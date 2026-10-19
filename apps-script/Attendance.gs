/**
 * LES Ecology Center - Registration vs. Attendance
 *
 * A separate Apps Script project from the main dashboard backend (Code.gs).
 * For each dashboard event it returns:
 *   - Attended: the headcount from the LESEC Activity Reporting form
 *   - Registered (events on Eventbrite only): Eventbrite registrations still
 *     attending (cancelled and refunded orders left out)
 * Both are matched to the event by date, then by words the names share.
 *
 * It only READS Eventbrite and the responses spreadsheet. It never writes.
 *
 * Setup: see ATTENDANCE_SETUP.md.
 */

const ACTIVITY_SHEET_ID = '1RqQl5Wx-DUhMDQwTk2APz0VulodV3FaS51Y9WGuYwAs';
const ACTIVITY_SHEET_NAME = 'Form Responses 1';
// Only report rows whose "Name of staff" mentions one of these count as
// Street Tree Care events.
const STC_STAFF = ['Maddy', 'Hadas', 'Gretel'];
// Eventbrite events and report rows this many days either side of an event
// are offered as choices when the automatic match is wrong.
const WINDOW_DAYS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_SECONDS = 600;

function doGet() {
  return json_({ ok: true, service: 'attendance' });
}

// Body: {"events": [{"id", "name", "date": "yyyy-MM-dd", "location", "type", "eventbrite": true|false}]}
// Events sent with "eventbrite": false are only matched to activity reports.
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(getAttendance(body.events || []));
  } catch (err) {
    return json_({ success: false, error: String(err && err.message || err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getAttendance(evs) {
  const onEventbrite = ev => ev.eventbrite !== false;
  const earliest = evs.filter(ev => onEventbrite(ev) && /^\d{4}-\d{2}-\d{2}$/.test(ev.date || '')).map(ev => ev.date).sort()[0];
  const since = earliest ? Utilities.formatDate(new Date(Date.parse(earliest) - WINDOW_DAYS * DAY_MS), 'UTC', 'yyyy-MM-dd') : '';
  const reports = readStcReports_();
  const ebEvents = since ? listEventbriteEvents_(since) : [];

  const ranked = evs.map(ev => {
    const kind = reportKindFor_(ev.type);
    return {
      ev: ev,
      eb: onEventbrite(ev) ? rank_(ev, ebEvents, item => item.name, () => true) : { candidates: [], autoKey: '', autoScore: 0, unsure: false },
      report: rank_(ev, reports, item => item.title + ' ' + item.place + ' ' + item.detail, item => !kind || item.kind === kind)
    };
  });
  resolveSharedMatches_(ranked.map(r => r.eb));
  resolveSharedMatches_(ranked.map(r => r.report));
  const ebIds = {};
  ranked.forEach(r => r.eb.candidates.forEach(c => { ebIds[c.key] = true; }));
  const regs = fetchRegistrations_(Object.keys(ebIds));

  return {
    success: true,
    fetchedAt: new Date().toISOString(),
    events: ranked.map(r => ({
      id: r.ev.id,
      eventbrite: {
        candidates: r.eb.candidates.map(c => Object.assign({}, c, { registered: regs[c.key] })),
        autoKey: r.eb.autoKey,
        unsure: r.eb.unsure
      },
      report: { candidates: r.report.candidates, autoKey: r.report.autoKey, unsure: r.report.unsure }
    }))
  };
}

// Volunteer events are reported as tree care, programs as workshops; other
// types (e.g. field trips) can be either.
function reportKindFor_(type) {
  const t = String(type || '').toUpperCase();
  if (t.indexOf('VOLUNTEER') >= 0) return 'Tree care';
  if (/PROGRAM|WORKSHOP|TABLING/.test(t)) return 'Workshop';
  return '';
}

// Items within WINDOW_DAYS of the event, closest date first, then most
// shared words. The automatic pick is a same-day item that `fits` (or, when
// none that day fits, one sharing words with the event), but only when it is
// the only one or clearly shares more words than the rest; otherwise
// "unsure" asks a person to pick.
function rank_(ev, items, textOf, fits) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ev.date || '')) return { candidates: [], autoKey: '', autoScore: 0, unsure: false };
  const evT = Date.parse(ev.date);
  const evWords = wordSet_(ev.name + ' ' + (ev.location || ''));
  const scored = [];
  items.forEach(item => {
    const diff = Math.round(Math.abs(Date.parse(item.date) - evT) / DAY_MS);
    if (diff > WINDOW_DAYS) return;
    const score = Object.keys(wordSet_(textOf(item))).filter(w => evWords[w]).length;
    scored.push({ item: item, diff: diff, score: score });
  });
  scored.sort((a, b) => a.diff - b.diff || b.score - a.score);
  const sameDay = scored.filter(s => s.diff === 0);
  const fitting = sameDay.filter(s => fits(s.item));
  const pool = fitting.length ? fitting : sameDay.filter(s => s.score > 0);
  const clear = pool.length === 1 || (pool.length > 1 && pool[0].score > pool[1].score);
  return {
    candidates: scored.map(s => s.item),
    autoKey: clear ? pool[0].item.key : '',
    autoScore: clear ? pool[0].score : 0,
    unsure: pool.length > 1 && !clear
  };
}

// Two events on the same day can both pick the one Eventbrite event or
// report that day. The one sharing more words keeps it; on a tie neither
// does and both ask a person to pick.
function resolveSharedMatches_(matches) {
  const byKey = {};
  matches.forEach(m => { if (m.autoKey) (byKey[m.autoKey] = byKey[m.autoKey] || []).push(m); });
  Object.keys(byKey).forEach(key => {
    const claims = byKey[key].sort((a, b) => b.autoScore - a.autoScore);
    if (claims.length < 2) return;
    const tie = claims[0].autoScore === claims[1].autoScore;
    claims.forEach((m, i) => {
      if (i === 0 && !tie) return;
      m.autoKey = '';
      m.unsure = tie;
    });
  });
}

// Words found in nearly every name don't help tell events apart.
const STOP_WORDS = { the: 1, and: 1, with: 1, for: 1, between: 1, street: 1, ave: 1, avenue: 1, new: 1, york: 1,
                     tree: 1, trees: 1, care: 1, stc: 1, event: 1, les: 1, lesec: 1 };
function wordSet_(s) {
  const set = {};
  String(s || '').toLowerCase().split(/[^a-z0-9]+/).forEach(w => {
    if (w.length >= 3 && !STOP_WORDS[w]) set[w] = 1;
  });
  return set;
}

// ---------- Activity report ----------

// Street Tree Care rows: workshops/outreach and tree care volunteer events
// run by STC_STAFF. Read-only.
function readStcReports_() {
  const ss = SpreadsheetApp.openById(ACTIVITY_SHEET_ID);
  const tz = ss.getSpreadsheetTimeZone();
  const values = ss.getSheetByName(ACTIVITY_SHEET_NAME).getDataRange().getValues();
  const head = values[0].map(h => String(h).trim());
  // Some headers repeat ("Notes", "Number of Participants"); the first match is the one we want.
  const col = (name, prefix) => {
    const i = head.findIndex(h => prefix ? h.indexOf(name) === 0 : h === name);
    if (i < 0) throw new Error('Activity report column not found: ' + name);
    return i;
  };
  const C = {
    ts: col('Timestamp'), staff: col('Name of staff carrying out activity'), type: col('Type of Activity'),
    wDate: col('Date of Activity'), wType: col('Type of Workshop'), wTitle: col('Workshop/Event Title'), wPlace: col('Workshop/Event Location'),
    wCount: col('Number of Participants'),
    vDate: col('Date of activity'), vType: col('Type of Volunteer Activity'), vCount: col('Number of tree care volunteers'),
    vPlace: col('Event Location', true), vGroup: col('Volunteer Group Name (if applicable)')
  };
  const staffRe = new RegExp(STC_STAFF.join('|'), 'i');
  const day = d => {
    if (d && !(d instanceof Date)) d = new Date(d);
    return d instanceof Date && !isNaN(d) ? Utilities.formatDate(d, tz, 'yyyy-MM-dd') : '';
  };
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const v = values[r];
    if (!staffRe.test(String(v[C.staff]))) continue;
    let row;
    if (v[C.type] === 'Workshop/Outreach') {
      row = { date: day(v[C.wDate]), title: v[C.wTitle], place: v[C.wPlace], detail: v[C.wType], count: v[C.wCount], kind: 'Workshop' };
    } else if (v[C.type] === 'Volunteer Activities' && v[C.vType] === 'Tree Care') {
      row = { date: day(v[C.vDate]), title: v[C.vGroup] ? 'Tree care: ' + v[C.vGroup] : 'Tree care',
              place: v[C.vPlace], detail: '', count: v[C.vCount], kind: 'Tree care' };
    } else {
      continue;
    }
    if (!row.date) continue;
    row.key = v[C.ts] instanceof Date ? String(v[C.ts].getTime()) : 'row' + (r + 1);
    row.title = String(row.title || '').trim();
    row.place = String(row.place || '').trim();
    row.detail = String(row.detail || '').trim();
    row.count = row.count === '' || row.count === null || isNaN(Number(row.count)) ? null : Number(row.count);
    out.push(row);
  }
  return out;
}

