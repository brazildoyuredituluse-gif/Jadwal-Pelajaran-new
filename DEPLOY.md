# Cara Deploy — Cloudflare Pages + D1 + domain .my.id

Arsitektur baru (beda dari versi Node/Express+MySQL sebelumnya, karena
Cloudflare tidak menjalankan server Node/MySQL biasa):

- **Frontend** (`public/`) → di-hosting sebagai **Cloudflare Pages** (static).
- **Backend API** (`functions/`) → **Cloudflare Pages Functions**
  (serverless, jalan otomatis mengikuti Pages, tidak perlu server terpisah).
- **Database** → **Cloudflare D1** (SQLite yang dikelola Cloudflare,
  pengganti MySQL).
- **Domain** → domain `.my.id` yang sudah kamu punya, di-pointing ke Cloudflare.

Semua gratis di paket Cloudflare Free untuk skala sekolah seperti ini.

---

## 0. Yang perlu disiapkan
- Akun Cloudflare (gratis) — https://dash.cloudflare.com/sign-up
- Domain `.my.id` yang sudah kamu beli
- Node.js terpasang di komputer (untuk menjalankan `wrangler` dan membuat
  akun admin pertama)
- Folder project ini (`school-schedule` versi Cloudflare)

Install Wrangler (CLI resmi Cloudflare) sekali saja:
```bash
npm install -g wrangler
wrangler login
```
Ini akan membuka browser untuk login ke akun Cloudflare kamu.

---

