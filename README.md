# Luncur — Upload ZIP, dapatkan URL

Luncur adalah dashboard deployment ber-branding sendiri untuk menerbitkan website statis melalui Vercel API. Pengguna cukup upload ZIP dan mendapatkan URL; tidak perlu GitHub untuk setiap website.

## Cara memasukkan token langsung ke file backend
1. Buka file `lib/private-config.js`.
2. Ubah baris `export const VERCEL_TOKEN = '';` menjadi `export const VERCEL_TOKEN = 'TEMPEL_TOKEN_VERCEL_DI_SINI';`
3. Simpan file, lalu deploy ulang aplikasi Luncur.
4. Buka dashboard Luncur dan tunggu status koneksi diperiksa.

Token juga bisa diberikan lewat environment variable `VERCEL_TOKEN`; jika keduanya diisi, environment variable yang dipakai.

## PENTING — keamanan token
- Jangan taruh token di `public/index.html` atau JavaScript frontend. File `lib/private-config.js` dipakai oleh backend functions.
- Karena token ditulis di source code, simpan repository GitHub sebagai **PRIVATE** dan jangan bagikan ZIP/source yang berisi token. Siapa pun yang mendapat source file tersebut bisa membaca token. Untuk layanan publik, environment variable/secret manager lebih aman.
- Jika token pernah terunggah ke repository publik atau terbagi ke orang lain, segera revoke dan buat token baru di https://vercel.com/account/tokens.
- Batasi akses dashboard Luncur dengan autentikasi sebelum membukanya untuk umum.

## Fitur dan batasan
- Upload ZIP maksimal 15 MB, hasil ekstrak maksimal 30 MB, maksimal 100 file.
- Mendukung website statis dan hasil build siap publikasi. ZIP harus berisi `index.html` di root atau satu folder di dalam ZIP.
- Nama URL otomatis atau bisa ditentukan; target Production atau Preview.
- Source project yang membutuhkan build (misalnya source React/Vite/Next.js mentah) belum dibuild otomatis. Upload isi folder hasil build seperti `dist`.

## Jalankan lokal via Termux
```sh
pkg update && pkg install nodejs -y
npm install
npx vercel dev
```
