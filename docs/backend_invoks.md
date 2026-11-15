# INVOKS Backend — Rencana Database

Dokumen ini adalah panduan membangun database dan backend INVOKS secara bertahap. Bisa dipakai siapa saja: developer, tim, maupun AI assistant.

- **Stack:** Express.js + TypeScript + Drizzle ORM (`drizzle-orm` 0.45.x) + MariaDB (XAMPP)
- **Storage foto:** Cloudinary (mode Dynamic folders)
- **Klien:** Flutter (mahasiswa), Next.js (admin)
- **Tujuan:** menambah tabel satu kelompok dependensi pada satu waktu, tanpa merusak login/register yang sudah berfungsi.

## 0. Status Pengerjaan

| Tahap | Status | Catatan |
|---|---|---|
| 00 Cek kondisi awal | Selesai | |
| 01 User & role | Selesai | Login/register berjalan; admin dibuat lewat seed |
| 02 Gedung, ruangan, fasilitas, foto | Selesai | Foto sudah di Cloudinary; semua tes POST/PUT/GET lulus |
| 03 Booking ruangan | **Berikutnya** | Putuskan dulu 3 hal di bagian 7 |
| 04 sampai 09 | Belum | |

Langkah tambahan di luar nomor tahap yang sudah selesai: **pemindahan penyimpanan foto dari folder lokal `uploads/` ke Cloudinary** (lihat bagian 5).

## 1. Gambaran Fitur

- INVOKS melayani peminjaman **ruangan** (Gedung KP, BNI, Dieng; filter lantai) dan **barang** (Elektronik dan Furnitur).
- **User:** register/login, lihat katalog, meminjam, dan lihat peminjaman miliknya sendiri.
- **Admin:** login, kelola ruangan/barang, lihat semua peminjaman, konfirmasi pengembalian barang per unit.
- Booking berhasil **langsung tanpa approval**, tetapi ketersediaan wajib dicek saat submit.
- **Booking ruangan:** satu ruangan, satu kegiatan, boleh banyak tanggal dan slot 1 jam (07:00–19:00, boleh tidak berurutan). Status selesai otomatis berdasarkan waktu.
- **Peminjaman barang:** satu transaksi bisa berisi banyak unit fisik. Setiap unit punya kode inventaris unik yang dipilih sendiri oleh mahasiswa. Satu transaksi memakai satu rentang waktu.
- **Pengembalian barang:** dikonfirmasi admin per unit. Jadwal berakhir tidak berarti barang sudah kembali. Jika terlambat, mahasiswa mendapat reminder.
- **Foto:** satu foto wajib per ruangan dan per jenis barang, bisa diganti saat edit. Database menyimpan URL dan `public_id` Cloudinary; file disimpan di Cloudinary.
- Durasi peminjaman tidak dibatasi khusus, tetapi harus valid dan tersedia.

**Belum diputuskan (tandai "pending", jangan diimplementasikan dulu):**
- pembatalan booking (termasuk sebagian slot)
- pencatatan serah-terima awal barang
- aturan pemesanan barang di masa depan jika unit belum kembali
- jam layanan berbeda per gedung
- jadwal reminder

## 2. Aturan Pengerjaan

