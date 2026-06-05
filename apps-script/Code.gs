/**
 * LES Ecology Center - Event Dashboard Google Apps Script
 *
 * Deployment: Deploy as a web app accessible to anyone with the link
 */

const TRACKER_SHEET_ID = '1EKZHAAlNOPPQEgxDgR7IMBKXWY5aR3VEURl4crImsrY';
const SHEET_NAME = '2026';
const REPORTING_SHEET_ID = '1RqQl5Wx-DUhMDQwTk2APz0VulodV3FaS51Y9WGuYwAs';

/**
 * GET endpoint: Retrieve all events, impact metrics, or per-event metrics
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getImpactMetrics') {
    const metrics = getImpactMetrics(e.parameter.month, e.parameter.year);
    return ContentService.createTextOutput(JSON.stringify(metrics)).setMimeType(ContentService.MimeType.JSON);
  }

  if (e && e.parameter && e.parameter.action === 'getEventMetrics') {
    const metrics = getEventMetrics(e.parameter.eventName, e.parameter.eventType);
    return ContentService.createTextOutput(JSON.stringify(metrics)).setMimeType(ContentService.MimeType.JSON);
  }

  if (e && e.parameter && e.parameter.action === 'syncEvent') {
    const event = JSON.parse(e.parameter.data || '{}');
    return handleSyncEvent({ event });
  }

  if (e && e.parameter && e.parameter.action === 'syncBrief') {
    const brief = JSON.parse(e.parameter.data || '{}');
    return handleSyncBrief({ brief });
  }

  if (e && e.parameter && e.parameter.action === 'deleteEvent') {
    const name = e.parameter.name || '';
    return handleDeleteEvent(name);
  }

  if (e && e.parameter && e.parameter.action === 'createEventbriteEvent') {
    const data = JSON.parse(e.parameter.data || '{}');
    return handleCreateEventbriteEvent(data);
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(TRACKER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        error: `Sheet "${SHEET_NAME}" not found`
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const tz = spreadsheet.getSpreadsheetTimeZone();
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const events = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      const event = parseEventRow(row, headers, tz);
      if (event) events.push(event);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      count: events.length,
      events: events,
      lastSync: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST endpoint: Handle task updates, task creation to Chat, and metrics saving
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = e.parameter.action;

    if (action === 'createTasks') {
      return handleCreateTasks(payload);
    }

    if (action === 'saveMetrics') {
      return handleSaveMetrics(payload);
    }

    if (action === 'syncEvent') {
      return handleSyncEvent(payload);
    }

    if (action === 'createEventbriteEvent') {
      return handleCreateEventbriteEvent(payload);
    }

    const { eventName, taskField, value } = payload;

    if (!eventName || !taskField) {
      throw new Error('Missing required fields: eventName, taskField');
    }

    const spreadsheet = SpreadsheetApp.openById(TRACKER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    let eventRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventName) {
        eventRow = i;
        break;
      }
    }

    if (eventRow === -1) throw new Error(`Event "${eventName}" not found`);

    let taskCol = -1;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === taskField) {
        taskCol = j;
        break;
      }
    }

    if (taskCol === -1) throw new Error(`Task field "${taskField}" not found`);

    sheet.getRange(eventRow + 1, taskCol + 1).setValue(value);

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Updated ${taskField} for ${eventName}`,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Read per-event metrics from the reporting spreadsheet (form responses)
 */
