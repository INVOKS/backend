ALTER TABLE `rooms` DROP FOREIGN KEY `rooms_building_id_buildings_id_fk`;
--> statement-breakpoint
ALTER TABLE `room_facilities` MODIFY COLUMN `quantity` int NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE `buildings` ADD `image_url` text;--> statement-breakpoint
ALTER TABLE `buildings` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `facilities` ADD `description` text;--> statement-breakpoint
ALTER TABLE `rooms` ADD `room_code` varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD `is_active` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_building_id_room_code_unique` UNIQUE(`building_id`,`room_code`);--> statement-breakpoint
ALTER TABLE `room_facilities` ADD CONSTRAINT `room_facilities_room_id_facility_id_unique` UNIQUE(`room_id`,`facility_id`);--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_capacity_min_positive` CHECK (`rooms`.`capacity_min` > 0);--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_capacity_max_gte_min` CHECK (`rooms`.`capacity_max` >= `rooms`.`capacity_min`);--> statement-breakpoint
ALTER TABLE `room_facilities` ADD CONSTRAINT `room_facilities_quantity_positive` CHECK (`room_facilities`.`quantity` > 0);--> statement-breakpoint
ALTER TABLE `rooms` ADD CONSTRAINT `rooms_building_id_buildings_id_fk` FOREIGN KEY (`building_id`) REFERENCES `buildings`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `rooms_building_id_floor_idx` ON `rooms` (`building_id`,`floor`);