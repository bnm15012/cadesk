import {
  boolean,
  datetime,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Auth Tables ──────────────────────────────────────────────────────────────

export const users = mysqlTable("users", {
  id:             int("id").primaryKey().autoincrement(),
  email:          varchar("email", { length: 255 }).notNull().unique(),
  password_hash:  varchar("password_hash", { length: 255 }).notNull(),
  full_name:      varchar("full_name", { length: 255 }).notNull().default(""),
  firm_name:      varchar("firm_name", { length: 255 }),
  email_confirmed: boolean("email_confirmed").notNull().default(false),
  created_at:     datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at:     datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const sessions = mysqlTable("sessions", {
  id:         varchar("id", { length: 64 }).primaryKey(), // random hex token
  user_id:    int("user_id").notNull().references(() => users.id),
  expires_at: datetime("expires_at").notNull(),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const otps = mysqlTable("otps", {
  id:         int("id").primaryKey().autoincrement(),
  email:      varchar("email", { length: 255 }).notNull(),
  code:       varchar("code", { length: 8 }).notNull(),
  expires_at: datetime("expires_at").notNull(),
  used:       boolean("used").notNull().default(false),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

// ─── Enums ────────────────────────────────────────────────────────────────────

export const appRoleEnum = mysqlEnum("app_role", [
  "super_admin",
  "ca_admin",
  "manager",
  "staff",
  "client",
]);

export const docStatusEnum = mysqlEnum("doc_status", [
  "pending",
  "uploaded",
  "under_review",
  "approved",
  "rejected",
  "reupload_required",
]);

export const requestStatusEnum = mysqlEnum("request_status", [
  "open",
  "completed",
  "archived",
]);

export const subscriptionStatusEnum = mysqlEnum("subscription_status", [
  "trial",
  "active",
  "past_due",
  "expired",
  "cancelled",
]);

export const tenantStatusEnum = mysqlEnum("tenant_status", [
  "active",
  "suspended",
]);

// ─── Tables ───────────────────────────────────────────────────────────────────

export const tenants = mysqlTable("tenants", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  status: tenantStatusEnum.notNull().default("active"),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at: datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const profiles = mysqlTable("profiles", {
  // Mirrors Supabase auth.users.id — must stay varchar UUID
  id: varchar("id", { length: 36 }).primaryKey(),
  full_name: varchar("full_name", { length: 255 }).notNull().default(""),
  email: varchar("email", { length: 255 }).notNull().default(""),
  phone: varchar("phone", { length: 50 }),
  tenant_id: int("tenant_id").references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at: datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const user_roles = mysqlTable("user_roles", {
  id: int("id").primaryKey().autoincrement(),
  user_id: varchar("user_id", { length: 36 }).notNull(), // Supabase auth user UUID
  role: mysqlEnum("role", ["super_admin", "ca_admin", "manager", "staff", "client"]).notNull(),
  tenant_id: int("tenant_id").references(() => tenants.id),
});

export const roles = mysqlTable("roles", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const role_permissions = mysqlTable("role_permissions", {
  id: int("id").primaryKey().autoincrement(),
  role_id: int("role_id").notNull().references(() => roles.id),
  permission: varchar("permission", { length: 255 }).notNull(),
});

export const user_custom_roles = mysqlTable("user_custom_roles", {
  id: int("id").primaryKey().autoincrement(),
  user_id: varchar("user_id", { length: 36 }).notNull(), // Supabase auth user UUID
  role_id: int("role_id").notNull().references(() => roles.id),
});

export const clients = mysqlTable("clients", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }),
  mobile: varchar("mobile", { length: 50 }),
  pan: varchar("pan", { length: 20 }),
  gstin: varchar("gstin", { length: 20 }),
  notes: text("notes"),
  is_active: boolean("is_active").notNull().default(true),
  portal_user_id: varchar("portal_user_id", { length: 36 }), // Supabase auth user UUID
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at: datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const client_assignments = mysqlTable("client_assignments", {
  id: int("id").primaryKey().autoincrement(),
  client_id: int("client_id").notNull().references(() => clients.id),
  user_id: varchar("user_id", { length: 36 }).notNull(), // Supabase auth user UUID
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const financial_years = mysqlTable("financial_years", {
  id: int("id").primaryKey().autoincrement(),
  label: varchar("label", { length: 50 }).notNull(),
  start_date: datetime("start_date"),
  end_date: datetime("end_date"),
  is_active: boolean("is_active").notNull().default(true),
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const document_templates = mysqlTable("document_templates", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at: datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const template_items = mysqlTable("template_items", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 255 }),
  sort_order: int("sort_order").notNull().default(0),
  is_required: boolean("is_required").notNull().default(true),
  is_repeatable: boolean("is_repeatable").notNull().default(false),
  template_id: int("template_id").notNull().references(() => document_templates.id),
});

export const document_requests = mysqlTable("document_requests", {
  id: int("id").primaryKey().autoincrement(),
  title: varchar("title", { length: 255 }).notNull(),
  status: requestStatusEnum.notNull().default("open"),
  client_id: int("client_id").notNull().references(() => clients.id),
  financial_year_id: int("financial_year_id").notNull().references(() => financial_years.id),
  template_id: int("template_id").references(() => document_templates.id),
  created_by: varchar("created_by", { length: 36 }), // Supabase auth user UUID
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at: datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const request_items = mysqlTable("request_items", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  label: varchar("label", { length: 255 }),
  category: varchar("category", { length: 255 }),
  sort_order: int("sort_order").notNull().default(0),
  is_required: boolean("is_required").notNull().default(true),
  is_repeatable: boolean("is_repeatable").notNull().default(false),
  status: docStatusEnum.notNull().default("pending"),
  request_id: int("request_id").notNull().references(() => document_requests.id),
  reviewed_by: varchar("reviewed_by", { length: 36 }), // Supabase auth user UUID
  reviewed_at: datetime("reviewed_at"),
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at: datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const document_files = mysqlTable("document_files", {
  id: int("id").primaryKey().autoincrement(),
  file_name: varchar("file_name", { length: 500 }).notNull(),
  storage_path: varchar("storage_path", { length: 1000 }).notNull(),
  mime_type: varchar("mime_type", { length: 255 }),
  file_size: int("file_size").notNull().default(0),
  version: int("version").notNull().default(1),
  request_item_id: int("request_item_id").notNull().references(() => request_items.id),
  uploaded_by: varchar("uploaded_by", { length: 36 }), // Supabase auth user UUID
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const document_comments = mysqlTable("document_comments", {
  id: int("id").primaryKey().autoincrement(),
  body: text("body").notNull(),
  request_item_id: int("request_item_id").notNull().references(() => request_items.id),
  user_id: varchar("user_id", { length: 36 }).notNull(), // Supabase auth user UUID
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const activity_logs = mysqlTable("activity_logs", {
  id: int("id").primaryKey().autoincrement(),
  action: varchar("action", { length: 500 }).notNull(),
  entity_type: varchar("entity_type", { length: 100 }),
  entity_id: varchar("entity_id", { length: 100 }),
  details: json("details"),
  user_id: varchar("user_id", { length: 36 }), // Supabase auth user UUID
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const plans = mysqlTable("plans", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price_monthly: int("price_monthly").notNull().default(0),
  price_yearly: int("price_yearly").notNull().default(0),
  max_clients: int("max_clients").notNull().default(0),
  max_staff: int("max_staff").notNull().default(0),
  max_templates: int("max_templates").notNull().default(0),
  storage_gb: int("storage_gb").notNull().default(1),
  features: json("features").notNull().default([]),
  is_active: boolean("is_active").notNull().default(true),
  sort_order: int("sort_order").notNull().default(0),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").primaryKey().autoincrement(),
  status: subscriptionStatusEnum.notNull().default("trial"),
  billing_period: varchar("billing_period", { length: 20 }).notNull().default("monthly"),
  plan_id: int("plan_id").references(() => plans.id),
  razorpay_subscription_id: varchar("razorpay_subscription_id", { length: 255 }),
  current_period_start: datetime("current_period_start"),
  current_period_end: datetime("current_period_end"),
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
  updated_at: datetime("updated_at").notNull().default(new Date("1970-01-01")),
});

export const payments = mysqlTable("payments", {
  id: int("id").primaryKey().autoincrement(),
  amount: int("amount").notNull(),
  currency: varchar("currency", { length: 10 }).notNull().default("INR"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  razorpay_order_id: varchar("razorpay_order_id", { length: 255 }),
  razorpay_payment_id: varchar("razorpay_payment_id", { length: 255 }),
  subscription_id: int("subscription_id").references(() => subscriptions.id),
  tenant_id: int("tenant_id").notNull().references(() => tenants.id),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

export const coupons = mysqlTable("coupons", {
  id: int("id").primaryKey().autoincrement(),
  code: varchar("code", { length: 100 }).notNull(),
  percent_off: int("percent_off").notNull(),
  is_active: boolean("is_active").notNull().default(true),
  expires_at: datetime("expires_at"),
  created_at: datetime("created_at").notNull().default(new Date("1970-01-01")),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Otp = typeof otps.$inferSelect;
export type Tenant = typeof tenants.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type UserRole = typeof user_roles.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type RolePermission = typeof role_permissions.$inferSelect;
export type UserCustomRole = typeof user_custom_roles.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type ClientAssignment = typeof client_assignments.$inferSelect;
export type FinancialYear = typeof financial_years.$inferSelect;
export type DocumentTemplate = typeof document_templates.$inferSelect;
export type TemplateItem = typeof template_items.$inferSelect;
export type DocumentRequest = typeof document_requests.$inferSelect;
export type RequestItem = typeof request_items.$inferSelect;
export type DocumentFile = typeof document_files.$inferSelect;
export type DocumentComment = typeof document_comments.$inferSelect;
export type ActivityLog = typeof activity_logs.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Coupon = typeof coupons.$inferSelect;
