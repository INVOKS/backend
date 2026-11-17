CREATE TABLE `item_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `item_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `item_categories_name_unique` UNIQUE(`name`),
	CONSTRAINT `item_categories_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`category_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`specifications` json,
	`image_url` text NOT NULL,
	`image_public_id` varchar(255),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `item_units` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_id` int NOT NULL,
	`inventory_code` varchar(50) NOT NULL,
	`condition` enum('good','damaged','maintenance') NOT NULL DEFAULT 'good',
	`is_active` boolean NOT NULL DEFAULT true,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `item_units_id` PRIMARY KEY(`id`),
	CONSTRAINT `item_units_inventory_code_unique` UNIQUE(`inventory_code`)
);
--> statement-breakpoint
ALTER TABLE `items` ADD CONSTRAINT `items_category_id_item_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `item_categories`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `item_units` ADD CONSTRAINT `item_units_item_id_items_id_fk` FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `items_category_id_is_active_idx` ON `items` (`category_id`,`is_active`);--> statement-breakpoint
CREATE INDEX `item_units_item_id_idx` ON `item_units` (`item_id`);