1. **Cek kondisi project dulu** sebelum mengubah apa pun: schema, migrasi, konfigurasi, dan auth. Samakan penamaan dan tipe ID dengan yang sudah ada (jangan paksa BIGINT).
2. **Jangan buat ulang tabel yang sudah ada** (`users`, `buildings`, `rooms`, `facilities`, `room_facilities`). Cukup periksa dan lengkapi seperlunya.
3. **Jangan rusak login/register**, bentuk JWT, hash password, dan middleware yang sudah jalan.
4. **Kerjakan satu tahap sekali.** Selesaikan dan tinjau dulu sebelum lanjut.
5. **Migrasi harus aman:** tinjau hasil migrasi sebelum diterapkan, backup database sebelum mengubah struktur, dan jangan pakai `push`, drop, reset, atau truncate tanpa alasan jelas.
6. **Jangan hapus data lama.** Untuk kolom wajib baru di tabel berisi data: buat nullable dulu, isi datanya, baru jadikan NOT NULL jika perlu (contoh: `rooms.image_url`).
7. Tipe FK harus sama dengan tipe PK, dan `ON DELETE` dipilih dengan sengaja. Untuk data yang punya riwayat, gunakan `is_active` (arsip), bukan hapus.
8. Buat index dan unique constraint yang relevan. Unique constraint **tidak cukup** untuk mencegah bentrok jadwal; gunakan transaksi dan locking.
9. Zona waktu `Asia/Jakarta`. Interval waktu `[start_at, end_at)`, jadi slot yang berakhir 10:00 tidak bentrok dengan slot mulai 10:00. Aturan penyimpanan waktu yang tepat ada di bagian 7.
10. Jangan taruh `.env`, password database, JWT secret, atau token OTP di log, output, atau repository.
11. **Jangan pakai Drizzle relational query (`db.query.x.findMany/findFirst` dengan `with:`).** Di MariaDB (XAMPP) query itu menghasilkan `left join lateral` yang ditolak (`ER_PARSE_ERROR`), dan `mode: "planetscale"` juga gagal (`ER_BAD_FIELD_ERROR`). Gunakan `select` biasa atau `join`, lalu gabungkan hasilnya di kode (contoh: `getRooms()` dan `getRoomById()` di `room.service.ts`).
12. **Cleanup foto hanya untuk kegagalan penyimpanan.** Pembacaan data untuk respons (misalnya `getRoomById`) harus berada di luar blok `try` yang membungkus insert/update, supaya kegagalan membaca tidak menghapus foto yang sudah terhubung ke baris database.
13. Jangan mengerjakan testing otomatis dulu. Verifikasi manual lewat Postman, dan jalankan `npm run typecheck` setiap selesai.

## 3. Urutan Tahap

| Tahap | Modul | Tabel / tujuan | Butuh |
|---|---|---|---|
| 00 | Cek kondisi awal | Lihat schema/migrasi yang ada, backup | — |
| 01 | User & role | `users` (periksa, bukan buat ulang) | 00 |
| 02 | Gedung & ruangan | `buildings`, `rooms`, `facilities`, `room_facilities` | 01 |
| 03 | Booking ruangan | `room_bookings`, `room_booking_slots` | 02 |
| 04 | Master barang | `item_categories`, `items`, `item_units` | 01 |
| 05 | Peminjaman barang | `item_borrowings`, `item_borrowing_units` | 04 |
| 06 | Pengembalian | Konfirmasi admin per unit (pakai tabel tahap 05) | 05 |
| 07 | Notifikasi & reminder | `notifications`, `reminder_logs` | 06 |
| 08 | Profil & reset password | `password_reset_tokens` | 01 |
| 09 | Pendukung (opsional) | `audit_logs`, `system_settings`, `idempotency_requests` | 03, 05–08 |

Jika sebuah tabel sudah ada, tahapnya cukup berupa pengecekan dan perubahan kecil.

## 4. Detail Tiap Tahap

### Tahap 00 — Cek kondisi awal
Tidak ada perubahan. Catat hal berikut:
- scripts `package.json`, versi Drizzle dan driver MySQL
- schema dan migrasi yang sudah ada
- tipe ID, penamaan kolom, timestamps, FK, dan index
- cara kerja register/login dan isi JWT
- tabel yang benar-benar ada di `invoks_db`

Hasilnya berupa daftar "yang sudah ada vs yang dibutuhkan" beserta risikonya.

### Tahap 01 — User & role
Kolom target `users` (sesuaikan dengan nama yang sudah ada):

`id`, `full_name`, `email` (unik), `password_hash`, `role` (`user`/`admin`, default `user`), `phone`, `profile_image_url`, `is_active`, `created_at`, `updated_at`.

- Sebagian kolom profil Tahap 08 sudah ada di tabel (misalnya `gender` dan kolom tanggal). Periksa schema sebelum menambah kolom baru.
- Jangan ganti nama kolom password, role, atau ID tanpa memperbarui semua tempat yang memakainya.
- Register publik **selalu** menghasilkan `user`, walau client mengirim `admin`.
- Admin dibuat lewat seed (`npm run db:seed`, membaca `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` dari `.env`) atau proses terkontrol, bukan registrasi terbuka.
- Seed **tidak mengubah password** admin yang sudah ada. Jika `ADMIN_PASSWORD` diganti sesudah admin dibuat, hash lama di database tetap berlaku.
- Role ada di dalam JWT. Setelah role seseorang diubah, user itu harus **login ulang** untuk mendapat token baru.
- Hak akses diputuskan backend lewat JWT, bukan oleh UI.

