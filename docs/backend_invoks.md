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
| 02 Gedung, ruangan, fasilitas, foto | Selesai | Foto di Cloudinary; semua tes POST/PUT/GET lulus |
| 03 Booking ruangan | Selesai | Multi-slot, anti-bentrok, availability harian dan bulanan; semua tes lulus (termasuk 5 request bersamaan) |
| 04 Master barang | Selesai | Katalog, unit fisik, foto Cloudinary; semua tes manual lulus (CRUD, validasi, hak akses, filter, arsip, penambahan unit atomik) |
| 05 Peminjaman barang | Selesai | Multi-unit, multi-slot 1 jam 07:00–19:00, availability harian & bulanan per unit, anti-bentrok + cek overdue, uji 5 request bersamaan lulus |
| 06 Pengembalian barang | Selesai | Konfirmasi pengembalian per unit oleh admin, sinkronisasi kondisi master unit, pelunasan otomatis ke completed, properti terhitung returnStatus & isOverdue |
| 07 Notifikasi & reminder | Selesai | Notifikasi in-app otomatis (event booking/borrow/return & reminder overdue/due-soon terjadwal), endpoint baca & tandai sudah dibaca |
| 08 Profil & reset password | Selesai | Profil user & Web Admin (CRUD profil, update avatar Cloudinary, ubah password), alur lupa sandi OTP 6 digit via SMTP/Nodemailer (anti-enumeration, cooldown 30 detik, hash SHA-256, masa berlaku 15 menit) |
| 09 Pendukung (opsional) | Selesai | 3 tabel pendukung (audit_logs, system_settings, idempotency_requests), fail-safe audit log helper pada aksi admin, middleware idempotency opsional (mencegah booking ganda), endpoint kelola sistem setting & baca audit log |

Langkah tambahan di luar nomor tahap yang sudah selesai: **pemindahan penyimpanan foto dari folder lokal `uploads/` ke Cloudinary** (lihat bagian 5).

**Migrasi yang sudah diterapkan** (folder `backend/drizzle/`):

| Migrasi | Isi |
|---|---|
| `0000_freezing_chameleon` | 5 tabel awal (`users`, `buildings`, `rooms`, `facilities`, `room_facilities`) dalam penamaan bahasa Inggris |
| `0001_bumpy_piledriver` | `users.is_active` |
| `0002_loving_cargill` | Perubahan Tahap 02 (kolom gedung, ruangan, fasilitas, constraint) |
| `0003_famous_blazing_skull` | `rooms.image_public_id` |
| `0004_lyrical_hellfire_club` | `room_bookings`, `room_booking_slots` |
| `0005_huge_masque` | Tabel Tahap 04: `item_categories`, `items`, `item_units` |
| `0006_clumsy_amphibian` | Tabel Tahap 05 awal: `item_borrowings`, `item_borrowing_units` |
| `0007_silky_the_hood` | Penyesuaian Tahap 05: `item_borrowing_slots`, constraint `UNIQUE(item_unit_id, start_at)`, hapus kolom `start_at`/`end_at` pada `item_borrowings` |
| `0008_brave_lester` | Tabel Tahap 07: `notifications`, `reminder_logs` |
| `0009_funny_groot` | Tabel Tahap 08: `password_reset_tokens` |
| `0010_brief_abomination` | Tabel Tahap 09: `audit_logs`, `system_settings`, `idempotency_requests` |

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

1. **Cek kondisi project dulu** sebelum mengubah apa pun: schema, migrasi, konfigurasi, dan auth. Samakan penamaan dan tipe ID dengan yang sudah ada (jangan paksa BIGINT; semua ID saat ini `int`).
2. **Jangan buat ulang tabel yang sudah ada.** Cukup periksa dan lengkapi seperlunya.
3. **Jangan rusak login/register**, bentuk JWT, hash password, dan middleware yang sudah jalan.
4. **Kerjakan satu tahap sekali.** Selesaikan dan tinjau dulu sebelum lanjut.
5. **Migrasi harus aman:** tinjau hasil migrasi sebelum diterapkan, backup database sebelum mengubah struktur, dan jangan pakai `push`, drop, reset, atau truncate tanpa alasan jelas.
6. **Jangan hapus data lama.** Untuk kolom wajib baru di tabel berisi data: buat nullable dulu, isi datanya, baru jadikan NOT NULL jika perlu (contoh: `rooms.image_url`).
7. Tipe FK harus sama dengan tipe PK, dan `ON DELETE` dipilih dengan sengaja. Riwayat tidak boleh ikut terhapus (`restrict`); `cascade` hanya dari header ke anaknya sendiri (contoh: `room_bookings` ke `room_booking_slots`). Untuk data yang punya riwayat, gunakan `is_active` (arsip), bukan hapus.
8. Buat index dan unique constraint yang relevan. Unique constraint **tidak cukup** untuk mencegah bentrok jadwal; gunakan transaksi dan locking, dengan unique constraint sebagai pengaman kedua.
9. Zona waktu `Asia/Jakarta`. Interval waktu `[start_at, end_at)`, jadi slot yang berakhir 10:00 tidak bentrok dengan slot mulai 10:00. Aturan penyimpanan waktu ada di aturan 14 dan bagian 7.
10. Jangan taruh `.env`, password database, JWT secret, atau token OTP di log, output, atau repository.
11. **Jangan pakai Drizzle relational query (`db.query.x.findMany/findFirst` dengan `with:`).** Di MariaDB (XAMPP) query itu menghasilkan `left join lateral` yang ditolak (`ER_PARSE_ERROR`), dan `mode: "planetscale"` juga gagal (`ER_BAD_FIELD_ERROR`). Gunakan `select` biasa atau `join`, lalu gabungkan hasilnya di kode (contoh: `getRooms()` dan `getRoomById()` di `room.service.ts`).
12. **Cleanup foto hanya untuk kegagalan penyimpanan.** Pembacaan data untuk respons (misalnya `getRoomById`) harus berada di luar blok `try` yang membungkus insert/update, supaya kegagalan membaca tidak menghapus foto yang sudah terhubung ke baris database.
13. Jangan mengerjakan testing otomatis dulu. Verifikasi manual lewat Postman dan phpMyAdmin, dan jalankan `npm run typecheck` setiap selesai.
14. **Kolom `datetime` untuk jadwal memakai `mode: "string"`** dan bernilai waktu Jakarta (`"YYYY-MM-DD HH:mm:ss"`). Drizzle dengan mode default mengubah `Date` ke UTC lewat `toISOString()` sehingga jam bergeser tujuh jam, dan opsi `timezone` pada pool tidak mencegahnya. Semua perhitungan "sekarang", hari ini, dan status waktu memakai helper di `src/utils/datetime.ts`, bukan `new Date()` mentah.
15. Sesi koneksi database diatur UTC (`timezone: "Z"` pada pool dan `SET time_zone = '+00:00'` pada tiap koneksi baru) supaya `created_at`/`updated_at` akurat. Respons API menampilkan keduanya dengan akhiran `Z`, jadi klien harus mengonversinya ke WIB saat ditampilkan.

