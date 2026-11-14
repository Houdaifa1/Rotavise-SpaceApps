import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  check,
  unique,
} from "drizzle-orm/pg-core";
export const catalogVersions = pgTable(
  "catalog_versions",
  {
    id: uuid().primaryKey().defaultRandom(),
    catalogKey: text("catalog_key").notNull(),
    version: text().notNull(),
    schemaVersion: text("schema_version").notNull(),
    contentSha256: text("content_sha256").notNull(),
    body: jsonb().notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("catalog_release_identity").on(t.catalogKey, t.version),
    check(
      "catalog_identity",
      sql`${t.catalogKey} ~ '^[a-z][a-z0-9-]{2,79}$' AND ${t.version} ~ '^(0|[1-9][0-9]*)[.](0|[1-9][0-9]*)[.](0|[1-9][0-9]*)$' AND length(${t.version}) <= 40 AND ${t.schemaVersion} IN ('1','2') AND ${t.contentSha256} ~ '^[a-f0-9]{64}$'`,
    ),
    check(
      "catalog_body_limit",
      sql`octet_length(${t.body}::text) between 1 and (CASE WHEN ${t.schemaVersion}='2' THEN 16777216 ELSE 8388608 END)`,
    ),
    check(
      "catalog_body_identity",
      sql`coalesce(jsonb_typeof(${t.body}) = 'object' AND ${t.body}->>'id' = ${t.catalogKey} AND ${t.body}->>'version' = ${t.version} AND ${t.body}->>'schemaVersion' = ${t.schemaVersion},false)`,
    ),
    check(
      "catalog_real_evidence",
      sql`coalesce(${t.body}->'synthetic' = 'false'::jsonb AND jsonb_typeof(${t.body}->'profiles') = 'array' AND jsonb_typeof(${t.body}->'sources') = 'array' AND jsonb_array_length(${t.body}->'profiles') between 1 and 300 AND jsonb_array_length(${t.body}->'sources') between 1 and 600 AND jsonb_array_length(jsonb_path_query_array(${t.body}, '$.profiles[*] ? (@.synthetic == false)')) = jsonb_array_length(${t.body}->'profiles') AND jsonb_array_length(jsonb_path_query_array(${t.body}, '$.sources[*] ? (@.synthetic == false)')) = jsonb_array_length(${t.body}->'sources') AND (${t.schemaVersion} = '1' OR (jsonb_typeof(${t.body}->'issues') = 'array' AND jsonb_array_length(jsonb_path_query_array(${t.body}, '$.issues[*] ? (@.synthetic == false)')) = jsonb_array_length(${t.body}->'issues'))),false)`,
    ),
  ],
);
