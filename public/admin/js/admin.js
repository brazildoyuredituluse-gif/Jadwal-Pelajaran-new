'use strict';

const API_BASE = '/api';
const token = sessionStorage.getItem('adminToken');

if (!token) {
  window.location.href = 'login.html';
}

document.getElementById('whoami').textContent =
  `Masuk sebagai ${sessionStorage.getItem('adminName') || 'admin'}`;

document.getElementById('logoutBtn').addEventListener('click', () => {
  sessionStorage.removeItem('adminToken');
  sessionStorage.removeItem('adminName');
  window.location.href = 'login.html';
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showGlobalMsg(text, ok) {
  const el = document.getElementById('globalMsg');
  el.textContent = text;
  el.className = `msg ${ok ? 'ok' : 'error'}`;
  setTimeout(() => { el.textContent = ''; el.className = 'msg'; }, 4000);
}

async function api(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    sessionStorage.removeItem('adminToken');
    window.location.href = 'login.html';
    throw new Error('Sesi berakhir, silakan login lagi.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Gagal (${res.status})`);
  return data;
}

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

let ROOMS = [];
let CLASSES = [];
let TEACHERS = [];
let SUBJECTS = [];

/* ================= KELAS ================= */
async function loadClasses() {
  CLASSES = await api('/admin/classes');
  const list = document.getElementById('classList');
  list.innerHTML = CLASSES.map((c) => `
    <li>
      <span>${escapeHtml(c.name)}</span>
      <button class="btn danger" data-del-class="${c.id}" type="button">Hapus</button>
    </li>`).join('') || '<li><span class="meta">Belum ada kelas.</span></li>';

  list.querySelectorAll('[data-del-class]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus kelas ini beserta seluruh jadwalnya?')) return;
      try {
        await api(`/admin/classes?id=${btn.dataset.delClass}`, { method: 'DELETE' });
        showGlobalMsg('Kelas dihapus.', true);
        await loadClasses();
        await populateScheduleClassSelect();
      } catch (err) { showGlobalMsg(err.message, false); }
    });
  });

  populateScheduleClassSelect();
}

document.getElementById('addClassBtn').addEventListener('click', async () => {
  const name = document.getElementById('newClassName').value.trim();
  const sortOrder = Number(document.getElementById('newClassOrder').value) || 0;
  if (!name) return showGlobalMsg('Nama kelas wajib diisi.', false);
  try {
    await api('/admin/classes', { method: 'POST', body: JSON.stringify({ name, sort_order: sortOrder }) });
    document.getElementById('newClassName').value = '';
    showGlobalMsg('Kelas ditambahkan.', true);
    await loadClasses();
  } catch (err) { showGlobalMsg(err.message, false); }
});

/* ================= GURU ================= */
async function loadRooms() {
  ROOMS = await api('/admin/rooms');
  const sel = document.getElementById('newTeacherRoom');
  sel.innerHTML = ROOMS.map((r) => `<option value="${r.id}">${escapeHtml(r.label)}</option>`).join('');
}

async function loadTeachers() {
  TEACHERS = await api('/admin/teachers');
  const list = document.getElementById('teacherList');
  list.innerHTML = TEACHERS.map((t) => `
    <li>
      <span>${escapeHtml(t.name)} <span class="meta">→ ${escapeHtml(t.room_label || t.room_id)}</span></span>
      <button class="btn danger" data-del-teacher="${t.id}" type="button">Hapus</button>
    </li>`).join('') || '<li><span class="meta">Belum ada guru.</span></li>';

  list.querySelectorAll('[data-del-teacher]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus guru ini? Jam yang memakainya akan kosong gurunya.')) return;
      try {
        await api(`/admin/teachers?id=${btn.dataset.delTeacher}`, { method: 'DELETE' });
        showGlobalMsg('Guru dihapus.', true);
        await loadTeachers();
        renderEditorTable();
      } catch (err) { showGlobalMsg(err.message, false); }
    });
  });
}

document.getElementById('addTeacherBtn').addEventListener('click', async () => {
  const name = document.getElementById('newTeacherName').value.trim();
  const roomId = document.getElementById('newTeacherRoom').value;
  if (!name || !roomId) return showGlobalMsg('Nama guru dan ruang wajib diisi.', false);
  try {
    await api('/admin/teachers', { method: 'POST', body: JSON.stringify({ name, room_id: roomId }) });
    document.getElementById('newTeacherName').value = '';
    showGlobalMsg('Guru ditambahkan.', true);
    await loadTeachers();
  } catch (err) { showGlobalMsg(err.message, false); }
});

/* ================= MAPEL ================= */
async function loadSubjects() {
  SUBJECTS = await api('/admin/subjects');
  const list = document.getElementById('subjList');
  list.innerHTML = SUBJECTS.map((s) => `
    <li>
      <span>${escapeHtml(s.code)} <span class="meta">— ${escapeHtml(s.mapel_name || '(tanpa nama)')}${s.is_field_activity ? ' · Lapangan' : ''}</span></span>
      <button class="btn danger" data-del-subj="${s.code}" type="button">Hapus</button>
    </li>`).join('') || '<li><span class="meta">Belum ada mapel.</span></li>';

  list.querySelectorAll('[data-del-subj]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Hapus mapel ini?')) return;
      try {
        await api(`/admin/subjects?code=${encodeURIComponent(btn.dataset.delSubj)}`, { method: 'DELETE' });
        showGlobalMsg('Mapel dihapus.', true);
        await loadSubjects();
        renderEditorTable();
      } catch (err) { showGlobalMsg(err.message, false); }
    });
  });
}

