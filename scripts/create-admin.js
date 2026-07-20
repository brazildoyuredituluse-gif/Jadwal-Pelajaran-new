#!/usr/bin/env node
// Jalankan LOKAL di komputer kamu (bukan di Cloudflare) untuk membuat baris SQL
// akun admin pertama. Password TIDAK PERNAH dikirim/disimpan polos di database;
// yang disimpan hanya hash + salt (PBKDF2-SHA256, 150000 iterasi), sama persis
// dengan cara verifikasinya di functions/lib/auth.js.
//
// Pemakaian:
//   node scripts/create-admin.js <username> <password> ["Nama Lengkap"]
//
// Lalu salin perintah `wrangler d1 execute` yang dicetak di bagian bawah,
// atau tempel query INSERT-nya lewat Cloudflare Dashboard > D1 > Console.

const crypto = require('crypto');

function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const [, , username, password, fullName] = process.argv;
if (!username || !password) {
  console.error('Pemakaian: node scripts/create-admin.js <username> <password> ["Nama Lengkap"]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Gunakan password minimal 8 karakter (disarankan lebih panjang + acak).');
  process.exit(1);
}

const salt = crypto.randomBytes(16);
const hash = crypto.pbkdf2Sync(password, salt, 150000, 32, 'sha256');

const hashB64 = b64url(hash);
const saltB64 = b64url(salt);
const nameEscaped = (fullName || username).replace(/'/g, "''");
const userEscaped = username.replace(/'/g, "''");

const sql = `INSERT INTO admin_users (username, password_hash, password_salt, full_name)
VALUES ('${userEscaped}', '${hashB64}', '${saltB64}', '${nameEscaped}')
ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, password_salt = excluded.password_salt;`;

console.log('\n--- Salin & jalankan query ini di D1 (lihat DEPLOY.md) ---\n');
console.log(sql);
console.log('\n--- Atau langsung lewat wrangler (ganti nama-db-mu) ---\n');
console.log(`wrangler d1 execute NAMA_DATABASE_D1 --remote --command "${sql.replace(/\n/g, ' ').replace(/"/g, '\\"')}"`);
