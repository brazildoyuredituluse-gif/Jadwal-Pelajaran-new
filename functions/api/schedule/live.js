import { json } from '../../lib/auth.js';
import { DAYS, getSlots, getClassById, getWeeklyScheduleForClass, shapeSchedule, toMinutes } from '../../lib/schedule.js';

export async function onRequestGet({ env, request }) {
  const url = new URL(request.url);
  const classId = Number(url.searchParams.get('class'));
  const nowParam = url.searchParams.get('now');

  if (!Number.isInteger(classId)) return json({ error: 'Parameter class wajib diisi.' }, 400);

  const cls = await getClassById(env, classId);
  if (!cls) return json({ error: 'Kelas tidak ditemukan.' }, 404);

  const now = nowParam ? new Date(nowParam) : new Date();
  if (Number.isNaN(now.getTime())) return json({ error: 'Format waktu tidak dikenali.' }, 400);

  const jsDay = now.getDay(); // 0=Minggu .. 6=Sabtu
  if (jsDay === 0 || jsDay === 6) {
    return json({ day: null, slot: null, subjectCode: null, mapelName: null, teacherName: null, room: null });
  }
  const day = DAYS[jsDay - 1];
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const [slots, rawSchedule] = await Promise.all([
    getSlots(env),
    getWeeklyScheduleForClass(env, classId),
  ]);

  const activeSlot = slots.find((s) => nowMinutes >= toMinutes(s.start_time) && nowMinutes < toMinutes(s.end_time));
  if (!activeSlot) {
    return json({ day, slot: null, subjectCode: null, mapelName: null, teacherName: null, room: null });
  }

  const shaped = shapeSchedule(rawSchedule);
  const entry = shaped[day] ? shaped[day][activeSlot.slot_key] : undefined;

  if (!entry || !entry.subjectCode) {
    return json({ day, slot: activeSlot, subjectCode: null, mapelName: null, teacherName: null, room: null });
  }

  // Kegiatan tanpa guru/ruang tetap tapi ditandai "is_field_activity" -> nyalakan Lapangan.
  let room = entry.room;
  if (!room && entry.isFieldActivity) room = { id: 'lap', label: 'Lapangan' };

  return json({
    day,
    slot: activeSlot,
    subjectCode: entry.subjectCode,
    mapelName: entry.mapelName,
    teacherName: entry.teacherName,
    room: room || null,
    className: cls.name,
  });
}
