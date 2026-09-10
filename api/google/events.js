import { oauthClient, jsonResponse, readCookie, unseal } from './_shared.js';

export default async function handler(req) {
  const tokens = unseal(readCookie(req, 'bunk_google_tokens'));
  if (!tokens) {
    return jsonResponse(401, { error: 'Google Calendar is not connected' });
  }

  try {
    const client = oauthClient();
    client.setCredentials(tokens);
    const calendar = await import('googleapis').then(({ google }) => google.calendar({ version: 'v3', auth: client }));

    const result = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 100,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const events = (result.data.items || []).flatMap(item => {
      const start = item.start?.date || item.start?.dateTime?.slice(0, 10);
      if (!start) return [];
      const title = item.summary || 'Calendar event';
      return [{ date: start, title, type: title.toLowerCase().includes('birthday') ? 'birthday' : 'event' }];
    });

    return jsonResponse(200, { events });
  } catch {
    return jsonResponse(502, { error: 'Could not read Google Calendar' });
  }
}
