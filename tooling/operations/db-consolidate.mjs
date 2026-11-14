// Sources are hard-coded read-only backups. The only mutation target is rotavise.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { stableJson } from "../../apps/server/dist/common/serialization/stable-json.js";
import { readdir, mkdir, writeFile } from "node:fs/promises";
import {
  createPool,
  migrateApplication,
} from "../../packages/database/dist/index.js";
import {
  migrateQueue,
  createBoss,
} from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { FieldStore } from "../../apps/server/dist/modules/fields/application/field-store.js";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import { ExtractionStore } from "../../apps/server/dist/modules/earth-observations/application/extraction-store.js";
import { AppeearsClient } from "../../apps/server/dist/modules/earth-observations/providers/appeears/appeears.client.js";
import {
  ScenarioStore,
  tileUnits,
} from "../../apps/server/dist/modules/climate-scenarios/application/scenario-store.js";
import { currentFutureClimatePolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { scenarioCell } from "../../packages/contracts/dist/index.js";
import {
  container,
  databaseConfig,
  databasePool,
  assertContainer,
  copyTable,
  fingerprint,
} from "./database-tools.mjs";

import { importRegionalExtension } from "./regional-extension.mjs";
import { DataCompletenessService } from "../../apps/server/dist/modules/health/data-completeness.js";

const args = process.argv.slice(2).filter((a) => a !== "--");
if (
  args.some(
    (a) =>
      !["--verify-only", "--replace-new"].includes(a) &&
      !/^--(?:grace|gedi)-file=.+/.test(a),
  )
)
  throw Error("INVALID_ARGUMENT");
const verifyOnly = args.includes("--verify-only");
const tables = [
  ["rotavise_dev", "climate_scenario_units", "id", "true"],
  [
    "rotavise_dev",
    "climate_scenario_tiles",
    "tile_latitude,tile_longitude,policy_key",
    "true",
  ],
  [
    "rotavise_dev",
    "regional_water_storage",
    "product,latitude_e2,longitude_e2,month",
    "latitude_e2 BETWEEN 2600 AND 3700 AND longitude_e2 BETWEEN -1400 AND 0",
  ],
  [
    "rotavise_live",
    "regional_gedi_biomass",
    "product,latitude_e3,longitude_e3",
    "latitude_e3 BETWEEN 26000 AND 37000 AND longitude_e3 BETWEEN -14000 AND 0",
  ],
];
const config = databaseConfig();
const admin = databasePool("postgres", verifyOnly);
let target, source, boss;
const report = {
  at: new Date().toISOString(),
  container,
  tables: [],
  catalogs: [],
  reads: {},
  demo: [],
};
try {
  await assertContainer(admin);
  if (!verifyOnly) {
    const exists = (
      await admin.query("SELECT 1 FROM pg_database WHERE datname='rotavise'")
    ).rowCount;
    if (exists && !args.includes("--replace-new"))
      throw Error("TARGET_EXISTS_USE_VERIFY_ONLY_OR_REPLACE_NEW");
    // Literal SQL target: flags or environment can never select either backup.
    if (exists) await admin.query("DROP DATABASE rotavise");
    await admin.query("CREATE DATABASE rotavise");
  }
  target = verifyOnly
    ? databasePool("rotavise", true)
    : createPool(config.DATABASE_URL);
  if (!verifyOnly) {
    await migrateApplication(target);
    await migrateQueue(config);
    const store = new CatalogStore(target);
    const dirs = (await readdir("data/catalog/releases"))
      .filter((v) => /^0\.\d+\.0$/.test(v))
      .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]));
    for (const v of dirs) {
      const c = await loadCatalogRelease(`data/catalog/releases/${v}`);
      const imported = await store.import(c);
      await store.get(c.id, c.version);
      console.log(`Imported catalog ${v} ${imported.sha256}`);
    }
    for (const [from, table] of tables) {
      console.log(`Copying ${table} from read-only backup`);
      await copyTable(from, table);
    }
    source = databasePool("rotavise_live", true);
    boss = createBoss(config);
    const plans = new PlanStore(
      target,
      boss,
      config.PLAN_CATALOG_ID,
      config.PLAN_CATALOG_VERSION,
    );
    const session = await plans.createOwner("b6-consolidate-demo");
    const ownerId = await plans.authenticate(session.accessToken);
    const fields = new FieldStore(target);
    const extractions = new ExtractionStore(target, boss, new AppeearsClient());
    const candidates = (
      await source.query(
        "SELECT f.* FROM fields f WHERE (profile->'location'->>'latitude')::numeric=32.4 AND (profile->'location'->>'longitude')::numeric=-6.55",
      )
    ).rows;
    assert.equal(
      candidates.length,
      1,
      "exactly one original Tadla demo field required",
    );
    for (const field of candidates) {
      const history = (
        await source.query(
          "SELECT entry FROM field_crop_history WHERE field_id=$1 ORDER BY created_at,id",
          [field.id],
        )
      ).rows.map((r) => r.entry);
      const boundary = (
        await source.query(
          "SELECT boundary FROM field_boundaries WHERE field_id=$1",
          [field.id],
        )
      ).rows[0]?.boundary;
      const created = await fields.create(
        ownerId,
        field.profile,
        history,
        boundary,
      );
      for (const row of (
        await source.query(
          `SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') created_at_utc,
          to_char(updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') updated_at_utc,
          to_char(completed_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') completed_at_utc
          FROM field_extractions WHERE field_id=$1 AND status='completed' ORDER BY id`,
          [field.id],
        )
      ).rows) {
        const files = (
          await source.query(
            `SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') created_at_utc FROM field_extraction_files WHERE extraction_id=$1 ORDER BY name`,
            [row.id],
          )
        ).rows;
        report.demo.push(
          await extractions.importCompleted(created.id, row, files, {
            createdAt: row.created_at_utc,
            updatedAt: row.updated_at_utc,
            completedAt: row.completed_at_utc,
          }),
        );
      }
      await mkdir(".artifacts/b6", { recursive: true, mode: 0o700 });
      await writeFile(
        ".artifacts/b6/demo-session.json",
        JSON.stringify({ fieldId: created.id, ...session }),
        { mode: 0o600 },
      );
      console.log(
        "Created fresh guest-owned demo; access stored privately in .artifacts/b6/demo-session.json (seven-day expiry)",
      );
    }
    // Additional real source-file cells extend the old northern imports. The
    // existing importers preserve rows already copied, including imported_at.
    for (const arg of args) {
      if (arg.startsWith("--grace-file="))
        console.log(
          "GRACE extension",
          await importRegionalExtension(target, "grace", arg.slice(13)),
        );
      if (arg.startsWith("--gedi-file="))
        console.log(
          "GEDI extension",
          await importRegionalExtension(target, "gedi", arg.slice(12)),
        );
    }
    await target.query("ANALYZE");
  }
  let mismatch = false;
  for (const [from, table, order, where] of tables) {
    console.log(`Verifying exact COPY bytes: ${table}`);
    const original = await fingerprint(from, table, order);
    const copied = await fingerprint("rotavise", table, order, where);
    const ok =
      original.rows === copied.rows && original.sha256 === copied.sha256;
    report.tables.push({
      table,
      source: from,
      sourceRows: original.rows,
      targetRows: copied.rows,
      sourceSha256: original.sha256,
      targetSha256: copied.sha256,
      ok,
    });
    mismatch ||= !ok;
  }
  source ??= databasePool("rotavise_live", true);
  const originalFields = (
    await source.query("SELECT * FROM fields ORDER BY id")
  ).rows;
  for (const original of originalFields) {
    const ids = (
      await source.query(
        "SELECT id FROM field_extractions WHERE field_id=$1 ORDER BY id",
        [original.id],
      )
    ).rows.map((r) => r.id);
    const copied = (
      await target.query(
        "SELECT DISTINCT f.* FROM fields f JOIN field_extractions e ON e.field_id=f.id WHERE e.id=ANY($1::uuid[])",
        [ids],
      )
    ).rows;
    assert.equal(copied.length, 1, "demo field missing");
    assert.ok(
      copied[0].guest_owner_id && !copied[0].user_id,
      "demo must have a guest owner",
    );
    for (const [table, column, originalValue, copiedValue] of [
      ["fields", "profile", original.profile, copied[0].profile],
      ...(await Promise.all(
        [
          ["field_boundaries", "boundary"],
          ["field_crop_history", "entry"],
        ].map(async ([table, column]) => [
          table,
          column,
          (
            await source.query(
              `SELECT ${column} value FROM ${table} WHERE field_id=$1 ORDER BY ${column}::text`,
              [original.id],
            )
          ).rows.map((r) => r.value),
          (
            await target.query(
              `SELECT ${column} value FROM ${table} WHERE field_id=$1 ORDER BY ${column}::text`,
              [copied[0].id],
            )
          ).rows.map((r) => r.value),
        ]),
      )),
    ]) {
      const digest = (v) =>
        createHash("sha256").update(stableJson(v)).digest("hex");
      const fromHash = digest(originalValue),
        toHash = digest(copiedValue);
      const ok = fromHash === toHash;
      report.demo.push({
        table,
        column,
        sourceRows: table === "fields" ? 1 : originalValue.length,
        targetRows: table === "fields" ? 1 : copiedValue.length,
        sourceSha256: fromHash,
        targetSha256: toHash,
        ok,
      });
      mismatch ||= !ok;
    }
  }
  for (const [table, order, columns] of [
    [
      "field_extractions",
      "id",
      "id,kind,status,request,remote_task_id,attempts,result,result_hash,error_code,created_at,updated_at,completed_at",
    ],
    ["field_extraction_files", "extraction_id,name", "*"],
  ]) {
    const original = await fingerprint(
      "rotavise_live",
      table,
      order,
      "true",
      columns,
    );
    const copied = await fingerprint("rotavise", table, order, "true", columns);
    const ok =
      original.rows === copied.rows && original.sha256 === copied.sha256;
    report.tables.push({
      table,
      source: "rotavise_live",
      sourceRows: original.rows,
      targetRows: copied.rows,
      sourceSha256: original.sha256,
      targetSha256: copied.sha256,
      ok,
    });
    mismatch ||= !ok;
  }
  const store = new CatalogStore(target);
  for (const v of (await readdir("data/catalog/releases"))
    .filter((v) => /^0\.\d+\.0$/.test(v))
    .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]))) {
    const catalog = await loadCatalogRelease(`data/catalog/releases/${v}`);
    const stored = await store.get(catalog.id, catalog.version);
    assert.ok(stored, `catalog ${v} missing`);
    // import performs the exact project canonical-content conflict check.
    const result = verifyOnly ? null : await store.import(catalog);
    const { prepareStoredCatalog } =
      await import("../../apps/server/dist/modules/catalog/application/catalog-store.js");
    const expected = prepareStoredCatalog(catalog).sha256;
    const actual = stored.sha256;
    report.catalogs.push({
      version: v,
      sha256: actual,
      ok: expected === actual,
      ...(result ? { outcome: result.outcome } : {}),
    });
    mismatch ||= expected !== actual;
  }
  const cell = scenarioCell(32.4, -6.55);
  const unit = tileUnits(currentFutureClimatePolicy, cell.tile)[0];
  const series = await new ScenarioStore(target).series({
    cell: cell.cell,
    units: [unit],
  });
  assert.equal(series?.length, 1, "real climate unit must re-verify");
  report.reads.climate = {
    unitId: series[0].unitId,
    year: series[0].year,
    firstValues: series[0].values.slice(0, 3),
  };
  report.reads.grace = (
    await target.query(
      "SELECT latitude_e2,longitude_e2,month,lwe_cm FROM regional_water_storage ORDER BY latitude_e2,longitude_e2,month LIMIT 1",
    )
  ).rows[0];
  report.reads.gedi = (
    await target.query(
      "SELECT latitude_e3,longitude_e3,agbd_mg_ha FROM regional_gedi_biomass ORDER BY product,latitude_e3,longitude_e3 LIMIT 1",
    )
  ).rows[0];
  report.triggers = (
    await target.query(
      "SELECT tgname,tgenabled FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname",
    )
  ).rows;
  console.table(report.tables);
  console.table(report.catalogs);
  console.table(report.demo);
  console.table(report.triggers);
  const completeness = await new DataCompletenessService(target).check(true);
  report.completeness = completeness;
  console.table(completeness.datasets);
  mismatch ||= !completeness.ok;
  console.log(JSON.stringify(report.reads));
  await mkdir(".artifacts/b6", { recursive: true });
  await writeFile(
    ".artifacts/b6/consolidation.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  if (mismatch) throw Error("CONSOLIDATION_MISMATCH");
  console.log("CONSOLIDATION_VERIFIED");
} catch (error) {
  // Never stringify database/config errors: a connection URI may contain secrets.
  console.error(
    "CONSOLIDATION_FAILED",
    error.code ??
      (error.message?.match(/^[A-Z_]+$/) ? error.message : "CHECK_FAILED"),
  );
  process.exitCode = 1;
} finally {
  await boss?.stop();
  await source?.end();
  await target?.end();
  await admin.end();
}