### Tahap 02 — Gedung, ruangan, fasilitas, foto (selesai)

| Tabel | Kolom penting | Aturan |
|---|---|---|
| `buildings` | id, name, code, description?, image_url?, is_active, timestamps | Nama unik; seed KP/BNI/Dieng tanpa duplikat |
| `rooms` | id, building_id, room_code, name, floor, capacity_min, capacity_max, description, image_url, image_public_id, status, is_active, timestamps | UNIQUE(building_id, room_code); kapasitas > 0 dan `capacity_min` <= `capacity_max` |
| `facilities` | id, name, icon, description?, timestamps | Nama unik |
| `room_facilities` | id, room_id, facility_id, quantity, created_at | UNIQUE(room_id, facility_id); quantity > 0 |

- `rooms.status` default `available`. Pastikan nilainya tidak bertabrakan dengan `is_active`: `is_active` untuk arsip, `status` untuk kondisi ruangan.
- Satu foto utama per ruangan: wajib saat tambah, bisa diganti saat edit. Tidak perlu tabel `room_images`.
- `rooms.image_public_id` (varchar 255, nullable) menyimpan `public_id` Cloudinary persis seperti yang dikembalikan saat upload. Nilainya dipakai untuk menghapus foto lama. Untuk ruangan lama yang belum punya nilai ini, penghapusan foto lama dilewati.
- Lantai disimpan di `rooms.floor`. Filter memakai `building_id` + `floor`, tanpa tabel floors.
- Field form-data untuk tambah/edit ruangan: `buildingId`, `roomCode`, `name`, `floor`, `capacityMax` (dan `capacityMin` jika diminta validator), `description`, dan file `image`.

### Tahap 03 — Booking ruangan (multi-tanggal / multi-slot)

**`room_bookings`** (data kegiatan)

| Kolom | Keterangan |
|---|---|
| `id` | PK, unik tiap transaksi (bukan `users.id`) |
| `booking_code` | Kode unik yang mudah dibaca |
| `user_id` | FK → users |
| `room_id` | FK → rooms (satu booking = satu ruangan) |
| `activity_name`, `activity_description`, `organizer` | Info kegiatan |
| `participant_count`, `pic_name`, `pic_phone` | Peserta dan PIC |
| `status` | `booked` / `cancelled` |
| `created_at`, `updated_at` | Timestamp |

**`room_booking_slots`** (detail jadwal)

| Kolom | Keterangan |
|---|---|
| `id` | PK |
| `room_booking_id` | FK → room_bookings (bukan user_id) |
| `room_id` | FK → rooms (usulan, lihat bagian 7) |
| `start_at`, `end_at` | Tanggal + jam lengkap satu slot |
| `created_at` | Timestamp |

Kolom `status`, `cancelled_at`, `cancelled_by_user_id` untuk slot **ditunda** sampai aturan pembatalan diputuskan.

Aturan:
- Slot berdurasi 1 jam (07:00–19:00). Satu tanggal boleh pilih jam terpisah, satu booking boleh banyak tanggal.
- Tidak boleh ada slot ganda dalam satu request atau bentrok dengan booking lain di ruangan yang sama.
- Semua slot dalam satu submit **atomik**: kalau satu slot bentrok, tidak ada yang tersimpan.
- Lock baris `rooms` sebelum cek bentrok, lalu simpan header dan slot dalam satu transaksi. Pastikan semua tabel memakai engine InnoDB.
- Validasi tambahan: ruangan harus aktif dan berstatus tersedia, `participant_count` tidak melebihi `capacity_max`, slot tidak boleh di masa lalu, dan jumlah slot per request dibatasi (lihat bagian 7).
- Index: `room_bookings(room_id, status)` dan `room_booking_slots(room_booking_id, start_at)`.
- Status mendatang/berlangsung/selesai **dihitung dari waktu**, tidak perlu diupdate manual.
- Query baca memakai `select`/`join` biasa, bukan `with:` (aturan 11).
- Contoh: Andi (`users.id=5`) booking pertama jadi `room_bookings.id=101`, booking berikutnya dapat ID lain, tetapi `user_id` tetap 5.

