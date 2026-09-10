import crypto from 'node:crypto';
import { oauthClient, redirectResponse, jsonResponse, setCookie, seal } from './_shared.js';

export default async function handler(req) {
  try {
    const state = crypto.randomBytes(24).toString('base64url');
    const client = oauthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      state
    });

    return redirectResponse(url, [setCookie('bunk_google_state', seal(state), 600)]);
  } catch (error) {
    return jsonResponse(500, { error: error.message || 'Google login failed' });
  }
}
