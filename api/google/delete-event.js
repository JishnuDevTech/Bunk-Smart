import { oauthClient, jsonResponse, readCookie, unseal, readJsonBody } from './_shared.js';

export default async function handler(req) {
  const tokens = unseal(readCookie(req, 'bunk_google_tokens'));
  if (!tokens) {
    return jsonResponse(401, { error: 'Google Calendar is not connected' });
  }

  try {
    const { eventId } = await readJsonBody(req);
    if (!eventId) {
      return jsonResponse(400, { error: 'eventId is required' });
    }

    const client = oauthClient();
    client.setCredentials(tokens);
    const calendar = await import('googleapis').then(({ google }) => google.calendar({ version: 'v3', auth: client }));
    await calendar.events.delete({ calendarId: 'primary', eventId });

    return jsonResponse(200, { deleted: true });
  } catch (error) {
    return jsonResponse(502, { error: error.message || 'Could not remove Google Calendar event' });
  }
}
