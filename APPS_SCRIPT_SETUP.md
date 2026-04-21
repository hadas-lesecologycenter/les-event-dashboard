# Google Apps Script Setup Guide

This guide walks through deploying the Event Dashboard backend to Google Apps Script.

## Prerequisites

- Google account with access to your Event Tracker spreadsheet
- Permission to create Apps Scripts

## Step-by-Step Setup

### Step 1: Open Google Apps Script Console

1. Go to [script.google.com](https://script.google.com)
2. Click **"+ New project"**
3. Name it: `LES Event Dashboard API`
4. Click **Create**

### Step 2: Add the Backend Code

1. In the script editor, delete the default `myFunction` code
2. Copy the entire contents of `apps-script/Code.gs` from this repository
3. Paste into the Apps Script editor
4. Click **Save** (Ctrl+S or Cmd+S)

### Step 3: Verify Sheet Configuration

1. In `Code.gs`, find this line (near the top):
   ```javascript
   const TRACKER_SHEET_ID = '1EKZHAAlNOPPQEgxDgR7IMBKXWY5aR3VEURl4crImsrY';
   ```

2. Make sure this matches your Event Tracker sheet ID
   - To find your sheet ID:
     - Open your tracker sheet
     - The ID is in the URL: `docs.google.com/spreadsheets/d/`**`[ID HERE]`**`/edit`

3. Also verify the `SHEET_NAME`:
   ```javascript
   const SHEET_NAME = 'Sheet1'; // Change if different
   ```
   - If your sheet tab is named something else (e.g., "Events"), update this

### Step 4: Test the Code

1. In the script editor, click the **Run** button (play icon)
2. Select **testGetEvents** from the dropdown
3. Click **Run**
4. Check the **Execution log** at the bottom
5. You should see your events in JSON format

### Step 5: Deploy as Web App

1. Click **Deploy** (top right)
2. Click **"New deployment"** (if showing version selection)
3. Click the **Select type** gear icon
4. Choose **"Web app"**
5. Fill in:
   - **Description**: Event Dashboard API
   - **Execute as**: Your account
   - **Who has access**: Anyone with the link
6. Click **Deploy**
7. You'll get a warning about unverified app - click **Review permissions**
8. Select your account
9. Click **"Go to LES Event Dashboard API"** (unsafe warning is normal for development)
10. Copy the deployed URL

### Step 6: Use the API

Your API is now live at the deployment URL. You can test it:

**Get all events** (GET request):
```
[DEPLOYMENT_URL]
```

Response:
```json
{
  "success": true,
  "count": 15,
  "events": [
    {
      "id": 12345,
      "name": "Spring into Tree Care",
      "owner": "Maddy",
      "date": "2026-03-22",
      ...
    }
  ],
  "lastSync": "2026-04-21T15:30:00.000Z"
}
```

**Update a task** (POST request):
```
[DEPLOYMENT_URL]
```

Body:
```json
{
  "eventName": "Spring into Tree Care",
  "taskField": "Reminder Email Sent",
  "value": "Yes"
}
```

### Step 7: Connect Dashboard

To connect the dashboard to this API:

1. In `index.html`, find the `loadEvents()` function
2. Replace the sample data loading with an API call:

```javascript
async function loadEvents() {
  try {
    const response = await fetch('[YOUR_DEPLOYMENT_URL]');
    const data = await response.json();
    events = data.events.map(e => ({
      ...e,
      date: new Date(e.date)
    }));
  } catch (error) {
    console.error('Failed to load events:', error);
    events = getSampleData(); // Fallback
  }
}
```

3. Similarly, update the `handleTaskToggle` function to POST changes:

```javascript
function handleTaskToggle(e) {
  const eventId = parseInt(e.target.dataset.eventId);
  const taskKey = e.target.dataset.taskKey;
  const isChecked = e.target.checked;

  const event = events.find(e => e.id === eventId);
  if (event) {
    event[taskKey] = isChecked ? 'Yes' : 'No';

    // Sync to Google Sheets
    fetch('[YOUR_DEPLOYMENT_URL]', {
      method: 'POST',
      body: JSON.stringify({
        eventName: event.name,
        taskField: getTaskFieldName(taskKey),
        value: event[taskKey]
      })
    }).catch(console.error);

    applyFilters();
  }
}
```

## Troubleshooting

### "Sheet not found"
- Check `SHEET_NAME` matches your sheet tab exactly
- Sheet names are case-sensitive

### No events returned
- Verify `TRACKER_SHEET_ID` is correct
- Make sure your sheet has headers in the first row
- Check the column names match exactly

### Deployment URL doesn't work
- Go to **Deploy** > **Manage deployments**
- Check that the latest version is deployed
- Look for any error messages in execution logs

### Permission errors
- Reauthorize the script when deploying
- Make sure you're signed in to the correct Google account
- Grant the script access to Sheets and Drive

## Updating the Script

If you make changes to `Code.gs`:

1. Edit the code in the script editor
2. Click **Save**
3. Click **Deploy** > **Manage deployments**
4. Click the trash icon next to the current version
5. Click **"New deployment"** and follow step 5 above
6. Update the URL in your dashboard

## API Reference

### GET Events
```
GET [DEPLOYMENT_URL]
```

Returns all events from the sheet in JSON format.

**Response**: Array of event objects

### POST Update Task
```
POST [DEPLOYMENT_URL]
Content-Type: application/json

{
  "eventName": "Event Name",
  "taskField": "Column Header Name",
  "value": "Yes" | "No" | "N/A"
}
```

**Response**: Success message with timestamp

---

That's it! Your Event Dashboard API is now connected to Google Sheets.