## 3. Urutan Tahap

| Tahap | Modul | Tabel / tujuan | Butuh |
|---|---|---|---|
| 00 | Cek kondisi awal | Lihat schema/migrasi yang ada, backup | — |
| 01 | User & role | `users` (periksa, bukan buat ulang) | 00 |
| 02 | Gedung & ruangan | `buildings`, `rooms`, `facilities`, `room_facilities` | 01 |
| 03 | Booking ruangan | `room_bookings`, `room_booking_slots` | 02 |
| 04 | Master barang | `item_categories`, `items`, `item_units` | 01 |
| 05 | Peminjaman barang | `item_borrowings`, `item_borrowing_units`, `item_borrowing_slots` | 04 |
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

### Tahap 01 — User & role (selesai)

Kolom `users`: `id`, `role` (`user`/`admin`, default `user`), `full_name`, `email` (unik), `password_hash` (bcrypt cost 10), `gender` (enum `female`/`male`, nullable), `date_of_birth` (date, nullable), `department` (varchar 100, nullable), `user_type` (varchar 50, nullable; bukan enum database, nilai yang dipakai `student`/`lecturer`/`staff`), `academic_id` (varchar 50, nullable), `phone` (varchar 20, nullable), `profile_image_url` (text, nullable), `building_id` (int, nullable, belum dipakai, tanpa FK), `is_active`, `created_at`, `updated_at`. Semua kolom profil bersifat nullable.

- Register publik **selalu** menghasilkan `user`, walau client mengirim `admin`.
- Admin dibuat lewat seed (`npm run db:seed`, membaca `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` dari `.env`) atau proses terkontrol, bukan registrasi terbuka. Seed juga mengisi gedung KP, BNI, Dieng.
- Seed **tidak mengubah password** admin yang sudah ada dan aman dijalankan berulang.
- JWT berisi `sub` (ID user, string) dan `role`, dengan opsi `rememberMe`. Setelah role seseorang diubah, user itu harus **login ulang** untuk mendapat token baru.
- Akun `is_active = false` ditolak login (403). Middleware `requireAdmin` memberi 401 jika belum login dan 403 jika bukan admin.
- Hak akses diputuskan backend lewat JWT, bukan oleh UI.

Endpoint auth: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/admin/login`, `GET /api/auth/me`.

### Tahap 02 — Gedung, ruangan, fasilitas, foto (selesai)

| Tabel | Kolom penting | Aturan |
|---|---|---|
| `buildings` | id, name, code, description?, image_url?, is_active, timestamps | Nama dan kode unik; seed KP/BNI/Dieng (kode DNG) tanpa duplikat |
| `rooms` | id, building_id, room_code, name, floor (varchar), capacity_min, capacity_max, description, image_url, image_public_id, status, is_active, timestamps | FK gedung `restrict`; UNIQUE(building_id, room_code); CHECK `capacity_min` > 0 dan `capacity_max` >= `capacity_min`; index (building_id, floor) |
| `facilities` | id, name, icon, description?, timestamps | Nama unik |
| `room_facilities` | id, room_id, facility_id, quantity, created_at, updated_at | UNIQUE(room_id, facility_id); CHECK quantity > 0 |

- `rooms.status` bernilai `available` (default), `borrowed`, atau `maintenance`. `is_active` untuk arsip, `status` untuk kondisi ruangan; keduanya punya peran berbeda.
- Satu foto utama per ruangan: wajib saat tambah, bisa diganti saat edit. Tidak perlu tabel `room_images`.
- `rooms.image_public_id` (varchar 255, nullable) menyimpan `public_id` Cloudinary persis seperti yang dikembalikan saat upload. Untuk ruangan lama yang belum punya nilai ini, penghapusan foto lama dilewati.
- Lantai disimpan di `rooms.floor`. Filter memakai `building_id` + `floor`, tanpa tabel floors.
- Field form-data untuk tambah/edit ruangan: `buildingId`, `roomCode`, `name`, `floor`, `capacityMax` (dan `capacityMin`), `description`, dan file `image`.
- PUT gedung, ruangan, dan fasilitas yang tidak membawa data apa pun ditolak 400 sebelum menyentuh database (untuk ruangan, sebelum upload foto), supaya tidak ada error `No values to set` dan tidak ada foto yatim.

Endpoint:

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/buildings`, `/api/buildings/:id` | Login | User hanya melihat gedung aktif; admin boleh `?includeInactive=true` |
| POST, PUT | `/api/buildings`, `/api/buildings/:id` | Admin | |
| PATCH | `/api/buildings/:id/archive`, `/unarchive` | Admin | |
| GET | `/api/facilities`, `/api/facilities/:id` | Login | |
| POST, PUT, DELETE | `/api/facilities`, `/api/facilities/:id` | Admin | DELETE hanya jika belum dipakai ruangan |
| GET | `/api/rooms`, `/api/rooms/:id` | Login | Filter `buildingId`, `floor`; user hanya melihat ruangan aktif di gedung aktif |
| POST, PUT | `/api/rooms`, `/api/rooms/:id` | Admin | Multipart (lihat field di atas) |
| PATCH | `/api/rooms/:id/archive`, `/unarchive` | Admin | |
| PUT | `/api/rooms/:id/facilities` | Admin | Body `{ facilities: [{ facilityId, quantity }] }` |

### Tahap 03 — Booking ruangan multi-tanggal / multi-slot (selesai)

**`room_bookings`** (data kegiatan)

| Kolom | Keterangan |
|---|---|
| `id` | PK, unik tiap transaksi (bukan `users.id`) |
| `booking_code` | Unik, format `RB-YYYYMMDD-XXXX` (tanggal Jakarta, dibuat ulang jika bertabrakan) |
| `user_id` | FK → users (`restrict`) |
| `room_id` | FK → rooms (`restrict`; satu booking = satu ruangan) |
| `activity_name`, `activity_description`, `organizer` | Info kegiatan |
| `participant_count`, `pic_name`, `pic_phone` | Peserta dan PIC |
| `status` | `booked` / `cancelled`, default `booked` |
| `created_at`, `updated_at` | Timestamp (UTC) |

Index: `(room_id, status)` dan `user_id`.

**`room_booking_slots`** (detail jadwal)

| Kolom | Keterangan |
|---|---|
| `id` | PK |
| `room_booking_id` | FK → room_bookings (`cascade`) |
| `room_id` | FK → rooms (`restrict`) |
| `start_at`, `end_at` | `datetime` mode string, nilai waktu Jakarta |
| `created_at` | Timestamp (UTC) |

Constraint: **UNIQUE(`room_id`, `start_at`)** sebagai pengaman kedua. Index `(room_booking_id, start_at)`.

