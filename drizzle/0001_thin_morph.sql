CREATE TABLE `otps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`code` varchar(255) NOT NULL,
	`expires_at` datetime NOT NULL,
	`used` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `otps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(255) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`full_name` varchar(255) NOT NULL DEFAULT '',
	`firm_name` varchar(255),
	`email_confirmed` boolean NOT NULL DEFAULT false,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;