import { beforeAll, afterAll, test, expect } from "@jest/globals";
import {
  disposable,
  startApi,
  stop,
  poll,
  processFor,
  processEnv,
  freePort,
} from "../support/index.mjs";
import { planSession, submitPlan, planHttp } from "../support/plans.mjs";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
let db, api, worker, store, session, owner;
beforeAll(async () => {
  db = await disposable();
  const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
  await new CatalogStore(db.pool).import(catalog);
  store = new PlanStore(db.pool, db.boss, catalog.id, catalog.version);
  api = await startApi(db, { PLANS_ENABLED: "true" });
  session = await planSession(api);
  owner = await store.authenticate(session.accessToken);
});
afterAll(async () => {
  if (worker) await stop(worker.child);
  if (api) await stop(api.child);
  await db?.close();
});
async function reset(fault = "none") {
  if (worker) await stop(worker.child);
  const port = await freePort();
  const child = processFor(
    "worker",
    processEnv(db, {
      WORKER_PORT: String(port),
      PLANS_ENABLED: "true",
      TEST_PLAN_WORKER_FAULT: fault,
    }),
  );
  worker = { child, port };
  await poll(
    () =>
      child.output.includes("worker_ready") ||
      (child.exitCode !== null
        ? Promise.reject(new Error(child.output))
        : false),
  );
}
async function resultCount(id) {
  return (
    await db.pool.query(
      "SELECT * FROM plan_intake_results WHERE request_id=$1",
      [id],
    )
  ).rowCount;
}
test("transient intake failure retries with one result and no private payload in logs", async () => {
  await reset("transient");
  const { id } = await submitPlan(api, session.accessToken);
  await poll(async () => (await store.read(owner, id)).status === "completed");
  expect((await store.read(owner, id)).attempts).toBe(2);
  expect(await resultCount(id)).toBe(1);
  expect(worker.child.output).not.toContain(session.accessToken);
  expect(worker.child.output).not.toContain("SYNTHETIC symptom");
});
test("exhausted retries fail without result and late delivery cannot overwrite failure", async () => {
  await reset("terminal");
  const { id } = await submitPlan(api, session.accessToken);
  await poll(async () => (await store.read(owner, id)).status === "failed");
  expect(await store.read(owner, id)).toMatchObject({
    attempts: 3,
    error: { code: "RETRIES_EXHAUSTED" },
    result: null,
  });
  await store.verifyAndComplete(id);
  expect(await resultCount(id)).toBe(0);
});
test("actual SIGKILL after running intake recovers on restart with one authoritative result", async () => {
  await reset("pause");
  const { id } = await submitPlan(api, session.accessToken);
  await poll(() => worker.child.output.includes(`"requestId":"${id}"`));
  expect((await store.read(owner, id)).status).toBe("running");
  const began = Date.now();
  await stop(worker.child, "SIGKILL");
  expect(worker.child.signalCode).toBe("SIGKILL");
  await reset();
  await poll(async () => (await store.read(owner, id)).status === "completed", {
    timeout: 40000,
    label: "plan SIGKILL lease recovery",
  });
  expect((await store.read(owner, id)).attempts).toBe(2);
  expect(await resultCount(id)).toBe(1);
  console.log(
    `OBSERVED plan SIGKILL recovery: ${Date.now() - began} ms, 2 attempts, 1 result`,
  );
});
test("owned deletion while worker is paused cannot resurrect field input or result", async () => {
  await reset("pause");
  const { id } = await submitPlan(api, session.accessToken);
  await poll(() => worker.child.output.includes(`"requestId":"${id}"`));
  expect(
    (
      await planHttp(api, "/api/v1/plans/" + id, {
        method: "DELETE",
        token: session.accessToken,
      })
    ).status,
  ).toBe(204);
  await stop(worker.child, "SIGKILL");
  await reset();
  await store.maintain();
  expect(await store.begin(id)).toBeNull();
  expect(await resultCount(id)).toBe(0);
  expect(
    (await db.pool.query("SELECT * FROM plan_requests WHERE id=$1", [id]))
      .rowCount,
  ).toBe(0);
});
test("production rejects controlled plan faults before startup", async () => {
  const child = processFor(
    "worker",
    processEnv(db, {
      NODE_ENV: "production",
      DEV_HARNESS_ENABLED: "false",
      PLANS_ENABLED: "true",
      TEST_PLAN_WORKER_FAULT: "pause",
    }),
  );
  await child.exited;
  expect(child.exitCode).toBe(1);
  expect(child.output).toContain("WORKER_START_FAILED");
  expect(child.output).not.toContain(db.url);
});
