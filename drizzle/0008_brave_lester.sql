CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`type` varchar(50) NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`reference_type` varchar(50) NOT NULL,
	`reference_id` int NOT NULL,
	`is_read` boolean NOT NULL DEFAULT false,
	`read_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notification_id` int NOT NULL,
	`channel` varchar(30) NOT NULL DEFAULT 'in_app',
	`deduplication_key` varchar(150) NOT NULL,
	`status` varchar(30) NOT NULL DEFAULT 'sent',
	`attempt_count` int NOT NULL DEFAULT 1,
	`sent_at` timestamp,
	`last_error` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reminder_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `reminder_logs_dedup_key_unique` UNIQUE(`deduplication_key`)
);
--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reminder_logs` ADD CONSTRAINT `reminder_logs_notification_id_notifications_id_fk` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `notifications_user_id_is_read_created_at_idx` ON `notifications` (`user_id`,`is_read`,`created_at`);--> statement-breakpoint
CREATE INDEX `notifications_reference_type_reference_id_idx` ON `notifications` (`reference_type`,`reference_id`);--> statement-breakpoint
CREATE INDEX `reminder_logs_notification_id_idx` ON `reminder_logs` (`notification_id`);