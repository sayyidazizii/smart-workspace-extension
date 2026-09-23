# Smart Workspace Extension

Ekstensi peramban berbasis Chromium (Manifest V3) yang memadukan manajemen fokus aktivitas dengan *privacy gateway* berbasis AI lokal — sesuai dokumen rancang bangun "Smart Workspace Extension".

## Cara Instalasi (Developer Mode)

1. Ekstrak folder `smart-workspace-extension` ini ke lokasi permanen di komputer Anda (jangan di folder Downloads yang sering dibersihkan).
2. Buka Chrome/Edge/Brave, arahkan ke `chrome://extensions`.
3. Aktifkan **Developer mode** (kanan atas).
4. Klik **Load unpacked**, lalu pilih folder `smart-workspace-extension`.
5. Ikon "SW" akan muncul di toolbar browser.

## Fitur & Cara Penggunaan

### 1. Indikator Local Memory Lingkaran (Model Baterai HP)
- Di bagian atas popup terdapat **indikator lingkaran pemakaian memory lokal** (bergaya baterai handphone) yang menampilkan persentase pemakaian `chrome.storage.local` secara *real-time* (kuota 10 MB).
- Dilengkapi status keamanan (*Aman*, *Waspada*, *Penuh*) serta tombol reset untuk menghapus seluruh data lokal bila diperlukan.

### 2. Manajemen Mode Horizontal ("Kekanan") & Pencarian Dinamis
- Daftar mode ruang kerja ditampilkan dalam format **kartu berjajar ke kanan (horizontal scroll carousel)**, bukan list ke bawah.
- **Pencarian Dinamis (Live Search)**: Tersedia kolom pencarian nama mode di bagian atas daftar. Pengguna cukup mengetik nama mode dan daftar kartu akan terfilter secara instan.
- **Ikon Mode**: Semua ikon menggunakan pustaka **Bootstrap Icons** (tanpa emotikon dan tanpa SVG).

### 3. Detail Aturan Mode (Ikon Mata) & Fitur Edit Mode
- **Ikon Mata** di sebelah tombol tempat sampah (trash) pada tiap kartu:
  - Klik untuk membuka jendela modal **Detail Mode**.
  - Melihat secara jelas daftar **Domain Diizinkan (Allowed)** dengan badge hijau centang.
  - Melihat daftar **Domain Dibisukan (Muted)** dengan badge merah mute.
- **Ikon Pensil (Edit Mode)**:
  - Mengubah nama mode.
  - Memilih ikon dari pemilih visual Bootstrap Icons.
  - Mengedit daftar domain yang diizinkan dan dibisukan.
- **Tambah Mode Baru**: Tombol "+ Tambah Mode" membuka formulir interaktif pembuatan mode baru.

### 4. Pencegahan & Detail Data Kebocoran Sensitif
- Memindai secara *real-time* sebelum prompt dikirim ke ChatGPT, Claude, atau Gemini:
  - NIK (KTP Indonesia dengan validasi digit provinsi & bulan)
  - Alamat Email
  - Nomor Kartu Kredit / Debit (validasi algoritma Luhn)
  - API Key & Token Rahasia (OpenAI, GitHub, AWS, Bearer, dsb.)
  - Kata Kunci Kustom (nama proyek rahasia, klien, dsb.)
- **Detail Data Yang Bocor Ditampilkan**:
  - Pada jendela *popover konfirmasi*: Menampilkan jenis data, jumlah, potongan nilai yang terdeteksi, dan tombol pratinjau teks tersensor sebelum dikirim.
  - Pada kartu ringkasan popup: Menampilkan peristiwa kebocoran terakhir yang berhasil dicegat.
  - Pada **Dashboard Keamanan**: Log audit menampilkan rincian tabel data yang bocor (nilai sensitif, jumlah, token pengganti, domain tujuan, mode saat kejadian, dan cuplikan pesan asli).
  - Ekspor log dalam format CSV dan JSON kini menyertakan seluruh rincian data kebocoran.

### 5. Aktivasi & Pengendalian Tab Otomatis
- Mengaktifkan mode cukup dengan menekan sakelar toggle pada kartu mode.
- Tab dengan domain dibisukan otomatis dimatikan suaranya (*audio mute*).
- Tab di luar domain yang diizinkan otomatis dikelompokkan ke grup tab *"Lainnya"* untuk meminimalkan distraksi.

## Ringkasan Perubahan Aset & Komponen
- **Pustaka Ikon**: Sepenuhnya menggunakan Bootstrap Icons lokal (`lib/bootstrap-icons/`), tanpa emotikon, tanpa SVG tag untuk ikon.
- **Tata Letak**: Responsif, ramah navigasi horizontal, modal interaktif, dan visualisasi bar lingkaran berbasis CSS modern (*zero external network requirement*).