Kolom `status`, `cancelled_at`, `cancelled_by_user_id` untuk slot **ditunda** sampai aturan pembatalan diputuskan.

**Aturan:**
- Slot tepat 1 jam, menit 00, jam mulai 07 sampai 18 (selesai paling lambat 19:00). Satu tanggal boleh pilih jam terpisah, satu booking boleh banyak tanggal.
- Maksimal **50 slot** per request, minimal 1. Tidak boleh `startAt` ganda (termasuk beda format), tidak boleh di masa lalu, dan tidak boleh bentrok dengan booking lain di ruangan yang sama.
- Semua slot dalam satu submit **atomik**: satu transaksi, `SELECT ... FOR UPDATE` pada baris `rooms`, cek bentrok terhadap booking berstatus `booked`, lalu insert header dan semua slot. Jika satu slot bentrok, tidak ada yang tersimpan (409 dengan daftar slot bentrok). Error duplicate-key dari UNIQUE juga dijawab 409, bukan 500. Cek bentrok dilakukan sebelum header dibuat, jadi ID booking tidak melompat setelah request gagal.
- Ditolak (400) jika `rooms.is_active` false, `rooms.status` = `maintenance`, atau `buildings.is_active` false. Status `borrowed` **tidak** menolak, karena ketersediaan dihitung dari jadwal.
- `participant_count` > 0 dan hanya dicek terhadap `capacity_max` (`capacity_min` tidak dipakai untuk validasi).
- `user_id` selalu diambil dari JWT; `userId` di body diabaikan.
- Status mendatang/berlangsung/selesai **dihitung dari waktu** (Jakarta) terhadap slot, tidak disimpan. Slot yang sedang berjalan dihitung `past` pada availability (berdasarkan jam mulai).
- Query baca memakai `select`/`join` biasa, bukan `with:` (aturan 11). Pembacaan data respons di luar blok transaksi.
- Contoh: Andi (`users.id=5`) booking pertama jadi `room_bookings.id=101`, booking berikutnya dapat ID lain, tetapi `user_id` tetap 5.
- **Catatan pembatalan (pending):** karena `UNIQUE(room_id, start_at)`, slot yang dibatalkan harus dihapus atau ditangani khusus, jika tidak ruangan tetap terkunci.

**Endpoint:**

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/room-bookings` | User login | Ajukan booking |
| GET | `/api/room-bookings/me` | User login | Riwayat milik sendiri, dengan slot |
| GET | `/api/room-bookings/:id` | Pemilik atau admin | Detail |
| GET | `/api/room-bookings` | Admin | Semua booking; filter `roomId`, `date`, `status` |
| GET | `/api/rooms/:id/availability` | Login | Tepat satu dari `?date=YYYY-MM-DD` atau `?month=YYYY-MM` |

**Format request `POST /api/room-bookings`:**

```json
{
  "roomId": 8,
  "activityName": "...",
  "activityDescription": "...",
  "organizer": "...",
  "participantCount": 5,
  "picName": "...",
  "picPhone": "08...",
  "slots": [ { "startAt": "2026-11-26T09:00" } ]
}
```

`startAt` boleh `YYYY-MM-DDTHH:mm` atau `:ss`, dengan akhiran `+07:00` yang opsional. `Z` dan offset lain ditolak (400). `end_at` dihitung otomatis (+1 jam).

**Availability:**
- Mode `date`: 12 slot per hari dengan status `booked` / `past` / `available` (prioritas booked, lalu past). Disertai `bookable`, yang bernilai false jika ruangan nonaktif atau `maintenance`, atau gedung nonaktif (ruangan nonaktif bagi user biasa menghasilkan 404).
- Mode `month`: per tanggal ada `totalSlots`, `bookedCount`, `availableCount`, dan `status` = `past` / `full` / `limited` / `open`. Maksimal 12 bulan ke depan. Satu query rentang per request.
- Dua parameter sekaligus, tanpa parameter, tanggal tidak ada di kalender, format salah, atau lebih dari 12 bulan: 400 dengan pesan yang jelas.

**Format respons waktu:** `startAt`/`endAt` slot berbentuk `YYYY-MM-DDTHH:mm:ss+07:00` (waktu Jakarta); `createdAt`/`updatedAt` berakhiran `Z` (UTC).

**Bentuk error:** validasi `{ success: false, message: "Validasi data gagal", errors: { "slots.0.startAt": "..." } }`; aturan bisnis hanya `message` (400); bentrok 409 dengan `message` yang menyebut slot yang bentrok.

**Verifikasi yang sudah lulus:** booking 1 slot dan multi-slot, bentrok (409, tidak ada baris baru), atomik (slot bebas ikut tidak tersimpan), validasi slot/peserta/status ruangan/gedung, akses antar user dan admin, availability harian dan bulanan (`past`, `limited`, `full`, `open`), `bookable` saat `maintenance`, input availability yang salah, dan **lima request bersamaan** ke slot yang sama (tiga kali berturut-turut: tepat satu 201 dan empat 409, satu baris slot, tanpa booking tanpa slot).

### Tahap 04 — Katalog dan unit barang (selesai)

- **`item_categories`**: id, name (unik), slug (unik), timestamps. Seed **Elektronik** dan **Furnitur**.
- **`items`** (satu kartu katalog): id, category_id, name, description, specifications (JSON, opsional), image_url (wajib untuk data baru), image_public_id (nullable), is_active, timestamps.
- **`item_units`** (unit fisik): id, item_id, inventory_code (unik global), condition (`good` / `damaged` / `maintenance`), is_active, notes?, timestamps.

Aturan:
- **Tambah barang:** item + foto + satu atau lebih kode unit. Urutannya: validasi data, upload foto ke Cloudinary, simpan item dan semua unit dalam satu transaksi database, dan jika transaksi gagal, hapus foto dari Cloudinary. Pembacaan data respons dilakukan di luar blok `try` tersebut.
- **Edit barang:** ubah data/foto lewat PUT parsial. Unit dikelola lewat endpoint terpisah (`POST /api/items/:id/units` untuk menambah, `PUT /api/item-units/:id` untuk mengubah), tanpa menduplikasi row `items`. Foto lama dihapus **setelah** update database berhasil.
- Gunakan `storage.service.ts` yang sudah ada (jangan membuat logika upload baru), dengan folder khusus barang, misalnya `invoks/items`.
- Foto milik jenis barang; semua unit mewarisi foto itu (foto per unit tidak wajib).
- Stok total = jumlah unit. Stok tersedia per tanggal dihitung dari jadwal dan kondisi unit, **bukan** kolom stok statis.
- Tanpa `with:` (aturan 11). Kolom jadwal `datetime` mengikuti aturan 14.

**Endpoint:**

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/item-categories` | Login | Daftar kategori |
| GET | `/api/items` | Login | Filter `categoryId`, `q`; admin boleh `?includeInactive=true`; berisi `totalUnits` dan `availableUnits` |
| GET | `/api/items/:id` | Login | Detail dan unit; user hanya melihat unit aktif berkondisi `good`, admin melihat semua unit |
| POST | `/api/items` | Admin | Multipart: `categoryId`, `name`, `description`, `specifications` (JSON), `units` (JSON array), `image` |
| PUT | `/api/items/:id` | Admin | Multipart, parsial; field `units` ditolak 400 |
| PATCH | `/api/items/:id/archive`, `/unarchive` | Admin | |
| POST | `/api/items/:id/units` | Admin | **Hanya JSON** (bukan form-data): `{ "units": [ { "inventoryCode": "...", "condition": "good", "notes": "..." } ] }`; sukses 201 |
| PUT | `/api/item-units/:id` | Admin | `condition`, `isActive`, `notes` (parsial) |

