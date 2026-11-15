CREATE TABLE `buildings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`code` varchar(20),
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buildings_id` PRIMARY KEY(`id`),
	CONSTRAINT `buildings_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`icon` varchar(50),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `facilities_id` PRIMARY KEY(`id`),
	CONSTRAINT `facilities_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`full_name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`gender` enum('female','male'),
	`date_of_birth` date,
	`department` varchar(100),
	`user_type` varchar(50),
	`academic_id` varchar(50),
	`phone` varchar(20),
	`profile_image_url` text,
	`building_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`building_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`floor` varchar(50) NOT NULL,
	`capacity_min` int NOT NULL DEFAULT 1,
	`capacity_max` int NOT NULL,
	`description` text,
	`image_url` text,
	`status` enum('available','borrowed','maintenance') NOT NULL DEFAULT 'available',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `rooms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `room_facilities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`facility_id` int NOT NULL,
	`quantity` int DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_facilities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_building_id_buildings_id_fk` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_facilities` ADD CONSTRAINT `room_facilities_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_facilities` ADD CONSTRAINT `room_facilities_facility_id_facilities_id_fk` FOREIGN KEY (`facility_id`) REFERENCES `facilities`(`id`) ON DELETE cascade ON UPDATE no action;