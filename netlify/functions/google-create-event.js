import { cookieValue, oauthClient, unseal, response, requestHeaders } from './_google.js';

export default async function handler(event) {
  const tokens = unseal(cookieValue(requestHeaders(event), 'bunk_google_tokens'));
  if (!tokens) return response(401, { error: 'Google Calendar is not connected' });

  try {
    const { title, date, notes, type } = await event.json();
    const dateKey = String(date || '').slice(0, 10);
    if (!title || !dateKey) return response(400, { error: 'Title and date are required' });

    const client = oauthClient();
    client.setCredentials(tokens);
    const calendar = await import('googleapis').then(({ google }) => google.calendar({ version: 'v3', auth: client }));

    const endDate = new Date(`${dateKey}T00:00:00Z`);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const result = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        description: notes || `${type || 'event'} created from Bunk Smart`,
        start: { date: dateKey },
        end: { date: endDate.toISOString().slice(0, 10) },
        transparency: 'transparent',
        visibility: 'private'
      }
    });

    return response(200, { eventId: result.data.id || null, title, date: dateKey });
  } catch (error) {
    return response(502, { error: error.message || 'Could not create Google Calendar event' });
  }
}
