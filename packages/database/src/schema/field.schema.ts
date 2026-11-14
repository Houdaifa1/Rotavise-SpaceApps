import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  jsonb,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { user } from "./auth.schema.js";
import { planOwners } from "./plan.schema.js";
const instant = (name: string) => timestamp(name, { withTimezone: true });
export const fields = pgTable(
  "fields",
  {
    id: uuid().primaryKey().defaultRandom(),
    // An account's field, or a guest's until the guest session expires.
    userId: uuid("user_id").references(() => user.id, { onDelete: "cascade" }),
    guestOwnerId: uuid("guest_owner_id").references(() => planOwners.id, {
      onDelete: "cascade",
    }),
    profile: jsonb().notNull(),
    version: integer().notNull().default(1),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("field_owner_list_idx").on(t.userId, t.createdAt, t.id),
    index("field_guest_list_idx").on(t.guestOwnerId, t.createdAt, t.id),
    index("field_owner_idx").on(t.userId, t.id),
    index("field_guest_idx").on(t.guestOwnerId),
    check(
      "field_one_owner",
      sql`(${t.userId} IS NULL) <> (${t.guestOwnerId} IS NULL)`,
    ),
    check("field_version", sql`${t.version}>0`),
    check(
      "field_profile",
      sql`coalesce(${t.profile}->>'schema_version'='1' AND octet_length(${t.profile}::text)<=16384,false)`,
    ),
  ],
);
export const fieldCropHistory = pgTable(
  "field_crop_history",
  {
    id: uuid().primaryKey().defaultRandom(),
    fieldId: uuid("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    entry: jsonb().notNull(),
    version: integer().notNull().default(1),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("field_history_idx").on(t.fieldId, t.id),
    check("field_history_version", sql`${t.version}>0`),
    check(
      "field_history_entry",
      sql`coalesce(${t.entry}->>'schema_version'='1' AND octet_length(${t.entry}::text)<=2048,false)`,
    ),
  ],
);
// A saved field's outline for satellite sampling; owned through the field
// and deleted with it.
export const fieldBoundaries = pgTable(
  "field_boundaries",
  {
    fieldId: uuid("field_id")
      .primaryKey()
      .references(() => fields.id, { onDelete: "cascade" }),
    boundary: jsonb().notNull(),
    version: integer().notNull().default(1),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
  },
  (t) => [
    check("field_boundary_version", sql`${t.version}>0`),
    check(
      "field_boundary_shape",
      sql`coalesce(${t.boundary}->>'type'='Polygon' AND octet_length(${t.boundary}::text)<=12288,false)`,
    ),
  ],
);
