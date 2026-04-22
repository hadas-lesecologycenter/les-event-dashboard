import axios from 'axios';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const EVENTBRITE_API_KEY = process.env.EVENTBRITE_API_KEY;
    const EVENTBRITE_ORG_ID = process.env.EVENTBRITE_ORG_ID;

    if (!EVENTBRITE_API_KEY || !EVENTBRITE_ORG_ID) {
      return res.status(500).json({ error: 'Eventbrite credentials not configured' });
    }

    const { name, description, date, startTime, endTime, location, category } = req.body;

    // Format date and time for Eventbrite API
    const eventDate = new Date(date);
    const dateStr = eventDate.toISOString().split('T')[0];
    const startTimeStr = startTime ? `${dateStr}T${startTime}:00` : `${dateStr}T09:00:00`;
    const endTimeStr = endTime ? `${dateStr}T${endTime}:00` : `${dateStr}T10:00:00`;

    // Create event via Eventbrite API
    const eventData = {
      event: {
        name: {
          text: name
        },
        description: {
          text: description || `${name} - ${category}`
        },
        start: {
          timezone: 'America/New_York',
          utc: new Date(startTimeStr).toISOString()
        },
        end: {
          timezone: 'America/New_York',
          utc: new Date(endTimeStr).toISOString()
        },
        currency: 'USD',
        status: 'draft',
        online_event: false
      }
    };

    // Add location if provided
    if (location) {
      eventData.event.location = {
        address: {
          address_1: location,
          region: 'New York',
          country_code: 'US'
        }
      };
    }

    const response = await axios.post(
      `https://www.eventbriteapi.com/v3/organizations/${EVENTBRITE_ORG_ID}/events/`,
      eventData,
      {
        headers: {
          'Authorization': `Bearer ${EVENTBRITE_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const eventId = response.data.id;
    const eventUrl = `https://www.eventbrite.com/e/${eventId}`;

    res.status(200).json({
      success: true,
      eventId: eventId,
      eventUrl: eventUrl,
      message: `Event created: ${eventUrl}`
    });

  } catch (error) {
    console.error('Eventbrite API Error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to create Eventbrite event',
      details: error.response?.data?.errors?.[0]?.message || error.message
    });
  }
}
