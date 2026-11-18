CREATE TABLE `item_borrowing_slots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_borrowing_id` int NOT NULL,
	`item_borrowing_unit_id` int NOT NULL,
	`item_unit_id` int NOT NULL,
	`start_at` datetime NOT NULL,
	`end_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `item_borrowing_slots_id` PRIMARY KEY(`id`),
	CONSTRAINT `item_borrowing_slots_unit_start_unique` UNIQUE(`item_unit_id`,`start_at`)
);
--> statement-breakpoint
DROP INDEX `item_borrowings_status_start_at_end_at_idx` ON `item_borrowings`;--> statement-breakpoint
ALTER TABLE `item_borrowing_slots` ADD CONSTRAINT `item_borrowing_slots_item_borrowing_id_item_borrowings_id_fk` FOREIGN KEY (`item_borrowing_id`) REFERENCES `item_borrowings`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_borrowing_slots` ADD CONSTRAINT `item_borrowing_slots_item_unit_id_item_units_id_fk` FOREIGN KEY (`item_unit_id`) REFERENCES `item_units`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_borrowing_slots` ADD CONSTRAINT `item_borrowing_slots_borrowing_unit_id_fk` FOREIGN KEY (`item_borrowing_unit_id`) REFERENCES `item_borrowing_units`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `item_borrowing_slots_borrowing_start_idx` ON `item_borrowing_slots` (`item_borrowing_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `item_borrowing_slots_borrowing_unit_start_idx` ON `item_borrowing_slots` (`item_borrowing_unit_id`,`start_at`);--> statement-breakpoint
CREATE INDEX `item_borrowings_status_idx` ON `item_borrowings` (`status`);--> statement-breakpoint
ALTER TABLE `item_borrowings` DROP COLUMN `start_at`;--> statement-breakpoint
ALTER TABLE `item_borrowings` DROP COLUMN `end_at`;