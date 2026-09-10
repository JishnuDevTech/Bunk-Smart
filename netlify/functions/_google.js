import crypto from 'node:crypto';
import { google } from 'googleapis';

const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:8888').replace(/\/$/, '');
const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${frontendUrl}/.netlify/functions/google-callback`;
const secret = process.env.SESSION_SECRET;

function requireConfig() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !secret) {
    throw new Error('Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or SESSION_SECRET');
  }
}

export function oauthClient() {
  requireConfig();
  return new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, redirectUri);
}

export function cookieValue(cookieHeader, name) {
  const value = typeof cookieHeader?.get === 'function'
    ? cookieHeader.get('cookie')
    : typeof cookieHeader === 'object'
      ? cookieHeader.cookie || cookieHeader.Cookie
      : cookieHeader;
  return (value || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
}

function key() {
  return crypto.createHash('sha256').update(secret).digest();
}

export function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(part => part.toString('base64url')).join('.');
}

export function unseal(value) {
  if (!value) return null;
  try {
    const [ivText, tagText, encryptedText] = value.split('.');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8'));
  } catch {
    return null;
  }
}

export function cookie(name, value, maxAge = 3600) {
  const secure = frontendUrl.startsWith('https://') ? '; Secure' : '';
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly${secure}; SameSite=Lax`;
}

export function expiredCookie(name) {
  const secure = frontendUrl.startsWith('https://') ? '; Secure' : '';
  return `${name}=; Max-Age=0; Path=/; HttpOnly${secure}; SameSite=Lax`;
}

export function response(statusCode, body, headers = {}) {
  const responseHeaders = new Headers({ 'content-type': 'application/json' });
  for (const [name, value] of Object.entries(headers)) {
    if (Array.isArray(value)) value.forEach(item => responseHeaders.append(name, item));
    else responseHeaders.set(name, value);
  }
  return new Response(JSON.stringify(body), { status: statusCode, headers: responseHeaders });
}

export function redirect(url, headers = {}) {
  return response(302, null, { Location: url, ...headers });
}

export function requestUrl(event) {
  if (event instanceof Request) return new URL(event.url);
  return new URL(event.rawUrl || `http://localhost${event.path || '/'}`);
}

export function requestHeaders(event) {
  if (event instanceof Request) return event.headers;
  return event.headers || {};
}

export { frontendUrl, redirectUri };
