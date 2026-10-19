# Registered vs. Attended – Setup

The dashboard shows, for each event marked **EventBrite Created = Yes** in the tracker:

- **Registered** – Eventbrite registrations still attending (cancelled/refunded orders left out)
- **Attended** – the headcount from the LESEC Activity Reporting form ("Number of Participants" for workshops, "Number of tree care volunteers" for Tree Care volunteer events), counting only reports from Maddy, Hadas or Gretel
- **Show-up rate** – attended ÷ registered

Totals are in the **Stats** tab under "Registered vs. Attended".

Events are matched to Eventbrite and to the activity report by **date**, then by words their names share. If there are several on the same day and none is clearly the right one, the card asks you to pick one under **Check match**. Picks made there are saved in your browser only.

## Where the numbers come from

A separate Apps Script project, **STC Events**, runs `apps-script/Attendance.gs`. It only *reads* Eventbrite and the responses spreadsheet – it never writes to either. The main dashboard backend (`apps-script/Code.gs`) is not involved.

## Setting up the STC Events project

1. Open the **STC Events** project at script.google.com.
2. Replace everything in **Code.gs** with the contents of `apps-script/Attendance.gs`, then save.
3. Delete **Index.html** if it is there (⋮ next to the file name → Delete). It isn't used any more.
4. **Project Settings → Script Properties** must have `EVENTBRITE_TOKEN` (your Eventbrite private token). `EVENTBRITE_ORGANIZATION_ID` is filled in automatically.
5. Pick **testAttendance** in the function menu and click **Run**. The log lists past 2026 events with the Eventbrite event and activity report each was matched to.
6. **Deploy → Manage deployments**, select the deployment whose URL is in `ATTENDANCE_SCRIPT_URL` in `index.html`, click ✏️ **Edit**, set **Version: New version**, **Execute as: Me**, **Who has access: Anyone**, then **Deploy**. Editing (not "New deployment") keeps the same URL.
