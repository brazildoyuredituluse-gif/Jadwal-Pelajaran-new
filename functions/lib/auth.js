// Helper JWT (HS256) + hashing password pakai Web Crypto bawaan Cloudflare
// Workers — sengaja tanpa dependency npm supaya build Pages Functions tetap ringan.

function b64url(bytes) {
  let str = '';
  bytes = new Uint8Array(bytes);
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlToBytes(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

async function signJWT(payload, secret, expiresInSeconds = 60 * 60 * 8) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const encHeader = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const encBody = b64url(new TextEncoder().encode(JSON.stringify(body)));
  const data = `${encHeader}.${encBody}`;
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`;
}

async function verifyJWT(token, secret) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encBody, encSig] = parts;
  const key = await hmacKey(secret);
  const valid = await crypto.subtle.verify(
    'HMAC', key, b64urlToBytes(encSig), new TextEncoder().encode(`${encHeader}.${encBody}`)
  );
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(encBody)));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}

function getBearerToken(request) {
  const h = request.headers.get('Authorization') || '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

// PBKDF2-SHA256, 150k iterasi. Password TIDAK PERNAH disimpan/di-log polos.
async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const salt = saltHex
    ? b64urlToBytes(saltHex)
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return { hash: b64url(bits), salt: b64url(salt) };
}

async function verifyPassword(password, hash, salt) {
  const { hash: computed } = await hashPassword(password, salt);
  // constant-time-ish compare
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

function securityHeaders() {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; img-src 'self' data:;",
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...securityHeaders(), ...extraHeaders },
  });
}

async function requireAdmin(request, env) {
  const token = getBearerToken(request);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  if (!payload || payload.role !== 'admin') return null;
  return payload;
}

// Rate limit login: maks 8 percobaan / 15 menit / IP, disimpan di D1.
async function checkLoginRateLimit(env, ip) {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const row = await env.DB.prepare('SELECT count, window_start FROM login_attempts WHERE ip = ?').bind(ip).first();
  if (!row) {
    await env.DB.prepare('INSERT INTO login_attempts (ip, count, window_start) VALUES (?, 1, ?)')
      .bind(ip, new Date(now).toISOString()).run();
    return true;
  }
  const windowStart = new Date(row.window_start).getTime();
  if (now - windowStart > windowMs) {
    await env.DB.prepare('UPDATE login_attempts SET count = 1, window_start = ? WHERE ip = ?')
      .bind(new Date(now).toISOString(), ip).run();
    return true;
  }
  if (row.count >= 8) return false;
  await env.DB.prepare('UPDATE login_attempts SET count = count + 1 WHERE ip = ?').bind(ip).run();
  return true;
}

async function resetLoginRateLimit(env, ip) {
  await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
}

export {
  signJWT, verifyJWT, getBearerToken, hashPassword, verifyPassword,
  securityHeaders, json, requireAdmin, checkLoginRateLimit, resetLoginRateLimit,
};
