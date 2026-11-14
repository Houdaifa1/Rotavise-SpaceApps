import { beforeAll, afterAll, test, expect } from "@jest/globals";
import { execFileSync } from "node:child_process";
import {
  mkdtemp,
  readFile,
  readdir,
  appendFile,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  disposable,
  startApi,
  startWorker,
  stop,
  docker,
  poll,
} from "../support/index.mjs";
import { submitPlan, planSession } from "../support/plans.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { PlanningStore } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import { createPlanningHandler } from "../../apps/server/dist/modules/plans/worker/planning.handler.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { QUEUE } from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
import { operationsStatus } from "../../apps/server/dist/modules/health/operations-status.js";
import { parseMetrics } from "../../tooling/operations/alerts.mjs";
import { settings, compose } from "../../tooling/operations/lib.mjs";
import { backup } from "../../tooling/operations/backup.mjs";
import {
  checksumMatches,
  restoreDrill,
} from "../../tooling/operations/restore-drill.mjs";
import { initEnvironment } from "../../tooling/operations/init.mjs";

let db, api, dir, session;
const journal = JSON.parse(
  await readFile("packages/database/migrations/meta/_journal.json", "utf8"),
).entries.length;
// Backup names carry the second they were taken; step the clock so tests that
// back up several times in a row never share a name.
let clock = Date.now();
const dump = () =>
  backup({
    container: db.name,
    database: "rotavise_test",
    dir,
    tag: "test",
    now: new Date((clock += 2000)),
  });

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "rotavise-backups-"));
  db = await disposable();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  api = await startApi(db, { PLANS_ENABLED: "true", PLANNING_ENABLED: "true" });
  session = await planSession(api);
  const config = loadConfig({
    ...db.config,
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  });
  const workflow = new PlanningStore(db.pool, db.boss, config);
  const plans = new PlanStore(
    db.pool,
    db.boss,
    config.PLAN_CATALOG_ID,
    config.PLAN_CATALOG_VERSION,
    undefined,
    workflow,
  );
  try {
    for (let i = 0; i < 3; i += 1) {
      const accepted = await submitPlan(api, session.accessToken);
      await createPlanningHandler(
        plans,
        config,
      )([
        {
          data: { requestId: accepted.id },
          signal: new AbortController().signal,
        },
      ]);
    }
  } finally {
    await workflow.weather.close();
  }
}, 180000);
afterAll(async () => {
  if (api) await stop(api.child);
  await db?.close();
});

test("a backup is a checksummed custom-format dump outside the database volume, with the row counts of its own snapshot", async () => {
  const result = await dump();
  expect(result.name).toMatch(/^rotavise-\d{8}T\d{6}Z\.dump$/);
  const sums = await checksumMatches(result.file);
  expect(sums.recorded).toBe(sums.actual);
  expect(
    execFileSync("shasum", ["-a", "256", "-c", `${result.file}.sha256`], {
      cwd: dir,
      encoding: "utf8",
    }),
  ).toContain("OK");
  expect(result.manifest.tables["public.plan_requests"]).toBe(3);
  expect(result.manifest.migrations).toBe(journal);
  expect(result.manifest.postgres).toContain("PostgreSQL 18");
  expect((await readFile(result.file)).subarray(0, 5).toString()).toBe("PGDMP");
  expect(await readdir(dir)).toEqual(
    expect.arrayContaining([
      result.name,
      `${result.name}.sha256`,
      `${result.name}.manifest.json`,
    ]),
  );
}, 120000);

test("the restore drill proves a backup works, even after the live data has moved on", async () => {
  const result = await dump();
  await submitPlan(api, session.accessToken);
  const live = await db.pool.query("SELECT count(*)::int n FROM plan_requests");
  expect(live.rows[0].n).toBe(4);
  const drill = await restoreDrill({ dir, image: null, file: result.name });
  expect(drill.checks.map((check) => [check.name, check.ok])).toEqual([
    ["backup file matches its recorded checksum", true],
    ["pg_restore completes without errors", true],
    ["row counts match the backup manifest", true],
    ["migrations are current (running them changes nothing)", true],
    ["migration 0004/0005 protection triggers exist", true],
    ["stored plan input hashes recompute exactly", true],
    ["catalog content hashes and identities recompute exactly", true],
    ["planning version hashes recompute exactly", true],
    ["stored result hashes recompute exactly", true],
    ["accepted plan content is still protected from rewriting", true],
  ]);
  expect(drill.ok).toBe(true);
  expect(
    drill.checks.find(
      (c) => c.name === "stored result hashes recompute exactly",
    ).detail,
  ).toEqual({ results: 3, mismatches: 0 });
  expect(docker("ps", "-aq", "--filter", "label=rotavise.drill=true")).toBe("");
}, 240000);

