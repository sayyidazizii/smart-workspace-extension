# Smart Workspace Extension

Ekstensi peramban berbasis Chromium (Manifest V3) yang memadukan
manajemen fokus aktivitas dengan *privacy gateway* berbasis AI lokal —
sesuai dokumen rancang bangun "Smart Workspace Extension".

## Cara Instalasi (Developer Mode)

1. Ekstrak folder `smart-workspace-extension` ini ke lokasi permanen di
   komputer Anda (jangan di folder Downloads yang sering dibersihkan).
2. Buka Chrome/Edge/Brave, arahkan ke `chrome://extensions`.
3. Aktifkan **Developer mode** (kanan atas).
4. Klik **Load unpacked**, lalu pilih folder `smart-workspace-extension`.
5. Ikon "SW" akan muncul di toolbar.

## Cara Penggunaan

### 1. Nama Panggilan
- Di bagian atas popup ada sapaan "Halo, {nama}". Klik ikon pensil ✏️
  di sampingnya untuk mengubah nama panggilan, ketik nama baru, lalu
  klik **Simpan** (atau klik di luar kolom — otomatis tersimpan).

### 2. Konfigurasi Profil & Kata Kunci
- Klik ikon ekstensi → tab **Profiles**.
- Tiga profil bawaan tersedia: *Mode Kerja*, *Mode Belajar/Kuliah*,
  *Mode Santai* — masing-masing dengan daftar domain contoh.
- Klik **+ Tambah Profil Baru** untuk membuat profil sendiri (nama,
  domain diizinkan, domain dibisukan, ikon emoji).
- Klik ikon 🗑️ di kanan tiap kartu profil untuk **menghapus profil**
  tersebut (minimal harus tersisa satu profil).
- Tab **Keywords** untuk mendaftarkan kata kunci rahasia kustom (nama
  proyek internal, nama klien, dsb.) dan mengaktifkan/menonaktifkan
  detektor bawaan (NIK, Email, API Key, Nomor Kartu).

### 3. Aktivasi Profil
- Klik sakelar pada kartu profil yang diinginkan.
- Tab di domain yang **dibisukan** otomatis di-mute.
- Tab di luar domain **diizinkan** otomatis dikelompokkan & dikolaps ke
  grup "Lainnya" agar tidak mengganggu fokus.

### 4. Interaksi Aman di Platform AI
- Buka ChatGPT, Claude, atau Gemini seperti biasa.
- Saat Anda mengetik/menempel teks yang mengandung data sensitif lalu
  menekan Enter atau tombol kirim, ekstensi akan **menahan pengiriman**
  dan menampilkan gelembung konfirmasi berisi daftar item terdeteksi.
- Pilih:
  - **Kirim dengan Samaran** — teks otomatis diganti token
    (`[REDACTED_NIK]`, `[REDACTED_EMAIL]`, dst.) lalu terkirim.
  - **Tetap Kirim Asli** — teks asli tetap dikirim tanpa perubahan
    (dicatat sebagai override).

### 5. Dashboard Analitik
- Klik tab **Dashboard** pada popup untuk membuka halaman penuh berisi:
  Safety Score, total peristiwa dicegat, jenis data tersering, rasio
  tindakan (disamarkan vs. dikirim asli), grafik frekuensi mingguan,
  dan log audit terbaru.
- Tombol **Ekspor CSV/JSON** mengunduh seluruh riwayat log secara lokal.

### 6. Local Memory Usage & Hapus Data
- Di bawah daftar profil ada indikator **Local Memory Terpakai** —
  menunjukkan berapa banyak `chrome.storage.local` yang sudah dipakai
  ekstensi ini (dari kuota 10 MB) dan bertambah otomatis setiap ada
  perubahan data.
- Tombol **🗑️ Hapus Semua Data Lokal** menghapus seluruh profil, kata
  kunci kustom, nama panggilan, dan log audit dari browser ini, lalu
  mengembalikan ekstensi ke kondisi bawaan (3 profil default). Akan
  ada konfirmasi sebelum data benar-benar terhapus, dan tindakan ini
  **tidak bisa dibatalkan**.

## Catatan Teknis & Batasan

- **Semua pemrosesan berjalan on-device** melalui `chrome.storage.local`
  — tidak ada data yang dikirim ke server pihak ketiga.
- Selector DOM untuk kolom input & tombol kirim di ChatGPT/Claude/Gemini
  didefinisikan di `content.js` (`SITE_CONFIG`). Platform pihak ketiga
  kerap mengubah struktur halaman mereka — jika deteksi berhenti bekerja
  di satu situs, periksa dan perbarui selector tersebut.
- Validasi NIK bersifat heuristik ringan (format 16 digit + rentang kode
  provinsi/bulan lahir), bukan validasi resmi Dukcapil.
- Deteksi nomor kartu menggunakan algoritma Luhn untuk mengurangi
  positif-palsu, namun tetap heuristik.
- Pengelompokan tab memerlukan izin `tabGroups`, yang tersedia di Chrome
  versi modern; jika API tidak tersedia, ekstensi tetap menjalankan
  fungsi mute tanpa grouping.

## Struktur Folder

```
smart-workspace-extension/
├── manifest.json
├── background.js        # Service worker: profil, mute/group tab, audit log
├── content.js            # Pemindai input & gelembung konfirmasi di situs AI
├── content.css
├── popup.html/.css/.js   # UI popup: profil, keywords, detektor
├── dashboard.html/.css/.js  # Dashboard analitik risiko
├── lib/sanitizer.js      # Mesin deteksi & penyamaran data sensitif
└── icons/
```
