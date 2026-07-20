'use strict';

/* ================= CONFIG ================= */
const API_BASE = '/api'; // relatif — otomatis ikut domain tempat file ini disajikan
const SELECTED_CLASS_KEY = 'papan-jadwal:selectedClassId';

const CAT_COLOR = {
  tkj:'var(--c-tkj)', pjok:'var(--c-pjok)', kik:'var(--c-kik)', pipas:'var(--c-pipas)',
  bindo:'var(--c-bindo)', mtk:'var(--c-mtk)', ap:'var(--c-ap)', aphp:'var(--c-aphp)',
  tp:'var(--c-tp)', tkr:'var(--c-tkr)', bing:'var(--c-bing)', k3:'var(--c-k3)',
  agama:'var(--c-agama)', info:'var(--c-info)', none:'var(--c-none)'
};

// Tata letak grid denah (murni presentasi CSS — bukan data rahasia, aman di frontend).
const CAMPUS_TEMPLATE = `
  "k20     kolam1 k19      k18    urs  k17 labinfo guru  toilet1 rapat  rpstkj"
  "k21     kolam1 .        .      lap  lap lap     lap   lap     lap   bkk"
  "k22     koperasi perpus .      lap  lap lap     lap   lap     lap   k1"
  "k23     kolam2 toilet2  labipa lap  lap lap     lap   lap     lap   k2"
  "toilet3 .      k8       k7     k6   k5  k4      k3    coe     coe   coe"
  "tpa     rpstkr k16      k15    k14  k13 k12     bkuks k11     k10   k9"
  "kolam3  rencanaap rpsaphp rpstp k24 toilet4 rpsap ruangserba kepsek gudang tu"
`;

/* ================= HELPERS ================= */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Gagal memuat ${path} (${res.status})`);
  }
  return res.json();
}

function showError(message) {
  let el = document.getElementById('errorBanner');
  if (!el) {
    el = document.createElement('div');
    el.id = 'errorBanner';
    el.className = 'error-banner';
    document.querySelector('.wrap').prepend(el);
  }
  el.textContent = `Gagal memuat data: ${message}. Coba muat ulang halaman.`;
}

/* ================= STATE ================= */
let ROOMS = [];
let CLASSES = [];
let SELECTED_CLASS_ID = null;
let SCHEDULE_DATA = null;

/* ================= RENDER: CLOCK ================= */
function tickClock() {
  const now = new Date();
  document.getElementById('clockTime').textContent = now.toLocaleTimeString('id-ID');
  document.getElementById('clockDate').textContent = now.toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

/* ================= RENDER: CLASS PICKER ================= */
function renderClassPicker() {
  const sel = document.getElementById('classSelect');
  sel.innerHTML = CLASSES.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
  sel.value = SELECTED_CLASS_ID;
  sel.addEventListener('change', async () => {
    SELECTED_CLASS_ID = Number(sel.value);
    try {
      sessionStorage.setItem(SELECTED_CLASS_KEY, String(SELECTED_CLASS_ID));
    } catch (_) { /* sessionStorage bisa saja diblokir browser, abaikan */ }
    await loadClassSchedule();
    await refreshLive();
  });
}

/* ================= RENDER: LEGEND ================= */
function renderLegend() {
  const seen = new Set();
  const legendEl = document.getElementById('mapLegend');
  legendEl.innerHTML = '';
  ROOMS.forEach((r) => {
    if (!r.category || seen.has(r.category)) return;
    seen.add(r.category);
    const chip = document.createElement('div');
    chip.className = 'legend-chip';
    chip.innerHTML = `<i style="background:${CAT_COLOR[r.category] || CAT_COLOR.none}"></i>${escapeHtml(r.label)}`;
    legendEl.appendChild(chip);
  });
}

/* ================= RENDER: MAP ================= */
function renderMap(activeRoomIds) {
  const campusEl = document.getElementById('campus');
  campusEl.innerHTML = '';
  campusEl.style.gridTemplateAreas = CAMPUS_TEMPLATE;

  ROOMS.forEach((r) => {
    const active = activeRoomIds.includes(r.id);
    const cell = document.createElement('div');
    let cls = 'campus-area';
    if (r.id === 'lap') cls += ' lapangan';
    else if (r.id.startsWith('kolam')) cls += ' kolam';
    else if (r.is_facility) cls += ' facility';
    else cls += ' classroom';
    if (active) cls += ' active';
    cell.className = cls;
    cell.style.setProperty('--area', r.grid_area);

    if (r.category && !r.is_facility && !active) {
      cell.style.background = `linear-gradient(160deg, ${CAT_COLOR[r.category] || CAT_COLOR.none}33, #341f11 55%)`;
    }

    cell.innerHTML = `
      <div class="roof"></div>
      <div class="rname">${escapeHtml(r.label)}</div>
    `;
    campusEl.appendChild(cell);
  });
}

