# Monitoring Pengiriman — versi GitHub Pages (data real-time)

Paket ini berisi versi dashboard yang **mengambil data langsung dari Google Sheet setiap kali halaman dibuka**, tanpa perlu proses ETL manual lagi. Cukup hosting statis di GitHub Pages.

## Isi paket

- `index.html` — halaman dashboard (sama seperti versi sebelumnya, ditambah bagian pengambil data live)
- `etl-client.js` — versi JavaScript dari `etl_v6.py`, jalan di browser pengunjung untuk mengubah data mentah sheet menjadi format yang dipakai dashboard. Mencocokkan kolom **berdasarkan nama header**, sama seperti skrip Python sebelumnya — jadi tetap aman kalau kolom baru ditambahkan di sheet nanti, selama nama header kolom yang sudah ada tidak diubah/dihapus.

⚠️ **Penting soal kerahasiaan data**: GitHub Pages, bahkan dari repo *private* sekalipun, defaultnya menghasilkan halaman yang **bisa diakses siapa saja yang tahu link-nya** (tidak ada login). Karena isi dashboard ini data pengiriman internal Kawan Lama, pastikan itu sesuai kebijakan perusahaan sebelum publish — kalau perlu akses dibatasi, opsinya pakai GitHub Enterprise Cloud (ada fitur Pages access control) atau hosting internal lain, bukan GitHub Pages biasa.

---

## Langkah 1 — Publish Google Sheet sebagai CSV

Ini yang membuat data bisa diambil browser secara real-time tanpa perlu API key.

1. Buka Google Sheet **"Monitoring Pengiriman Laut (New)"**.
2. Klik **File → Share → Publish to web**.
3. Di dropdown pertama, pilih tab sheet yang berisi data mentah (yang selama ini dipakai, sheet **"Data"**) — jangan pilih "Entire document".
4. Di dropdown kedua, pilih **Comma-separated values (.csv)**.
5. Klik **Publish**, konfirmasi.
6. Copy link yang muncul — bentuknya kira-kira:
   ```
   https://docs.google.com/spreadsheets/d/e/2PACX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx/pub?gid=123456789&single=true&output=csv
   ```

Simpan link ini, dipakai di Langkah 2.

**Catatan**: "Publish to web" berbeda dengan sharing biasa — ini yang membuat Google mengizinkan halaman lain (dashboard kita) mengambil datanya lewat browser tanpa harus login. Setelah dipublish, Google Sheets sendiri yang menjaga link ini tetap sinkron dengan isi sheet (biasanya update dalam beberapa menit setelah sheet diedit).

---

## Langkah 2 — Isi URL CSV ke dashboard

1. Buka `index.html` dengan text editor apa saja.
2. Cari baris ini (dekat awal file, sebelum penutup `</head>`):
   ```js
   var DASHBOARD_CSV_URL = "GANTI_DENGAN_URL_CSV_PUBLISH_TO_WEB";
   ```
3. Ganti bagian `"GANTI_DENGAN_URL_CSV_PUBLISH_TO_WEB"` dengan link CSV dari Langkah 1, jadi misalnya:
   ```js
   var DASHBOARD_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-xxxxx/pub?gid=123456789&single=true&output=csv";
   ```
4. Simpan file.

---

## Langkah 3 — Push ke GitHub

Karena kamu sudah punya repo, cukup:

```bash
# di folder repo kamu
cp index.html etl-client.js .
git add index.html etl-client.js
git commit -m "Tambah dashboard monitoring pengiriman (live dari Google Sheet)"
git push
```

Kalau mau taruh di subfolder (misal `docs/`), pastikan langkah "Enable GitHub Pages" di bawah diarahkan ke folder yang sama.

---

## Langkah 4 — Aktifkan GitHub Pages

1. Buka repo di GitHub → tab **Settings** → menu **Pages** (di sidebar kiri).
2. Di bagian **Build and deployment → Source**, pilih **Deploy from a branch**.
3. Di **Branch**, pilih branch tempat kamu push (biasanya `main`), dan folder **`/ (root)`** — atau `/docs` kalau kamu taruh di situ.
4. Klik **Save**.
5. Tunggu 1–2 menit, GitHub akan menampilkan URL dashboard-nya, biasanya berbentuk:
   ```
   https://<username-atau-org>.github.io/<nama-repo>/
   ```

Setelah itu, setiap kali ada yang membuka link tersebut, `index.html` akan otomatis fetch data terbaru dari Google Sheet dan olah datanya langsung di browser mereka — tidak perlu proses manual apa pun lagi dari sisi kamu.

---

## Cara kerja singkat

- Saat halaman dibuka, dashboard langsung tampil dengan data snapshot terakhir yang "dibekukan" di dalam `index.html` (supaya tidak blank sambil menunggu).
- Begitu data live selesai diambil & diproses (biasanya 1–2 detik), tampilan otomatis di-refresh dengan data real-time dari sheet.
- Status pengambilan data ditampilkan di pojok kanan atas header ("Data live dari Google Sheet" / pesan error kalau gagal).
- Kalau fetch gagal (misal link CSV salah, sheet belum dipublish, atau koneksi bermasalah), dashboard tetap menampilkan snapshot terakhir dan memberi tahu di status header — tidak sampai blank/error total.

## Kalau ingin snapshot di dalam file ikut ter-update juga (opsional)

`index.html` yang di-push berisi data snapshot per tanggal ini sebagai fallback. Ini tidak wajib diperbarui karena data live akan selalu menggantikannya begitu fetch berhasil — tapi kalau suatu saat kamu mau snapshot fallback-nya juga segar, tinggal minta saya generate ulang `index.html` dengan data terbaru dan kirim ulang file-nya untuk di-push.

## Kalau nanti mau menambah kolom lagi di sheet

Sama seperti sebelumnya — aman selama nama header kolom yang sudah dipakai dashboard tidak diubah/dihapus (daftar lengkapnya ada di komentar bagian atas `etl-client.js`, sama seperti dulu didiskusikan untuk `etl_v6.py`).