**Perilaku yang sudah diverifikasi:**
- `specifications` dikembalikan sebagai objek.
- `totalUnits` = semua unit aktif; `availableUnits` = unit aktif dan `good`. Ini stok fisik, **bukan** ketersediaan per tanggal (Tahap 05 menghitungnya dari jadwal).
- PUT parsial: field yang tidak dikirim tidak berubah.
- Semua PUT update (barang, unit barang, gedung, ruangan, fasilitas) menolak request tanpa data dengan 400 "Tidak ada data yang diubah". Pengecekan berjalan setelah cek 404 dan sebelum upload foto.
- `PUT /api/items/:id` yang berisi field `units` ditolak 400; gunakan `POST /api/items/:id/units`.
- Kode inventaris: ganda dalam satu request = 400 (validasi, tidak membedakan huruf besar/kecil); sudah dipakai = 409; semua unit disimpan atomik (satu gagal berarti tidak ada yang tersimpan).
- Barang yang diarsip: unit baru ditolak 400; user biasa mendapat 404, admin boleh melihatnya.
- `categoryId` yang tidak ada = 404. Format data salah (JSON, tipe file, nama kosong) = 400.
- Ganti foto: foto lama dihapus setelah update database berhasil.
- Mengubah kondisi unit hanya menyentuh `item_units`; `updatedAt` item tidak ikut berubah.

### Tahap 05 — Peminjaman barang per kode unit (selesai)

**`item_borrowings`** (header kegiatan peminjaman)

| Kolom | Keterangan |
|---|---|
| `id` | PK, unik tiap transaksi |
| `borrowing_code` | Unik, format `IB-YYYYMMDD-XXXX` (tanggal Jakarta, dibuat ulang jika bertabrakan) |
| `user_id` | FK → users (`restrict`) |
| `activity_name` | Nama kegiatan (wajib, min 1, max 255) |
| `pic_name`, `pic_phone` | Penanggung jawab kegiatan |
| `status` | `booked` / `completed` / `cancelled`, default `booked` |
| `completed_at` | Catatan waktu selesai (datetime mode string Jakarta, diisi saat semua unit kembali) |
| `created_at`, `updated_at` | Timestamp (UTC) |

Index: `(user_id)` dan `(status)`.

**`item_borrowing_units`** (detail unit fisik yang dipinjam)

| Kolom | Keterangan |
|---|---|
| `id` | PK |
| `item_borrowing_id` | FK → item_borrowings (`cascade`) |
| `item_unit_id` | FK → item_units (`restrict`) |
| `returned_at` | `datetime` mode string Jakarta; NULL = belum dikembalikan |
| `returned_by_admin_id` | FK → users (`restrict`), NULL sampai dikonfirmasi admin |
| `return_condition` | `good` / `damaged` / `maintenance` (kondisi saat kembali) |
| `return_notes` | Catatan kondisi fisik saat kembali |
| `created_at` | Timestamp (UTC) |

Constraint: **UNIQUE(`item_borrowing_id`, `item_unit_id`)** mencegah unit ganda dalam satu transaksi. Index: `(item_unit_id, returned_at)`.

**`item_borrowing_slots`** (detail jadwal per unit fisik)

| Kolom | Keterangan |
|---|---|
| `id` | PK |
| `item_borrowing_id` | FK → item_borrowings (`cascade`) |
| `item_borrowing_unit_id` | FK → item_borrowing_units (`cascade`) |
| `item_unit_id` | FK → item_units (`restrict`) |
| `start_at`, `end_at` | `datetime` mode string, nilai waktu Jakarta |
| `created_at` | Timestamp (UTC) |

Constraint: **UNIQUE(`item_unit_id`, `start_at`)** sebagai pengaman kedua dari bentrok fisik. Index: `(item_borrowing_id, start_at)`, `(item_borrowing_unit_id, start_at)`.

**Aturan & Logika Bisnis:**
- Multi-unit: 1 s.d. 20 unit fisik per transaksi. Tidak boleh ada `itemUnitId` duplikat dalam satu request (400).
- Multi-slot: 1 s.d. 50 slot per unit. Slot tepat 1 jam, menit 00, jam operasional 07:00–18:00 (selesai paling lambat 19:00 WIB). Tidak boleh ada duplikat slot dalam satu unit dan tidak boleh di masa lalu.
- Submit atomik: seluruh proses berjalan dalam satu transaksi. Pernyataan pertama wajib mengunci baris unit dengan `SELECT ... FROM item_units WHERE id IN (...) ORDER BY id ASC FOR UPDATE` untuk mencegah deadlock.
- Validasi kondisi fisik: setiap unit wajib memiliki `unit.isActive === true` dan `unit.condition === "good"`, serta katalog induk `items.isActive === true` (400 jika tidak memenuhi).
- Cek unit overdue: unit yang masih memiliki peminjaman aktif (`item_borrowings.status = 'booked'` dan `item_borrowing_units.returned_at IS NULL`) di mana slot terakhirnya sudah lewat dari waktu sekarang (`MAX(end_at) < nowJakarta`) ditolak (409) karena terlambat dikembalikan dan belum dikonfirmasi oleh admin.
- Cek bentrok jadwal: slot berstatus `booked` dan `returned_at IS NULL` yang bertumpukan langsung ditolak (409) sebelum insert dilakukan.
- Retry kode peminjaman unik: insert header mencoba ulang hingga 5 kali jika terjadi bentrok `borrowing_code`. Pelanggaran constraint slot `item_borrowing_slots_unit_start_unique` ditangkap lewat helper `isDuplicateKeyError` dan dikembalikan sebagai 409 (bukan 500).
- Query baca tanpa relational query `with:` (Aturan 11). Pembacaan respons dilakukan di luar blok transaksi.

