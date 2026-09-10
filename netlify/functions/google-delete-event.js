import { cookieValue, oauthClient, unseal, response, requestHeaders } from './_google.js';

export default async function handler(event) {
  const tokens = unseal(cookieValue(requestHeaders(event), 'bunk_google_tokens'));
  if (!tokens) return response(401, { error: 'Google Calendar is not connected' });

  try {
    const { eventId } = await event.json();
    if (!eventId) return response(400, { error: 'Missing event id' });

    const client = oauthClient();
    client.setCredentials(tokens);
    const calendar = await import('googleapis').then(({ google }) => google.calendar({ version: 'v3', auth: client }));
    await calendar.events.delete({ calendarId: 'primary', eventId });

    return response(200, { deleted: true });
  } catch (error) {
    return response(502, { error: error.message || 'Could not delete Google Calendar event' });
  }
}
