import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  numeric,
  timestamp,
  customType,
  check,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { fields } from "./field.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true });
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
// One terrain, ECOSTRESS or MODIS extraction for a saved field. Same life cycle as a
// field observation, with a larger request limit because a terrain request
// holds a small grid of sample points.
export const fieldExtractions = pgTable(
  "field_extractions",
  {
    id: uuid().primaryKey(),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    kind: text().notNull(),
    status: text().notNull().default("queued"),
    request: jsonb().notNull(),
    remoteTaskId: text("remote_task_id"),
    attempts: integer().notNull().default(0),
    result: jsonb(),
    resultHash: text("result_hash"),
    errorCode: text("error_code"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    completedAt: instant("completed_at"),
  },
  (t) => [
    index("field_extraction_field_idx").on(t.fieldId, t.createdAt),
    index("field_extraction_pending_idx").on(t.status, t.updatedAt),
    check(
      "field_extraction_state",
      sql`${t.kind} in ('terrain','ecostress','modis') AND ${t.status} in ('queued','submitted','completed','failed') AND ${t.attempts} between 0 and 10 AND octet_length(${t.request}::text)<=65536 AND (${t.status} in ('completed','failed')) = (${t.completedAt} is not null) AND (${t.status}='failed') = (${t.errorCode} is not null) AND (${t.status}='completed') = (${t.result} is not null AND ${t.resultHash} ~ '^[a-f0-9]{64}$')`,
    ),
    check(
      "field_extraction_result_limit",
      sql`${t.result} is null OR octet_length(${t.result}::text)<=2097152`,
    ),
  ],
);
// Raw provider files behind a completed extraction, kept for re-verification.
export const fieldExtractionFiles = pgTable(
  "field_extraction_files",
  {
    extractionId: uuid("extraction_id")
      .notNull()
      .references(() => fieldExtractions.id, { onDelete: "cascade" }),
    name: text().notNull(),
    raw: bytea().notNull(),
    sha256: text().notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.extractionId, t.name] }),
    check(
      "field_extraction_file",
      sql`${t.sha256} ~ '^[a-f0-9]{64}$' AND octet_length(${t.raw}) between 1 and 20971520 AND ${t.name} ~ '^[A-Za-z0-9._-]{1,200}$'`,
    ),
  ],
);
// GRACE / GRACE-FO mascon months for the Morocco region, imported from a file
// a person downloaded with their own Earthdata login. Regional, shared by all
// fields, never written by a request.
export const regionalWaterStorage = pgTable(
  "regional_water_storage",
  {
    product: text().notNull(),
    latitude: integer("latitude_e2").notNull(),
    longitude: integer("longitude_e2").notNull(),
    month: text().notNull(),
    lweCm: numeric("lwe_cm", { precision: 9, scale: 3 }).notNull(),
    sourceSha256: text("source_sha256").notNull(),
    importedAt: instant("imported_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.product, t.latitude, t.longitude, t.month] }),
    index("regional_water_storage_cell_idx").on(t.latitude, t.longitude),
    check(
      "regional_water_storage_value",
      sql`${t.month} ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' AND ${t.lweCm} between -2000 and 2000 AND ${t.sourceSha256} ~ '^[a-f0-9]{64}$' AND ${t.latitude} between -9000 and 9000 AND ${t.longitude} between -18000 and 18000`,
    ),
  ],
);
// GEDI L4B 1 km mean aboveground biomass density cells for the Morocco region,
// imported from a file a person downloaded with their own Earthdata login.
// Latitude and longitude are thousandths of a degree so that neighbouring 1 km
// cells never share a key. Regional, shared by all fields, never written by a
// request.
export const regionalGediBiomass = pgTable(
  "regional_gedi_biomass",
  {
    product: text().notNull(),
    latitude: integer("latitude_e3").notNull(),
    longitude: integer("longitude_e3").notNull(),
    agbdMgHa: numeric("agbd_mg_ha", { precision: 9, scale: 3 }).notNull(),
    seMgHa: numeric("se_mg_ha", { precision: 9, scale: 3 }),
    sourceSha256: text("source_sha256").notNull(),
    importedAt: instant("imported_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.product, t.latitude, t.longitude] }),
    index("regional_gedi_latest_idx").on(t.importedAt),
    check(
      "regional_gedi_biomass_value",
      sql`${t.agbdMgHa} between 0 and 5000 AND (${t.seMgHa} is null OR ${t.seMgHa} between 0 and 5000) AND ${t.sourceSha256} ~ '^[a-f0-9]{64}$' AND ${t.latitude} between -90000 and 90000 AND ${t.longitude} between -180000 and 180000`,
    ),
  ],
);