test("the drill fails loudly when a backup file is corrupted or a stored hash was tampered with", async () => {
  const good = await dump();
  await appendFile(good.file, "corruption");
  const corrupted = await restoreDrill({ dir, image: null, file: good.name });
  expect(corrupted.ok).toBe(false);
  expect(corrupted.checks[0]).toMatchObject({
    name: "backup file matches its recorded checksum",
    ok: false,
  });

  await db.pool.query(
    "ALTER TABLE plan_requests DISABLE TRIGGER plan_request_immutable",
  );
  try {
    await db.pool.query(
      "UPDATE plan_requests SET input_hash = repeat('0', 64) WHERE id = (SELECT id FROM plan_requests LIMIT 1)",
    );
  } finally {
    await db.pool.query(
      "ALTER TABLE plan_requests ENABLE TRIGGER plan_request_immutable",
    );
  }
  const tampered = await dump();
  const drill = await restoreDrill({ dir, image: null, file: tampered.name });
  expect(drill.ok).toBe(false);
  expect(
    drill.checks.find(
      (check) => check.name === "stored plan input hashes recompute exactly",
    ),
  ).toMatchObject({ ok: false, detail: { plans: 4 } });
}, 240000);

test("the compose file is valid for a generated production settings file", async () => {
  const env = join(await mkdtemp(join(tmpdir(), "rotavise-compose-")), ".env");
  await initEnvironment({ file: env });
  const out = execFileSync(
    "docker",
    [
      "compose",
      "-p",
      "rotavise-validate",
      "-f",
      "infra/production/compose.yaml",
      "--env-file",
      env,
      "config",
      "--format",
      "json",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, ROTAVISE_TAG: "validate", ROTAVISE_ENV_FILE: env },
    },
  );
  const config = JSON.parse(out);
  expect(Object.keys(config.services).sort()).toEqual([
    "api",
    "catalog-import",
    "migrate",
    "postgres",
    "proxy",
    "science",
    "worker",
  ]);
  const published = Object.values(config.services).flatMap(
    (service) => service.ports ?? [],
  );
  expect(published).toHaveLength(1);
  expect(published[0].host_ip).toBe("127.0.0.1");
});

test("restored catalog and completed result corruption are detected independently", async () => {
  await db.pool.query(
    "ALTER TABLE catalog_versions DISABLE TRIGGER catalog_version_immutable",
  );
  await db.pool.query(
    "ALTER TABLE planning_runs DISABLE TRIGGER planning_run_immutable",
  );
  try {
    await db.pool.query(
      "UPDATE catalog_versions SET content_sha256=repeat('0',64)",
    );
    await db.pool.query(
      "UPDATE planning_runs SET result_hash=repeat('0',64) WHERE result IS NOT NULL",
    );
  } finally {
    await db.pool.query(
      "ALTER TABLE catalog_versions ENABLE TRIGGER catalog_version_immutable",
    );
    await db.pool.query(
      "ALTER TABLE planning_runs ENABLE TRIGGER planning_run_immutable",
    );
  }
  const saved = await dump();
  const drill = await restoreDrill({ dir, image: null, file: saved.name });
  expect(drill.ok).toBe(false);
  for (const name of [
    "catalog content hashes and identities recompute exactly",
    "stored result hashes recompute exactly",
  ])
    expect(drill.checks.find((c) => c.name === name).ok).toBe(false);
}, 240000);

test("staging compose resolves to an independent volume, network, settings and loopback port", async () => {
  const folder = await mkdtemp(join(tmpdir(), "rotavise-staging-"));
  const envFile = join(folder, ".env.staging");
  const stage = settings({
    ROTAVISE_ENVIRONMENT: "staging",
    ROTAVISE_ENV_FILE: envFile,
    ROTAVISE_DATA_DIR: folder,
  });
  await initEnvironment({ file: envFile, template: stage.templateFile });
  const config = JSON.parse(
    compose(stage, "validate", ["config", "--format", "json"]),
  );
  expect(config.volumes.pgdata.name).toBe("rotavise-staging_pgdata");
  expect(config.networks.internal.name).toBe("rotavise-staging_internal");
  expect(config.services.proxy.ports).toHaveLength(1);
  expect(config.services.proxy.ports[0]).toMatchObject({
    host_ip: "127.0.0.1",
    published: "8089",
  });
  expect(config.services.api.environment.DATABASE_URL).not.toContain(
    "disposable_only",
  );
  expect(config.services.api.environment.NODE_ENV).toBe("production");
});

