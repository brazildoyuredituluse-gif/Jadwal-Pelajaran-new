import { json, requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT code, mapel_name, is_field_activity FROM subject_codes ORDER BY code'
  ).all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);

  const body = await request.json().catch(() => ({}));
  const code = (body.code || '').trim();
  const mapelName = (body.mapel_name || '').trim() || null;
  const isField = body.is_field_activity ? 1 : 0;
  if (!code || code.length > 40) return json({ error: 'Kode mapel wajib diisi (maks 40 karakter).' }, 400);

  await env.DB.prepare(
    `INSERT INTO subject_codes (code, mapel_name, is_field_activity) VALUES (?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET mapel_name = excluded.mapel_name, is_field_activity = excluded.is_field_activity`
  ).bind(code, mapelName, isField).run();

  return json({ message: 'Mapel disimpan.' });
}

export async function onRequestDelete({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return json({ error: 'Kode tidak valid.' }, 400);
  await env.DB.prepare('DELETE FROM subject_codes WHERE code = ?').bind(code).run();
  return json({ message: 'Mapel dihapus.' });
}
