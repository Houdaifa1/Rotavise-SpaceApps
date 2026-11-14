import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  timestamp,
  integer,
  bigint,
  index,
  check,
  unique,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true });
export const user = pgTable(
  "auth_users",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    email: text().notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [index("auth_user_unverified_idx").on(t.emailVerified, t.createdAt)],
);
export const session = pgTable(
  "auth_sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    expiresAt: instant("expires_at").notNull(),
    token: text().notNull().unique(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [
    index("auth_session_user_idx").on(t.userId),
    index("auth_session_expiry_idx").on(t.expiresAt),
  ],
);
export const account = pgTable(
  "auth_accounts",
  {
    id: uuid().primaryKey().defaultRandom(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    refreshTokenExpiresAt: instant("refresh_token_expires_at"),
    scope: text(),
    password: text(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("auth_account_user_idx").on(t.userId),
    unique("auth_provider_account").on(t.providerId, t.accountId),
  ],
);
export const verification = pgTable(
  "auth_verifications",
  {
    id: uuid().primaryKey().defaultRandom(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("auth_verification_identifier_idx").on(t.identifier),
    index("auth_verification_expiry_idx").on(t.expiresAt),
  ],
);
export const rateLimit = pgTable(
  "auth_rate_limits",
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text().notNull().unique(),
    count: integer().notNull(),
    lastRequest: bigint("last_request", { mode: "number" }).notNull(),
  },
  (t) => [index("auth_rate_limit_expiry_idx").on(t.lastRequest)],
);
// A Better Auth plugin model: adapter.create uses the active auth transaction.
// SMTP delivery is deliberately outside that transaction in the separate worker.
export const authMail = pgTable(
  "auth_mail",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    ciphertext: text(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    status: text().notNull().default("queued"),
    attempts: integer().notNull().default(0),
    availableAt: instant("available_at").notNull().defaultNow(),
    leaseUntil: instant("lease_until"),
    leaseId: uuid("lease_id"),
    completedAt: instant("completed_at"),
    errorCode: text("error_code"),
  },
  (t) => [
    check("auth_mail_kind", sql`${t.kind} in ('verify','recover','delete')`),
    check(
      "auth_mail_state",
      sql`${t.status} in ('queued','running','sent','failed')`,
    ),
    check("auth_mail_attempts", sql`${t.attempts} between 0 and 5`),
    check(
      "auth_mail_size",
      sql`${t.ciphertext} is null or octet_length(${t.ciphertext}) <= 16384`,
    ),
    check(
      "auth_mail_content",
      sql`(${t.status} in ('queued','running')) = (${t.ciphertext} is not null)`,
    ),
    check(
      "auth_mail_lease",
      sql`(${t.status}='running') = (${t.leaseId} is not null and ${t.leaseUntil} is not null)`,
    ),
    index("auth_mail_work_idx").on(t.status, t.availableAt),
    index("auth_mail_user_idx").on(t.userId),
    index("auth_mail_expiry_idx").on(t.status, t.expiresAt),
    index("auth_mail_completed_idx").on(t.completedAt),
  ],
);
