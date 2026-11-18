CREATE TABLE `item_borrowings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`borrowing_code` varchar(30) NOT NULL,
	`user_id` int NOT NULL,
	`activity_name` varchar(255) NOT NULL,
	`pic_name` varchar(100) NOT NULL,
	`pic_phone` varchar(30) NOT NULL,
	`start_at` datetime NOT NULL,
	`end_at` datetime NOT NULL,
	`status` enum('booked','completed','cancelled') NOT NULL DEFAULT 'booked',
	`completed_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `item_borrowings_id` PRIMARY KEY(`id`),
	CONSTRAINT `item_borrowings_borrowing_code_unique` UNIQUE(`borrowing_code`)
);
--> statement-breakpoint
CREATE TABLE `item_borrowing_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_borrowing_id` int NOT NULL,
	`item_unit_id` int NOT NULL,
	`returned_at` datetime,
	`returned_by_admin_id` int,
	`return_condition` enum('good','damaged','maintenance'),
	`return_notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `item_borrowing_units_id` PRIMARY KEY(`id`),
	CONSTRAINT `item_borrowing_units_item_borrowing_id_item_unit_id_unique` UNIQUE(`item_borrowing_id`,`item_unit_id`)
);
--> statement-breakpoint
ALTER TABLE `item_borrowings` ADD CONSTRAINT `item_borrowings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_borrowing_units` ADD CONSTRAINT `item_borrowing_units_item_borrowing_id_item_borrowings_id_fk` FOREIGN KEY (`item_borrowing_id`) REFERENCES `item_borrowings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_borrowing_units` ADD CONSTRAINT `item_borrowing_units_item_unit_id_item_units_id_fk` FOREIGN KEY (`item_unit_id`) REFERENCES `item_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_borrowing_units` ADD CONSTRAINT `item_borrowing_units_returned_by_admin_id_users_id_fk` FOREIGN KEY (`returned_by_admin_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `item_borrowings_user_id_idx` ON `item_borrowings` (`user_id`);--> statement-breakpoint
CREATE INDEX `item_borrowings_status_start_at_end_at_idx` ON `item_borrowings` (`status`,`start_at`,`end_at`);--> statement-breakpoint
CREATE INDEX `item_borrowing_units_item_unit_id_returned_at_idx` ON `item_borrowing_units` (`item_unit_id`,`returned_at`);