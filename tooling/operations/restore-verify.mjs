// Runs inside the production server image (passed to `node --eval`, so imports
// resolve against /app) on a restored copy of the database. It prints one JSON
// report and exits 0 only when every check passes. It only reads, except for one
// UPDATE that must fail and is always rolled back.
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";
import { createPool, migrateApplication } from "@rotavise/database";
import { anyRequestIdentity } from "./dist/modules/plans/application/plan-policy.js";
import { prepareStoredCatalog } from "./dist/modules/catalog/application/catalog-store.js";
import { stableJson } from "./dist/common/serialization/stable-json.js";
import {
  planningResultSchema,
  rotationAssessmentSchema,
} from "@rotavise/contracts";

const digest = (value) =>
  createHash("sha256").update(stableJson(value)).digest("hex");

const manifest = JSON.parse(process.env.MANIFEST_JSON);
const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const migrationCount = async () =>
  Number(
    (await pool.query("SELECT count(*) AS n FROM drizzle.__drizzle_migrations"))
      .rows[0].n,
  );

try {
  const counts =
    await pool.query(`SELECT table_schema || '.' || table_name AS name,
      (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint AS n
    FROM information_schema.tables
    WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema')`);
  const restored = Object.fromEntries(
    counts.rows.map((r) => [r.name, Number(r.n)]),
  );
  const differences = [];
  for (const name of new Set([
    ...Object.keys(manifest.tables),
    ...Object.keys(restored),
  ]))
    if (manifest.tables[name] !== restored[name])
      differences.push(
        `${name}: backup ${manifest.tables[name] ?? "absent"}, restored ${restored[name] ?? "absent"}`,
      );
  add(
    "row counts match the backup manifest",
    differences.length === 0,
    differences.length
      ? differences.slice(0, 10)
      : `${Object.keys(restored).length} tables, ${Object.values(restored).reduce((a, b) => a + b, 0)} rows`,
  );

  const before = await migrationCount();
  const migrationPool = createPool(process.env.DATABASE_URL);
  try {
    await migrateApplication(migrationPool);
  } finally {
    await migrationPool.end();
  }
  const after = await migrationCount();
  const journalUrl = new URL(
    "../migrations/meta/_journal.json",
    import.meta.resolve("@rotavise/database"),
  );
  const journal = JSON.parse(readFileSync(journalUrl, "utf8")).entries.length;
  add(
    "migrations are current (running them changes nothing)",
    before === after && after === journal && before === manifest.migrations,
    {
      restored: before,
      afterMigrate: after,
      imageKnows: journal,
      manifest: manifest.migrations,
    },
  );

  const triggers = (
    await pool.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal")
  ).rows.map((r) => r.tgname);
  const required = [
    "plan_request_immutable",
    "plan_result_immutable",
    "planning_run_immutable",
    "planning_weather_immutable",
  ];
  const missing = required.filter((name) => !triggers.includes(name));
  add(
    "migration 0004/0005 protection triggers exist",
    missing.length === 0,
    missing.length ? { missing } : required,
  );

  if (
    manifest.tables["public.climate_scenario_units"] >= 186900 &&
    manifest.tables["public.catalog_versions"] >= 15
  ) {
    const { DataCompletenessService } =
      await import("./dist/modules/health/data-completeness.js");
    const completeness = await new DataCompletenessService(pool).check(true);
    add(
      "restored national reference database passes data completeness",
      completeness.ok,
      completeness.ok ? completeness.datasets : completeness.incomplete,
    );
  }

  const plans = (
    await pool.query("SELECT id, input, input_hash FROM plan_requests")
  ).rows;
  const badHashes = [];
  for (const row of plans) {
    try {
      if (anyRequestIdentity(row.input).hash !== row.input_hash)
        badHashes.push(row.id);
    } catch {
      badHashes.push(row.id);
    }
  }
  add("stored plan input hashes recompute exactly", badHashes.length === 0, {
    plans: plans.length,
    mismatches: badHashes.slice(0, 5),
  });

  let catalogs = 0,
    invalidCatalogs = 0;
  for (const row of (await pool.query("SELECT * FROM catalog_versions")).rows) {
    catalogs += 1;
    try {
      const prepared = prepareStoredCatalog(row.body);
      if (
        prepared.sha256 !== row.content_sha256 ||
        prepared.catalog.id !== row.catalog_key ||
        prepared.catalog.version !== row.version ||
        prepared.catalog.schemaVersion !== row.schema_version
      )
        invalidCatalogs += 1;
    } catch {
      invalidCatalogs += 1;
    }
  }
  add(
    "catalog content hashes and identities recompute exactly",
    invalidCatalogs === 0,
    { catalogs, mismatches: invalidCatalogs },
  );

  let results = 0,
    invalidResults = 0,
    versions = 0,
    invalidVersions = 0;
  for (const row of (
    await pool.query(
      "SELECT versions,versions_hash,result,result_hash FROM planning_runs",
    )
  ).rows) {
    versions += 1;
    if (digest(row.versions) !== row.versions_hash) invalidVersions += 1;
    if (row.result !== null) {
      results += 1;
      try {
        const parsed =
          row.result.kind === "rotation_assessment"
            ? rotationAssessmentSchema.parse(row.result)
            : planningResultSchema.parse(row.result);
        if (digest(parsed) !== row.result_hash) invalidResults += 1;
      } catch {
        invalidResults += 1;
      }
    }
  }
  for (const table of ["field_observations", "field_extractions"]) {
    for (const row of (
      await pool.query(
        `SELECT result,result_hash FROM ${table} WHERE result IS NOT NULL`,
      )
    ).rows) {
      results += 1;
      if (digest(row.result) !== row.result_hash) invalidResults += 1;
    }
  }
  add("planning version hashes recompute exactly", invalidVersions === 0, {
    versions,
    mismatches: invalidVersions,
  });
  add("stored result hashes recompute exactly", invalidResults === 0, {
    results,
    mismatches: invalidResults,
  });

  if (plans.length) {
    const client = await pool.connect();
    let message = null;
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE plan_requests SET input = jsonb_set(input, '{restore_probe}', 'true') WHERE id = $1",
        [plans[0].id],
      );
    } catch (error) {
      message = error.message;
    } finally {
      await client.query("ROLLBACK").catch(() => {});
      client.release();
    }
    add(
      "accepted plan content is still protected from rewriting",
      message === "PLAN_ACCEPTED_CONTENT_IMMUTABLE",
      message ?? "the update was allowed",
    );
  } else {
    add(
      "accepted plan content is still protected from rewriting",
      true,
      "skipped: the backup holds no plans",
    );
  }
} catch (error) {
  add(
    "verification ran to the end",
    false,
    String(error.message).slice(0, 300),
  );
} finally {
  await pool.end();
}
const ok = checks.every((check) => check.ok);
console.log(JSON.stringify({ ok, checks }, null, 2));
process.exit(ok ? 0 : 1);
