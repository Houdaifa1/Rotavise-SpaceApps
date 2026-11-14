import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  customType,
  check,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { planningRuns } from "./planning.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true });
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
// One NEX-GDDP-CMIP6 tile response: shared, immutable, and free of farmer
// data (it names a 1° tile, never a field). Normalized values are derived
// from the raw bytes on every read and checked against normalized_sha256.
export const climateScenarioUnits = pgTable(
  "climate_scenario_units",
  {
    id: uuid().primaryKey(),
    unitKey: text("unit_key").notNull().unique(),
    model: text().notNull(),
    experiment: text().notNull(),
    variable: text().notNull(),
    year: integer().notNull(),
    tileLatitude: integer("tile_latitude").notNull(),
    tileLongitude: integer("tile_longitude").notNull(),
    raw: bytea().notNull(),
    rawSha256: text("raw_sha256").notNull(),
    normalizedSha256: text("normalized_sha256").notNull(),
    retrievedAt: instant("retrieved_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("climate_scenario_tile_year_idx").on(
      t.tileLatitude,
      t.tileLongitude,
      t.experiment,
      t.year,
      t.model,
      t.variable,
    ),
    index("climate_scenario_tile_idx").on(t.tileLatitude, t.tileLongitude),
    check(
      "climate_scenario_hashes",
      sql`${t.unitKey} ~ '^[a-f0-9]{64}$' AND ${t.rawSha256} ~ '^[a-f0-9]{64}$' AND ${t.normalizedSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "climate_scenario_identity",
      sql`${t.experiment} in ('historical','ssp245','ssp585') AND ${t.variable} in ('tasmin','tasmax','tas','pr') AND ${t.year} between 1950 and 2100 AND ${t.tileLatitude} between -60 and 89 AND ${t.tileLongitude} between -180 and 179 AND ${t.model} ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$'`,
    ),
    check(
      "climate_scenario_raw_limit",
      sql`octet_length(${t.raw}) between 1 and 262144`,
    ),
  ],
);
// Preparation state for one tile under one ensemble policy.
export const climateScenarioTiles = pgTable(
  "climate_scenario_tiles",
  {
    tileLatitude: integer("tile_latitude").notNull(),
    tileLongitude: integer("tile_longitude").notNull(),
    policyKey: text("policy_key").notNull(),
    status: text().notNull().default("requested"),
    unitsTotal: integer("units_total").notNull(),
    unitsReady: integer("units_ready").notNull().default(0),
    failures: integer().notNull().default(0),
    errorCode: text("error_code"),
    requestedAt: instant("requested_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    completedAt: instant("completed_at"),
  },
  (t) => [
    primaryKey({ columns: [t.tileLatitude, t.tileLongitude, t.policyKey] }),
    index("climate_scenario_tile_requested_idx").on(t.requestedAt),
    check(
      "climate_scenario_tile_policy",
      sql`${t.policyKey} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "climate_scenario_tile_state",
      sql`${t.status} in ('requested','preparing','ready','failed') AND ${t.unitsReady} between 0 and ${t.unitsTotal} AND ${t.unitsTotal} between 1 and 20000 AND ${t.failures} between 0 and 1000 AND (${t.status}='ready') = (${t.completedAt} is not null) AND (${t.status}='failed') = (${t.errorCode} is not null)`,
    ),
  ],
);
// Units a planning run used; retries reuse them and results cite them.
export const planningScenarioUnits = pgTable(
  "planning_scenario_units",
  {
    requestId: uuid("request_id")
      .notNull()
      .references(() => planningRuns.requestId, { onDelete: "cascade" }),
    unitId: uuid("unit_id")
      .notNull()
      .references(() => climateScenarioUnits.id),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.requestId, t.unitId] }),
    index("planning_scenario_unit_idx").on(t.unitId),
  ],
);
