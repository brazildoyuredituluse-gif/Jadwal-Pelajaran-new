import { json, requireAdmin } from '../../lib/auth.js';
import { DAYS, getSlots, getWeeklyScheduleForClass, shapeSchedule } from '../../lib/schedule.js';

export async function onRequestGet({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);

  const url = new URL(request.url);
  const classId = Number(url.searchParams.get('class'));
  if (!Number.isInteger(classId)) return json({ error: 'Parameter class wajib diisi.' }, 400);

  const [slots, rawSchedule] = await Promise.all([
    getSlots(env),
    getWeeklyScheduleForClass(env, classId),
  ]);

  return json({ days: DAYS, slots, schedule: shapeSchedule(rawSchedule) });
}

// Body: { class_id, day, slot_key, subject_code, teacher_id }
// subject_code/teacher_id boleh null (mengosongkan jam itu).
export async function onRequestPut({ request, env }) {
  const admin = await requireAdmin(request, env);
  if (!admin) return json({ error: 'Tidak terautentikasi.' }, 401);

  const body = await request.json().catch(() => ({}));
  const classId = Number(body.class_id);
  const day = body.day;
  const slotKey = body.slot_key;
  const subjectCode = body.subject_code || null;
  const teacherId = body.teacher_id != null ? Number(body.teacher_id) : null;

  if (!Number.isInteger(classId) || !DAYS.includes(day) || !slotKey) {
    return json({ error: 'Data jadwal tidak lengkap/valid.' }, 400);
  }

  const cls = await env.DB.prepare('SELECT id FROM classes WHERE id = ?').bind(classId).first();
  if (!cls) return json({ error: 'Kelas tidak ditemukan.' }, 404);

  if (subjectCode) {
    const subj = await env.DB.prepare('SELECT code FROM subject_codes WHERE code = ?').bind(subjectCode).first();
    if (!subj) return json({ error: 'Kode mapel tidak dikenal.' }, 400);
  }
  if (teacherId != null) {
    const t = await env.DB.prepare('SELECT id FROM teachers WHERE id = ?').bind(teacherId).first();
    if (!t) return json({ error: 'Guru tidak ditemukan.' }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO schedule (class_id, day, slot_key, subject_code, teacher_id)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(class_id, day, slot_key)
     DO UPDATE SET subject_code = excluded.subject_code, teacher_id = excluded.teacher_id`
  ).bind(classId, day, slotKey, subjectCode, teacherId).run();

  return json({ message: 'Jadwal diperbarui.' });
}