test("HTTP error responses have safe JSON codes and fresh request IDs, including malformed bodies", async () => {
  const privateText = "private-person@example.test";
  const ids = [];
  for (const [path, options] of [
    ["/api/v1/no-such-route?email=" + privateText, {}],
    [
      "/api/v1/plans",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{bad JSON " + privateText,
      },
    ],
    [
      "/api/v1/plans",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: privateText, latitude: 32.123456789 }),
      },
    ],
  ]) {
    const response = await fetch(api.origin + path, {
      ...options,
      headers: { ...options.headers, "X-Request-Id": privateText },
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    const id = response.headers.get("x-request-id");
    expect(id).toMatch(/^[a-f0-9-]{36}$/);
    ids.push(id);
  }
  await poll(() => ids.every((id) => api.child.output.includes(id)), {
    label: "error logs",
  });
  const logs = api.child.output
    .split("\n")
    .filter((line) => line.startsWith("{"))
    .map((line) => JSON.parse(line));
  for (const requestId of ids)
    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requestId,
          level: "error",
          event: "http_error",
          code: expect.any(String),
        }),
      ]),
    );
  expect(new Set(ids).size).toBe(ids.length);
  expect(api.child.output).not.toContain(privateText);
  expect(api.child.output).not.toContain("32.123456789");
});

test("worker loopback metrics report real queue and tile state; failing jobs log no payload or exception text", async () => {
  const worker = await startWorker(db);
  try {
    const before = await operationsStatus(db.pool);
    expect(
      before.ingests.find((row) => row.provider === "nasa-power").lastSuccessAt,
    ).toBeNull();
    expect(before.disk.freeBytes).toBeGreaterThan(0);
    // Controlled invalid job: failure occurs before touching the development ledger.
    await db.boss.send(
      QUEUE,
      { email: "private-job@example.test", latitude: 32.123456789 },
      { retryLimit: 0 },
    );
    await poll(() => worker.child.output.includes('"event":"job_failure"'), {
      label: "job failure log",
    });
    await db.pool
      .query(`INSERT INTO climate_scenario_tiles(tile_latitude,tile_longitude,policy_key,status,units_total,error_code)
      VALUES(0,0,repeat('f',64),'failed',1,'SCENARIO_UPSTREAM_UNAVAILABLE')`);
    const response = await fetch(
      `http://127.0.0.1:${worker.port}/health/operations`,
    );
    expect(response.status).toBe(200);
    const metrics = parseMetrics(await response.json());
    expect(metrics.queue.failed).toBeGreaterThanOrEqual(1);
    expect(metrics.climateTiles).toContainEqual(
      expect.objectContaining({ status: "failed", count: 1, unitsReady: 0 }),
    );
    expect(JSON.stringify(metrics)).not.toMatch(
      /tile_latitude|tile_longitude|email|request_id|input_hash/,
    );
    expect((await fetch(api.origin + "/api/v1/health/operations")).status).toBe(
      404,
    );
    expect(worker.child.output).not.toContain("private-job@example.test");
    expect(worker.child.output).not.toContain("32.123456789");
    expect(worker.child.output).toContain('"code":"CALCULATION_FAILED"');
  } finally {
    await stop(worker.child);
  }
});

test("backup collision or a failed dump never overwrites or removes an existing copy", async () => {
  const saved = await dump();
  await expect(
    backup({
      container: db.name,
      database: "rotavise_test",
      dir,
      now: new Date(saved.manifest.createdAt),
    }),
  ).rejects.toThrow("BACKUP_EXISTS");
  const failedAt = new Date((clock += 2000));
  await expect(
    backup({
      container: "rotavise-nonexistent-controlled-test",
      database: "rotavise_test",
      dir,
      now: failedAt,
    }),
  ).rejects.toThrow("PSQL_SESSION_ENDED");
  expect((await checksumMatches(saved.file)).actual).toBe(saved.sha256);
  expect(await readdir(dir)).not.toContain(".backup-lock");
});

test("restore drill rejects a manifest whose row count differs from the restored snapshot", async () => {
  const saved = await dump();
  saved.manifest.tables["public.plan_requests"] += 1;
  await writeFile(
    saved.file + ".manifest.json",
    JSON.stringify(saved.manifest),
  );
  const drill = await restoreDrill({ dir, image: null, file: saved.name });
  expect(drill.ok).toBe(false);
  expect(
    drill.checks.find(
      (check) => check.name === "row counts match the backup manifest",
    ).ok,
  ).toBe(false);
}, 240000);
