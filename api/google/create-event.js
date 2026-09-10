import { oauthClient, jsonResponse, readCookie, unseal, readJsonBody } from './_shared.js';

export default async function handler(req) {
  const tokens = unseal(readCookie(req, 'bunk_google_tokens'));
  if (!tokens) {
    return jsonResponse(401, { error: 'Google Calendar is not connected' });
  }

  try {
    const payload = await readJsonBody(req);
    const { title, date, notes, type } = payload;
    const dateKey = String(date || '').slice(0, 10);

    if (!title || !dateKey) {
      return jsonResponse(400, { error: 'Title and date are required' });
    }

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

    return jsonResponse(200, { eventId: result.data.id || null, title, date: dateKey });
  } catch (error) {
    return jsonResponse(502, { error: error.message || 'Could not create Google Calendar event' });
  }
}
