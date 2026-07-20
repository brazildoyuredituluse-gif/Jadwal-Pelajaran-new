import { json, requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);
  const { results } = await env.DB.prepare('SELECT id, name, sort_order FROM classes ORDER BY sort_order, name').all();
  return json(results);
}

export async function onRequestPost({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);

  const body = await request.json().catch(() => ({}));
  const name = (body.name || '').trim();
  if (!name || name.length > 50) return json({ error: 'Nama kelas wajib diisi (maks 50 karakter).' }, 400);

  const sortOrder = Number.isInteger(body.sort_order) ? body.sort_order : 0;
  try {
    const result = await env.DB.prepare('INSERT INTO classes (name, sort_order) VALUES (?, ?)')
      .bind(name, sortOrder).run();
    return json({ id: result.meta.last_row_id, name, sort_order: sortOrder }, 201);
  } catch (e) {
    return json({ error: 'Nama kelas sudah ada.' }, 409);
  }
}

export async function onRequestDelete({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);

  const url = new URL(request.url);
  const id = Number(url.searchParams.get('id'));
  if (!Number.isInteger(id)) return json({ error: 'ID tidak valid.' }, 400);

  await env.DB.prepare('DELETE FROM classes WHERE id = ?').bind(id).run();
  return json({ message: 'Kelas dihapus (beserta jadwalnya).' });
}