**Availability Unit Barang:**
- Mode `date`: 12 slot per hari dengan status `booked` / `past` / `available` (prioritas `booked`, lalu `past`). Disertai `bookable`, bernilai false jika unit tidak aktif, kondisi bukan `good`, katalog induk tidak aktif, atau unit sedang overdue.
- Mode `month`: per tanggal ada `totalSlots`, `bookedCount`, `availableCount`, dan status `past` / `full` / `limited` / `open`. Maksimal 12 bulan ke depan.
- User non-admin mendapat 404 jika unit atau katalog induknya tidak aktif.

**Endpoint:**

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| POST | `/api/item-borrowings` | User login | Ajukan peminjaman multi-unit & multi-slot (201) |
| GET | `/api/item-borrowings/me` | User login | Daftar peminjaman milik user sendiri |
| GET | `/api/item-borrowings` | Admin | Seluruh peminjaman barang; filter `status`, `itemUnitId`, `date` |
| GET | `/api/item-borrowings/:id` | Pemilik / Admin | Detail peminjaman beserta unit dan slot |
| GET | `/api/item-units/:id/availability` | User login | Ketersediaan unit barang per hari (`?date=`) atau per bulan (`?month=`) |

**Format request `POST /api/item-borrowings`:**

```json
{
  "activityName": "Praktikum Jaringan Komputer",
  "picName": "Budi Santoso",
  "picPhone": "08123456789",
  "units": [
    {
      "itemUnitId": 18,
      "slots": [
        { "startAt": "2026-12-10T10:00" },
        { "startAt": "2026-12-10T11:00" }
      ]
    }
  ]
}
```

**Verifikasi yang sudah lulus:**
- Seluruh skenario fungsional via Postman (pengajuan peminjaman 1 unit dan multi-unit, validasi waktu operasional, pencegahan slot di masa lalu, pencegahan slot duplikat/bentrok, deteksi unit overdue, availability harian dan bulanan, serta hak akses pemilik/admin).
- **Uji konkurensi 5 request bersamaan** ke unit barang dan slot waktu yang sama persis: tepat 1 request berhasil 201 Created dan 4 request lainnya tertolak 409 Conflict secara aman, tidak ada error 500, tepat 1 baris slot tersimpan di database, dan 0 header peminjaman yatim.
- Seluruh tabel peminjaman barang (`item_borrowings`, `item_borrowing_units`, `item_borrowing_slots`) dibersihkan kembali ke 0 baris setelah pengujian.

### Tahap 06 — Pengembalian oleh admin (selesai)

Tidak perlu tabel baru. Menggunakan kolom `returned_at`, `returned_by_admin_id`, `return_condition`, dan `return_notes` pada tabel `item_borrowing_units`.

**Keputusan Final & Aturan Bisnis:**
- **Hak Akses**: Hanya admin yang berhak mengonfirmasi pengembalian unit barang (`authenticate` + `requireAdmin`).
- **Endpoint**: `PATCH /api/item-borrowings/:id/return` (status 200).
- **Pengembalian Per Unit**: Admin dapat mengonfirmasi pengembalian 1 atau beberapa unit fisik dalam satu request.
- **Nilai Default Kondisi**: `returnCondition` bersifat opsional di request dengan default `"good"` (memudahkan UI admin jika hanya memilih status "Dikembalikan").
- **Sinkronisasi Otomatis Master Unit**: Kolom `item_units.condition` ikut diupdate sesuai `returnCondition` dalam transaksi yang sama. Jika unit dikembalikan dengan kondisi `"damaged"` atau `"maintenance"`, unit langsung tidak tersedia untuk peminjaman berikutnya (`bookable: false`) sampai admin memperbaikinya.
- **Pencegahan Konfirmasi Ganda**: Unit yang sudah memiliki `returned_at !== null` ditolak 400 jika dicoba dikonfirmasi ulang.
- **Pelunasan Header Otomatis**:
  - Jika baru sebagian unit yang kembali, status header `item_borrowings` tetap `"booked"` dan `completed_at` tetap `null`.
  - Jika **semua** unit pada peminjaman tersebut sudah dikembalikan (`returned_at !== null`), status header `item_borrowings` otomatis diupdate menjadi `"completed"` dan `completed_at` diisi waktu Jakarta saat ini (`getNowJakartaString()`).
- **Properti Terhitung Dinamis (Query Baca)**:
  - Pada tiap unit:
    - `returnStatus`: `"returned"` jika `returned_at !== null`, atau `"borrowed"` jika `returned_at === null` (memudahkan pemetaan dropdown UI).
    - `isOverdue`: boolean, bernilai `true` HANYA JIKA peminjaman berstatus `"booked"`, unit belum kembali (`returned_at === null`), dan slot terakhir unit tersebut sudah lewat (`MAX(end_at) < nowJakarta`).
  - Pada header peminjaman:
    - `hasOverdueUnits`: boolean, bernilai `true` jika minimal terdapat satu unit dengan `isOverdue === true`.
- **Format Waktu**: `returnedAt` dan `completedAt` diformat menggunakan `toApiDateTime(...)` (`+07:00`), sedangkan timestamp `createdAt`/`updatedAt` tetap UTC (`Z`).

**Format request `PATCH /api/item-borrowings/:id/return`:**

```json
{
  "units": [
    {
      "itemUnitId": 18,
      "returnCondition": "good",
      "returnNotes": "Barang kembali lengkap dan berfungsi normal"
    }
  ]
}
```

**Verifikasi yang sudah lulus:**
- Seluruh pengujian manual via Postman (pengembalian 1 unit, pengembalian bertahap/sebagian, pelunasan otomatis ke `completed`, pencegahan konfirmasi ganda 400, sinkronisasi ke kondisi `item_units`, serta respon properti terhitung `returnStatus`, `isOverdue`, dan `hasOverdueUnits`).
- Pembersihan data uji pasca-tes: seluruh tabel peminjaman barang (`item_borrowings`, `item_borrowing_units`, `item_borrowing_slots`) dibersihkan kembali ke 0 baris, dan seluruh unit master `item_units` dipastikan berkondisi `good`.

### Tahap 07 — Notifikasi dan reminder (selesai)

#### Cara kerja: notifikasi dibuat otomatis oleh sistem
Notifikasi **tidak diinput manual** oleh admin atau user. Backend yang membuatnya sendiri secara otomatis dengan dua cara:

1. **Dipicu kejadian (event-based):** saat suatu proses berhasil disimpan (di luar transaksi utama), backend membuat baris di `notifications` dengan pembungkus `try/catch` aman agar tidak mengganggu transaksi utama.
   - `room_booking_created`: dibuat saat pemesanan ruangan berhasil diajukan (`reference_type = "room_booking"`).
   - `item_borrowing_created`: dibuat saat peminjaman barang berhasil diajukan (`reference_type = "item_borrowing"`).
   - `item_return_confirmed`: dibuat saat admin mengonfirmasi pengembalian unit barang.
