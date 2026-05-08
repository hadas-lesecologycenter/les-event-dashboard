const axios = require('axios');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY;
    const EVENTBRITE_ORG_ID = process.env.EVENTBRITE_ORG_ID;

    if (!EVENTBRITE_API_KEY || !EVENTBRITE_ORG_ID) {
      return res.status(500).json({ error: 'Eventbrite credentials not configured' });
    }

    const { event, brief } = req.body;

    if (!event || !event.name || !event.date) {
      return res.status(400).json({ error: 'Event name and date are required' });
    }

    const eventName = brief?.eventNameExternal || event.name;
    const description = brief?.description || event.notes || '';
    const eventDate = new Date(event.date);
    const dateStr = eventDate.toISOString().split('T')[0];

    const startTime = event.time || '09:00';
    const endTime = event.endTime || '10:00';
    const startTimeStr = `${dateStr}T${startTime}:00`;
    const endTimeStr = `${dateStr}T${endTime}:00`;

    let fullDescription = description;
    if (brief?.goals) fullDescription += `\n\nEvent Goals:\n${brief.goals}`;
    if (brief?.runOfShow) fullDescription += `\n\nSchedule:\n${brief.runOfShow}`;
    if (brief?.audience && brief.audience.length > 0) {
      const audienceList = Array.isArray(brief.audience) ? brief.audience.join(', ') : brief.audience;
      fullDescription += `\n\nTarget Audience:\n${audienceList}`;
    }
    if (brief?.expectedAttendance) fullDescription += `\n\nExpected Attendance:\n${brief.expectedAttendance}`;
    if (brief?.accessNotes) fullDescription += `\n\nAccess Information:\n${brief.accessNotes}`;

    const eventData = {
      event: {
        name: { text: eventName },
        description: { text: fullDescription || `${eventName} - ${event.primaryCategory || event.category}` },
        start: { timezone: 'America/New_York', utc: new Date(startTimeStr).toISOString() },
        end: { timezone: 'America/New_York', utc: new Date(endTimeStr).toISOString() },
        currency: 'USD',
        status: 'draft',
        online_event: brief?.format === 'Virtual' || false
      }
    };

    const location = brief?.location || event.location;
    if (location) {
      eventData.event.location = {
        address: { address_1: location, region: 'New York', country_code: 'US' }
      };
    }

    const response = await axios.post(
      `https://www.eventbriteapi.com/v3/organizations/${EVENTBRITE_ORG_ID}/events/`,
      eventData,
      { headers: { 'Authorization': `Bearer ${EVENTBRITE_API_KEY}`, 'Content-Type': 'application/json' } }
    );

    const eventId = response.data.id;
    res.status(200).json({ success: true, eventId, eventUrl: `https://www.eventbrite.com/e/${eventId}` });

  } catch (error) {
    console.error('Eventbrite API Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to create Eventbrite event',
      details: error.response?.data?.errors?.[0]?.message || error.message
    });
  }
};
