import { clearCookie, jsonResponse } from './_shared.js';

export default async function handler() {
  return jsonResponse(200, { connected: false }, {
    'Set-Cookie': clearCookie('bunk_google_tokens')
  });
}
