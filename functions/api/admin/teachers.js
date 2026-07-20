import { json, requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.name, t.room_id, r.label AS room_label
     FROM teachers t LEFT JOIN rooms r ON r.id = t.room_id
     ORDER BY t.name`
  ).all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);

  const body = await request.json().catch(() => ({}));
  const name = (body.name || '').trim();
  const roomId = (body.room_id || '').trim();
  if (!name || name.length > 100) return json({ error: 'Nama guru wajib diisi.' }, 400);
  if (!roomId) return json({ error: 'Ruang guru wajib dipilih.' }, 400);

  const room = await env.DB.prepare('SELECT id FROM rooms WHERE id = ?').bind(roomId).first();
  if (!room) return json({ error: 'Ruang tidak ditemukan.' }, 400);

  const result = await env.DB.prepare('INSERT INTO teachers (name, room_id) VALUES (?, ?)')
    .bind(name, roomId).run();
  return json({ id: result.meta.last_row_id, name, room_id: roomId }, 201);
}

export async function onRequestPut({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);

  const body = await request.json().catch(() => ({}));
  const id = Number(body.id);
  const name = (body.name || '').trim();
  const roomId = (body.room_id || '').trim();
  if (!Number.isInteger(id) || !name || !roomId) return json({ error: 'Data tidak lengkap.' }, 400);

  const room = await env.DB.prepare('SELECT id FROM rooms WHERE id = ?').bind(roomId).first();
  if (!room) return json({ error: 'Ruang tidak ditemukan.' }, 400);

  await env.DB.prepare('UPDATE teachers SET name = ?, room_id = ? WHERE id = ?').bind(name, roomId, id).run();
  return json({ message: 'Guru diperbarui.' });
}

export async function onRequestDelete({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id)) return json({ error: 'ID tidak valid.' }, 400);

  await env.DB.prepare('DELETE FROM teachers WHERE id = ?').bind(id).run();
  return json({ message: 'Guru dihapus.' });
}
