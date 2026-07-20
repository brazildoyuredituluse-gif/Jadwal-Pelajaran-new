-- ============================================================
-- Papan Jadwal Hidup — skema untuk Cloudflare D1 (SQLite)
-- Mendukung banyak kelas, dan setiap kelas bisa punya guru
-- berbeda untuk mapel yang sama (mis. MTK kelas A = Bu Ema,
-- MTK kelas B = Pak Ari) -> ruang yang menyala ikut guru yang
-- sedang mengajar, bukan cuma ikut nama mapel.
-- ============================================================

DROP TABLE IF EXISTS schedule;
DROP TABLE IF EXISTS subject_codes;
DROP TABLE IF EXISTS schedule_slots;
DROP TABLE IF EXISTS teachers;
DROP TABLE IF EXISTS classes;
DROP TABLE IF EXISTS rooms;
DROP TABLE IF EXISTS admin_users;
DROP TABLE IF EXISTS login_attempts;

-- Akun admin dashboard. password_hash + password_salt = PBKDF2 (Web Crypto),
-- tidak ada password polos yang pernah disimpan.
CREATE TABLE admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  full_name     TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- Percobaan login, untuk rate-limit brute force (per IP).
CREATE TABLE login_attempts (
  ip           TEXT PRIMARY KEY,
  count        INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

-- Ruang / bangunan pada denah (tata letak grid CSS, murni presentasi).
CREATE TABLE rooms (
  id          TEXT PRIMARY KEY,
  grid_area   TEXT NOT NULL,
  label       TEXT NOT NULL,
  category    TEXT,
  is_facility INTEGER NOT NULL DEFAULT 0
);

-- Kelas (bisa banyak baris sekarang, bebas ditambah lewat admin).
CREATE TABLE classes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Guru. Setiap guru "menempati" satu ruang di denah -> saat guru itu
-- mengajar (di kelas manapun, jam manapun), ruangnya yang menyala.
CREATE TABLE teachers (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id)
);