2. **Dipicu jadwal (job terjadwal di server):** background worker berjalan berkala (default interval 15 menit, configurable lewat `REMINDER_JOB_INTERVAL_MS`), mengevaluasi peminjaman barang aktif (`status = "booked"` dan `returned_at IS NULL`):
   - `return_due_soon`: dipicu ketika batas akhir pengembalian unit berada di rentang 30 menit ke depan (`nowJakarta < maxEndAt <= nowJakarta + REMINDER_DUE_SOON_MINUTES`). Deduplication key: `return_due_soon:item_borrowing:<borrowingId>` (maks 1 kali per peminjaman).
   - `return_overdue`: dipicu ketika batas akhir pengembalian unit sudah terlewati (`maxEndAt < nowJakarta`). Deduplication key: `return_overdue:item_borrowing:<borrowingId>:<YYYY-MM-DD>` (maksimal 1 kali per hari per peminjaman selama masih ada unit yang belum dikembalikan).

#### Tabel

- **`notifications`** (migrasi `0008_brave_lester`):
  - `id` (int PK autoIncrement)
  - `user_id` (FK → users, cascade)
  - `type` (varchar 50: `room_booking_created`, `item_borrowing_created`, `item_return_confirmed`, `return_due_soon`, `return_overdue`)
  - `title` (varchar 255)
  - `message` (text)
  - `reference_type` (varchar 50: `room_booking`, `item_borrowing`)
  - `reference_id` (int)
  - `is_read` (boolean, default false)
  - `read_at` (timestamp UTC, nullable)
  - `created_at` (timestamp UTC defaultNow)
  - Index: `(user_id, is_read, created_at)` dan `(reference_type, reference_id)`
- **`reminder_logs`** (migrasi `0008_brave_lester`):
  - `id` (int PK autoIncrement)
  - `notification_id` (FK → notifications, cascade)
  - `channel` (varchar 30 default "in_app")
  - `deduplication_key` (varchar 150, UNIQUE)
  - `status` (varchar 30 default "sent")
  - `attempt_count` (int default 1)
  - `sent_at` (timestamp UTC)
  - `last_error` (text, nullable)
  - `created_at` (timestamp UTC defaultNow)

#### Endpoint Notifikasi

| Method | Path | Akses | Keterangan |
|---|---|---|---|
| GET | `/api/notifications` | User login | Daftar notifikasi milik user; filter `?isRead=true\|false`, paginasi `?limit&offset`, menyertakan `unreadCount` |
| PATCH | `/api/notifications/:id/read` | User login | Tandai satu notifikasi sebagai sudah dibaca (`isRead = true`, `readAt`) |
| PATCH | `/api/notifications/read-all` | User login | Tandai seluruh notifikasi user sebagai sudah dibaca |

#### Aturan & Keamanan
- Mahasiswa hanya dapat melihat dan menandai notifikasi miliknya sendiri (mencegah kebocoran data antar user).
- Scheduler di `src/jobs/reminder.job.ts` dilengkapi guard anti-overlap (`isRunning`) dan dapat dinonaktifkan lewat `REMINDER_JOB_ENABLED=false`.
- Deduplication key mencegah reminder ganda walau server di-restart atau job berjalan berulang.

**Verifikasi yang sudah lulus:**
- Seluruh pengujian manual via Postman & phpMyAdmin 100% lulus (pembuatan notifikasi event `room_booking_created`, `item_borrowing_created`, `item_return_confirmed`, pembacaan notifikasi terpaginasi dengan `unreadCount`, penandaan sudah dibaca per id dan read-all secara idempoten, isolasi akses antar user, serta trigger background reminder overdue & due-soon).
- Pembersihan data uji pasca-tes: seluruh data uji coba pada tabel `reminder_logs`, `notifications`, `item_borrowings`, `item_borrowing_units`, dan `item_borrowing_slots` dibersihkan kembali ke 0 baris, dan seluruh unit master `item_units` berkondisi `good`.

### Tahap 08 — Profil dan lupa password

- **Tabel & Kolom:**
  - Struktur tabel `users` dipertahankan sepenuhnya tanpa penambahan atau perubahan kolom (seluruh kolom profil seperti `full_name`, `phone`, `gender`, `date_of_birth`, `department`, `user_type`, `academic_id`, `profile_image_url`, `building_id`, `role`, dan `is_active` sudah tersedia sejak migrasi awal).
  - Tabel baru **`password_reset_tokens`** (migrasi `0009_funny_groot`):
    - `id` (int PK autoIncrement)
    - `user_id` (int notNull, FK -> `users.id` ON DELETE cascade)
    - `otp_hash` (varchar 255 notNull, hash SHA-256 dari 6 digit kode OTP)
    - `reset_token_hash` (varchar 255 nullable, hash SHA-256 dari token reset hex 32-byte)
    - `expires_at` (timestamp notNull, masa berlaku 15 menit)
    - `verified_at` (timestamp nullable, waktu OTP berhasil diverifikasi)
    - `used_at` (timestamp nullable, waktu token dikonsumsi saat reset password)
    - `created_at` (timestamp notNull defaultNow)
    - Index pada `(user_id, created_at)`.

- **Modul Profil Pengguna:**
  - Helper `formatUserProfile` memecah `fullName` menjadi `firstName` dan `lastName` secara otomatis, menyertakan relasi `building: { id, name }`, serta tidak pernah mengekspos `passwordHash`.
  - Endpoint `GET /api/profile` (autentikasi): mengambil data profil pengguna saat ini.
  - Endpoint `PATCH /api/profile` (autentikasi): memperbarui nama, nomor telepon, jenis kelamin, tanggal lahir, departemen/prodi, jenis pengguna, NIM/NIP, dan gedung; pembaruan `email` dan `role` dilarang/diabaikan.
  - Endpoint `PATCH /api/profile/avatar` (autentikasi): mengunggah foto profil ke Cloudinary pada folder `invoks/avatars` via `storage.service.ts` dan memperbarui `profile_image_url`. Mendukung field form-data `avatar` maupun fallback `image`.
  - Endpoint `PATCH /api/profile/password` (autentikasi): memvalidasi kata sandi saat ini via bcrypt, memberlakukan kebijakan kata sandi kuat (minimal 8 karakter, huruf besar, huruf kecil, angka, karakter khusus), dan meng-hash kata sandi baru.

