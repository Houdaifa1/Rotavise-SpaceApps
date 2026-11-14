import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  doublePrecision,
  customType,
  index,
  uniqueIndex,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";

// Built-in PostgreSQL box + GiST: no PostGIS or runtime provider required.
const box = customType<{ data: string }>({ dataType: () => "box" });
export const boundaryDatasets = pgTable(
  "boundary_datasets",
  {
    sha256: text().primaryKey(),
    sourceUrl: text("source_url").notNull(),
    sourceEtag: text("source_etag").notNull(),
    license: text().notNull(),
    attribution: text().notNull(),
    year: integer().notNull(),
    active: boolean().notNull().default(false),
    report: jsonb().notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("boundary_dataset_one_active")
      .on(t.active)
      .where(sql`${t.active}`),
    check("boundary_dataset_sha", sql`${t.sha256} ~ '^[a-f0-9]{64}$'`),
    check(
      "boundary_dataset_license",
      sql`${t.license} = 'CC-BY-4.0' AND ${t.year} = 2025`,
    ),
  ],
);
export const boundaryCandidates = pgTable(
  "boundary_candidates",
  {
    datasetSha256: text("dataset_sha256")
      .notNull()
      .references(() => boundaryDatasets.sha256, { onDelete: "cascade" }),
    sourceId: text("source_id").notNull(),
    geometry: jsonb().notNull(),
    bounds: box().notNull(),
    areaHectares: doublePrecision("area_hectares").notNull(),
    confidence: doublePrecision(),
    holesDropped: integer("holes_dropped").notNull(),
    areaChangePercent: doublePrecision("area_change_percent").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.datasetSha256, t.sourceId] }),
    index("boundary_candidates_bounds").using("gist", t.bounds),
    check(
      "boundary_candidate_area",
      sql`${t.areaHectares} BETWEEN 0.1 AND 1000`,
    ),
    check(
      "boundary_candidate_confidence",
      sql`${t.confidence} IS NULL OR ${t.confidence} BETWEEN 0 AND 1`,
    ),
    check(
      "boundary_candidate_cleaning",
      sql`${t.holesDropped} BETWEEN 0 AND 31 AND ${t.areaChangePercent} BETWEEN 0 AND 2`,
    ),
    check(
      "boundary_candidate_geometry",
      sql`coalesce(${t.geometry}->>'type'='Polygon' AND octet_length(${t.geometry}::text)<=12288, false)`,
    ),
  ],
);
