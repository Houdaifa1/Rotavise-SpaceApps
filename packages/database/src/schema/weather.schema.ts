import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  check,
  foreignKey,
  unique,
  index,
} from "drizzle-orm/pg-core";
export const weatherSnapshots = pgTable(
  "weather_snapshots",
  {
    id: uuid().primaryKey(),
    requestKey: text("request_key").notNull(),
    raw: text().notNull(),
    rawSha256: text("raw_sha256").notNull(),
    normalizedSha256: text("normalized_sha256").notNull(),
    snapshot: jsonb().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("weather_snapshot_key_id").on(t.requestKey, t.id),
    // Retention deletes the oldest unreferenced snapshots first.
    index("weather_snapshot_created_idx").on(t.createdAt),
    check(
      "weather_snapshot_hashes",
      sql`${t.requestKey} ~ '^[a-f0-9]{64}$' AND ${t.rawSha256} ~ '^[a-f0-9]{64}$' AND ${t.normalizedSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "weather_snapshot_raw_limit",
      sql`octet_length(${t.raw}) between 1 and 1048576`,
    ),
    check(
      "weather_snapshot_shape",
      sql`coalesce(jsonb_typeof(${t.snapshot}) = 'object' AND ${t.snapshot}->>'schemaVersion' = '1' AND ${t.snapshot}->'provenance'->>'provider' = 'nasa-power' AND ${t.snapshot}->'provenance'->>'rawSha256' = ${t.rawSha256}, false)`,
    ),
  ],
);
export const weatherCache = pgTable(
  "weather_cache",
  {
    requestKey: text("request_key").primaryKey(),
    snapshotId: uuid("snapshot_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    leaseOwner: uuid("lease_owner"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.requestKey, t.snapshotId],
      foreignColumns: [weatherSnapshots.requestKey, weatherSnapshots.id],
      name: "weather_cache_snapshot_fk",
    }),
    index("weather_cache_snapshot_idx").on(t.snapshotId),
    index("weather_cache_expiry_idx").on(t.expiresAt),
    check("weather_cache_key", sql`${t.requestKey} ~ '^[a-f0-9]{64}$'`),
    check(
      "weather_cache_snapshot_pair",
      sql`(${t.snapshotId} is null) = (${t.expiresAt} is null)`,
    ),
    check(
      "weather_cache_lease_pair",
      sql`(${t.leaseOwner} is null) = (${t.leaseUntil} is null)`,
    ),
  ],
);