/* ================= RENDER: SCHEDULE TABLE ================= */
function renderTable(highlightDay, highlightSlotKey) {
  if (!SCHEDULE_DATA) return;
  const { days, slots, schedule } = SCHEDULE_DATA;
  const table = document.getElementById('scheduleTable');

  let html = '<thead><tr><th>Jam</th>';
  days.forEach((d) => {
    html += `<th class="${d === highlightDay ? 'day-col-now' : ''}">${escapeHtml(d)}</th>`;
  });
  html += '</tr></thead><tbody>';

  slots.forEach((s) => {
    const isNowRow = s.slot_key === highlightSlotKey;
    html += `<tr class="${isNowRow ? 'now-row' : ''}"><th>${escapeHtml(s.label)}<br><span style="color:#5c7089">${s.start_time}–${s.end_time}</span></th>`;
    days.forEach((d) => {
      const entry = schedule[d] ? schedule[d][s.slot_key] : undefined;
      const isNowCell = isNowRow && d === highlightDay;
      if (entry === undefined) {
        html += `<td class="empty">·</td>`;
      } else if (!entry.subjectCode) {
        html += `<td class="${isNowCell ? 'now-cell' : ''}">—</td>`;
      } else {
        const label = entry.teacherName
          ? `${entry.subjectCode} · ${entry.teacherName}`
          : entry.subjectCode;
        html += `<td class="${isNowCell ? 'now-cell' : ''}">${escapeHtml(label)}</td>`;
      }
    });
    html += '</tr>';
  });
  html += '</tbody>';
  table.innerHTML = html;
}

/* ================= RENDER: STATUS BANNER ================= */
function renderStatus(live) {
  const mapelEl = document.getElementById('statusMapel');
  const subEl = document.getElementById('statusSub');
  const roomEl = document.getElementById('statusRoom');
  const timeEl = document.getElementById('statusTime');
  const className = (CLASSES.find((c) => c.id === SELECTED_CLASS_ID) || {}).name || '';

  if (!live.day) {
    mapelEl.textContent = 'Akhir pekan';
    subEl.textContent = 'Tidak ada jadwal pelajaran hari ini.';
    roomEl.textContent = 'Ruang —';
    timeEl.textContent = '--:-- – --:--';
    return [];
  }

  if (!live.slot) {
    mapelEl.textContent = 'Di luar jam pelajaran';
    subEl.textContent = `${live.day} · belum masuk jam berapapun`;
    roomEl.textContent = 'Ruang —';
    timeEl.textContent = '--:-- – --:--';
    return [];
  }

  if (!live.subjectCode) {
    mapelEl.textContent = live.slot.label;
    subEl.textContent = `${live.day} · kegiatan tanpa jam mapel tetap`;
    roomEl.textContent = 'Ruang —';
    timeEl.textContent = `${live.slot.start_time} – ${live.slot.end_time}`;
    return [];
  }

  mapelEl.textContent = live.mapelName || live.subjectCode;
  subEl.textContent = live.teacherName
    ? `${live.day} · ${live.slot.label} · ${className} · Guru: ${live.teacherName}`
    : `${live.day} · ${live.slot.label} · ${className}`;
  timeEl.textContent = `${live.slot.start_time} – ${live.slot.end_time}`;

  if (live.room) {
    roomEl.textContent = live.room.label;
    return [live.room.id];
  }

  roomEl.textContent = 'Ruang tidak tetap';
  return [];
}

/* ================= LIVE POLLING ================= */
async function refreshLive() {
  if (!SELECTED_CLASS_ID) return;
  try {
    const now = new Date().toISOString();
    const live = await apiGet(`/schedule/live?class=${SELECTED_CLASS_ID}&now=${encodeURIComponent(now)}`);
    const activeRooms = renderStatus(live);
    renderMap(activeRooms);
    renderTable(live.day, live.slot ? live.slot.slot_key : null);
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

/* ================= LOAD SCHEDULE FOR SELECTED CLASS ================= */
async function loadClassSchedule() {
  const cls = CLASSES.find((c) => c.id === SELECTED_CLASS_ID);
  document.getElementById('brandSub').textContent = cls ? `Sekolah · ${cls.name}` : 'Sekolah';
  document.getElementById('tableTitle').textContent = cls ? `Jadwal Minggu Ini — ${cls.name}` : 'Jadwal Minggu Ini';
  SCHEDULE_DATA = await apiGet(`/schedule/${SELECTED_CLASS_ID}`);
}

/* ================= INIT ================= */
async function init() {
  tickClock();
  setInterval(tickClock, 1000);

  try {
    const [rooms, classes] = await Promise.all([apiGet('/rooms'), apiGet('/classes')]);
    ROOMS = rooms;
    CLASSES = classes;

    if (!CLASSES.length) {
      showError('Belum ada kelas yang dibuat. Tambahkan kelas lewat dashboard admin.');
      return;
    }

    let storedId = null;
    try { storedId = Number(sessionStorage.getItem(SELECTED_CLASS_KEY)); } catch (_) { /* abaikan */ }
    SELECTED_CLASS_ID = CLASSES.some((c) => c.id === storedId) ? storedId : CLASSES[0].id;

    renderClassPicker();
    renderLegend();
    await loadClassSchedule();
    await refreshLive();
    setInterval(refreshLive, 15000);
  } catch (err) {
    console.error(err);
    showError(err.message);
  }
}

document.addEventListener('DOMContentLoaded', init);