### Tahap 04 — Katalog dan unit barang

- **`item_categories`**: id, name (unik), slug (unik), timestamps. Seed **Elektronik** dan **Furnitur**.
- **`items`** (satu kartu katalog): id, category_id, name, description, specifications (JSON, opsional), image_url (wajib untuk data baru), image_public_id (nullable), is_active, timestamps.
- **`item_units`** (unit fisik): id, item_id, inventory_code (unik global), condition (`good` / `damaged` / `maintenance`), is_active, notes?, timestamps.

Aturan:
- **Tambah barang:** item + foto + satu atau lebih kode unit. Urutannya: validasi data, upload foto ke Cloudinary, simpan item dan semua unit dalam satu transaksi database, dan jika transaksi gagal, hapus foto dari Cloudinary. Pembacaan data respons dilakukan di luar blok `try` tersebut.
- **Edit barang:** ubah data/foto, kelola unit, dan tambah kode baru tanpa menduplikasi row `items`. Foto lama dihapus **setelah** update database berhasil.
- Gunakan `storage.service.ts` yang sudah ada (jangan membuat logika upload baru), dengan folder khusus barang, misalnya `invoks/items`.
- Foto milik jenis barang; semua unit mewarisi foto itu (foto per unit tidak wajib).
- Stok total = jumlah unit. Stok tersedia per tanggal dihitung dari jadwal dan kondisi unit, **bukan** kolom stok statis.

### Tahap 05 — Peminjaman barang per kode unit

**`item_borrowings`** (header)

| Kolom | Keterangan |
|---|---|
| `id`, `borrowing_code` | PK dan kode unik |
| `user_id` | FK → users |
| `pic_name`, `pic_phone` | PIC |
| `start_at`, `end_at` | Satu periode untuk semua unit |
| `status` | `booked` / `completed` / `cancelled` |
| `completed_at`, timestamps | Catatan selesai |

**`item_borrowing_units`** (unit yang dipinjam)

| Kolom | Keterangan |
|---|---|
| `id` | PK |
| `item_borrowing_id` | FK → item_borrowings |
| `item_unit_id` | FK → item_units (unit spesifik) |
| `returned_at` | NULL = belum dikembalikan |
| `returned_by_admin_id` | FK → users, NULL |
| `return_condition`, `return_notes` | Kondisi saat kembali (opsional) |
| `created_at` | Timestamp |

Aturan:
- UNIQUE `(item_borrowing_id, item_unit_id)` hanya mencegah unit ganda dalam satu transaksi, **bukan** bentrok antar transaksi.
- Keranjang awal boleh di state Flutter (belum mereservasi apa pun).
- Saat submit, backend mengecek ulang semua unit: lock baris `item_units` yang dipilih (urut ID), cek kondisi dan status aktif, cek bentrok periode, serta cek unit yang lewat jatuh tempo tetapi belum dikonfirmasi kembali. Lalu simpan header + semua unit secara atomik.
- Satu unit gagal berarti seluruh transaksi gagal.
- Query baca memakai `select`/`join` biasa, bukan `with:` (aturan 11).

### Tahap 06 — Pengembalian oleh admin

Tidak perlu tabel baru. Gunakan `returned_at`, `returned_by_admin_id`, `return_condition`, `return_notes`.

- Hanya admin yang boleh mengonfirmasi barang sudah diterima.
- Pengembalian **per unit**: jika 2 dari 3 unit kembali, header belum selesai. Header jadi `completed` hanya jika **semua** unit sudah kembali.
- Update dilakukan atomik; konfirmasi dua kali harus ditolak dengan aman.
- Unit yang kembali dalam kondisi rusak tidak langsung tersedia lagi.
- **Overdue** dihitung, bukan disimpan: `end_at` sudah lewat, `returned_at` masih kosong, dan transaksi belum dibatalkan.
- Pencatatan serah-terima awal (`handed_over_at`) belum diputuskan.

