import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  customType,
  check,
  index,
  primaryKey,
} from "drizzle-orm/pg-core";
import { fields } from "./field.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true });
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });
// One satellite extraction for a saved field. The request holds the field's
// sample points, so it is owned through the field and deleted with it.
export const fieldObservations = pgTable(
  "field_observations",
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
    index("field_observation_field_idx").on(t.fieldId, t.createdAt),
    index("field_observation_pending_idx").on(t.status, t.updatedAt),
    check(
      "field_observation_state",
      sql`${t.kind} in ('hls','smap','gpm') AND ${t.status} in ('queued','submitted','completed','failed') AND ${t.attempts} between 0 and 10 AND octet_length(${t.request}::text)<=16384 AND (${t.status} in ('completed','failed')) = (${t.completedAt} is not null) AND (${t.status}='failed') = (${t.errorCode} is not null) AND (${t.status}='completed') = (${t.result} is not null AND ${t.resultHash} ~ '^[a-f0-9]{64}$')`,
    ),
    check(
      "field_observation_result_limit",
      sql`${t.result} is null OR octet_length(${t.result}::text)<=2097152`,
    ),
  ],
);
// Raw provider files behind a completed observation, kept for re-verification.
export const fieldObservationFiles = pgTable(
  "field_observation_files",
  {
    observationId: uuid("observation_id")
      .notNull()
      .references(() => fieldObservations.id, { onDelete: "cascade" }),
    name: text().notNull(),
    raw: bytea().notNull(),
    sha256: text().notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.observationId, t.name] }),
    check(
      "field_observation_file",
      sql`${t.sha256} ~ '^[a-f0-9]{64}$' AND octet_length(${t.raw}) between 1 and 20971520 AND ${t.name} ~ '^[A-Za-z0-9._-]{1,200}$'`,
    ),
  ],
);
