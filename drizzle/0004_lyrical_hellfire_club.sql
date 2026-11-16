CREATE TABLE `room_bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`booking_code` varchar(50) NOT NULL,
	`user_id` int NOT NULL,
	`room_id` int NOT NULL,
	`activity_name` varchar(255) NOT NULL,
	`activity_description` text,
	`organizer` varchar(150) NOT NULL,
	`participant_count` int NOT NULL,
	`pic_name` varchar(100) NOT NULL,
	`pic_phone` varchar(30) NOT NULL,
	`status` enum('booked','cancelled') NOT NULL DEFAULT 'booked',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `room_bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `room_bookings_booking_code_unique` UNIQUE(`booking_code`)
);
--> statement-breakpoint
CREATE TABLE `room_booking_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_booking_id` int NOT NULL,
	`room_id` int NOT NULL,
	`start_at` datetime NOT NULL,
	`end_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `room_booking_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `room_booking_slots_room_id_start_at_unique` UNIQUE(`room_id`,`start_at`)
);
--> statement-breakpoint
ALTER TABLE `room_bookings` ADD CONSTRAINT `room_bookings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_bookings` ADD CONSTRAINT `room_bookings_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_booking_slots` ADD CONSTRAINT `room_booking_slots_room_booking_id_room_bookings_id_fk` FOREIGN KEY (`room_booking_id`) REFERENCES `room_bookings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `room_booking_slots` ADD CONSTRAINT `room_booking_slots_room_id_rooms_id_fk` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `room_bookings_room_id_status_idx` ON `room_bookings` (`room_id`,`status`);--> statement-breakpoint
CREATE INDEX `room_booking_slots_booking_start_idx` ON `room_booking_slots` (`room_booking_id`,`start_at`);