function getEventMetrics(eventName, eventType) {
  try {
    if (!eventName) return { error: 'eventName required' };

    const spreadsheet = SpreadsheetApp.openById(REPORTING_SHEET_ID);
    const normalizedType = String(eventType || '').toUpperCase().replace(/\s+/g, '_');

    let sheetName = '';
    if (['FIELD_TRIP', 'PUBLIC_VOLUNTEER_EVENT', 'PRIVATE_VOLUNTEER_EVENT'].includes(normalizedType)) {
      sheetName = 'Volunteer Activities';
    } else if (['PUBLIC_PROGRAM', 'TABLING', 'WORKSHOP'].includes(normalizedType)) {
      sheetName = 'Workshop/Outreach';
    }

    // If type unknown, search both sheets
    const sheetsToSearch = sheetName ? [sheetName] : ['Volunteer Activities', 'Workshop/Outreach'];

    for (const name of sheetsToSearch) {
      const sheet = spreadsheet.getSheetByName(name);
      if (!sheet) continue;

      const data = sheet.getDataRange().getValues();
      const headers = data[0];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const titleIdx = findColumnIndex(headers, 'Workshop/Event Title');
        if (titleIdx === -1) continue;
        const rowTitle = String(row[titleIdx] || '').toLowerCase().trim();
        if (!rowTitle.includes(eventName.toLowerCase().trim())) continue;

        if (name === 'Volunteer Activities') {
          return {
            volunteers: Number(row[findColumnIndex(headers, 'Number of tree care volunteers')]) || 0,
            trees: Number(row[findColumnIndex(headers, 'Number of trees cared for')]) || 0,
            hours: Number(row[findColumnIndex(headers, 'Length of tree care event in hours')]) || 0,
            compost: Number(row[findColumnIndex(headers, 'Compost collected (lbs)')]) || 0,
            source: 'reporting_sheet'
          };
        } else {
          return {
            participants: Number(row[headers.indexOf('Number of Participants')]) || 0,
            hours: Number(row[headers.indexOf('Length of Activity/Events (in hours)')]) || 0,
            source: 'reporting_sheet'
          };
        }
      }
    }

    return { notFound: true };

  } catch (error) {
    Logger.log('Error in getEventMetrics: ' + error);
    return { error: error.toString() };
  }
}

/**
 * Save manually entered metrics to the reporting spreadsheet
 */
