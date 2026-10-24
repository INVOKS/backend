CREATE TABLE `buildings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nama` varchar(100) NOT NULL,
	`kode` varchar(20),
	`deskripsi` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buildings_id` PRIMARY KEY(`id`),
	CONSTRAINT `buildings_nama_unique` UNIQUE(`nama`)
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nama` varchar(100) NOT NULL,
	`icon` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `facilities_nama_unique` UNIQUE(`nama`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gedung_id` int NOT NULL,
	`nama` varchar(100) NOT NULL,
	`lantai` varchar(50) NOT NULL,
	`kapasitas_min` int NOT NULL DEFAULT 1,
	`kapasitas_max` int NOT NULL,
	`deskripsi` text,
	`foto` text,
	`status` enum('tersedia','dipinjam','perbaikan') NOT NULL DEFAULT 'tersedia',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `room_facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`facility_id` int NOT NULL,
	`jumlah` int DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_facilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_gedung_id_buildings_id_fk` FOREIGN KEY (`gedung_id`) REFERENCES `buildings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_facilities` ADD CONSTRAINT `room_facilities_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_facilities` ADD CONSTRAINT `room_facilities_facility_id_facilities_id_fk` FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE cascade ON UPDATE no action;