## 1. Tambahkan domain .my.id ke Cloudflare
1. Di dashboard Cloudflare → **Add a site** → masukkan domain `.my.id` kamu.
2. Pilih paket **Free**.
3. Cloudflare akan menampilkan 2 **nameserver** (contoh: `ana.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
4. Masuk ke tempat kamu membeli domain `.my.id` (PANDI/registrar-nya), ganti
   nameserver domain ke 2 nameserver dari Cloudflare tadi.
5. Tunggu propagasi (biasanya menit-jam, kadang sampai 24 jam). Cloudflare
   akan mengirim email saat domain aktif.

---

## 2. Buat database D1
Dari folder project ini:
```bash
wrangler d1 create papan-jadwal-db
```
Perintah ini mencetak `database_id`. **Salin ID itu**, lalu buka
`wrangler.toml` dan tempel menggantikan
`GANTI_DENGAN_DATABASE_ID_HASIL_WRANGLER_D1_CREATE`.

Lalu jalankan skema + data awal ke database tersebut:
```bash
wrangler d1 execute papan-jadwal-db --remote --file=./schema.sql
```
`--remote` supaya langsung masuk ke database asli di Cloudflare (bukan cuma
simulasi lokal).

---

## 3. Buat akun admin pertama
Password TIDAK PERNAH ditulis di file mana pun — script ini hanya menghasilkan
**hash**-nya di layar kamu:
```bash
node scripts/create-admin.js admin "PasswordPanjangDanAcakMu123!" "Nama Admin"
```
Salin perintah `wrangler d1 execute ...` yang tercetak di bagian bawah output,
lalu jalankan (atau tempel query SQL-nya lewat Cloudflare Dashboard → D1 →
database kamu → tab **Console**).

Ganti username/password contoh di atas — jangan pernah pakai nilai contoh.

---

## 4. Set rahasia JWT_SECRET
Ini kunci untuk menandatangani token login admin — wajib string acak panjang,
**jangan** ditulis di kode:
```bash
wrangler pages secret put JWT_SECRET --project-name papan-jadwal-hidup
```
Saat diminta, masukkan string acak panjang (min. 32 karakter). Contoh cara
generate: `openssl rand -base64 48`.

---

## 5. Deploy ke Cloudflare Pages
Opsi termudah — langsung dari CLI:
```bash
wrangler pages deploy public --project-name papan-jadwal-hidup
```
Wrangler otomatis membaca `functions/` di root project untuk backend API,
dan mengikat D1 sesuai `wrangler.toml`.

> **Alternatif (disarankan untuk jangka panjang):** hubungkan project ke
> repo Git (GitHub/GitLab) lewat Cloudflare Dashboard → Pages → Create
> project → Connect to Git. Dengan begitu setiap kamu `git push`,
> Cloudflare otomatis build & deploy ulang, tanpa perlu jalankan wrangler
> manual tiap kali ada perubahan. Build command dikosongkan saja,
> **build output directory** diisi `public`.

Setelah deploy pertama, cek dashboard project Pages-mu untuk memastikan
binding D1 (`DB`) sudah terpasang di tab **Settings → Functions →
D1 database bindings**. Kalau lewat CLI dengan `wrangler.toml` biasanya
otomatis terpasang; kalau lewat Dashboard, tambahkan manual di situ
(pilih database `papan-jadwal-db`, binding name `DB`) untuk environment
**Production** (dan **Preview** kalau mau).

---

## 6. Pasang domain .my.id ke project Pages
1. Di dashboard Cloudflare → **Workers & Pages** → pilih project
   `papan-jadwal-hidup` → tab **Custom domains**.
2. Klik **Set up a custom domain**, masukkan domain/subdomain kamu, misalnya
   `jadwal.namasekolahmu.my.id` (atau domain utamanya langsung).
3. Cloudflare otomatis membuatkan DNS record dan sertifikat HTTPS gratis.
   Tunggu beberapa menit sampai status "Active".

Buka `https://jadwal-domainmu.my.id` — halaman jadwal publik akan tampil,
dan `https://jadwal-domainmu.my.id/admin/login.html` untuk login admin.

---

## 7. Pengamanan tambahan yang disarankan (opsional tapi bagus)
Semua ini diatur di dashboard Cloudflare, gratis:
- **SSL/TLS → Overview**: set mode ke **Full (strict)**.
- **SSL/TLS → Edge Certificates**: aktifkan **Always Use HTTPS** dan
  **Automatic HTTPS Rewrites**.
- **Security → WAF → Rate limiting rules**: buat 1 rule (gratis dapat
  beberapa rule dasar) untuk membatasi request ke `/api/admin/login`,
  misal maks 10 request/menit per IP — ini lapisan tambahan di luar
  rate-limit yang sudah ada di kode (`login_attempts` table).
- **Security → Bots**: aktifkan proteksi bot dasar (gratis) untuk
  mengurangi bot scraping/brute force.

---

## 8. Menambahkan kelas, guru, dan jadwal
Semua dikerjakan lewat **dashboard admin** (`/admin/login.html`), tidak perlu
edit kode atau database manual lagi:
1. **Kelola Kelas** → tambahkan tiap kelas (mis. `11 TJKT 1`, `11 TO 1`, dst).
2. **Kelola Guru** → tambahkan tiap guru + ruang yang ia "tempati" di denah
   (mis. Ema → Ruang Kelas 11, Ari → Ruang Kelas 10).
3. **Kelola Mata Pelajaran** → tambahkan kode mapel (mis. `MTK`,
   `B.IND`, dst) dan nama tampilannya.
4. **Edit Jadwal** → pilih kelas, lalu untuk tiap hari/jam pilih mapel &
   gurunya. Begitu kamu ganti pilihan, otomatis tersimpan ke database.

Hasilnya persis seperti contoh yang kamu mau: kelas **11 TJKT 1** jam MTK
dengan guru **Ema** akan menyalakan ruang milik Ema, sedangkan kelas
**11 TO 1** jam MTK dengan guru **Ari** menyalakan ruang milik Ari —
walau sama-sama "MTK" dan sama-sama jam yang sama, ruang yang menyala
mengikuti guru masing-masing kelas.

---

## 9. Update di kemudian hari
Kalau kamu edit file lokal (`public/`, `functions/`) lagi:
```bash
wrangler pages deploy public --project-name papan-jadwal-hidup
```
Kalau pakai koneksi Git, cukup `git push`.

Kalau kamu ubah `schema.sql` (menambah tabel/kolom baru), jalankan lagi:
```bash
wrangler d1 execute papan-jadwal-db --remote --file=./schema.sql
```
⚠️ **Perhatian**: `schema.sql` versi ini pakai `DROP TABLE IF EXISTS` di
awal — cocok untuk setup awal, tapi kalau dijalankan ulang setelah kamu
sudah mengisi banyak data lewat dashboard, **isi lama akan hilang**. Untuk
perubahan struktur di kemudian hari, buat file migrasi baru yang hanya
berisi `ALTER TABLE ...` / `CREATE TABLE IF NOT EXISTS ...` tanpa `DROP`.
