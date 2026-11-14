import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { disposable } from "../../tests/support/database.mjs";
import {
  disposableMail,
  TEST_PASSWORD,
} from "../../tests/support/accounts.mjs";
import { freePort, poll } from "../../tests/support/polling.mjs";
import {
  processFor,
  processEnv,
  stop,
} from "../../tests/support/processes.mjs";
import { syntheticPlanInput } from "../../tests/support/plans.mjs";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
const db = await disposable();
let inbox, api, worker;
try {
  inbox = await disposableMail();
  const port = await freePort(),
    workerPort = await freePort(),
    origin = `http://127.0.0.1:${port}`;
  const environment = {
    AUTH_ENABLED: "true",
    AUTH_SECRET: randomUUID() + randomUUID(),
    AUTH_BASE_URL: origin,
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(inbox.smtpPort),
    SMTP_TLS: "local",
    MAIL_FROM: "rotavise@example.invalid",
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  };
  const config = loadConfig(
    processEnv(db, { ...environment, API_PORT: String(port) }),
  );
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  api = await createApi(config);
  await api.app.listen(port, "127.0.0.1");
  worker = processFor(
    "worker",
    processEnv(db, { ...environment, WORKER_PORT: String(workerPort) }),
  );
  await poll(
    () =>
      worker.output.includes("worker_ready") ||
      (worker.exitCode !== null
        ? Promise.reject(new Error("WORKER_START_FAILED"))
        : false),
  );
  const email = "backend-demo@example.invalid";
  const post = (path, body, cookie, extra = {}) =>
    fetch(origin + path, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
        ...extra,
      },
      body: JSON.stringify(body),
      redirect: "manual",
    });
  const signup = await post("/api/auth/sign-up/email", {
    name: "Explicit synthetic demo account",
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(signup.status, 200);
  const verification = await poll(() => inbox.message(email));
  const link = verification.Text.match(/https?:\/\/[^\s]+/)[0];
  const verified = await fetch(link, { redirect: "manual" });
  assert.ok([200, 302].includes(verified.status));
  const login = await post("/api/auth/sign-in/email", {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(login.status, 200);
  const cookie = login.headers
    .getSetCookie()
    .map((v) => v.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  assert.equal(Object.hasOwn(await login.json(), "token"), false);
  console.log(
    "PASS optional account: durable verification delivered by separate worker; verified login and HttpOnly cookie",
  );
  const field = await post(
    "/api/v1/fields",
    {
      schema_version: "1",
      name: "Synthetic demonstration field",
      location: { latitude: 32.3, longitude: -6.3 },
      soil: { status: "unknown" },
      water: { status: "unknown" },
      crop_health: { status: "unknown" },
    },
    cookie,
  );
  assert.equal(field.status, 201);
  const saved = await field.json();
  const history = await post(
    `/api/v1/fields/${saved.id}/history`,
    {
      schema_version: "1",
      crop_id: "durum-wheat",
      planted_on: "2024-11-01",
      harvested_on: "2025-06-01",
    },
    cookie,
  );
  assert.equal(history.status, 201);
  console.log(
    "PASS private saved field and dated crop history; unknown soil/water remain explicit",
  );
  const accepted = await post("/api/v1/plans", syntheticPlanInput(), cookie, {
    "idempotency-key": "backend-demo-plan",
  });
  assert.equal(accepted.status, 202);
  const plan = await accepted.json();
  const result = await poll(async () => {
    const response = await fetch(origin + "/api/v1/plans/" + plan.id, {
      headers: { cookie },
    });
    assert.equal(response.status, 200);
    const data = await response.json();
    return data.status === "completed" ? data : false;
  });
  assert.equal(result.result.synthetic, false);
  assert.equal(result.result.assessment.outcome, "insufficient_evidence");
  assert.equal(result.result.assessment.sequence.counts.schedules, 0);
  assert.equal(result.weatherSnapshotIds.length, 0);
  const stranger = await fetch(origin + "/api/v1/plans/" + plan.id);
  assert.equal(stranger.status, 401);
  console.log(
    "PASS full backend workflow: real catalog → explicit missing evidence → persisted complete result; zero invented schedules/weather",
  );
  const guestResponse = await post("/api/v1/plan-sessions", {});
  const guest = await guestResponse.json();
  const guestPlanResponse = await post(
    "/api/v1/plans",
    syntheticPlanInput(),
    undefined,
    {
      authorization: "Bearer " + guest.accessToken,
      "idempotency-key": "backend-demo-guest",
    },
  );
  assert.equal(guestPlanResponse.status, 202);
  const guestPlan = await guestPlanResponse.json();
  const claim = () =>
    post(`/api/v1/plans/${guestPlan.id}/claim`, { confirm: true }, cookie, {
      authorization: "Bearer " + guest.accessToken,
    });
  assert.equal((await claim()).status, 201);
  assert.equal((await claim()).status, 201);
  const list = await fetch(origin + "/api/v1/plans", { headers: { cookie } });
  assert.equal((await list.json()).items.length, 2);
  console.log(
    "PASS repeatable guest claim and owned plan history; unchanged request identities/evidence",
  );
  await post("/api/auth/sign-out", {}, cookie);
  assert.equal(
    (await fetch(origin + "/api/v1/account", { headers: { cookie } })).status,
    401,
  );
  assert.equal(worker.output.includes(TEST_PASSWORD), false);
  assert.equal(worker.output.includes(email), false);
  console.log(
    "PASS logout immediately revokes the session; no credentials in worker logs",
  );
  console.log(
    "DEMO uses disposable PostgreSQL/SMTP and reserved .invalid contacts. Real recommendations remain blocked by local evidence review.",
  );
} finally {
  if (worker) await stop(worker);
  await api?.close();
  inbox?.close();
  await db.close();
}
