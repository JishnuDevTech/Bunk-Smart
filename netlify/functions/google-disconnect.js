import { expiredCookie, response } from './_google.js';

export default async function handler() {
  return response(200, { connected: false }, { 'Set-Cookie': expiredCookie('bunk_google_tokens') });
}