document.getElementById('addSubjBtn').addEventListener('click', async () => {
  const code = document.getElementById('newSubjCode').value.trim();
  const mapelName = document.getElementById('newSubjName').value.trim();
  const isField = document.getElementById('newSubjField').checked;
  if (!code) return showGlobalMsg('Kode mapel wajib diisi.', false);
  try {
    await api('/admin/subjects', {
      method: 'POST',
      body: JSON.stringify({ code, mapel_name: mapelName, is_field_activity: isField }),
    });
    document.getElementById('newSubjCode').value = '';
    document.getElementById('newSubjName').value = '';
    document.getElementById('newSubjField').checked = false;
    showGlobalMsg('Mapel disimpan.', true);
    await loadSubjects();
  } catch (err) { showGlobalMsg(err.message, false); }
});

/* ================= JADWAL ================= */
async function populateScheduleClassSelect() {
  const sel = document.getElementById('scheduleClassSelect');
  const prev = sel.value;
  sel.innerHTML = CLASSES.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  if (prev && CLASSES.some((c) => String(c.id) === prev)) sel.value = prev;
  await renderEditorTable();
}

document.getElementById('scheduleClassSelect').addEventListener('change', renderEditorTable);

async function renderEditorTable() {
  const table = document.getElementById('editorTable');
  const classId = document.getElementById('scheduleClassSelect').value;
  if (!classId) { table.innerHTML = ''; return; }

  const { slots, schedule } = await api(`/admin/schedule?class=${classId}`);

  const subjOptions = ['<option value="">— kosong —</option>']
    .concat(SUBJECTS.map((s) => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.code)}</option>`))
    .join('');
  const teacherOptions = ['<option value="">— tanpa guru —</option>']
    .concat(TEACHERS.map((t) => `<option value="${t.id}">${escapeHtml(t.name)}</option>`))
    .join('');

  let html = '<thead><tr><th>Jam</th>';
  DAYS.forEach((d) => { html += `<th>${d}</th>`; });
  html += '</tr></thead><tbody>';

  slots.forEach((s) => {
    html += `<tr><th>${escapeHtml(s.label)}<br><span style="opacity:.6">${s.start_time}–${s.end_time}</span></th>`;
    DAYS.forEach((d) => {
      const entry = schedule[d] ? schedule[d][s.slot_key] : null;
      const currentSubj = entry ? entry.subjectCode || '' : '';
      const currentTeacherId = entry && entry.teacherName
        ? (TEACHERS.find((t) => t.name === entry.teacherName) || {}).id || ''
        : '';
      html += `<td>
        <select class="cell-subj" data-day="${d}" data-slot="${s.slot_key}">${subjOptions}</select>
        <select class="cell-teacher" data-day="${d}" data-slot="${s.slot_key}" style="margin-top:3px;">${teacherOptions}</select>
      </td>`;
      // set selected values after building (avoids escaping issues below)
      window.__pendingSelections = window.__pendingSelections || [];
      window.__pendingSelections.push({ day: d, slot: s.slot_key, subj: currentSubj, teacher: currentTeacherId });
    });
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;

  // Terapkan nilai terpilih & pasang listener simpan-otomatis.
  const pending = window.__pendingSelections || [];
  window.__pendingSelections = [];
  pending.forEach(({ day, slot, subj, teacher }) => {
    const subjSel = table.querySelector(`.cell-subj[data-day="${day}"][data-slot="${slot}"]`);
    const teacherSel = table.querySelector(`.cell-teacher[data-day="${day}"][data-slot="${slot}"]`);
    if (subjSel) subjSel.value = subj;
    if (teacherSel) teacherSel.value = teacher;
  });

  table.querySelectorAll('select').forEach((sel) => {
    sel.addEventListener('change', () => saveCell(classId, sel.dataset.day, sel.dataset.slot, table));
  });
}

async function saveCell(classId, day, slotKey, table) {
  const subjSel = table.querySelector(`.cell-subj[data-day="${day}"][data-slot="${slotKey}"]`);
  const teacherSel = table.querySelector(`.cell-teacher[data-day="${day}"][data-slot="${slotKey}"]`);
  const subjectCode = subjSel.value || null;
  const teacherId = teacherSel.value ? Number(teacherSel.value) : null;

  try {
    await api('/admin/schedule', {
      method: 'PUT',
      body: JSON.stringify({ class_id: Number(classId), day, slot_key: slotKey, subject_code: subjectCode, teacher_id: teacherId }),
    });
    showGlobalMsg(`Tersimpan: ${day} · ${slotKey}`, true);
  } catch (err) {
    showGlobalMsg(err.message, false);
  }
}

/* ================= INIT ================= */
(async function init() {
  try {
    await loadRooms();
    await loadTeachers();
    await loadSubjects();
    await loadClasses();
  } catch (err) {
    showGlobalMsg(err.message, false);
  }
})();
