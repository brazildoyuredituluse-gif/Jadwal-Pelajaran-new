import { json, requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);
  const { results } = await env.DB.prepare(
    'SELECT id, grid_area, label, category, is_facility FROM rooms ORDER BY label'
  ).all();
  return json(results);
}