- **Modul Lupa Kata Sandi (OTP 6 Digit via SMTP Nodemailer):**
  - Menggunakan library `nodemailer` dengan konfigurasi SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) di `.env`.
  - Endpoint `POST /api/auth/forgot-password` (publik):
    - Anti-enumeration: selalu mengembalikan status 200 dan pesan generik `"Jika email terdaftar, kode OTP 6 digit telah dikirim ke email Anda"` baik email ditemukan maupun tidak.
    - Cooldown check: menolak permintaan jika user baru saja meminta OTP dalam kurun waktu kurang dari 30 detik (HTTP 429).
    - Menginvalidasi token lama yang belum digunakan (`usedAt = now()`).
    - Menghasilkan OTP 6 digit acak numerik, menyimpannya dalam bentuk hash SHA-256 dengan masa kedaluwarsa 15 menit, lalu mengirimkan email HTML profesional bertema INVOKS Vokasi UB ke alamat user.
  - Endpoint `POST /api/auth/verify-reset-otp` (publik):
    - Memvalidasi kecocokan hash OTP, status belum digunakan/diverifikasi, serta masa kedaluwarsa.
    - Menghasilkan `resetToken` acak 32-byte hex, menyimpan hash SHA-256 ke `reset_token_hash`, menandai `verifiedAt = now()`, dan mengembalikan `resetToken` ke klien.
  - Endpoint `POST /api/auth/reset-password` (publik):
    - Memverifikasi hash `resetToken`, memastikan token sudah diverifikasi dan belum kedaluwarsa.
    - Menjalankan transaksi atomik: meng-update `password_hash` user dengan bcrypt cost 10 dan menandai token sebagai sudah digunakan (`usedAt = now()`).

### Tahap 09 — Tabel pendukung (opsional)

- **Tabel Baru (Migrasi `0010_brief_abomination`):**
    - **`audit_logs`**:
    - `id` (int PK autoIncrement)
    - `actor_user_id` (int nullable, FK -> `users.id` ON DELETE set null)
    - `action` (varchar 100 notNull, misal: `"CREATE"`, `"UPDATE"`, `"ARCHIVE"`, `"UNARCHIVE"`, `"RETURN_CONFIRMED"`, `"UPDATE_SETTING"`)
    - `entity_type` (varchar 100 notNull, misal: `"room"`, `"item"`, `"item_unit"`, `"item_borrowing"`, `"system_setting"`)
    - `entity_id` (varchar 100 notNull, mendukung ID numerik maupun string key)
    - `before_data` (json nullable)
    - `after_data` (json nullable)
    - `created_at` (timestamp notNull defaultNow)
    - Index pada `(entity_type, entity_id)` dan `(actor_user_id, created_at)`.
  - **`system_settings`**:
    - `setting_key` (varchar 100 PK)
    - `setting_value` (json notNull)
    - `description` (text nullable)
    - `updated_by` (int nullable, FK -> `users.id` ON DELETE set null)
    - `updated_at` (timestamp notNull defaultNow onUpdateNow)
  - **`idempotency_requests`**:
    - `id` (int PK autoIncrement)
    - `user_id` (int notNull, FK -> `users.id` ON DELETE cascade)
    - `operation` (varchar 100 notNull, misal: `"CREATE_ROOM_BOOKING"`, `"CREATE_ITEM_BORROWING"`)
    - `idempotency_key` (varchar 128 notNull)
    - `request_hash` (varchar 64 notNull, hash SHA-256 dari request body)
    - `response_status` (int notNull)
    - `response_body` (json notNull)
    - `expires_at` (timestamp notNull, masa berlaku 24 jam)
    - `created_at` (timestamp notNull defaultNow)
    - Unique constraint: `UNIQUE(user_id, operation, idempotency_key)` dan index pada `(expires_at)`.

- **Audit Log Helper (`src/services/audit-log.service.ts`):**
  - Fungsi `recordAuditLog(...)` membungkus operasi penulisan dalam `try/catch` aman (fail-safe) sehingga kegagalan mencatat log tidak pernah menggagalkan alur transaksi bisnis utama.
  - Dipasang pada aksi penting admin: konfirmasi pengembalian barang (`RETURN_CONFIRMED`), arsip/unarsip & edit ruangan (`room.service.ts`), arsip/unarsip & edit barang (`item.service.ts`), serta pembaruan pengaturan sistem (`system-setting.service.ts`).

- **Middleware Idempotency (`src/middlewares/idempotency.middleware.ts`):**
  - Bersifat opsional: jika header `Idempotency-Key` tidak dikirim, request langsung dilanjutkan seperti biasa agar klien lama tetap kompatibel 100%.
  - Jika `Idempotency-Key` dikirim:
    - Menghitung SHA-256 dari payload `req.body`.
    - Jika key sudah pernah dipakai dengan payload berbeda: mengembalikan `409 Conflict`.
    - Jika key sudah pernah dipakai dengan payload identik: langsung mengembalikan respons tersimpan tanpa mengeksekusi booking ulang.
    - Jika belum pernah dipakai: intercept respons 2xx dan simpan ke `idempotency_requests` (berlaku 24 jam).
  - Dipasang pada `POST /api/room-bookings` dan `POST /api/item-borrowings`.

- **Pengaturan Sistem Awal (`src/services/system-setting.service.ts`):**
  - Fungsi idempoten `ensureDefaultSystemSettings()` menginisialisasi 3 konfigurasi awal:
    - `operational_hours`: `{ "startHour": 7, "endHour": 19, "slotDurationMinutes": 60, "timezone": "Asia/Jakarta" }`
    - `booking_limits`: `{ "maxSlotsPerBooking": 50, "maxAdvanceMonths": 12, "maxUnitsPerItemBorrowing": 20 }`
    - `reminder_policy`: `{ "dueSoonMinutes": 30, "jobIntervalMinutes": 15 }`
  - Dijalankan otomatis saat server startup (`src/server.ts`) dan seed (`npm run db:seed`).

- **Endpoint API Admin:**
  - `GET /api/audit-logs` (admin): daftar riwayat log aktivitas terpaginasi (`limit`, `offset`/`page`), filter (`entityType`, `action`, `actorUserId`), diurutkan `created_at DESC`, lengkap dengan info aktor `{ id, fullName, email, role }` (tanpa `passwordHash`).
  - `GET /api/audit-logs/:id` (admin): detail audit log tertentu.
  - `GET /api/system-settings` (auth): daftar seluruh konfigurasi sistem beserta updater.
  - `GET /api/system-settings/:key` (auth): detail konfigurasi tertentu berdasarkan key.
  - `PUT /api/system-settings/:key` (admin): memperbarui nilai JSON `settingValue` dan deskripsi, mencatat `updatedBy`, serta merekam perubahan ke `audit_logs`.

## 5. Penyimpanan Foto (Cloudinary)

File terkait: `src/config/cloudinary.ts`, `src/services/storage.service.ts`, `src/middlewares/upload.middleware.ts`, `src/middlewares/error.middleware.ts`.

**Variabel environment** (isi di `.env`, nama saja di `.env.example`):

| Variabel | Keterangan |
|---|---|
| `CLOUDINARY_CLOUD_NAME` | Harus cocok dengan akun pemilik API key |
| `CLOUDINARY_API_KEY` | Jangan ditampilkan atau di-commit |
| `CLOUDINARY_API_SECRET` | Jangan ditampilkan atau di-commit |
| `MAX_UPLOAD_MB` | Batas ukuran upload; default 1 jika kosong, bukan angka, atau di bawah 1; maksimum 1 (dibatasi 1 MB) |

