import { beforeAll, afterAll, test, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import {
  disposable,
  startApi,
  startWorker,
  stop,
  request,
  submit,
  poll,
  docker,
  TOKEN,
  processFor,
  processEnv,
  freePort,
} from "../support/index.mjs";
import { migrateApplication } from "../../packages/database/dist/index.js";
import {
  migrateQueue,
  QUEUE,
} from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
import { Ledger } from "../../apps/server/dist/modules/development-jobs/application/job-ledger.js";
let db, api, worker, ledger;
beforeAll(async () => {
  db = await disposable();
  api = await startApi(db);
  ledger = new Ledger(db.pool, db.boss);
});
afterAll(async () => {
  if (worker) await stop(worker.child);
  if (api) await stop(api.child);
  if (db) await db.close();
});
test("fresh migrations rerun safely and actual constraints reject invalid writes", async () => {
  await migrateApplication(db.pool);
  await migrateQueue(db.config);
  expect(
    (await db.pool.query("SHOW server_version")).rows[0].server_version,
  ).toMatch(/^18\.4/);
  const keys = await db.pool.query(
    "SELECT conname FROM pg_constraint WHERE conrelid='job_runs'::regclass",
  );
  expect(keys.rows.map((r) => r.conname)).toContain(
    "job_runs_idempotency_key_unique",
  );
  await expect(
    db.pool.query(
      "INSERT INTO job_runs(id,operation,input,input_hash,idempotency_key,queue_job_id,status) VALUES($1,'echo',$2,$3,$4,$5,'bad')",
      [
        randomUUID(),
        { operation: "echo", message: "x" },
        "a".repeat(64),
        randomUUID(),
        randomUUID(),
      ],
    ),
  ).rejects.toThrow();
  for (const input of [
    { operation: "echo" },
    { operation: "echo", message: null },
    { operation: "echo", message: "x", extra: true },
  ]) {
    await expect(
      db.pool.query(
        "INSERT INTO job_runs(id,operation,input,input_hash,idempotency_key,queue_job_id) VALUES($1,'echo',$2,$3,$4,$5)",
        [randomUUID(), input, "a".repeat(64), randomUUID(), randomUUID()],
      ),
    ).rejects.toThrow();
  }
});
test("readiness requires migrated queue and startup does not recreate it", async () => {
  await db.boss.deleteQueue(QUEUE);
  expect((await request(api, "/api/v1/health/ready")).status).toBe(503);
  expect(await db.boss.getQueue(QUEUE)).toBeNull();
  expect((await request(api, "/api/v1/health/live")).status).toBe(200);
  await migrateQueue(db.config);
  expect(
    await (await request(api, "/api/v1/health/ready")).json(),
  ).toMatchObject({ dependenciesReady: true, dataCompleteness: { ok: false } });
});
test("every API response carries browser security headers; HSTS only in production", async () => {
  for (const path of ["/api/v1/health/live", "/api/v1/no-such-route"]) {
    const response = await request(api, path);
    expect([200, 404]).toContain(response.status);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("content-security-policy")).toContain(
      "default-src 'none'",
    );
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cross-origin-resource-policy")).toBe(
      "same-origin",
    );
    expect(response.headers.get("strict-transport-security")).toBeNull();
  }
});
test("health checks distinguish live from actual database failure", async () => {
  expect(
    await (await request(api, "/api/v1/health/ready")).json(),
  ).toMatchObject({ dependenciesReady: true, dataCompleteness: { ok: false } });
  docker("stop", db.name);
  try {
    expect((await request(api, "/api/v1/health/live")).status).toBe(200);
    expect((await request(api, "/api/v1/health/ready")).status).toBe(503);
  } finally {
    docker("start", db.name);
    await poll(() => db.pool.query("SELECT 1"));
  }
  expect(
    await (await request(api, "/api/v1/health/ready")).json(),
  ).toMatchObject({ dependenciesReady: true, dataCompleteness: { ok: false } });
});
test("protected finite harness rejects invalid, unknown, oversized inputs and lookup", async () => {
  for (const token of [null, "wrong"])
    expect(
      (
        await request(api, "/api/v1/dev/test-jobs", {
          method: "POST",
          token,
          body: { operation: "echo", message: "x" },
          key: randomUUID(),
        })
      ).status,
    ).toBe(401);
  for (const body of [
    { operation: "plan", message: "x" },
    { operation: "echo", message: "" },
    { operation: "echo", message: "x".repeat(257) },
    { operation: "echo", message: "x", extra: true },
  ])
    expect(
      (
        await request(api, "/api/v1/dev/test-jobs", {
          method: "POST",
          body,
          key: randomUUID(),
        })
      ).status,
    ).toBe(400);
  expect(
    (
      await request(api, "/api/v1/dev/test-jobs", {
        method: "POST",
        body: { operation: "echo", message: "x" },
      })
    ).status,
  ).toBe(400);
  const huge = await request(api, "/api/v1/dev/test-jobs", {
    method: "POST",
    body: { operation: "echo", message: "x".repeat(5000) },
    key: randomUUID(),
  });
  expect([400, 413]).toContain(huge.status);
  expect(await huge.text()).not.toContain(TOKEN);
  expect(
    (await request(api, `/api/v1/dev/test-jobs/${randomUUID()}`)).status,
  ).toBe(404);
  expect((await request(api, "/api/v1/dev/test-jobs/invalid")).status).toBe(
    400,
  );
});
test("queue failure after real transactional enqueue rolls back ledger and queue", async () => {
  const key = randomUUID();
  let queueId;
  await expect(
    ledger.submit(
      key,
      { operation: "echo", message: "atomic" },
      async (runId, id, adapter) => {
        queueId = id;
        await db.boss.send(QUEUE, { runId }, { id, db: adapter });
        throw new Error("CONTROLLED_ENQUEUE_FAILURE");
      },
    ),
  ).rejects.toThrow("CONTROLLED_ENQUEUE_FAILURE");
  expect(
    (
      await db.pool.query("SELECT id FROM job_runs WHERE idempotency_key=$1", [
        key,
      ])
    ).rowCount,
  ).toBe(0);
  expect(await db.boss.findJobs(QUEUE, { id: queueId })).toHaveLength(0);
});
test("sequential and concurrent normalized submissions resolve once and changed input conflicts", async () => {
  const key = randomUUID();
  const ids = await Promise.all(
    Array.from({ length: 12 }, () => submit(api, " same ", key)),
  );
  expect(new Set(ids).size).toBe(1);
  expect(await submit(api, "same", key)).toBe(ids[0]);
  expect(
    (
      await request(api, "/api/v1/dev/test-jobs", {
        method: "POST",
        key,
        body: { operation: "echo", message: "different" },
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await db.pool.query("SELECT id FROM job_runs WHERE idempotency_key=$1", [
        key,
      ])
    ).rowCount,
  ).toBe(1);
});
test("queued work survives API restart, completes and remains durable; duplicate completions stay unique", async () => {
  const id = await submit(api);
  expect((await ledger.read(id)).status).toBe("queued");
  await stop(api.child);
  api = await startApi(db);
  worker = await startWorker(db);
  await poll(async () => (await ledger.read(id)).status === "completed", {
    label: "durable completion",
  });
  await Promise.all(
    Array.from({ length: 8 }, () =>
      ledger.complete(id, {
        operation: "echo",
        message: "attempted overwrite",
      }),
    ),
  );
  expect(await ledger.begin(id)).toBeNull();
  const duplicateJobId = await db.boss.send(QUEUE, { runId: id });
  await poll(
    async () =>
      (await db.boss.findJobs(QUEUE, { id: duplicateJobId }))[0]?.state ===
      "completed",
    { label: "physical duplicate delivery" },
  );
  expect((await ledger.read(id)).attempts).toBe(1);

  expect(
    (await db.pool.query("SELECT * FROM job_run_results WHERE run_id=$1", [id]))
      .rowCount,
  ).toBe(1);
  await stop(api.child);
  api = await startApi(db);
  const response = await request(api, `/api/v1/dev/test-jobs/${id}`);
  expect(response.status).toBe(200);
  expect((await response.json()).result).toEqual({
    fixture: "infrastructure-only",
    operation: "echo",
    message: "synthetic fixture",
  });
});
test("compiled production process excludes harness; unsafe production setting exits", async () => {
  const production = await startApi(db, {
    NODE_ENV: "production",
    TRUST_PROXY: "false",
    DEV_HARNESS_ENABLED: "false",
  });
  try {
    expect(
      (
        await request(production, "/api/v1/dev/test-jobs", {
          method: "POST",
          body: { operation: "echo", message: "x" },
          key: randomUUID(),
        })
      ).status,
    ).toBe(404);
    expect(
      (await request(production, `/api/v1/dev/test-jobs/${randomUUID()}`))
        .status,
    ).toBe(404);
    expect(
      (await request(production, "/api/v1/health/live")).headers.get(
        "strict-transport-security",
      ),
    ).toBe("max-age=31536000");
  } finally {
    await stop(production.child);
  }
});
test("production API refuses to start without an explicit proxy setting", async () => {
  const child = processFor(
    "api",
    processEnv(db, {
      NODE_ENV: "production",
      DEV_HARNESS_ENABLED: "false",
      API_PORT: String(await freePort()),
    }),
  );
  await child.exited;
  expect(child.exitCode).toBe(1);
  expect(child.output).toContain("API_START_FAILED");
  expect(child.output).not.toContain(db.url);
});