-- Jam pelajaran (siklus harian Senin-Jumat, dipakai bersama semua kelas).
CREATE TABLE schedule_slots (
  slot_key   TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time   TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

-- Kode mapel -> nama tampilan. is_field_activity = kegiatan tanpa ruang
-- tetap tapi tetap ingin menyalakan Lapangan (upacara, olahraga bebas, dll).
CREATE TABLE subject_codes (
  code             TEXT PRIMARY KEY,
  mapel_name       TEXT,
  is_field_activity INTEGER NOT NULL DEFAULT 0
);

-- Jadwal per kelas / hari / jam. teacher_id boleh NULL (kegiatan tanpa guru
-- tetap, mis. Ekskul/Upacara). Guru yang menentukan ruang mana yang menyala.
CREATE TABLE schedule (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id     INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  day          TEXT NOT NULL CHECK (day IN ('Senin','Selasa','Rabu','Kamis','Jumat')),
  slot_key     TEXT NOT NULL REFERENCES schedule_slots(slot_key),
  subject_code TEXT REFERENCES subject_codes(code),
  teacher_id   INTEGER REFERENCES teachers(id),
  UNIQUE (class_id, day, slot_key)
);

-- ============================================================
-- SEED: jam pelajaran
-- ============================================================
INSERT INTO schedule_slots (slot_key, label, start_time, end_time, sort_order) VALUES
('upacara',   'Upacara/Apel & MBG', '06:30', '07:30', 1),
('j1',        'Jam 1',              '07:30', '08:10', 2),
('j2',        'Jam 2',              '08:10', '08:50', 3),
('j3',        'Jam 3',              '08:50', '09:30', 4),
('istirahat', 'Istirahat',          '09:30', '09:45', 5),
('j4',        'Jam 4',              '09:45', '10:25', 6),
('j5',        'Jam 5',              '10:25', '11:05', 7),
('j6',        'Jam 6',              '11:05', '11:45', 8),
('ishoma',    'Ishoma',             '11:45', '12:45', 9),
('j7',        'Jam 7',              '12:45', '13:25', 10),
('j8',        'Jam 8',              '13:25', '14:05', 11),
('j9',        'Jam 9',              '14:05', '14:45', 12);

-- ============================================================
-- SEED: ruang / denah sekolah (sama seperti versi sebelumnya)
-- ============================================================
INSERT INTO rooms (id, grid_area, label, category, is_facility) VALUES
('k20','k20','Ruang Kelas 20','ap',0),
('kolam1','kolam1','Kolam',NULL,1),
('k19','k19','Ruang Kelas 19','bing',0),
('k18','k18','Ruang Kelas 18','bing',0),
('urs','urs','URS',NULL,1),
('k17','k17','Ruang Kelas 17','bing',0),
('labinfo','labinfo','Lab. Informatika & Bahasa','info',0),
('guru','guru','Ruang Guru',NULL,1),
('toilet1','toilet1','Toilet',NULL,1),
('rapat','rapat','Ruang Rapat',NULL,1),
('rpstkj','rpstkj','RPS TKJ','tkj',0),
('k21','k21','Ruang Kelas 21','bindo',0),
('bkk','bkk','Ruang BKK',NULL,1),
('k22','k22','Ruang Kelas 22','bindo',0),
('koperasi','koperasi','Koperasi',NULL,1),
('perpus','perpus','Ruang Perpustakaan',NULL,1),
('k1','k1','Ruang Kelas 1','tkj',0),
('k23','k23','Ruang Kelas 23','bindo',0),
('kolam2','kolam2','Kolam',NULL,1),
('toilet2','toilet2','Toilet',NULL,1),
('labipa','labipa','Laboratorium IPA',NULL,1),
('k2','k2','Ruang Kelas 2','pjok',0),
('lap','lap','Lapangan',NULL,1),
('toilet3','toilet3','Toilet',NULL,1),
('k8','k8','Ruang Kelas 8','bindo',0),
('k7','k7','Ruang Kelas 7','pipas',0),
('k6','k6','Ruang Kelas 6','pipas',0),
('k5','k5','Ruang Kelas 5','kik',0),
('k4','k4','Ruang Kelas 4','kik',0),
('k3','k3','Ruang Kelas 3','kik',0),
('coe','coe','Ruang COE','agama',0),
('tpa','tpa','TPA',NULL,1),
('rpstkr','rpstkr','RPS TKR','tkr',0),
('k16','k16','Ruang Kelas 16','tkr',0),
('k15','k15','Ruang Kelas 15','tkr',0),
('k14','k14','Ruang Kelas 14','tp',0),
('k13','k13','Ruang Kelas 13','aphp',0),
('k12','k12','Ruang Kelas 12','ap',0),
('bkuks','bkuks','Rencana Ajuan Ruang BK & UKS',NULL,1),
('k11','k11','Ruang Kelas 11','mtk',0),
('k10','k10','Ruang Kelas 10','mtk',0),
('k9','k9','Ruang Kelas 9','mtk',0),
('kolam3','kolam3','Kolam',NULL,1),
('rencanaap','rencanaap','Rencana Ajuan RPS AP',NULL,1),
('rpsaphp','rpsaphp','RPS APHP','aphp',0),
('rpstp','rpstp','RPS Teknik Pemesinan','tp',0),
('k24','k24','Ruang Kelas 24','k3',0),
('toilet4','toilet4','Toilet',NULL,1),
('rpsap','rpsap','RPS AP','ap',0),
('ruangserba','ruangserba','Ruang Tambahan',NULL,1),
('kepsek','kepsek','Ruang Kepala Sekolah',NULL,1),
('gudang','gudang','Gudang',NULL,1),
('tu','tu','Ruang Tata Usaha',NULL,1);

-- ============================================================
-- SEED CONTOH — silakan ganti/lengkapi lewat dashboard admin.
-- Ini hanya menunjukkan mekanismenya sesuai contoh dari kamu:
-- 11 TJKT 1 - MTK - Bu Ema (menempati Ruang Kelas 11)
-- 11 TO 1   - MTK - Pak Ari (menempati Ruang Kelas 10)
-- ============================================================
INSERT INTO classes (name, sort_order) VALUES
('11 TJKT 1', 1),
('11 TO 1', 2);

INSERT INTO teachers (name, room_id) VALUES
('Ema', 'k11'),
('Ari', 'k10');

INSERT INTO subject_codes (code, mapel_name, is_field_activity) VALUES
('MTK', 'Matematika', 0),
('B.IND', 'Bahasa Indonesia', 0),
('B.ING', 'Bahasa Inggris', 0),
('PJOK', 'PJOK', 0),
('Upacara', 'Upacara/Apel', 1),
('Ekskul', 'Ekstrakurikuler', 1);

-- Contoh isi jadwal Senin, jam 1-3 = MTK untuk kedua kelas (guru beda).
INSERT INTO schedule (class_id, day, slot_key, subject_code, teacher_id)
SELECT id, 'Senin', 'j1', 'MTK', (SELECT id FROM teachers WHERE name='Ema') FROM classes WHERE name='11 TJKT 1';
INSERT INTO schedule (class_id, day, slot_key, subject_code, teacher_id)
SELECT id, 'Senin', 'j2', 'MTK', (SELECT id FROM teachers WHERE name='Ema') FROM classes WHERE name='11 TJKT 1';
INSERT INTO schedule (class_id, day, slot_key, subject_code, teacher_id)
SELECT id, 'Senin', 'j3', 'MTK', (SELECT id FROM teachers WHERE name='Ema') FROM classes WHERE name='11 TJKT 1';

INSERT INTO schedule (class_id, day, slot_key, subject_code, teacher_id)
SELECT id, 'Senin', 'j1', 'MTK', (SELECT id FROM teachers WHERE name='Ari') FROM classes WHERE name='11 TO 1';
INSERT INTO schedule (class_id, day, slot_key, subject_code, teacher_id)
SELECT id, 'Senin', 'j2', 'MTK', (SELECT id FROM teachers WHERE name='Ari') FROM classes WHERE name='11 TO 1';
INSERT INTO schedule (class_id, day, slot_key, subject_code, teacher_id)
SELECT id, 'Senin', 'j3', 'MTK', (SELECT id FROM teachers WHERE name='Ari') FROM classes WHERE name='11 TO 1';
