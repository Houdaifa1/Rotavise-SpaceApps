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
import { disposableMail } from "../support/accounts.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { PlanningStore } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { PLANNING_QUEUE } from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
let db, api, worker, workflow, store, session, owner, inbox;
beforeAll(async () => {
  db = await disposable();
  const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
  await new CatalogStore(db.pool).import(catalog);
  const config = loadConfig({
    ...db.config,
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  });
  workflow = new PlanningStore(db.pool, db.boss, config);
  store = new PlanStore(
    db.pool,
    db.boss,
    catalog.id,
    catalog.version,
    undefined,
    workflow,
  );
  api = await startApi(db, { PLANS_ENABLED: "true", PLANNING_ENABLED: "true" });
  session = await planSession(api);
  owner = await store.authenticate(session.accessToken);
});
afterAll(async () => {
  if (worker) await stop(worker.child);
  if (api) await stop(api.child);
  await workflow?.weather.close();
  inbox?.close();
  await db?.close();
});
async function reset(fault = "none", extra = {}) {
  if (worker) await stop(worker.child);
  const port = await freePort(),
    child = processFor(
      "worker",
      processEnv(db, {
        WORKER_PORT: String(port),
        PLANS_ENABLED: "true",
        PLANNING_ENABLED: "true",
        TEST_PLAN_WORKER_FAULT: fault,
        ...extra,
      }),
    );
  worker = { child, port };
  await poll(
    () =>
      child.output.includes("worker_ready") ||
      (child.exitCode !== null
        ? Promise.reject(new Error(child.output))
        : false),
    { label: "backend worker ready" },
  );
}
test("separate worker process performs complete real-evidence pipeline and durable completed result", async () => {
  await reset();
  const { id } = await submitPlan(api, session.accessToken);
  const result = await poll(async () => {
    const record = await store.read(owner, id);
    return record.status === "completed" ? record : false;
  });
  expect(result.result).toMatchObject({
    synthetic: false,
    processing: {
      calendar: "evaluated",
      weather: "not_needed",
      ranking: "insufficient_evidence",
    },
    assessment: { outcome: "insufficient_evidence" },
  });
  expect(result.attempts).toBe(1);
  expect(worker.child.output).not.toContain(session.accessToken);
  expect(worker.child.output).not.toContain("SYNTHETIC symptom");
});
test("actual SIGKILL recovers the same request once; controlled lease expiry avoids a fifteen-minute test wait", async () => {
  await reset("pause");
  const { id } = await submitPlan(api, session.accessToken);
  await poll(() => worker.child.output.includes(`"requestId":"${id}"`));
  expect((await store.read(owner, id)).status).toBe("running");
  await stop(worker.child, "SIGKILL");
  expect(worker.child.signalCode).toBe("SIGKILL");
  const row = (
    await db.pool.query("SELECT queue_job_id FROM plan_requests WHERE id=$1", [
      id,
    ])
  ).rows[0];
  // Explicit controlled failure injection in this disposable DB. Production
  // keeps its 900-second queue/database leases and 600-second work budget.
  await db.pool.query(
    "UPDATE planning_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE request_id=$1",
    [id],
  );
  await db.boss.fail(PLANNING_QUEUE, row.queue_job_id, {
    code: "SYNTHETIC_CRASH_TEST",
  });
  await reset();
  const result = await poll(
    async () => {
      const r = await store.read(owner, id);
      return r.status === "completed" ? r : false;
    },
    { label: "full planning SIGKILL recovery" },
  );
  expect(result.attempts).toBe(2);
  expect(
    (
      await db.pool.query(
        "SELECT * FROM planning_runs WHERE request_id=$1 AND result IS NOT NULL",
        [id],
      )
    ).rowCount,
  ).toBe(1);
  const hash = (
    await db.pool.query(
      "SELECT result_hash FROM planning_runs WHERE request_id=$1",
      [id],
    )
  ).rows[0].result_hash;
  await workflow.process(id, crypto.randomUUID(), new AbortController().signal);
  expect(
    (
      await db.pool.query(
        "SELECT result_hash FROM planning_runs WHERE request_id=$1",
        [id],
      )
    ).rows[0].result_hash,
  ).toBe(hash);
});
test("controlled transient failure retries; terminal failure stays operational and cannot become an agronomic rejection", async () => {
  await reset("transient");
  const first = await submitPlan(api, session.accessToken);
  await poll(
    async () => (await store.read(owner, first.id)).status === "completed",
  );
  expect((await store.read(owner, first.id)).attempts).toBe(2);
  await reset("terminal");
  const second = await submitPlan(api, session.accessToken);
  await poll(
    async () => (await store.read(owner, second.id)).status === "failed",
  );
  expect(await store.read(owner, second.id)).toMatchObject({
    error: { code: "CALCULATION_FAILED" },
    result: null,
  });
});
test("deleting a paused full planning request removes versions/results and restart cannot restore them", async () => {
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
  expect(await workflow.load(id)).toBeNull();
  expect(await workflow.begin(id)).toBeNull();
});
test("actual separate worker delivers verification mail after API process restart; no credentials are logged", async () => {
  inbox = await disposableMail();
  const auth = {
    AUTH_ENABLED: "true",
    AUTH_SECRET: "synthetic-recovery-auth-secret-07-" + crypto.randomUUID(),
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(inbox.smtpPort),
    SMTP_TLS: "local",
    MAIL_FROM: "rotavise@example.invalid",
  };
  if (worker) await stop(worker.child);
  const authApi = await startApi(db, {
    ...auth,
    AUTH_BASE_URL: "http://127.0.0.1:3000",
  });
  const email = "restart-fixture@example.invalid",
    password = "SyntheticRestartPassword_07!";
  try {
    const response = await fetch(authApi.origin + "/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        origin: "http://127.0.0.1:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "Synthetic restart", email, password }),
    });
    expect(response.status).toBe(200);
    expect(
      (await db.pool.query("SELECT status FROM auth_mail WHERE kind='verify'"))
        .rows[0].status,
    ).toBe("queued");
    await stop(authApi.child);
    await reset("none", { ...auth, AUTH_BASE_URL: "http://127.0.0.1:3000" });
    const message = await poll(() => inbox.message(email), {
      label: "durable SMTP after API restart",
    });
    expect(message.Text).toContain("Verify your email");
    expect(worker.child.output).not.toContain(email);
    expect(worker.child.output).not.toContain(password);
    expect(worker.child.output).not.toContain("token=");
    expect(
      (
        await db.pool.query(
          "SELECT status,ciphertext FROM auth_mail WHERE kind='verify'",
        )
      ).rows[0],
    ).toEqual({ status: "sent", ciphertext: null });
  } finally {
    await stop(authApi.child);
  }
});