### Tahap 07 — Notifikasi dan reminder

#### Cara kerja: notifikasi dibuat otomatis oleh sistem
Notifikasi **tidak diinput manual** oleh admin atau user. Backend yang membuatnya sendiri dengan dua cara:

1. **Dipicu kejadian (event-based):** saat suatu proses selesai, backend langsung menambah baris di `notifications`. Contoh: booking berhasil dibuat, admin mengonfirmasi pengembalian.
2. **Dipicu jadwal (job terjadwal):** job di server berjalan berkala (misalnya tiap beberapa menit), mencari kondisi tertentu, lalu membuat notifikasi. Contoh: peminjaman yang lewat batas tetapi unitnya belum dikembalikan. Job ini jalan di server, jadi **tidak tergantung aplikasi Flutter sedang dibuka**.

Alur untuk reminder keterlambatan:

1. Job mencari peminjaman yang `end_at`-nya sudah lewat, masih punya unit dengan `returned_at` kosong, dan statusnya belum dibatalkan.
2. Untuk tiap peminjaman, job membuat `deduplication_key` (misalnya gabungan jenis notifikasi + ID peminjaman + periode reminder).
3. Jika key itu belum ada di `reminder_logs`, job membuat baris di `notifications` untuk peminjamnya, lalu mencatat pengirimannya di `reminder_logs`.
4. Jika key sudah ada, job melewatinya, jadi tidak ada notifikasi ganda walau job jalan berulang.
5. Setelah semua unit dikembalikan, peminjaman itu tidak lagi ditemukan oleh job, sehingga reminder berhenti sendiri.

#### Jenis notifikasi

| Jenis (`type`) | Dibuat saat | Penerima | Pemicu | Status keputusan |
|---|---|---|---|---|
| `return_overdue` | Barang lewat batas dan belum dikembalikan | Peminjam | Job terjadwal | **Sudah jelas** (ada di rancangan awal) |
| `room_booking_created` | Booking ruangan berhasil disimpan | Pembuat booking | Event | Usulan, **pending** |
| `item_borrowing_created` | Peminjaman barang berhasil disimpan | Peminjam | Event | Usulan, **pending** |
| `item_return_confirmed` | Admin mengonfirmasi pengembalian satu unit | Peminjam | Event | Usulan, **pending** |
| `return_due_soon` | Mendekati batas pengembalian | Peminjam | Job terjadwal | Usulan, **pending** (menunggu jadwal reminder) |

Hanya `return_overdue` yang sudah pasti. Sisanya hanya usulan; implementasikan setelah kamu memutuskan jenis mana yang benar-benar dibutuhkan.

#### Tabel

- **`notifications`**: id, user_id, type, title, message, reference_type, reference_id, is_read, read_at, created_at.
  - `reference_type` + `reference_id` menunjuk ke transaksi terkait (misalnya `item_borrowing` dengan ID 12). Ini referensi logis, divalidasi di service, bukan FK, karena bisa menunjuk ke lebih dari satu tabel.
  - `is_read` dan `read_at` diubah ketika mahasiswa membuka notifikasi di aplikasi.
- **`reminder_logs`**: id, notification_id, channel (`in_app` / `push` / opsional `email`), deduplication_key (unik), status, attempt_count, sent_at, last_error, created_at.
  - Fungsinya mencegah notifikasi ganda dan mencatat percobaan kirim yang gagal.
  - Jika nanti tabel ini juga dipakai untuk notifikasi non-reminder, namai ulang menjadi `notification_deliveries`. Pilih salah satu nama saja, jangan membuat keduanya.
- **`user_devices`** (opsional, hanya jika memakai push notification/FCM): id, user_id, token, platform, is_active, last_seen_at, created_at.

#### Aturan

- Penerima hanya user terkait. Mahasiswa tidak bisa melihat notifikasi milik orang lain.
- Mulai dari notifikasi **in-app** saja (muncul di dalam aplikasi). Push notification/FCM ditambahkan belakangan setelah disetujui.
- Jadwal dan frekuensi reminder dibuat **configurable** (misalnya lewat `system_settings`), jangan ditulis permanen di kode, karena belum diputuskan.
- Notifikasi dibuat setelah proses utamanya berhasil, jadi kalau booking gagal, tidak ada notifikasi yang terbuat.

