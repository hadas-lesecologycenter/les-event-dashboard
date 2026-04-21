# LES Ecology Center - Event Workflow Dashboard

A streamlined dashboard for managing event planning workflows across the LES Ecology Center's Street Tree Care & community engagement programs.

## Overview

This dashboard helps Maddy, Hadas, and Gretel track event workflows from planning through completion. It breaks down each event into three phases:

- **Setup Phase**: Event brief, EventBrite listing, calendar event, comms form
- **Execution Phase**: Compost ordering, ops check-in, reminder emails
- **Completion Phase**: Activity reports, tree map data, thank you emails

## Features

✅ **Event Overview** - See all events at a glance with progress tracking  
✅ **Task Tracking** - Check off tasks as they're completed  
✅ **Smart Filtering** - Filter by owner, status, category, or search  
✅ **Progress Metrics** - View overall completion % and event statistics  
✅ **Offline First** - Works without internet (saves to browser storage)  
✅ **Quick Updates** - Mark tasks complete with a single click  

## Quick Start

### 1. Basic Usage (No Setup Required)

1. Open `index.html` in a web browser
2. The dashboard loads with sample events
3. Click checkboxes to mark tasks as complete
4. Use filters to find specific events
5. Data is automatically saved to your browser

### 2. With Your Real Data

#### Option A: Manual Import
1. Copy your event data from the Google Sheet
2. Edit the `getSampleData()` function in `index.html` to replace sample events
3. Save and refresh the browser

#### Option B: Google Sheets Integration (Advanced)

To automatically sync with your Google Sheets tracker:

1. **Create a Google Apps Script**:
   - Go to [script.google.com](https://script.google.com)
   - Create a new project
   - Copy the code from `apps-script/Code.gs` (see below for file creation)
   - Deploy as a web app (Instructions in `APPS_SCRIPT_SETUP.md`)

2. **Get Your Sheet ID**:
   - Your tracker sheet ID: `1EKZHAAlNOPPQEgxDgR7IMBKXWY5aR3VEURl4crImsrY`
   - Add this to the script configuration

3. **In the Dashboard**:
   - Click "Sync with Google Sheets" button (future release)
   - Dashboard will pull latest event data
   - Changes sync back automatically

## Data Structure

Each event tracks the following information:

| Field | Type | Example |
|-------|------|---------|
| Event Name | Text | "Spring into Tree Care" |
| Owner | Select | Maddy, Hadas, or Gretel |
| Date | Date | March 22, 2026 |
| Time | Time | 12:00 PM |
| Location | Text | Tompkins Square Park |
| Category | Select | Outreach, Education, Stewardship |
| Event Type | Select | Tabling, Workshop, STC Event, etc. |
| Collaboration | Text | Partner org name |

**Task Status**: Each task is tracked as:
- `Yes` = Completed
- `No` = Not yet completed
- `N/A` = Not applicable for this event

## Workflow Phases Explained

### 📋 Setup Phase
Tasks to prepare before the event:
- **Event Brief Created** - Internal planning document ready
- **EventBrite Created** - Ticket page live (if public event)
- **Calendar Event Created** - Added to LES calendar
- **Comms Form Submitted** - Marketing/comms team informed

### 🚀 Execution Phase
Tasks during event planning and promotion:
- **Order Placed on Compost Tracker** - Materials ordered if needed
- **Compost Ops Check-In** - Confirmed with operations team
- **Reminder Email Sent** - Attendees/volunteers reminded

### ✅ Completion Phase
Post-event follow-up tasks:
- **Activity Report Completed** - Event summary and data
- **Tree Map Data Completed** - Tree info updated in map
- **Thank You Email Sent** - Attendees/volunteers thanked

## Owners & Responsibilities

- **Maddy**: Outreach events, public workshops, volunteer coordination
- **Hadas**: Tree care events, permits, private partnerships
- **Gretel**: Community engagement, special collaborations

## Browser Storage

All task updates are saved locally in your browser's storage. To back up:
1. Open browser DevTools (F12)
2. Go to Application → Local Storage
3. Find `lesEvents` entry
4. Copy the data

## Future Enhancements

- [ ] Real-time Google Sheets sync
- [ ] Email notifications for overdue tasks
- [ ] Recurring event templates
- [ ] Volunteer roster integration
- [ ] Activity report auto-generation
- [ ] Calendar view
- [ ] Mobile app

## Support

For questions about the dashboard or to request features:
- Check the issue tracker on GitHub
- Contact the development team

---

**Made for the LES Ecology Center's Event Workflow**  
Last updated: April 2026
