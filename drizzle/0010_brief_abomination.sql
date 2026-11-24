CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actor_user_id` int,
	`action` varchar(100) NOT NULL,
	`entity_type` varchar(100) NOT NULL,
	`entity_id` varchar(100) NOT NULL,
	`before_data` json,
	`after_data` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `idempotency_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`operation` varchar(100) NOT NULL,
	`idempotency_key` varchar(128) NOT NULL,
	`request_hash` varchar(64) NOT NULL,
	`response_status` int NOT NULL,
	`response_body` json NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `idempotency_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `idempotency_user_op_key_uniq` UNIQUE(`user_id`,`operation`,`idempotency_key`)
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`setting_key` varchar(100) NOT NULL,
	`setting_value` json NOT NULL,
	`description` text,
	`updated_by` int,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `system_settings_setting_key` PRIMARY KEY(`setting_key`)
);
--> statement-breakpoint
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `idempotency_requests` ADD CONSTRAINT `idempotency_requests_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `system_settings` ADD CONSTRAINT `system_settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_logs_entity_type_entity_id_idx` ON `audit_logs` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_actor_user_id_created_at_idx` ON `audit_logs` (`actor_user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idempotency_requests_expires_at_idx` ON `idempotency_requests` (`expires_at`);