// ---------- Eventbrite ----------

function ebToken_() {
  const token = PropertiesService.getScriptProperties().getProperty('EVENTBRITE_TOKEN');
  if (!token) throw new Error('EVENTBRITE_TOKEN is not set in Script Properties');
  return token;
}

function ebGet_(url) {
  const resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ebToken_() }, muteHttpExceptions: true });
  let data = {};
  try { data = JSON.parse(resp.getContentText()); } catch (e) {}
  if (resp.getResponseCode() !== 200) {
    throw new Error('Eventbrite ' + resp.getResponseCode() + ': ' + (data.error_description || resp.getContentText().slice(0, 200)));
  }
  return data;
}

// The organization ID used in API URLs is not the organizer profile number;
// ask Eventbrite once and remember it (set EVENTBRITE_ORGANIZATION_ID in
// Script Properties by hand to override).
function ebOrgId_() {
  const props = PropertiesService.getScriptProperties();
  let id = props.getProperty('EVENTBRITE_ORGANIZATION_ID');
  if (id) return id;
  const orgs = ebGet_('https://www.eventbriteapi.com/v3/users/me/organizations/').organizations || [];
  if (!orgs.length) throw new Error('This Eventbrite token has no organization');
  id = orgs[0].id;
  props.setProperty('EVENTBRITE_ORGANIZATION_ID', id);
  return id;
}