function handleSaveMetrics(metricsData) {
  try {
    const { eventName, eventDate, eventType, metrics, owner } = metricsData;

    if (!eventName || !eventDate || !eventType || !metrics) {
      throw new Error('Missing required fields');
    }

    const spreadsheet = SpreadsheetApp.openById(REPORTING_SHEET_ID);
    const normalizedType = String(eventType).toUpperCase().replace(/\s+/g, '_');
    let sheetName = '';

    if (['FIELD_TRIP', 'PUBLIC_VOLUNTEER_EVENT', 'PRIVATE_VOLUNTEER_EVENT'].includes(normalizedType)) {
      sheetName = 'Volunteer Activities';
    } else if (['PUBLIC_PROGRAM', 'TABLING', 'WORKSHOP'].includes(normalizedType)) {
      sheetName = 'Workshop/Outreach';
    }

    if (!sheetName) throw new Error(`Unknown event type: ${eventType}`);

    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Sheet "${sheetName}" not found in reporting spreadsheet`);

    const headerRow = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    const allData = sheet.getDataRange().getValues();
    let eventRow = -1;
    for (let i = 1; i < allData.length; i++) {
      if (String(allData[i][0]).toLowerCase().includes(eventName.toLowerCase())) {
        eventRow = i;
        break;
      }
    }

    if (eventRow === -1) {
      const emptyRow = new Array(sheet.getLastColumn()).fill('');
      sheet.appendRow(emptyRow);
      eventRow = sheet.getLastRow() - 1;
    }

    const metricsMapping = {
      'Volunteer Activities': {
        'Date': eventDate,
        'Workshop/Event Title': eventName,
        'Number of tree care volunteers': metrics.volunteers || 0,
        'Number of trees cared for': metrics.trees || 0,
        'Length of tree care event in hours': metrics.hours || 0,
        'Compost collected (lbs)': metrics.compost || 0
      },
      'Workshop/Outreach': {
        'Date': eventDate,
        'Workshop/Event Title': eventName,
        'Number of Participants': metrics.participants || 0,
        'Length of Activity/Events (in hours)': metrics.hours || 0
      }
    };

    const rowMapping = metricsMapping[sheetName];
    for (const [columnName, value] of Object.entries(rowMapping)) {
      const colIndex = headerRow.indexOf(columnName);
      if (colIndex !== -1) {
        sheet.getRange(eventRow + 1, colIndex + 1).setValue(value);
      }
    }

    if (owner) {
      const ownerColIndex = headerRow.findIndex(h =>
        String(h).toLowerCase().includes('owner') || String(h).toLowerCase().includes('name')
      );
      if (ownerColIndex !== -1) {
        sheet.getRange(eventRow + 1, ownerColIndex + 1).setValue(owner);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Metrics saved for ${eventName}`,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Sync event from dashboard to spreadsheet
 */
function handleSyncEvent(eventData) {
  try {
    const { event } = eventData;

    if (!event || !event.name) {
      throw new Error('Missing event name');
    }

    const spreadsheet = SpreadsheetApp.openById(TRACKER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find event row — prefer ID match, fall back to name match
    const idColIdx = findColumnIndex(headers, 'Event ID');
    let eventRow = -1;
    if (idColIdx !== -1 && event.id) {
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][idColIdx]) === String(event.id)) { eventRow = i; break; }
      }
    }
    if (eventRow === -1) {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === event.name) { eventRow = i; break; }
      }
    }

    // If event doesn't exist, append it
    if (eventRow === -1) {
      const newRow = new Array(headers.length).fill('');
      const basicMap = {
        'Event ID': event.id || '',
        'Column 1': event.name,
        'Owner': event.owner || '',
        'Date': event.date || '',
        'Time': event.time || '',
        'End Time': event.endTime || '',
        'Location': event.location || '',
        'Event Category': event.category || '',
        'Event Type': event.type || '',
        'Status': event.status || 'Planning'
      };
      const taskMap = {
        'Event Brief Created': event.brief || 'No',
        'EventBrite Created': event.eventbrite || 'No',
        'LES Calendar Event Created': event.calendar || 'No',
        'Comms Form Submitted': event.comms || 'No',
        'Order Placed on Compost Tracker': event.compost || 'No',
        'Compost Ops Check-In': event.opsCheckin || 'No',
        'Reminder Email Sent': event.reminder || 'No',
        'Activity Report Completed': event.report || 'No',
        'Tree Map Data Completed': event.treeMap || 'No',
        'Thank You Email Sent': event.thankYou || 'No'
      };
      Object.entries({ ...basicMap, ...taskMap }).forEach(([col, val]) => {
        const idx = findColumnIndex(headers, col);
        if (idx !== -1) newRow[idx] = val;
      });

      // Insert in date order
      const dateColIdx = findColumnIndex(headers, 'Date');
      const newDate = event.date ? new Date(event.date) : new Date('9999-12-31');
      let insertBefore = -1;
      for (let i = 1; i < data.length; i++) {
        if (!data[i][0]) continue;
        const rowDate = data[i][dateColIdx] ? new Date(data[i][dateColIdx]) : new Date('9999-12-31');
        if (!isNaN(rowDate) && newDate < rowDate) { insertBefore = i + 1; break; }
      }
      if (insertBefore === -1) {
        sheet.getRange(data.length + 1, 1, 1, newRow.length).setValues([newRow]);
      } else {
        sheet.insertRowBefore(insertBefore);
        sheet.getRange(insertBefore, 1, 1, newRow.length).setValues([newRow]);
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Event "${event.name}" created in sheet`,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    } else {
      // Update basic event fields
      const basicMap = {
        'Event ID': event.id || '',
        'Column 1': event.name,
        'Owner': event.owner || '',
        'Date': event.date || '',
        'Time': event.time || '',
        'End Time': event.endTime || '',
        'Location': event.location || '',
        'Event Category': event.category || '',
        'Event Type': event.type || '',
        'Status': event.status || 'Planning'
      };
      Object.entries(basicMap).forEach(([colName, value]) => {
        const colIdx = findColumnIndex(headers, colName);
        if (colIdx !== -1) sheet.getRange(eventRow + 1, colIdx + 1).setValue(value);
      });

      // Update task fields by column name
      const taskMap = {
        'Event Brief Created': event.brief,
        'EventBrite Created': event.eventbrite,
        'LES Calendar Event Created': event.calendar,
        'Comms Form Submitted': event.comms,
        'Order Placed on Compost Tracker': event.compost,
        'Compost Ops Check-In': event.opsCheckin,
        'Reminder Email Sent': event.reminder,
        'Activity Report Completed': event.report,
        'Tree Map Data Completed': event.treeMap,
        'Thank You Email Sent': event.thankYou
      };
      Object.entries(taskMap).forEach(([colName, value]) => {
        if (value === undefined) return;
        const colIdx = findColumnIndex(headers, colName);
        if (colIdx !== -1) sheet.getRange(eventRow + 1, colIdx + 1).setValue(value);
      });

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: `Event "${event.name}" updated in sheet`,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Create a draft Eventbrite event from event + brief data
 */
function handleCreateEventbriteEvent(data) {
  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('EVENTBRITE_API_KEY');
    const orgId = PropertiesService.getScriptProperties().getProperty('EVENTBRITE_ORG_ID') || '13297911311';

    if (!apiKey) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'EVENTBRITE_API_KEY not set. Add it in Apps Script → Project Settings → Script Properties.'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    const { event, brief } = data;
    const description = (brief && brief.description) || event.notes || '';

    const payload = {
      event: {
        name: { text: event.name },
        description: { text: description },
        start: { timezone: 'America/New_York', utc: event.startUtc },
        end: { timezone: 'America/New_York', utc: event.endUtc },
        currency: 'USD',
        status: 'draft',
        online_event: false
      }
    };

    if (event.location) {
      payload.event.location = {
        address: { address_1: event.location, region: 'New York', country_code: 'US' }
      };
    }

    const response = UrlFetchApp.fetch(
      'https://www.eventbriteapi.com/v3/organizations/' + orgId + '/events/',
      {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      }
    );

    const result = JSON.parse(response.getContentText());
    if (response.getResponseCode() !== 200) {
      throw new Error(result.error_description || result.detail || JSON.stringify(result));
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      eventId: result.id,
      eventUrl: 'https://www.eventbrite.com/e/' + result.id
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Delete an event row from the tracker sheet by name
 */
function handleDeleteEvent(name) {
  try {
    if (!name) throw new Error('Missing event name');
    const spreadsheet = SpreadsheetApp.openById(TRACKER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 1; i--) {
      if (String(data[i][0]).trim().toLowerCase() === name.trim().toLowerCase()) {
        sheet.deleteRow(i + 1);
        return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ success: true, note: 'row not found' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Sync event brief to dedicated Briefs sheet
 */
function handleSyncBrief(briefData) {
  try {
    const { brief } = briefData;

    if (!brief || !brief.eventName) {
      throw new Error('Missing event name in brief');
    }

    const spreadsheet = SpreadsheetApp.openById(TRACKER_SHEET_ID);
    let sheet = spreadsheet.getSheetByName('Briefs');

    // Create Briefs sheet if it doesn't exist
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Briefs');
      const headers = [
        'Event Name',
        'Event Lead',
        'Status',
        'Date Saved',
        'Brief Data',
        'Raw Brief'
      ];
      sheet.appendRow(headers);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find existing brief or create new one
    let briefRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === brief.eventName) {
        briefRow = i;
        break;
      }
    }

    const briefStatus = brief.eventbriefCompleted ? 'Completed' : 'Draft';
    const dateSaved = new Date().toISOString();
    const briefDataStr = JSON.stringify(brief.eventbriefDraft || {});

    if (briefRow === -1) {
      // Create new brief entry
      sheet.appendRow([
        brief.eventName,
        brief.eventLead || '',
        briefStatus,
        dateSaved,
        briefDataStr,
        briefDataStr
      ]);
    } else {
      // Update existing brief entry
      sheet.getRange(briefRow + 1, 1, 1, 6).setValues([[
        brief.eventName,
        brief.eventLead || '',
        briefStatus,
        dateSaved,
        briefDataStr,
        briefDataStr
      ]]);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Brief for "${brief.eventName}" saved to Briefs sheet`,
      timestamp: dateSaved
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Create tasks in Google Tasks
 */
function handleCreateTasks(tasks) {
  try {
    const taskList = TasksApp.getDefaultTaskList();
    let createdCount = 0;

    for (const task of tasks) {
      const dueDate = new Date(task.due);
      const newTask = taskList.addTask(task.title)
        .setNotes(`${task.notes}\n\nAssigned to: ${task.owner}`);
      if (!isNaN(dueDate)) {
        newTask.setDueDate(dueDate);
      }
      createdCount++;
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: `Created ${createdCount} tasks in Google Tasks`
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Get aggregate impact metrics from the reporting spreadsheet, filtered by month/year
 */
function getImpactMetrics(month, year) {
  try {
    const spreadsheet = SpreadsheetApp.openById(REPORTING_SHEET_ID);
    let totalVolunteers = 0, totalParticipants = 0, totalTrees = 0, totalHours = 0;

    const volSheet = spreadsheet.getSheetByName('Volunteer Activities');
    if (volSheet) {
      const volData = volSheet.getDataRange().getValues();
      const volHeaders = volData[0];
      const dateIdx = findColumnIndex(volHeaders, 'Date');
      const volVolunteersIdx = findColumnIndex(volHeaders, 'Number of tree care volunteers');
      const treesIdx = findColumnIndex(volHeaders, 'Number of trees cared for');
      const volHoursIdx = findColumnIndex(volHeaders, 'Length of tree care event in hours');

      for (let i = 1; i < volData.length; i++) {
        const row = volData[i];
        if (!rowMatchesMonthYear(row[dateIdx], month, year)) continue;
        if (!rowContainsTeamMember(row)) continue;
        totalVolunteers += Number(row[volVolunteersIdx]) || 0;
        totalTrees += Number(row[treesIdx]) || 0;
        totalHours += Number(row[volHoursIdx]) || 0;
      }
    }

    const workSheet = spreadsheet.getSheetByName('Workshop/Outreach');
    if (workSheet) {
      const workData = workSheet.getDataRange().getValues();
      const workHeaders = workData[0];
      const dateIdx = findColumnIndex(workHeaders, 'Date');
      const titleIdx = findColumnIndex(workHeaders, 'Workshop/Event Title');
      const participantsIdx = workHeaders.indexOf('Number of Participants');
      const workHoursIdx = workHeaders.indexOf('Length of Activity/Events (in hours)');

      for (let i = 1; i < workData.length; i++) {
        const row = workData[i];
        if (!rowMatchesMonthYear(row[dateIdx], month, year)) continue;
        if (!rowContainsTeamMember(row)) continue;
        const title = String(row[titleIdx] || '').toLowerCase();
        const isTreeRelated = title.includes('tree') || title.includes('stc') || title.includes('stewardship');
        if (!isTreeRelated) continue;
        totalParticipants += Number(row[participantsIdx]) || 0;
        totalHours += Number(row[workHoursIdx]) || 0;
      }
    }

    return { totalVolunteers, totalParticipants, totalTrees, totalHours: Math.round(totalHours) };

  } catch (error) {
    Logger.log('Error in getImpactMetrics: ' + error);
    return { error: error.toString() };
  }
}

function rowContainsTeamMember(row) {
  const team = ['maddy', 'hadas', 'gretel'];
  return row.some(cell => {
    const val = String(cell || '').toLowerCase();
    return team.some(name => val.includes(name));
  });
}

function rowMatchesMonthYear(dateVal, month, year) {
  if (!dateVal) return false;
  const d = new Date(dateVal);
  if (isNaN(d)) return false;
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const rowMonth = monthNames[d.getMonth()];
  const rowYear = String(d.getFullYear());
  const monthMatch = !month || month === 'All' || rowMonth === month;
  const yearMatch = !year || year === 'All' || rowYear === year;
  return monthMatch && yearMatch;
}

function findColumnIndex(headers, searchTerm) {
  const target = String(searchTerm).trim().toLowerCase();
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toLowerCase() === target) return i;
  }
  return -1;
}

/**
 * Parse a tracker sheet row into an event object
 */
function parseEventRow(row, headers, tz) {
  const getColumn = (name) => {
    const index = findColumnIndex(headers, name);
    return index >= 0 ? row[index] : null;
  };

  const name = getColumn('Column 1');
  if (!name) return null;

  const dateStr = getColumn('Date');
  let date = null;
  if (dateStr) {
    date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  }

  tz = tz || 'America/New_York';
  const dateStrOut = date ? Utilities.formatDate(date, tz, 'yyyy-MM-dd') : null;
  const storedId = getColumn('Event ID');
  return {
    id: storedId ? Number(storedId) : hashCode(name + (dateStrOut || '')),
    name: name,
    owner: getColumn('Owner') || 'Unassigned',
    date: dateStrOut,
    time: formatSheetTime(getColumn('Time')),
    endTime: formatSheetTime(getColumn('End Time')),
    location: getColumn('Location') || '',
    category: getColumn('Event Category') || '',
    type: getColumn('Event Type') || '',
    status: getColumn('Status') || '',
    collaboration: getColumn('Collaboration') || '',
    collaborationNotes: getColumn('Collaboration Notes/ General Notes') || '',

    brief: normalizeValue(getColumn('Event Brief Created')),
    eventbrite: normalizeValue(getColumn('EventBrite Created')),
    calendar: normalizeValue(getColumn('LES Calendar Event Created')),
    comms: normalizeValue(getColumn('Comms Form Submitted')),

    compost: normalizeValue(getColumn('Order Placed on Compost Tracker')),
    opsCheckin: normalizeValue(getColumn('Compost Ops Check-In')),
    reminder: normalizeValue(getColumn('Reminder Email Sent')),

    report: normalizeValue(getColumn('Activity Report Completed')),
    treeMap: normalizeValue(getColumn('Tree Map Data Completed')),
    thankYou: normalizeValue(getColumn('Thank You Email Sent')),

    notes: getColumn('Notes') || ''
  };
}

function normalizeValue(value) {
  if (!value) return 'No';
  const str = value.toString().trim().toUpperCase();
  if (str === 'YES' || str === 'TRUE' || str === 'Y') return 'Yes';
  if (str === 'NO' || str === 'FALSE' || str === 'N') return 'No';
  if (str === 'N/A') return 'N/A';
  return 'No';
}

function formatSheetTime(val) {
  if (!val) return '';
  // Google Sheets returns time cells as Date objects
  if (val instanceof Date) {
    let h = val.getHours(), m = val.getMinutes();
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${String(m).padStart(2, '0')} ${period}`;
  }
  // Plain string like "14:00" or "2:00:00 AM" — convert to 12-hour without seconds
  const str = String(val).trim();
  // Remove seconds if present (e.g., "2:00:00 AM" -> "2:00 AM")
  const withoutSeconds = str.replace(/:\d{2}(\s*(?:AM|PM))/i, '$1');
  if (/AM|PM/i.test(withoutSeconds)) return withoutSeconds;
  const match = str.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    let h = parseInt(match[1], 10), m = match[2];
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${h}:${m} ${period}`;
  }
  return str;
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function testGetEvents() {
  const response = doGet({});
  Logger.log(response.getContent());
}
