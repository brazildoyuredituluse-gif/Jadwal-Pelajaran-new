import { json } from '../../lib/auth.js';
import { DAYS, getSlots, getClassById, getWeeklyScheduleForClass, shapeSchedule } from '../../lib/schedule.js';

export async function onRequestGet({ env, params }) {
  const classId = Number(params.classId);
  if (!Number.isInteger(classId)) return json({ error: 'ID kelas tidak valid.' }, 400);

  const cls = await getClassById(env, classId);
  if (!cls) return json({ error: 'Kelas tidak ditemukan.' }, 404);

  const [slots, rawSchedule] = await Promise.all([
    getSlots(env),
    getWeeklyScheduleForClass(env, classId),
  ]);

  return json({
    classId: cls.id,
    className: cls.name,
    days: DAYS,
    slots,
    schedule: shapeSchedule(rawSchedule),
  });
}
