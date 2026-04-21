# Eventbrite Integration Guide

This guide explains how to integrate Eventbrite ticket sales into your Event Dashboard.

## Overview

The dashboard can pull event data from Eventbrite to:
- Auto-populate event details (date, time, location, description)
- Track ticket sales and attendee counts
- Link to event pages
- Sync attendee information

## Prerequisites

- Eventbrite account with organizer access
- Eventbrite API key
- Organization ID

## Your Current Setup

- **Organization ID**: `13297911311`
- **Eventbrite Account**: Connected via the LES Ecology Center account

## Getting Your API Key

1. Go to [Eventbrite Account Settings](https://www.eventbrite.com/account-settings/)
2. Click **Apps** in the left menu
3. Click **Create New App**
4. Fill in app details:
   - **App Name**: LES Event Dashboard
   - **App URL**: `[your-dashboard-url]`
   - **OAuth Redirect URI**: `[your-dashboard-url]` (or leave blank if not using OAuth)
5. Accept the terms and create
6. You'll receive an **API Key** and **OAuth Token**
7. Save these securely

## Dashboard Integration

To enable Eventbrite syncing in the dashboard:

### Option 1: Automatic Sync

Add this code to `index.html`:

```javascript
async function syncEventbriteEvents() {
  const apiKey = '[YOUR_EVENTBRITE_API_KEY]';
  const orgId = '13297911311';

  try {
    const response = await fetch(
      `https://www.eventbriteapi.com/v3/organizations/${orgId}/events/`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const data = await response.json();
    const ebEvents = data.events || [];

    // Match Eventbrite events with dashboard events
    events = events.map(event => {
      const match = ebEvents.find(eb =>
        eb.name.text.toLowerCase().includes(event.name.toLowerCase())
      );

      if (match) {
        return {
          ...event,
          eventbriteId: match.id,
          eventbriteUrl: match.url,
          attendeeCount: match.status === 'live' ? match.capacity : 0,
          eventbrite: 'Yes'
        };
      }
      return event;
    });

    saveEvents();
    applyFilters();
  } catch (error) {
    console.error('Eventbrite sync failed:', error);
  }
}
```

### Option 2: Manual Import

1. Go to [Eventbrite Manage](https://www.eventbrite.com/manage)
2. For each event:
   - Click the event name
   - Copy the URL
   - Paste into the dashboard's Eventbrite field
3. Dashboard will fetch details automatically

## Eventbrite Event Types

Map your event types to Eventbrite categories:

| Dashboard Type | Eventbrite Category |
|---|---|
| Public Volunteer STC Event | Volunteering |
| Workshop | Classes & Training |
| Virtual Workshop | Online Event |
| Tabling | Conferences & Expos |
| Walk | Classes & Training |
| School STC Event | Workshops & Classes |

## Tracking Ticket Sales

Once synced, the dashboard can display:
- Ticket sales count
- Remaining capacity
- Registration deadline
- Ticket pricing

## Common Issues

### API Key Not Working
- Make sure the key has organization access
- Check that your organization ID is correct
- Verify the key isn't expired

### Events Not Matching
- Event names must be identical or very similar
- Check spelling and capitalization
- Consider adding event IDs manually

### CORS Errors
- Eventbrite API has CORS restrictions
- Use a server-side proxy (Google Apps Script) instead
- See APPS_SCRIPT_SETUP.md for backend solution

## Eventbrite API Endpoints

Popular endpoints for event management:

```
GET /v3/organizations/{id}/events/
- List all events for your organization

GET /v3/events/{id}/
- Get specific event details

GET /v3/events/{id}/attendees/
- List attendees for an event

POST /v3/events/{id}/publish/
- Publish an event

POST /v3/events/{id}/unpublish/
- Unpublish an event
```

See [Eventbrite API Docs](https://www.eventbriteapi.com/) for complete reference.

## Privacy & Security

⚠️ **Do not commit API keys to GitHub!**

Store sensitive keys in:
- Environment variables
- `.env` file (add to `.gitignore`)
- Browser's `localStorage` (warn users)
- Google Apps Script (secure backend)

## Next Steps

1. [Set up Google Apps Script backend](APPS_SCRIPT_SETUP.md) for secure API access
2. [Configure Google Sheets integration](README.md)
3. Test event syncing with one pilot event
4. Roll out to all events

---

For more details on Eventbrite's API, see their [complete documentation](https://developer.eventbrite.com/).