**Belum diputuskan:** seberapa sering reminder keterlambatan dikirim (sekali, harian, tiap beberapa jam), apakah ada reminder sebelum jatuh tempo, dan jenis notifikasi tambahan di atas.

### Tahap 08 — Profil dan lupa password

- Lengkapi kolom profil di `users` seperlunya: nama, email, telepon, identitas akademik, jurusan, tanggal lahir, jenis kelamin, foto profil. Periksa dulu kolom yang sudah ada.
- Jika foto profil diunggah, pakai `storage.service.ts` dan simpan `public_id`-nya juga.
- **`password_reset_tokens`** (jika belum ada): id, user_id, token_hash, expires_at, consumed_at, attempt_count, created_at.
- OTP hanya disimpan dalam bentuk hash, dengan masa berlaku, batas percobaan, dan sekali pakai. Token tidak boleh masuk log.

### Tahap 09 — Tabel pendukung (opsional)

- **`audit_logs`**: id, actor_user_id, action, entity_type, entity_id, before_data (JSON), after_data (JSON), created_at.
- **`system_settings`**: setting_key (PK), setting_value (JSON), description, updated_by, updated_at (misalnya jam slot, interval 60 menit, zona waktu).
- **`idempotency_requests`**: id, user_id, operation, idempotency_key, request_hash, response_status, response_body, expires_at, created_at; UNIQUE(user_id, operation, idempotency_key). Berguna agar booking yang terkirim dua kali tidak tercatat ganda.

## 5. Penyimpanan Foto (Cloudinary)

File terkait: `src/config/cloudinary.ts`, `src/services/storage.service.ts`, `src/middlewares/upload.middleware.ts`, `src/middlewares/error.middleware.ts`.

**Variabel environment** (isi di `.env`, nama saja di `.env.example`):

| Variabel | Keterangan |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Harus cocok dengan akun pemilik API key |
| `CLOUDINARY_API_KEY` | Jangan ditampilkan atau di-commit |
| `CLOUDINARY_API_SECRET` | Jangan ditampilkan atau di-commit |
| `MAX_UPLOAD_MB` | Batas ukuran upload; default 5 jika kosong, bukan angka, atau di bawah 1; maksimum 10 (batas gambar paket Free) |

**Aturan upload:**
- Tipe file: jpg, png, webp. Penyimpanan sementara memakai multer `memoryStorage`, jadi tidak ada file yang ditulis ke disk.
- Pesan error ukuran menyebut batas yang sedang berlaku. Error ukuran atau jumlah piksel dari Cloudinary dikembalikan sebagai 400, bukan 500.
- `uploadImage(buffer, mimetype, folder)` mengembalikan `{ url, publicId }` (`secure_url` https). Folder ditentukan lewat `asset_folder` (akun memakai Dynamic folders), contohnya `invoks/rooms`.
- `public_id` disimpan **persis** seperti respons upload, tidak disusun sendiri.
- `deleteImage(publicId)` tidak melempar error fatal jika gagal; cukup mencatat log tanpa data sensitif. Disarankan memakai `invalidate: true` agar cache CDN ikut bersih, dan mencatat peringatan jika hasilnya bukan `ok`.
- `storage.service.ts` bersifat umum (tidak ada logika ruangan di dalamnya), dan dipakai ulang oleh barang (Tahap 04) serta foto profil (Tahap 08).

**Urutan operasi:**
- **Tambah:** validasi data, upload foto, `insert` ke database. Jika `insert` gagal, hapus foto baru. Pembacaan respons dilakukan di luar blok `try`.
- **Edit:** tanpa foto baru, foto lama dipertahankan. Dengan foto baru: upload foto baru, `update` database (jika gagal, hapus foto baru), dan **setelah** `update` berhasil baru hapus foto lama.

