const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

async function getSlots(env) {
  const { results } = await env.DB.prepare(
    'SELECT slot_key, label, start_time, end_time FROM schedule_slots ORDER BY sort_order ASC'
  ).all();
  return results;
}

async function getClassById(env, classId) {
  return env.DB.prepare('SELECT id, name FROM classes WHERE id = ?').bind(classId).first();
}

// Ambil jadwal satu kelas satu minggu penuh, sudah di-join dengan mapel & guru & ruang guru.
async function getWeeklyScheduleForClass(env, classId) {
  const { results } = await env.DB.prepare(
    `SELECT s.day, s.slot_key, s.subject_code,
            sc.mapel_name, sc.is_field_activity,
            t.id AS teacher_id, t.name AS teacher_name, t.room_id AS room_id,
            r.label AS room_label
     FROM schedule s
     LEFT JOIN subject_codes sc ON sc.code = s.subject_code
     LEFT JOIN teachers t ON t.id = s.teacher_id
     LEFT JOIN rooms r ON r.id = t.room_id
     WHERE s.class_id = ?`
  ).bind(classId).all();
  return results;
}

function shapeSchedule(rows) {
  const shaped = {};
  DAYS.forEach((d) => { shaped[d] = {}; });
  rows.forEach((row) => {
    if (!shaped[row.day]) return;
    shaped[row.day][row.slot_key] = {
      subjectCode: row.subject_code,
      mapelName: row.mapel_name || null,
      isFieldActivity: !!row.is_field_activity,
      teacherName: row.teacher_name || null,
      room: row.room_id ? { id: row.room_id, label: row.room_label } : null,
    };
  });
  return shaped;
}

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export { DAYS, getSlots, getClassById, getWeeklyScheduleForClass, shapeSchedule, toMinutes };
