CREATE TABLE `system_settings` (
	`key` varchar(100) NOT NULL,
	`value` text NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `system_settings_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
ALTER TABLE `otps` MODIFY COLUMN `code` varchar(255) NOT NULL;