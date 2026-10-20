# Attendance – Setup

On each event card the dashboard shows:

- **Attended** (every past event) – the headcount from the LESEC Activity Reporting form ("Number of Participants" for workshops, "Number of tree care volunteers" for Tree Care volunteer events), counting only reports from Maddy, Hadas or Gretel
- **Registered** (events marked **EventBrite Created = Yes**) – Eventbrite registrations still attending (cancelled/refunded orders left out)
- **Show-up rate** (Eventbrite events) – attended ÷ registered

Totals are in the **Stats** tab under "Attendance Rate", with the full list of events behind "Show all events".

Events are matched to the activity report (and Eventbrite) by **date**, then by words their names share. Volunteer events only match tree care reports and programs only workshop reports. If there are several on the same day and none is clearly the right one, the card asks you to pick one under **Check match** (or in the Stats list). Picks are saved in the **Attendance Matches** tab of the tracker spreadsheet, so the whole team sees the same matches.

## Where the numbers come from

A separate Apps Script project, **STC Events**, runs `apps-script/Attendance.gs`. It only *reads* Eventbrite and the responses spreadsheet – it never writes to either. The only thing it writes is the match picks, in the **Attendance Matches** tab of the tracker (created on the first pick). The main dashboard backend (`apps-script/Code.gs`) is not involved.

## Setting up the STC Events project

1. Open the **STC Events** project at script.google.com.
2. Replace everything in **Code.gs** with the contents of `apps-script/Attendance.gs`, then save.
3. Delete **Index.html** if it is there (⋮ next to the file name → Delete). It isn't used any more.
4. **Project Settings → Script Properties** must have `EVENTBRITE_TOKEN` (your Eventbrite private token). `EVENTBRITE_ORGANIZATION_ID` is filled in automatically.
5. Pick **testAttendance** in the function menu and click **Run**. The log lists past 2026 events with the Eventbrite event and activity report each was matched to.
6. **Deploy → Manage deployments**, select the deployment whose URL is in `ATTENDANCE_SCRIPT_URL` in `index.html`, click ✏️ **Edit**, set **Version: New version**, **Execute as: Me**, **Who has access: Anyone**, then **Deploy**. Editing (not "New deployment") keeps the same URL.
