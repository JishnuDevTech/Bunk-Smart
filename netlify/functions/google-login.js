import crypto from 'node:crypto';
import { oauthClient, seal, cookie, redirect, response } from './_google.js';

export default async function handler() {
  try {
    const state = crypto.randomBytes(24).toString('base64url');
    const client = oauthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar.readonly'],
      state
    });
    return redirect(url, { 'Set-Cookie': cookie('bunk_google_state', seal(state), 600) });
  } catch (error) {
    return response(500, { error: error.message });
  }
}
