import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  check,
} from "drizzle-orm/pg-core";

// SoilGrids responses for one 0.01° cell: shared, immutable and free of farmer
// data. The estimate is re-derived from the raw layers on every read.
export const soilEstimates = pgTable(
  "soil_estimates",
  {
    id: uuid().primaryKey(),
    cellKey: text("cell_key").notNull().unique(),
    layers: jsonb().notNull(),
    normalizedSha256: text("normalized_sha256").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check("soil_estimate_hash", sql`${t.normalizedSha256} ~ '^[a-f0-9]{64}$'`),
  ],
);
// GPM IMERG responses for one 0.1° cell: shared, immutable, no farmer data.
export const rainReferences = pgTable(
  "rain_references",
  {
    id: uuid().primaryKey(),
    cellKey: text("cell_key").notNull().unique(),
    raw: text().notNull(),
    normalizedSha256: text("normalized_sha256").notNull(),
    retrievedAt: timestamp("retrieved_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check("rain_reference_hash", sql`${t.normalizedSha256} ~ '^[a-f0-9]{64}$'`),
  ],
);
