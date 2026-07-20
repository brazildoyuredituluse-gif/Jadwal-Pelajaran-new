import { json, verifyPassword, signJWT, checkLoginRateLimit, resetLoginRateLimit } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  const allowed = await checkLoginRateLimit(env, ip);
  if (!allowed) {
    return json({ error: 'Terlalu banyak percobaan login. Coba lagi dalam 15 menit.' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Body request tidak valid.' }, 400);
  }

  const { username, password } = body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return json({ error: 'Username dan password wajib diisi.' }, 400);
  }

  const user = await env.DB.prepare(
    'SELECT id, username, password_hash, password_salt, full_name FROM admin_users WHERE username = ?'
  ).bind(username).first();

  // Pesan error disamakan (tidak membedakan "user tidak ada" vs "password salah")
  // supaya tidak membocorkan username mana yang valid.
  if (!user) return json({ error: 'Username atau password salah.' }, 401);

  const ok = await verifyPassword(password, user.password_hash, user.password_salt);
  if (!ok) return json({ error: 'Username atau password salah.' }, 401);

  await resetLoginRateLimit(env, ip);

  const token = await signJWT({ sub: user.id, username: user.username, role: 'admin' }, env.JWT_SECRET);
  return json({ token, fullName: user.full_name || user.username });
}
