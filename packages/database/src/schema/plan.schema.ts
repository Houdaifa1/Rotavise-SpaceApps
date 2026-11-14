import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  check,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { catalogVersions } from "./catalog.schema.js";
import { user } from "./auth.schema.js";
export const planOwners = pgTable(
  "plan_owners",
  {
    id: uuid().primaryKey().defaultRandom(),
    tokenHash: text("token_hash").unique(),
    userId: uuid("user_id")
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "plan_owner_hash",
      sql`${t.tokenHash} is null OR ${t.tokenHash} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "plan_owner_expiry",
      sql`(${t.userId} IS NOT NULL AND ${t.tokenHash} IS NULL AND ${t.expiresAt} IS NULL) OR (${t.userId} IS NULL AND ${t.tokenHash} IS NOT NULL AND ${t.expiresAt} IS NOT NULL AND ${t.expiresAt} > ${t.createdAt} AND ${t.expiresAt} <= ${t.createdAt} + interval '7 days')`,
    ),
    index("plan_owner_expiry_idx").on(t.expiresAt),
  ],
);
export const planRequests = pgTable(
  "plan_requests",
  {
    id: uuid().primaryKey(),
    ownerId: uuid("owner_id")
      .notNull()
      .references(() => planOwners.id, { onDelete: "cascade" }),
    idempotencyKey: text("idempotency_key").notNull(),
    label: text("label"),
    initialLabel: text("initial_label"),
    // Retain the provenance UUID even if the source plan expires or is deleted.
    parentPlanId: uuid("parent_plan_id"),
    input: jsonb().notNull(),
    inputHash: text("input_hash").notNull(),
    evidence: jsonb().notNull(),
    catalogSnapshotId: uuid("catalog_snapshot_id")
      .notNull()
      .references(() => catalogVersions.id),
    queueJobId: uuid("queue_job_id").notNull().unique(),
    status: text().notNull().default("queued"),
    attempts: integer().notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: text("error_code"),
    retention: text().notNull().default("guest"),
  },
  (t) => [
    unique("plan_owner_idempotency").on(t.ownerId, t.idempotencyKey),
    check("plan_key", sql`${t.idempotencyKey} ~ '^[A-Za-z0-9_-]{8,80}$'`),
    check(
      "plan_label",
      sql`${t.label} is null OR (char_length(${t.label}) <= 80 AND ${t.label} !~ '[[:cntrl:]\u0080-\u009f]')`,
    ),
    check(
      "plan_initial_label",
      sql`${t.initialLabel} is null OR (char_length(${t.initialLabel}) <= 80 AND ${t.initialLabel} !~ '[[:cntrl:]\u0080-\u009f]')`,
    ),
    check(
      "plan_parent",
      sql`${t.parentPlanId} is null OR (${t.parentPlanId} <> ${t.id} AND ${t.input}->>'schema_version'='2' AND ${t.input}->'what_if' is not null)`,
    ),
    check("plan_hash", sql`${t.inputHash} ~ '^[a-f0-9]{64}$'`),
    check(
      "plan_status",
      sql`${t.status} in ('queued','running','completed','failed')`,
    ),
    check("plan_attempts", sql`${t.attempts} >= 0`),
    check(
      "plan_expiry",
      sql`${t.expiresAt} > ${t.createdAt} AND ((${t.retention}='guest' AND ${t.expiresAt} <= ${t.createdAt} + interval '1 day') OR (${t.retention}='account' AND ${t.expiresAt} <= ${t.createdAt} + interval '365 days'))`,
    ),
    check(
      "plan_input",
      sql`coalesce(jsonb_typeof(${t.input})='object' AND ${t.input}->>'schema_version' in ('1','2') AND octet_length(${t.input}::text) between 1 and 65536,false)`,
    ),
    check(
      "plan_evidence",
      sql`coalesce(jsonb_typeof(${t.evidence})='object' AND ${t.evidence}->>'catalogSnapshotId'=${t.catalogSnapshotId}::text AND ${t.evidence}->>'catalogSha256' ~ '^[a-f0-9]{64}$' AND ${t.evidence}->>'intakeVersion'='1' AND ${t.evidence}->>'policyVersion'='intake-policy-1' AND ${t.evidence}->'weatherSnapshotIds'='[]'::jsonb AND ${t.evidence}->'engineVersion'='null'::jsonb AND ${t.evidence}->'rankingVersion'='null'::jsonb,false)`,
    ),
    check(
      "plan_terminal",
      sql`(${t.status} in ('completed','failed')) = (${t.completedAt} is not null)`,
    ),
    check(
      "plan_error",
      sql`coalesce((${t.status}='failed' AND ${t.errorCode} in ('RETRIES_EXHAUSTED','QUEUE_TERMINAL_WITHOUT_RESULT','STORED_REQUEST_INVALID','CATALOG_EVIDENCE_INVALID')) OR (${t.status}<>'failed' AND ${t.errorCode} is null),false)`,
    ),
    index("plan_owner_list_idx").on(t.ownerId, t.createdAt, t.id),
    index("plan_pending_idx").on(t.status, t.updatedAt),
    index("plan_expiry_idx").on(t.expiresAt),
  ],
);
export const planIntakeResults = pgTable(
  "plan_intake_results",
  {
    requestId: uuid("request_id")
      .primaryKey()
      .references(() => planRequests.id, { onDelete: "cascade" }),
    result: jsonb().notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "plan_intake_only",
      sql`coalesce(${t.result} = '{"kind":"request_intake","requestIntegrity":"verified","catalogIntegrity":"verified","planning":"not_implemented","recommendations":null,"weather":"not_requested"}'::jsonb,false)`,
    ),
  ],
);
export const planQuotas = pgTable(
  "plan_quotas",
  {
    keyHash: text("key_hash").primaryKey(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check("plan_quota_hash", sql`${t.keyHash} ~ '^[a-f0-9]{64}$'`),
    check("plan_quota_count", sql`${t.count} > 0`),
    index("plan_quota_expiry_idx").on(t.expiresAt),
  ],
);
export const planClaims = pgTable(
  "plan_claims",
  {
    requestId: uuid("request_id")
      .primaryKey()
      .references(() => planRequests.id, { onDelete: "cascade" }),
    guestOwnerId: uuid("guest_owner_id").notNull(),
    originalKey: text("original_key").notNull(),
    accountOwnerId: uuid("account_owner_id")
      .notNull()
      .references(() => planOwners.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("claim_guest_key").on(t.guestOwnerId, t.originalKey)],
);
