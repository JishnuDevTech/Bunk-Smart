import { cookieValue, oauthClient, seal, unseal, cookie, expiredCookie, frontendUrl, response, redirect, requestUrl, requestHeaders } from './_google.js';

export default async function handler(event) {
  const url = requestUrl(event);
  const params = url.searchParams;
  const stateCookie = unseal(cookieValue(requestHeaders(event), 'bunk_google_state'));
  if (!params.get('code') || !stateCookie || stateCookie !== params.get('state')) return response(400, { error: 'Invalid Google OAuth state' });
  try {
    const client = oauthClient();
    const { tokens } = await client.getToken(params.get('code'));
    return redirect(`${frontendUrl}/dashboard.html?calendar=connected`, { 'Set-Cookie': [cookie('bunk_google_tokens', seal(tokens), 2592000), expiredCookie('bunk_google_state')] });
  } catch {
    return response(502, { error: 'Google authorization failed' });
  }
}
