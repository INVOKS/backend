CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`nama_lengkap` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`gender` enum('perempuan','laki_laki'),
	`tanggal_lahir` date,
	`jurusan` varchar(100),
	`jenis_pengguna` varchar(50),
	`nim_nidn` varchar(50),
	`no_telp` varchar(20),
	`foto` text,
	`gedung_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
