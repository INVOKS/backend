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
| 04 Master barang | **Berikutnya** | |
| 05 sampai 09 | Belum | |

Langkah tambahan di luar nomor tahap yang sudah selesai: **pemindahan penyimpanan foto dari folder lokal `uploads/` ke Cloudinary** (lihat bagian 5).

**Migrasi yang sudah diterapkan** (folder `backend/drizzle/`):

| Migrasi | Isi |
|---|---|
| `0000_freezing_chameleon` | 5 tabel awal (`users`, `buildings`, `rooms`, `facilities`, `room_facilities`) dalam penamaan bahasa Inggris |
| `0001_bumpy_piledriver` | `users.is_active` |
| `0002_loving_cargill` | Perubahan Tahap 02 (kolom gedung, ruangan, fasilitas, constraint) |
| `0003_famous_blazing_skull` | `rooms.image_public_id` |
| `0004_lyrical_hellfire_club` | `room_bookings`, `room_booking_slots` |

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
- Tanpa `with:` (aturan 11). Kolom jadwal `datetime` mengikuti aturan 14.

### Tahap 05 — Peminjaman barang per kode unit

**`item_borrowings`** (header)

| Kolom | Keterangan |
|---|---|
| `id`, `borrowing_code` | PK dan kode unik |
| `user_id` | FK → users |
| `pic_name`, `pic_phone` | PIC |
| `start_at`, `end_at` | Satu periode untuk semua unit (`datetime` mode string, waktu Jakarta) |
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
- Uji dengan beberapa request bersamaan seperti tes booking ruangan di Tahap 03.

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
- Job terjadwal butuh server yang selalu menyala (relevan saat deploy).

**Belum diputuskan:** seberapa sering reminder keterlambatan dikirim (sekali, harian, tiap beberapa jam), apakah ada reminder sebelum jatuh tempo, dan jenis notifikasi tambahan di atas.

### Tahap 08 — Profil dan lupa password

- Kolom profil di `users` sudah sebagian besar ada (nama, telepon, jurusan, tanggal lahir, jenis kelamin, jenis pengguna, identitas akademik, foto profil). Periksa schema sebelum menambah kolom baru.
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
- Tipe file: jpg, png, webp. Penyimpanan sementara memakai multer `memoryStorage`, jadi tidak ada file yang ditulis ke disk. Field form-data bernama `image`.
- Pesan error ukuran menyebut batas yang sedang berlaku. Error ukuran atau jumlah piksel dari Cloudinary dikembalikan sebagai 400, bukan 500.
- `uploadImage(buffer, mimetype, folder)` mengembalikan `{ url, publicId }` (`secure_url` https). Folder ditentukan lewat `asset_folder` (akun memakai Dynamic folders), contohnya `invoks/rooms`.
- `public_id` disimpan **persis** seperti respons upload, tidak disusun sendiri.
- `deleteImage(publicId)` tidak melempar error fatal jika gagal; cukup mencatat log tanpa data sensitif. Disarankan memakai `invalidate: true` agar cache CDN ikut bersih, dan mencatat peringatan jika hasilnya bukan `ok` (belum dikerjakan).
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
- **Upload foto:** multipart dengan field `image`, maksimal 5 MB, jpg/png/webp.
- **Waktu booking:** kirim tiap slot satu jam (`startAt` berformat `YYYY-MM-DDTHH:mm`). Tampilan boleh menggabungkan slot berurutan (misalnya 13.00 - 17.00), tetapi request tetap per jam. Ambil jam langsung dari teks respons (`substring`) agar tidak bergantung zona waktu perangkat, dan konversi `createdAt` (UTC) ke WIB.
- **Warna kalender bulanan:** `open` (putih), `limited` (kuning), `full` (merah), `past` (abu/nonaktif). Slot abu di layar pilih jam berarti `booked` atau `past`.
- **Alamat backend di emulator Android:** `10.0.2.2` (bukan `localhost`).

## 9. Perbaikan Opsional (belum dikerjakan)

- Respons 409 booking sebaiknya juga memuat daftar terstruktur slot bentrok (misalnya `conflicts`), selain `message`.
- Respons `/api/room-bookings/me` terlalu padat (user, ruangan, gedung lengkap per booking); bisa diringkas.
- Bentuk error masih dua macam (`errors` objek vs `message` saja); pertimbangkan menyeragamkan.
- `deleteImage` memakai `invalidate: true` dan mencatat hasil selain `ok`.
- `users.building_id` belum punya FK dan belum dipakai; `rooms.status = borrowed` kemungkinan tidak terpakai.

## 10. Cara Memakai Dokumen Ini

1. Simpan di `backend/docs/backend_invoks.md` (atau ganti namanya jika sudah ada README lain).
2. Mulai dari tahap yang berstatus "Berikutnya" di bagian 0, lalu kerjakan satu tahap per giliran sesuai urutan di bagian 3.
3. Sebelum lanjut, tinjau hasil tahap itu: file yang berubah, tabel/kolom baru, dan isi migrasi. Perbarui bagian 0 setelah tiap tahap selesai.
4. Catat keputusan bisnis yang masih "pending" sebelum mengaktifkan fitur terkait.
5. Backup `invoks_db` (Export di phpMyAdmin) sebelum menjalankan `npm run db:migrate`.

*Alur singkat: cek kondisi → buat perubahan kecil → tinjau migrasi → terapkan → verifikasi manual → lanjut tahap berikutnya.*