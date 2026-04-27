/**
 * LES Ecology Center - Event Dashboard Google Apps Script
 *
 * This script provides server-side functionality for syncing event data
 * between Google Sheets and the Event Workflow Dashboard.
 *
 * Deployment: Deploy as a web app accessible to anyone with the link
 */

// Configuration
const TRACKER_SHEET_ID = '1EKZHAAlNOPPQEgxDgR7IMBKXWY5aR3VEURl4crImsrY';
const SHEET_NAME = 'Sheet1';
const REPORTING_SHEET_ID = '1RqQl5Wx-DUhMDQwTk2APz0VulodV3FaS51Y9WGuYwAs';

/**
 * GET endpoint: Retrieve all events from the tracker sheet, or impact metrics
 */
function doGet(e) {
  if (e && e.parameter && e.parameter.action === 'getImpactMetrics') {
    const metrics = getImpactMetrics(e.parameter.month, e.parameter.year);
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

    // Parse each row into an event object
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // Skip empty rows
      if (!row[0]) continue;

      const event = parseEventRow(row, headers);
      if (event) {
        events.push(event);
      }
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
 * POST endpoint: Handle task creation and updates
 * Expects JSON body with task data
 */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = e.parameter.action;

    if (action === 'createTasks') {
      return handleCreateTasks(payload);
    }

    const { eventName, taskField, value } = payload;

    if (!eventName || !taskField) {
      throw new Error('Missing required fields: eventName, taskField');
    }

    const spreadsheet = SpreadsheetApp.openById(TRACKER_SHEET_ID);
    const sheet = spreadsheet.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // Find the event row
    let eventRow = -1;
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === eventName) {
        eventRow = i;
        break;
      }
    }

    if (eventRow === -1) {
      throw new Error(`Event "${eventName}" not found`);
    }

    // Find the task column
    let taskCol = -1;
    for (let j = 0; j < headers.length; j++) {
      if (headers[j] === taskField) {
        taskCol = j;
        break;
      }
    }

    if (taskCol === -1) {
      throw new Error(`Task field "${taskField}" not found`);
    }

    // Update the cell (converting to 1-based indexing for Sheets)
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
 * Create tasks in Google Chat space via webhook
 */
function handleCreateTasks(tasks) {
  try {
    const webhookUrl = 'https://chat.googleapis.com/v1/spaces/AAQA3PJhlEI/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=mfmdhcbvCzpDA2kXs6oAS2rVM98x4HpdaT0wBxLXU5M';
    let createdCount = 0;

    for (const task of tasks) {
      const message = {
        text: `📋 Task: ${task.title}\nDue: ${task.due}\n${task.notes}\n\nAssigned to: ${task.owner}`
      };

      const options = {
        method: 'post',
        payload: JSON.stringify(message),
        contentType: 'application/json',
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(webhookUrl, options);
      if (response.getResponseCode() === 200) {
        createdCount++;
      }
    }

    return HtmlService.createHtmlOutput(JSON.stringify({
      success: true,
      message: `Created ${createdCount} tasks in Chat space`
    })).setMimeType(MimeType.JSON);

  } catch (error) {
    return HtmlService.createHtmlOutput(JSON.stringify({
      success: false,
      error: error.toString()
    })).setMimeType(MimeType.JSON);
  }
}

/**
 * Get impact metrics from the reporting spreadsheet, filtered by month/year
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
      const participantsIdx = workHeaders.indexOf('Number of Participants');
      const workHoursIdx = workHeaders.indexOf('Length of Activity/Events (in hours)');

      for (let i = 1; i < workData.length; i++) {
        const row = workData[i];
        if (!rowMatchesMonthYear(row[dateIdx], month, year)) continue;
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
 * Parse a sheet row into an event object
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

    // Setup phase
    brief: normalizeValue(getColumn('Event Brief Created')),
    eventbrite: normalizeValue(getColumn('EventBrite Created')),
    calendar: normalizeValue(getColumn('LES Calendar Event Created')),
    comms: normalizeValue(getColumn('Comms Form Submitted')),

    // Execution phase
    compost: normalizeValue(getColumn('Order Placed on Compost Tracker')),
    opsCheckin: normalizeValue(getColumn('Compost Ops Check-In')),
    reminder: normalizeValue(getColumn('Reminder Email Sent')),

    // Completion phase
    report: normalizeValue(getColumn('Activity Report Completed')),
    treeMap: normalizeValue(getColumn('Tree Map Data Completed')),
    thankYou: normalizeValue(getColumn('Thank You Email Sent')),

    notes: getColumn('Notes') || ''
  };
}

/**
 * Normalize task values to Yes/No/N/A
 */
function normalizeValue(value) {
  if (!value) return 'No';
  const str = value.toString().trim().toUpperCase();
  if (str === 'YES' || str === 'TRUE' || str === 'Y') return 'Yes';
  if (str === 'NO' || str === 'FALSE' || str === 'N') return 'No';
  if (str === 'N/A') return 'N/A';
  return 'No';
}

/**
 * Simple hash function for generating unique IDs
 */
function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Test function to verify the script works
 */
function testGetEvents() {
  const response = doGet({});
  const content = response.getContent();
  Logger.log(content);
}
