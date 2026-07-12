/**
 * Core authentication server functions.
 * Replaces all Supabase Auth calls.
 *
 * Session token is stored in an HTTP-only cookie named "sid".
 * All server functions that need auth use requireAuth middleware from auth-middleware.ts
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setCookie, deleteCookie } from "@tanstack/react-start/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { eq, and, gt } from "drizzle-orm";

const SESSION_COOKIE = "sid";
const SESSION_DAYS   = 30;
const OTP_MINUTES    = 15;
const BCRYPT_ROUNDS  = 10;

// ── helpers ───────────────────────────────────────────────────────────────────

function randomHex(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}

async function createSession(userId: number) {
  const { getDb } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");

  const id = randomHex(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await getDb().insert(sessions).values({
    id,
    user_id: userId,
    expires_at: expires,
    created_at: now,
  });

  return { id, expires };
}

function setSessionCookie(sessionId: string, expires: Date) {
  setCookie(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

// ── getSession — read current session from cookie ────────────────────────────
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { getDb } = await import("@/lib/db");
  const { sessions, users, profiles, user_roles, user_custom_roles, role_permissions, clients, tenants } =
    await import("@/lib/db/schema");

  const req = getRequest();
  const cookieHeader = req?.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const sessionId = match?.[1];
  if (!sessionId) return null;

  const now = new Date();

  // Load session + user in one query
  const [row] = await getDb()
    .select({
      userId: sessions.user_id,
      expires: sessions.expires_at,
      email: users.email,
      fullName: users.full_name,
      emailConfirmed: users.email_confirmed,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.user_id, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expires_at, now)))
    .limit(1);

  if (!row) return null;

  // Load profile (tenant info)
  const [profile] = await getDb()
    .select({ tenantId: profiles.tenant_id })
    .from(profiles)
    .where(eq(profiles.id, String(row.userId)))
    .limit(1);

  const tenantId = profile?.tenantId ?? null;

  // Load tenant name + status
  let tenantStatus: string | null = null;
  let tenantName: string = "";
  if (tenantId) {
    const [t] = await getDb()
      .select({ status: tenants.status, name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);
    tenantStatus = t?.status ?? null;
    tenantName = t?.name ?? "";
  }

  // Load system roles
  const roleRows = await getDb()
    .select({ role: user_roles.role })
    .from(user_roles)
    .where(eq(user_roles.user_id, String(row.userId)));
  const roles = roleRows.map((r) => r.role);

  // Load custom role permissions
  const customRoleRows = await getDb()
    .select({ roleId: user_custom_roles.role_id })
    .from(user_custom_roles)
    .where(eq(user_custom_roles.user_id, String(row.userId)));
  const customRoleIds = customRoleRows.map((r) => r.roleId);

  let permissions: string[] = [];
  if (customRoleIds.length) {
    const { inArray } = await import("drizzle-orm");
    const permRows = await getDb()
      .select({ permission: role_permissions.permission })
      .from(role_permissions)
      .where(inArray(role_permissions.role_id, customRoleIds));
    permissions = permRows.map((p) => p.permission);
  }

  // If client role — get client id
  let clientId: number | null = null;
  if (roles.includes("client")) {
    const [c] = await getDb()
      .select({ id: clients.id })
      .from(clients)
      .where(eq(clients.portal_user_id, String(row.userId)))
      .limit(1);
    clientId = c?.id ?? null;
  }

  const isCaAdmin = roles.includes("ca_admin");
  const isManager = roles.includes("manager");
  const isStaff   = roles.includes("staff");
  const isClient  = roles.includes("client") && !isCaAdmin && !isManager && !isStaff;
  const isFirmMember = isCaAdmin || isManager || isStaff;

  // ca_admin gets wildcard permission
  if (isCaAdmin) permissions = ["*"];

  return {
    userId: String(row.userId),
    email: row.email,
    fullName: row.fullName,
    emailConfirmed: row.emailConfirmed,
    tenantId,
    tenantName,
    tenantStatus,
    roles,
    permissions,
    clientId,
    isClient,
    isFirmMember,
    isCaAdmin,
  };
});

// ── signUp ────────────────────────────────────────────────────────────────────
export const signUp = createServerFn({ method: "POST" })
  .validator((d: {
    email: string;
    password: string;
    fullName: string;
    firmName: string;
  }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users, tenants, profiles, user_roles, subscriptions, plans, roles, financial_years, document_templates, template_items } =
      await import("@/lib/db/schema");

    const db = getDb();
    const email = data.email.toLowerCase().trim();

    // Check duplicate
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing) throw new Error("This email is already registered. Try signing in instead.");

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    const now = new Date();

    const skipConfirmation = process.env.SKIP_EMAIL_CONFIRMATION === "true";

    // Insert user
    const [insertResult] = await db.insert(users).values({
      email,
      password_hash: passwordHash,
      full_name: data.fullName,
      firm_name: data.firmName,
      email_confirmed: skipConfirmation,
      created_at: now,
      updated_at: now,
    });
    const userId = Number((insertResult as any).insertId);

    // Create tenant
    const [tenantResult] = await db.insert(tenants).values({
      name: data.firmName,
      status: "active",
      created_at: now,
      updated_at: now,
    });
    const tenantId = Number((tenantResult as any).insertId);

    // Create profile (id = string of userId to keep compatibility with existing schema)
    await db.insert(profiles).values({
      id: String(userId),
      full_name: data.fullName,
      email,
      tenant_id: tenantId,
      created_at: now,
      updated_at: now,
    });

    // Assign ca_admin role
    await db.insert(user_roles).values({
      user_id: `${userId}`,
      role: "ca_admin",
      tenant_id: tenantId,
    });

    // Seed default Manager and Staff roles for the new tenant
    await db.insert(roles).values([
      { name: "Manager", description: "Can manage clients, requests and team assignments", tenant_id: tenantId, created_at: now },
      { name: "Staff", description: "Can view and work on assigned clients and requests", tenant_id: tenantId, created_at: now },
    ]);

    // Seed financial years — Indian FY: April 1 to March 31
    // Determine current FY based on signup date (month >= 4 means new FY has started)
    const signupYear = now.getFullYear();
    const signupMonth = now.getMonth() + 1; // 1-based
    // currentFYStart: April 1 of this year if month >= 4, else April 1 of last year
    const currentFYStartYear = signupMonth >= 4 ? signupYear : signupYear - 1;
    const prevFYStartYear = currentFYStartYear - 1;

    const buildFY = (startYear: number, isActive: boolean) => ({
      label: `FY ${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`,
      start_date: new Date(`${startYear}-04-01`),
      end_date: new Date(`${startYear + 1}-03-31`),
      is_active: isActive,
      tenant_id: tenantId,
      created_at: now,
    });

    await db.insert(financial_years).values([
      buildFY(prevFYStartYear, false),   // e.g. FY 24-25 — inactive
      buildFY(currentFYStartYear, true), // e.g. FY 25-26 — active
    ]);

    // Seed 3 common starter templates — CA can add more as needed
    const defaultTemplates: Array<{ name: string; description: string; items: string[] }> = [
      {
        name: "ITR — Salaried Individual",
        description: "Checklist for salaried income tax return",
        items: ["Form 16 (from employer)", "Bank statements (all accounts)", "Investment proofs (80C — LIC, PPF, ELSS, etc.)", "Home loan interest certificate (if applicable)", "Rent receipts / Rental agreement (HRA, if applicable)", "Aadhaar copy", "PAN copy"],
      },
      {
        name: "GST Monthly Return",
        description: "Documents for monthly GSTR-1 and GSTR-3B filing",
        items: ["Sales invoices", "Purchase invoices", "Credit / Debit notes", "Bank statement for the month", "Expense bills"],
      },
      {
        name: "Company Audit",
        description: "Statutory audit checklist for private limited company",
        items: ["Bank statements (all accounts, full year)", "Trial balance", "Ledger extracts", "Fixed asset register", "Loan agreements", "Statutory dues challans (PF, ESI, TDS, GST)", "Board minutes / resolutions"],
      },
    ];

    for (const tpl of defaultTemplates) {
      const [tplResult] = await db.insert(document_templates).values({
        tenant_id: tenantId,
        name: tpl.name,
        description: tpl.description,
        created_at: now,
        updated_at: now,
      }).$returningId();
      await db.insert(template_items).values(
        tpl.items.map((itemName, idx) => ({
          template_id: tplResult.id,
          name: itemName,
          category: null,
          is_required: true,
          is_repeatable: false,
          sort_order: idx,
        }))
      );
    }

    // Get starter plan
    const [starterPlan] = await db.select({ id: plans.id }).from(plans).where(eq(plans.name, "Starter")).limit(1);
    const trialEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(subscriptions).values({
      status: "trial",
      billing_period: "monthly",
      plan_id: starterPlan?.id ?? null,
      current_period_start: now,
      current_period_end: trialEnd,
      tenant_id: tenantId,
      created_at: now,
      updated_at: now,
    });

    if (skipConfirmation) {
      // Auto-login in dev
      const session = await createSession(userId);
      setSessionCookie(session.id, session.expires);
      return { confirmed: true };
    }

    // Production: send confirmation email
    const confirmToken = randomHex(32);
    await db.insert((await import("@/lib/db/schema")).otps).values({
      email,
      code: confirmToken,
      expires_at: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      used: false,
      created_at: now,
    });

    const appUrl = process.env.VITE_APP_URL ?? "http://localhost:8080";
    const { sendConfirmationEmail } = await import("@/lib/email");
    await sendConfirmationEmail(email, confirmToken, appUrl);

    return { confirmed: false };
  });

// ── signIn ────────────────────────────────────────────────────────────────────
export const signIn = createServerFn({ method: "POST" })
  .validator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users } = await import("@/lib/db/schema");

    const email = data.email.toLowerCase().trim();
    const [user] = await getDb()
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) throw new Error("Invalid email or password.");

    const valid = await bcrypt.compare(data.password, user.password_hash);
    if (!valid) throw new Error("Invalid email or password.");

    const skipConfirmation = process.env.SKIP_EMAIL_CONFIRMATION === "true";
    if (!user.email_confirmed && !skipConfirmation) {
      throw new Error("Please confirm your email before signing in.");
    }

    const session = await createSession(user.id);
    setSessionCookie(session.id, session.expires);

    return { userId: String(user.id) };
  });

// ── signOut ───────────────────────────────────────────────────────────────────
export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const { getDb } = await import("@/lib/db");
  const { sessions } = await import("@/lib/db/schema");

  const req = getRequest();
  const cookieHeader = req?.headers.get("cookie") ?? "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const sessionId = match?.[1];

  if (sessionId) {
    await getDb().delete(sessions).where(eq(sessions.id, sessionId));
  }

  deleteCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

// ── confirmEmail — verify the token from the confirmation email link ──────────
export const confirmEmail = createServerFn({ method: "GET" })
  .validator((d: { token: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users, otps } = await import("@/lib/db/schema");

    const now = new Date();
    const [otp] = await getDb()
      .select()
      .from(otps)
      .where(and(eq(otps.code, data.token), eq(otps.used, false), gt(otps.expires_at, now)))
      .limit(1);

    if (!otp) throw new Error("This confirmation link is invalid or has expired.");

    // Mark token as used
    await getDb().update(otps).set({ used: true }).where(eq(otps.id, otp.id));

    // Mark user as confirmed
    await getDb().update(users).set({ email_confirmed: true }).where(eq(users.email, otp.email));

    // Auto-login: create session
    const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, otp.email)).limit(1);
    if (!user) throw new Error("User not found.");

    const session = await createSession(user.id);
    setSessionCookie(session.id, session.expires);

    return { ok: true };
  });

// ── sendOtp — for forgot password ─────────────────────────────────────────────
export const sendOtp = createServerFn({ method: "POST" })
  .validator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users, otps } = await import("@/lib/db/schema");

    const email = data.email.toLowerCase().trim();
    const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);

    // Don't reveal whether email exists
    if (!user) return { ok: true };

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const now = new Date();
    const expires = new Date(now.getTime() + OTP_MINUTES * 60 * 1000);

    await getDb().insert(otps).values({ email, code, expires_at: expires, used: false, created_at: now });

    const { sendOtpEmail } = await import("@/lib/email");
    await sendOtpEmail(email, code);

    return { ok: true };
  });

// ── verifyOtp ─────────────────────────────────────────────────────────────────
export const verifyOtp = createServerFn({ method: "POST" })
  .validator((d: { email: string; code: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { otps } = await import("@/lib/db/schema");

    const email = data.email.toLowerCase().trim();
    const now = new Date();

    const [otp] = await getDb()
      .select()
      .from(otps)
      .where(and(eq(otps.email, email), eq(otps.code, data.code), eq(otps.used, false), gt(otps.expires_at, now)))
      .limit(1);

    if (!otp) throw new Error("Invalid or expired OTP.");

    await getDb().update(otps).set({ used: true }).where(eq(otps.id, otp.id));

    // Issue a short-lived reset token (reuse OTP id as proof)
    const resetToken = randomHex(24);
    const resetExpires = new Date(now.getTime() + 10 * 60 * 1000); // 10 min

    await getDb().insert(otps).values({
      email,
      code: resetToken,
      expires_at: resetExpires,
      used: false,
      created_at: now,
    });

    return { resetToken };
  });

// ── resetPassword ─────────────────────────────────────────────────────────────
export const resetPassword = createServerFn({ method: "POST" })
  .validator((d: { email: string; resetToken: string; newPassword: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { users, otps } = await import("@/lib/db/schema");

    const email = data.email.toLowerCase().trim();
    const now = new Date();

    const [tokenRow] = await getDb()
      .select()
      .from(otps)
      .where(and(eq(otps.email, email), eq(otps.code, data.resetToken), eq(otps.used, false), gt(otps.expires_at, now)))
      .limit(1);

    if (!tokenRow) throw new Error("Reset session expired. Please start over.");

    await getDb().update(otps).set({ used: true }).where(eq(otps.id, tokenRow.id));

    const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
    await getDb().update(users).set({ password_hash: passwordHash, updated_at: now }).where(eq(users.email, email));

    return { ok: true };
  });

// ── changePassword — for logged-in users ─────────────────────────────────────
export const changePassword = createServerFn({ method: "POST" })
  .validator((d: { newPassword: string }) => d)
  .handler(async ({ data }) => {
    const { getDb } = await import("@/lib/db");
    const { sessions, users } = await import("@/lib/db/schema");

    const req = getRequest();
    const cookieHeader = req?.headers.get("cookie") ?? "";
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
    const sessionId = match?.[1];
    if (!sessionId) throw new Error("Not authenticated.");

    const now = new Date();
    const [row] = await getDb()
      .select({ userId: sessions.user_id })
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), gt(sessions.expires_at, now)))
      .limit(1);

    if (!row) throw new Error("Session expired. Please sign in again.");

    const passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
    await getDb().update(users).set({ password_hash: passwordHash, updated_at: now }).where(eq(users.id, row.userId));

    return { ok: true };
  });