**Catatan verifikasi:**
- Foto yang sudah terhapus bisa masih tampil di browser karena cache CDN. Untuk memastikan benar terhapus, buka URL dengan nomor versi diganti, misalnya `.../upload/v1/<public_id>.jpg`. Hasil 404 berarti aset sudah tidak ada.
- Media Library Cloudinary sering terlambat memperbarui indeks; jangan jadikan hasil kosong di sana sebagai bukti tunggal.

## 6. Relasi Inti

| Parent | Child | Jenis |
|---|---|---|
| users.id | room_bookings.user_id | 1:N |
| rooms.id | room_bookings.room_id | 1:N |
| buildings.id | rooms.building_id | 1:N |
| rooms.id | room_facilities.room_id | 1:N |
| facilities.id | room_facilities.facility_id | 1:N |
| room_bookings.id | room_booking_slots.room_booking_id | 1:N |
| item_categories.id | items.category_id | 1:N |
| items.id | item_units.item_id | 1:N |
| users.id | item_borrowings.user_id | 1:N |
| item_borrowings.id | item_borrowing_units.item_borrowing_id | 1:N |
| item_units.id | item_borrowing_units.item_unit_id | 1:N (antar waktu) |
| users.id | item_borrowing_units.returned_by_admin_id | 1:N (nullable) |
| users.id | notifications.user_id | 1:N |
| notifications.id | reminder_logs.notification_id | 1:N |
| users.id | password_reset_tokens.user_id | 1:N |

**Kaidah ID:** `users.id` adalah identitas tetap akun. Setiap pengajuan baru menghasilkan `room_bookings.id` atau `item_borrowings.id` yang **baru**. Semua baris detail mengacu ke ID transaksi, bukan langsung ke `users.id`.

## 7. Keputusan yang Harus Diambil Sebelum Tahap 03

Isi kolom "Keputusan" setelah ditentukan, lalu salin ke prompt Tahap 03.

| Topik | Pilihan | Saran | Keputusan |
|---|---|---|---|
| Penyimpanan waktu | (a) simpan waktu Jakarta apa adanya, koneksi mysql2/Drizzle diset `timezone: "+07:00"`; (b) simpan UTC, konversi ke Jakarta di semua validasi dan tampilan | (a), karena validasi jam 07:00–19:00 jadi sederhana | _pending_ |
| `room_id` di `room_booking_slots` | Ada atau tidak. Jika ada, cek bentrok tanpa join, dan bisa ditambah `UNIQUE(room_id, start_at)` sebagai pengaman kedua di luar lock | Ada. Konsekuensinya, saat aturan pembatalan diputuskan, slot yang dibatalkan harus dihapus atau ditangani khusus | _pending_ |
| Batas jumlah slot per request | Angka maksimum, misalnya 50 | 50 | _pending_ |
| Peserta vs `capacity_min` | Hanya `participant_count <= capacity_max`, atau juga `>= capacity_min` | Mulai dari batas atas saja | _pending_ |

Catatan zona waktu: respons API saat ini menampilkan `createdAt` dengan akhiran `Z` (UTC) padahal nilainya waktu Jakarta (misalnya 18:17 WIB tampil sebagai `18:17:26.000Z`). Untuk timestamp biasa ini tidak masalah, tetapi untuk `start_at` dan `end_at` slot, jam bisa bergeser tujuh jam jika konversinya tidak konsisten. Putuskan aturannya dulu, lalu pastikan satu konfigurasi koneksi dipakai di semua tempat.

## 8. Cara Memakai Dokumen Ini

1. Simpan di `backend/docs/backend_invoks.md` (atau ganti namanya jika sudah ada README lain).
2. Mulai dari tahap yang berstatus "Berikutnya" di bagian 0, lalu kerjakan satu tahap per giliran sesuai urutan di bagian 3.
3. Sebelum lanjut, tinjau hasil tahap itu: file yang berubah, tabel/kolom baru, dan isi migrasi. Perbarui bagian 0 setelah tiap tahap selesai.
4. Catat keputusan bisnis yang masih "pending" sebelum mengaktifkan fitur terkait.
5. Backup `invoks_db` (Export di phpMyAdmin) sebelum menjalankan `npm run db:migrate`.

*Alur singkat: cek kondisi → buat perubahan kecil → tinjau migrasi → terapkan → verifikasi manual → lanjut tahap berikutnya.*