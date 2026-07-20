# Papan Jadwal Hidup — versi Cloudflare Pages + D1

Tampilan (HTML/CSS) **sama persis** dengan versi sebelumnya — cuma ditambah
satu dropdown pemilih kelas di header. Yang berubah total adalah cara
hosting-nya, supaya bisa jalan di Cloudflare (gratis) dengan domain `.my.id`
kamu, dan supaya satu website ini bisa melayani **banyak kelas** dengan
**guru berbeda-beda per kelas** untuk mapel yang sama.

📄 **Baca `DEPLOY.md` untuk langkah deploy lengkap, urut dari awal.**

## Struktur folder
```
├── public/              halaman publik yang dilihat pengunjung (Cloudflare Pages)
│   ├── index.html        desain sama seperti sebelumnya + dropdown kelas
│   ├── css/style.css
│   ├── js/app.js
│   └── admin/            login.html + dashboard.html untuk kelola data
├── functions/            backend API (Cloudflare Pages Functions)
│   ├── api/               endpoint publik (classes, rooms, schedule)
│   └── api/admin/         endpoint admin (perlu login JWT)
├── schema.sql            skema + contoh data awal untuk Cloudflare D1
├── scripts/create-admin.js   generator akun admin pertama (jalan lokal)
├── wrangler.toml         konfigurasi Cloudflare Pages + binding D1
└── DEPLOY.md             panduan deploy step-by-step
```

## Konsep inti: ruang menyala ikut GURU, bukan ikut mapel
Sebelumnya satu mapel = satu/beberapa ruang tetap. Sekarang:
- Setiap **guru** ditugaskan ke satu **ruang** di denah.
- Jadwal tiap kelas diisi dengan **mapel + guru** untuk tiap jam.
- Saat jam pelajaran berlangsung, sistem mencari guru yang mengajar kelas
  yang sedang dipilih, lalu menyalakan ruang milik guru itu.

Jadi kelas **11 TJKT 1** jam MTK dengan Bu **Ema** menyalakan ruang Ema,
sementara kelas **11 TO 1** jam MTK (jam yang sama) dengan Pak **Ari**
menyalakan ruang Ari — meski mapelnya sama-sama MTK.

## Keamanan
- Password admin di-hash (PBKDF2-SHA256, 150.000 iterasi) — tidak pernah
  disimpan/dikirim polos.
- Login pakai token JWT (HS256) yang ditandatangani dengan `JWT_SECRET`
  rahasia (disimpan sebagai Cloudflare secret, bukan di kode).
- Semua endpoint `admin/*` wajib token valid.
- Rate limit percobaan login: maks 8x/15 menit per IP (tersimpan di D1),
  bisa ditambah lapisan Cloudflare WAF rate limiting (lihat `DEPLOY.md`).
- Semua query D1 pakai prepared statement (`?` placeholder) — tidak ada
  string concat ke SQL, jadi aman dari SQL injection.
- Header keamanan dasar (`X-Content-Type-Options`, `X-Frame-Options`,
  CSP, dll) dipasang lewat `functions/_middleware.js`.
- HTTPS otomatis & gratis dari Cloudflare begitu domain `.my.id` terpasang.
- Token admin disimpan di `sessionStorage` (hilang saat tab ditutup),
  bukan `localStorage`.

## Menjalankan lokal (opsional, sebelum deploy)
```bash
npm install -g wrangler
wrangler d1 create papan-jadwal-db      # sekali saja, lalu isi database_id di wrangler.toml
wrangler d1 execute papan-jadwal-db --local --file=./schema.sql
wrangler pages dev public
```
Buka `http://localhost:8788`.