// Published Eventbrite events starting on or after `since` (yyyy-MM-dd).
function listEventbriteEvents_(since) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'eb-events-' + since;
  const hit = cache.get(cacheKey);
  if (hit) return JSON.parse(hit);

  const out = [];
  let continuation = '';
  for (let page = 0; page < 20; page++) {
    const data = ebGet_('https://www.eventbriteapi.com/v3/organizations/' + ebOrgId_() +
      '/events/?status=all&order_by=start_desc' + (continuation ? '&continuation=' + encodeURIComponent(continuation) : ''));
    let reachedOlder = false;
    (data.events || []).forEach(ev => {
      const date = String(ev.start && ev.start.local || '').slice(0, 10);
      if (date < since) { reachedOlder = true; return; }
      if (ev.status === 'canceled' || ev.status === 'draft') return;
      out.push({ key: ev.id, name: ev.name && ev.name.text || '', date: date, url: ev.url });
    });
    if (reachedOlder || !data.pagination || !data.pagination.has_more_items) break;
    continuation = data.pagination.continuation;
  }
  try { cache.put(cacheKey, JSON.stringify(out), CACHE_SECONDS); } catch (e) {}
  return out;
}

// Number of attendees still attending, per Eventbrite event ID.
function fetchRegistrations_(ids) {
  const cache = CacheService.getScriptCache();
  const out = {};
  const missing = [];
  ids.forEach(id => {
    const hit = cache.get('eb-reg-' + id);
    if (hit !== null) out[id] = Number(hit);
    else missing.push(id);
  });
  if (!missing.length) return out;
  const token = ebToken_();
  const resps = UrlFetchApp.fetchAll(missing.map(id => ({
    url: 'https://www.eventbriteapi.com/v3/events/' + id + '/attendees/?status=attending',
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  })));
  resps.forEach((resp, i) => {
    let data = {};
    try { data = JSON.parse(resp.getContentText()); } catch (e) {}
    if (resp.getResponseCode() === 200 && data.pagination) {
      out[missing[i]] = data.pagination.object_count;
      cache.put('eb-reg-' + missing[i], String(data.pagination.object_count), CACHE_SECONDS);
    } else {
      out[missing[i]] = null;
    }
  });
  return out;
}

// ---------- Check from the editor ----------

// Run from the Apps Script editor: logs what the dashboard would show for
// the 2026 events of the main dashboard's tracker sheet that already
// happened (Eventbrite only for those marked "EventBrite Created" = Yes).
function testAttendance() {
  const sheet = SpreadsheetApp.openById('1EKZHAAlNOPPQEgxDgR7IMBKXWY5aR3VEURl4crImsrY').getSheetByName('2026');
  const values = sheet.getDataRange().getValues();
  const head = values[0].map(h => String(h).trim());
  const iName = head.indexOf('Event Name'), iDate = head.indexOf('Date'), iEb = head.indexOf('EventBrite Created'),
        iLoc = head.indexOf('Location'), iType = head.indexOf('Event Type'), iStatus = head.indexOf('Status');
  const today = Utilities.formatDate(new Date(), 'America/New_York', 'yyyy-MM-dd');
  const evs = values.slice(1)
    .filter(r => r[iDate] instanceof Date && !/^cancel/i.test(String(r[iStatus]).trim()))
    .map((r, i) => ({ id: i, name: String(r[iName]), location: String(r[iLoc] || ''), type: String(r[iType] || ''),
                      eventbrite: String(r[iEb]).trim().toLowerCase() === 'yes',
                      date: Utilities.formatDate(r[iDate], 'America/New_York', 'yyyy-MM-dd') }))
    .filter(ev => ev.date <= today);
  const res = getAttendance(evs);
  res.events.forEach((r, i) => {
    const eb = r.eventbrite.candidates.filter(c => c.key === r.eventbrite.autoKey)[0];
    const rep = r.report.candidates.filter(c => c.key === r.report.autoKey)[0];
    Logger.log(evs[i].date + ' ' + evs[i].name +
      ' | Eventbrite: ' + (!evs[i].eventbrite ? '–' : eb ? '"' + eb.name + '" registered ' + eb.registered : (r.eventbrite.unsure ? 'several that day, pick one' : 'no match')) +
      ' | Report: ' + (rep ? '"' + rep.title + '" attended ' + rep.count : (r.report.unsure ? 'several that day, pick one' : 'no match')));
  });
}
