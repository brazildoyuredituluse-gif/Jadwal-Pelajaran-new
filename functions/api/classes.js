import { json, securityHeaders } from '../lib/auth.js';

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare(
    'SELECT id, name FROM classes ORDER BY sort_order ASC, name ASC'
  ).all();
  return json(results);
}

export async function onRequestOptions() {
  return new Response(null, { headers: securityHeaders() });
}