**Penyeragaman Format Respons JSON (`src/utils/response.ts`):**
- Seluruh endpoint API menggunakan helper terpusat `sendSuccess` dan `sendError`.
- Format respons sukses seragam:
  ```json
  {
    "success": true,
    "message": "Pesan deskriptif",
    "data": { ... },
    "meta": { ... }
  }
  ```
- Format respons error seragam (ditangani oleh `error.middleware.ts`, `validate.middleware.ts`, `idempotency.middleware.ts`):
  ```json
  {
    "success": false,
    "message": "Pesan error jelas",
    "errors": { ... }
  }
  ```

**Aturan upload:**
- Tipe file: jpg, jpeg, png, webp. Maksimal 1 MB (`1 * 1024 * 1024` bytes). Penyimpanan sementara memakai multer `memoryStorage`, jadi tidak ada file yang ditulis ke disk. Field form-data bernama `image` (atau `avatar` pada profil).
- Pesan error ukuran menyebut batas yang sedang berlaku. Error ukuran atau jumlah piksel dari Cloudinary dikembalikan sebagai 400, bukan 500.
- `uploadImage(buffer, mimetype, folder)` mengembalikan `{ url, publicId }` (`secure_url` https). Folder ditentukan lewat `asset_folder` (akun memakai Dynamic folders), contohnya `invoks/rooms`.
- `public_id` disimpan **persis** seperti respons upload, tidak disusun sendiri.
- `deleteImage(publicId)` tidak melempar error fatal jika gagal; cukup mencatat log tanpa data sensitif. Fungsi ini memakai `invalidate: true` agar cache CDN ikut bersih, dan mencatat `console.warn` jika hasilnya bukan `ok`.
- `storage.service.ts` bersifat umum (tidak ada logika ruangan di dalamnya), dan dipakai ulang oleh barang (Tahap 04) serta foto profil (Tahap 08).
- Kunci API Cloudinary hanya ada di backend. fe-web dan Flutter hanya menerima `imageUrl` dari backend.

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
| rooms.id | room_booking_slots.room_id | 1:N |
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

## 7. Keputusan Tahap 03 (final)

| Topik | Keputusan | Alasan |
|---|---|---|
| Penyimpanan waktu jadwal | Waktu Jakarta apa adanya, kolom `datetime` mode string (aturan 14) | Validasi jam 07:00–19:00 sederhana. Drizzle mode default mengubah `Date` ke UTC lewat `toISOString()`, dan opsi `timezone` pada pool tidak mencegahnya |
| Timestamp `created_at`/`updated_at` | UTC (sesi koneksi diatur UTC), tampil dengan akhiran `Z` | Akurat; klien mengonversi ke WIB |
| `room_id` di `room_booking_slots` | Ada, dengan `UNIQUE(room_id, start_at)` | Cek bentrok tanpa join, plus pengaman kedua di luar lock. Konsekuensi: slot yang dibatalkan harus dihapus atau ditangani khusus |
| Batas slot per request | 50 | |
| Peserta | Hanya `participant_count <= capacity_max` | `capacity_min` tidak dipakai validasi |
| Status ruangan | Hanya `maintenance` yang menolak booking; `borrowed` tidak | Ketersediaan dihitung dari jadwal |

## 8. Catatan untuk Frontend (fe-web dan Flutter)

- **Respons user** memakai field `fullName`, `phone`, `profileImageUrl`, `dateOfBirth`, `department`, `userType`, `academicId`, `buildingId`, `isActive`. Request register memakai `fullName`, `confirmPassword`, dan `rememberMe` (login). Nilai enum database: `female`/`male` (gender) dan `available`/`borrowed`/`maintenance` (status ruangan). `userType` bukan enum database (string bebas); frontend memakai `student`/`lecturer`/`staff`.
- **Upload foto:** multipart dengan field `image` (atau `avatar`), maksimal 1 MB, jpg/jpeg/png/webp.
- **Waktu booking:** kirim tiap slot satu jam (`startAt` berformat `YYYY-MM-DDTHH:mm`). Tampilan boleh menggabungkan slot berurutan (misalnya 13.00 - 17.00), tetapi request tetap per jam. Ambil jam langsung dari teks respons (`substring`) agar tidak bergantung zona waktu perangkat, dan konversi `createdAt` (UTC) ke WIB.
- **Warna kalender bulanan:** `open` (putih), `limited` (kuning), `full` (merah), `past` (abu/nonaktif). Slot abu di layar pilih jam berarti `booked` atau `past`.
- **Alamat backend di emulator Android:** `10.0.2.2` (bukan `localhost`).
- **Barang:** `PUT /api/items/:id` bersifat parsial dan menolak field `units`; unit baru ditambah lewat `POST /api/items/:id/units` dengan body JSON (bukan form-data). `availableUnits` adalah stok fisik, bukan ketersediaan per tanggal.

## 9. Perbaikan Opsional (belum dikerjakan)

- Respons 409 booking sebaiknya juga memuat daftar terstruktur slot bentrok (misalnya `conflicts`), selain `message`.
- Respons `/api/room-bookings/me` terlalu padat (user, ruangan, gedung lengkap per booking); bisa diringkas.
- Bentuk error masih dua macam (`errors` objek vs `message` saja); pertimbangkan menyeragamkan.
- PUT form-data tanpa field pada gedung, ruangan, dan fasilitas membalas "Validasi data gagal" dengan `errors` kosong, sedangkan barang memakai "Tidak ada data yang diubah"; seragamkan bersama bentuk error lainnya.
- Foto barang 14 (Laptop ASUS) dan kemungkinan beberapa ruangan masih di akun Cloudinary lama; penghapusan foto lama dari akun baru gagal diam-diam (hanya `console.warn`).
- `users.building_id` belum punya FK dan belum dipakai; `rooms.status = borrowed` kemungkinan tidak terpakai.

## 10. Cara Memakai Dokumen Ini

1. Simpan di `backend/docs/backend_invoks.md` (atau ganti namanya jika sudah ada README lain).
2. Mulai dari tahap yang berstatus "Berikutnya" di bagian 0, lalu kerjakan satu tahap per giliran sesuai urutan di bagian 3.
3. Sebelum lanjut, tinjau hasil tahap itu: file yang berubah, tabel/kolom baru, dan isi migrasi. Perbarui bagian 0 setelah tiap tahap selesai.
4. Catat keputusan bisnis yang masih "pending" sebelum mengaktifkan fitur terkait.
5. Backup `invoks_db` (Export di phpMyAdmin) sebelum menjalankan `npm run db:migrate`.

*Alur singkat: cek kondisi → buat perubahan kecil → tinjau migrasi → terapkan → verifikasi manual → lanjut tahap berikutnya.*