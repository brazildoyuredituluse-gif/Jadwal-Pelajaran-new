import { json } from '../lib/auth.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, grid_area, label, category, is_facility FROM rooms'
  ).all();
  return json(results);
}
