CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`action` varchar(500) NOT NULL,
	`entity_type` varchar(100),
	`entity_id` varchar(100),
	`details` json,
	`user_id` varchar(36),
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `client_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`client_id` int NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `client_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255),
	`mobile` varchar(50),
	`pan` varchar(20),
	`gstin` varchar(20),
	`notes` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`portal_user_id` varchar(36),
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(100) NOT NULL,
	`percent_off` int NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`expires_at` datetime,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`body` text NOT NULL,
	`request_item_id` int NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `document_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`storage_path` varchar(1000) NOT NULL,
	`mime_type` varchar(255),
	`file_size` int NOT NULL DEFAULT 0,
	`version` int NOT NULL DEFAULT 1,
	`request_item_id` int NOT NULL,
	`uploaded_by` varchar(36),
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `document_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`request_status` enum('open','completed','archived') NOT NULL DEFAULT 'open',
	`client_id` int NOT NULL,
	`financial_year_id` int NOT NULL,
	`template_id` int,
	`created_by` varchar(36),
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `document_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `document_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_years` (
	`id` int AUTO_INCREMENT NOT NULL,
	`label` varchar(50) NOT NULL,
	`start_date` datetime,
	`end_date` datetime,
	`is_active` boolean NOT NULL DEFAULT true,
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `financial_years_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`amount` int NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'INR',
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`razorpay_order_id` varchar(255),
	`razorpay_payment_id` varchar(255),
	`subscription_id` int,
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price_monthly` int NOT NULL DEFAULT 0,
	`price_yearly` int NOT NULL DEFAULT 0,
	`max_clients` int NOT NULL DEFAULT 0,
	`max_staff` int NOT NULL DEFAULT 0,
	`max_templates` int NOT NULL DEFAULT 0,
	`storage_gb` int NOT NULL DEFAULT 1,
	`features` json NOT NULL DEFAULT ('[]'),
	`is_active` boolean NOT NULL DEFAULT true,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` varchar(36) NOT NULL,
	`full_name` varchar(255) NOT NULL DEFAULT '',
	`email` varchar(255) NOT NULL DEFAULT '',
	`phone` varchar(50),
	`tenant_id` int,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `request_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`label` varchar(255),
	`category` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_required` boolean NOT NULL DEFAULT true,
	`is_repeatable` boolean NOT NULL DEFAULT false,
	`doc_status` enum('pending','uploaded','under_review','approved','rejected','reupload_required') NOT NULL DEFAULT 'pending',
	`request_id` int NOT NULL,
	`reviewed_by` varchar(36),
	`reviewed_at` datetime,
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `request_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`role_id` int NOT NULL,
	`permission` varchar(255) NOT NULL,
	CONSTRAINT `role_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`subscription_status` enum('trial','active','past_due','expired','cancelled') NOT NULL DEFAULT 'trial',
	`billing_period` varchar(20) NOT NULL DEFAULT 'monthly',
	`plan_id` int,
	`razorpay_subscription_id` varchar(255),
	`current_period_start` datetime,
	`current_period_end` datetime,
	`tenant_id` int NOT NULL,
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `template_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`category` varchar(255),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_required` boolean NOT NULL DEFAULT true,
	`is_repeatable` boolean NOT NULL DEFAULT false,
	`template_id` int NOT NULL,
	CONSTRAINT `template_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`tenant_status` enum('active','suspended') NOT NULL DEFAULT 'active',
	`created_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	`updated_at` datetime NOT NULL DEFAULT '1970-01-01 00:00:00.000',
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_custom_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`role_id` int NOT NULL,
	CONSTRAINT `user_custom_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`app_role` enum('super_admin','ca_admin','manager','staff','client') NOT NULL,
	`tenant_id` int,
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_assignments` ADD CONSTRAINT `client_assignments_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_assignments` ADD CONSTRAINT `client_assignments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `clients` ADD CONSTRAINT `clients_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_comments` ADD CONSTRAINT `document_comments_request_item_id_request_items_id_fk` FOREIGN KEY (`request_item_id`) REFERENCES `request_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_comments` ADD CONSTRAINT `document_comments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_files` ADD CONSTRAINT `document_files_request_item_id_request_items_id_fk` FOREIGN KEY (`request_item_id`) REFERENCES `request_items`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_files` ADD CONSTRAINT `document_files_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_financial_year_id_financial_years_id_fk` FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_template_id_document_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `document_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_requests` ADD CONSTRAINT `document_requests_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_years` ADD CONSTRAINT `financial_years_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_subscription_id_subscriptions_id_fk` FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `profiles` ADD CONSTRAINT `profiles_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_items` ADD CONSTRAINT `request_items_request_id_document_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `document_requests`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `request_items` ADD CONSTRAINT `request_items_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `roles` ADD CONSTRAINT `roles_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_plan_id_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `subscriptions` ADD CONSTRAINT `subscriptions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `template_items` ADD CONSTRAINT `template_items_template_id_document_templates_id_fk` FOREIGN KEY (`template_id`) REFERENCES `document_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_custom_roles` ADD CONSTRAINT `user_custom_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;