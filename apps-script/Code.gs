/**
 * LES Ecology Center - Event Dashboard Google Apps Script
 *
 * Deployment: Deploy as a web app accessible to anyone with the link
 */

const TRACKER_SHEET_ID = '1EKZHAAlNOPPQEgxDgR7IMBKXWY5aR3VEURl4crImsrY';
const SHEET_NAME = 'Sheet1';
const REPORTING_SHEET_ID = '1RqQl5Wx-DUhMDQwTk2APz0VulodV3FaS51Y9WGuYwAs';

/**
 * GET endpoint: Retrieve all events, impact metrics, or per-event metrics
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getImpactMetrics') {
    const metrics = getImpactMetrics(e.parameter.month, e.parameter.year);
    return HtmlService.createHtmlOutput(JSON.stringify(metrics)).setMimeType(MimeType.JSON);
  }

  if (e && e.parameter && e.parameter.action === 'getEventMetrics') {
    const metrics = getEventMetrics(e.parameter.eventName, e.parameter.eventType);
    return HtmlService.createHtmlOutput(JSON.stringify(metrics)).setMimeType(MimeType.JSON);
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(TRACKER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return HtmlService.createHtmlOutput(JSON.stringify({
        error: `Sheet "${SHEET_NAME}" not found`
      })).setMimeType(MimeType.JSON);
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const events = [];

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue;
      const event = parseEventRow(row, headers);
      if (event) events.push(event);
    }

    return HtmlService.createHtmlOutput(JSON.stringify({
      success: true,
      count: events.length,
      events: events,
      lastSync: new Date().toISOString()
    })).setMimeType(MimeType.JSON);

  } catch (error) {
    return HtmlService.createHtmlOutput(JSON.stringify({
      error: error.toString()
    })).setMimeType(MimeType.JSON);
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

    return HtmlService.createHtmlOutput(JSON.stringify({
      success: true,
      message: `Updated ${taskField} for ${eventName}`,
      timestamp: new Date().toISOString()
    })).setMimeType(MimeType.JSON);

  } catch (error) {
    return HtmlService.createHtmlOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(MimeType.JSON);
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

    return HtmlService.createHtmlOutput(JSON.stringify({
      success: true,
      message: `Metrics saved for ${eventName}`,
      timestamp: new Date().toISOString()
    })).setMimeType(MimeType.JSON);

  } catch (error) {
    return HtmlService.createHtmlOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(MimeType.JSON);
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

    // Find event row or create new one
    let eventRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === event.name) {
        eventRow = i;
        break;
      }
    }

    // If event doesn't exist, append it
    if (eventRow === -1) {
      const newRow = [
        event.name,
        event.owner || '',
        event.date || '',
        event.time || '',
        event.location || '',
        event.category || '',
        event.type || '',
        '' // Collaboration
      ];

      // Pad with empty cells to match header count
      while (newRow.length < headers.length) {
        newRow.push('');
      }

      sheet.appendRow(newRow);
      return HtmlService.createHtmlOutput(JSON.stringify({
        success: true,
        message: `Event "${event.name}" created in sheet`,
        timestamp: new Date().toISOString()
      })).setMimeType(MimeType.JSON);
    } else {
      // Update existing event
      const eventRange = sheet.getRange(eventRow + 1, 1, 1, 8);
      eventRange.setValues([[
        event.name,
        event.owner || '',
        event.date || '',
        event.time || '',
        event.location || '',
        event.category || '',
        event.type || '',
        '' // Collaboration
      ]]);

      return HtmlService.createHtmlOutput(JSON.stringify({
        success: true,
        message: `Event "${event.name}" updated in sheet`,
        timestamp: new Date().toISOString()
      })).setMimeType(MimeType.JSON);
    }

  } catch (error) {
    return HtmlService.createHtmlOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(MimeType.JSON);
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

    return HtmlService.createHtmlOutput(JSON.stringify({
      success: true,
      message: `Created ${createdCount} tasks in Google Tasks`
    })).setMimeType(MimeType.JSON);

  } catch (error) {
    return HtmlService.createHtmlOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(MimeType.JSON);
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
  for (let i = 0; i < headers.length; i++) {
    if (String(headers[i]).toLowerCase().includes(searchTerm.toLowerCase())) return i;
  }
  return -1;
}

/**
 * Parse a tracker sheet row into an event object
 */
function parseEventRow(row, headers) {
  const getColumn = (name) => {
    const index = headers.indexOf(name);
    return index >= 0 ? row[index] : null;
  };

  const name = getColumn('Column 1');
  if (!name) return null;

  const dateStr = getColumn('Date');
  let date = null;
  if (dateStr) {
    date = dateStr instanceof Date ? dateStr : new Date(dateStr);
  }

  return {
    id: hashCode(name + (date ? date.toString() : '')),
    name: name,
    owner: getColumn('Owner') || 'Unassigned',
    date: date ? date.toISOString().split('T')[0] : null,
    time: getColumn('Time') || '',
    location: getColumn('Location') || '',
    category: getColumn('Event Category') || '',
    type: getColumn('Event Type') || '',
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
