import { oauthClient, redirectResponse, jsonResponse, setCookie, clearCookie, readCookie, seal, unseal, frontendUrl } from './_shared.js';

export default async function handler(req) {
  const url = new URL(req.url);
  const params = url.searchParams;
  const stateCookie = unseal(readCookie(req, 'bunk_google_state'));

  if (!params.get('code') || !stateCookie || stateCookie !== params.get('state')) {
    return jsonResponse(400, { error: 'Invalid Google OAuth state' });
  }

  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(params.get('code'));
    return redirectResponse(`${frontendUrl}/dashboard.html?calendar=connected`, [
      setCookie('bunk_google_tokens', seal(tokens), 2592000),
      clearCookie('bunk_google_state')
    ]);
  } catch {
    return jsonResponse(502, { error: 'Google authorization failed' });
  }
}
