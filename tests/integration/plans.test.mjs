import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { disposable, startApi, stop, poll, docker } from "../support/index.mjs";
import {
  syntheticPlanInput,
  planSession,
  planHttp,
  submitPlan,
} from "../support/plans.mjs";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { PLAN_QUEUE } from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
import { migrateApplication } from "../../packages/database/dist/index.js";
const catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
let db, api, store, snapshot, session, owner;
beforeAll(async () => {
  db = await disposable();
  snapshot = await new CatalogStore(db.pool).import(catalog);
  api = await startApi(db, { PLANS_ENABLED: "true" });
  store = new PlanStore(db.pool, db.boss, catalog.id, catalog.version);
});
afterAll(async () => {
  if (api) await stop(api.child);
  await db?.close();
});
beforeEach(async () => {
  await db.pool.query(
    "TRUNCATE plan_owners,plan_requests,plan_intake_results,plan_quotas CASCADE",
  );
  session = await planSession(api);
  owner = await store.authenticate(session.accessToken);
});
async function read(id, token = session.accessToken) {
  return planHttp(api, "/api/v1/plans/" + id, { token });
}
async function expireRequest(id) {
  await db.pool.query(
    "ALTER TABLE plan_requests DISABLE TRIGGER plan_request_immutable",
  );
  try {
    await db.pool.query(
      "UPDATE plan_requests SET created_at=now()-interval '2 days',expires_at=now()-interval '1 day' WHERE id=$1",
      [id],
    );
  } finally {
    await db.pool.query(
      "ALTER TABLE plan_requests ENABLE TRIGGER plan_request_immutable",
    );
  }
}
test("real migration repeats; only token hashes are persisted and no credentials appear in logs", async () => {
  await migrateApplication(db.pool);
  await migrateApplication(db.pool);
  expect(session.accessToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const rows = (await db.pool.query("SELECT * FROM plan_owners")).rows;
  expect(JSON.stringify(rows)).not.toContain(session.accessToken);
  expect(rows[0].token_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(api.child.output).not.toContain(session.accessToken);
  const response = await planHttp(api, "/api/v1/plan-sessions", {
    method: "POST",
    body: {},
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
});
test("real HTTP accepts unknowns/unsupported choices, pins immutable catalog and queues only an ID", async () => {
  const accepted = await submitPlan(api, session.accessToken);
  const response = await read(accepted.id),
    body = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(body.input.soil).toEqual({ status: "unknown" });
  expect(body.input.preferences.considered_next_crop_ids).toContain(
    "unsupported-crop",
  );
  expect(body.evidence).toMatchObject({
    catalogSnapshotId: snapshot.id,
    catalogSha256: snapshot.sha256,
    engineVersion: null,
    rankingVersion: null,
    weatherSnapshotIds: [],
  });
  const row = (
    await db.pool.query("SELECT queue_job_id FROM plan_requests WHERE id=$1", [
      accepted.id,
    ])
  ).rows[0];
  const [job] = await db.boss.findJobs(PLAN_QUEUE, { id: row.queue_job_id });
  expect(job.data).toEqual({ requestId: accepted.id });
  expect(body.result).toBeNull();
  expect(body.stage).toBe("awaiting_intake");
});
test("missing, invalid and other-owner access cannot expose or delete private input", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  const other = await planSession(api);
  expect((await planHttp(api, "/api/v1/plans/" + id)).status).toBe(401);
  expect((await read(id, "x".repeat(43))).status).toBe(401);
  const foreign = await read(id, other.accessToken),
    missing = await read(randomUUID(), other.accessToken);
  expect(foreign.status).toBe(404);
  expect(await foreign.json()).toEqual(await missing.json());
  const deletion = await planHttp(api, "/api/v1/plans/" + id, {
    method: "DELETE",
    token: other.accessToken,
  });
  expect(deletion.status).toBe(404);
  expect((await read(id)).status).toBe(200);
  expect(
    (await planHttp(api, "/api/v1/plans", { token: session.accessToken }))
      .status,
  ).toBe(200);
});
test("invalid/extra/query/oversize inputs and wrong headers return safe errors", async () => {
  const v = syntheticPlanInput();
  v.preferences.excluded_crop_ids.push("faba-bean");
  expect(
    (
      await planHttp(api, "/api/v1/plans", {
        method: "POST",
        token: session.accessToken,
        key: randomUUID(),
        body: v,
      })
    ).status,
  ).toBe(400);
  const query = await planHttp(
    api,
    "/api/v1/plans/" + randomUUID() + "?access_token=not-allowed",
    { token: session.accessToken },
  );
  expect(query.status).toBe(400);
  const tooLarge = await planHttp(api, "/api/v1/plans", {
    method: "POST",
    token: session.accessToken,
    key: randomUUID(),
    body: { ...syntheticPlanInput(), padding: "x".repeat(40000) },
  });
  expect(tooLarge.status).toBe(413);
  expect(await tooLarge.text()).not.toContain(session.accessToken);
  expect(
    (
      await planHttp(api, "/api/v1/plans", {
        method: "POST",
        token: session.accessToken,
        body: syntheticPlanInput(),
      })
    ).status,
  ).toBe(400);
  const past = syntheticPlanInput();
  past.planning.earliest_start_date = "2000-01-01";
  expect(
    (
      await planHttp(api, "/api/v1/plans", {
        method: "POST",
        token: session.accessToken,
        key: randomUUID(),
        body: past,
      })
    ).status,
  ).toBe(400);
});
test("twelve concurrent repeats commit one job; normalized repeat succeeds and changed input conflicts", async () => {
  const key = randomUUID(),
    input = syntheticPlanInput();
  const replies = await Promise.all(
    Array.from({ length: 12 }, () =>
      submitPlan(api, session.accessToken, input, key),
    ),
  );
  expect(new Set(replies.map((r) => r.id)).size).toBe(1);
  const copy = structuredClone(input);
  copy.preferences.considered_next_crop_ids.reverse();
  expect((await submitPlan(api, session.accessToken, copy, key)).id).toBe(
    replies[0].id,
  );
  copy.preferences.priority = "soil_health";
  const conflict = await planHttp(api, "/api/v1/plans", {
    method: "POST",
    token: session.accessToken,
    key,
    body: copy,
  });
  expect(conflict.status).toBe(409);
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM plan_requests")).rows[0]
      .n,
  ).toBe(1);
  const other = await planSession(api);
  expect((await submitPlan(api, other.accessToken, input, key)).id).not.toBe(
    replies[0].id,
  );
});
test("real enqueue then injected failure rolls back request and queue insertion", async () => {
  const before = (
    await db.pool.query(
      "SELECT count(*)::int n FROM pgboss.job WHERE name=$1",
      [PLAN_QUEUE],
    )
  ).rows[0].n;
  await expect(
    store.submit(
      owner,
      randomUUID(),
      syntheticPlanInput(),
      async (id, queueId, tx) => {
        await db.boss.send(
          PLAN_QUEUE,
          { requestId: id },
          { id: queueId, db: tx },
        );
        throw new Error("CONTROLLED_AFTER_ENQUEUE_FAILURE");
      },
    ),
  ).rejects.toThrow("CONTROLLED_AFTER_ENQUEUE_FAILURE");
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM plan_requests")).rows[0]
      .n,
  ).toBe(0);
  expect(
    (
      await db.pool.query(
        "SELECT count(*)::int n FROM pgboss.job WHERE name=$1",
        [PLAN_QUEUE],
      )
    ).rows[0].n,
  ).toBe(before);
});
test("missing catalog is explicit and cannot leave a request/job", async () => {
  const missing = new PlanStore(db.pool, db.boss, catalog.id, "99.0.0");
  await expect(
    missing.submit(owner, randomUUID(), syntheticPlanInput()),
  ).rejects.toThrow("CATALOG_UNAVAILABLE");
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM plan_requests")).rows[0]
      .n,
  ).toBe(0);
});
test("controlled catalog corruption blocks acceptance and pinned intake verification", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  const corrupt = structuredClone(catalog);
  corrupt.profiles[0].limitations.push("Controlled integrity test mutation.");
  await db.pool.query(
    "ALTER TABLE catalog_versions DISABLE TRIGGER catalog_version_immutable",
  );
  try {
    await db.pool.query("UPDATE catalog_versions SET body=$2 WHERE id=$1", [
      snapshot.id,
      corrupt,
    ]);
    await expect(
      store.submit(owner, randomUUID(), syntheticPlanInput()),
    ).rejects.toThrow("CATALOG_UNAVAILABLE");
    await store.begin(id);
    await store.verifyAndComplete(id);
    expect((await store.read(owner, id)).error.code).toBe(
      "CATALOG_EVIDENCE_INVALID",
    );
  } finally {
    await db.pool.query("UPDATE catalog_versions SET body=$2 WHERE id=$1", [
      snapshot.id,
      catalog,
    ]);
    await db.pool.query(
      "ALTER TABLE catalog_versions ENABLE TRIGGER catalog_version_immutable",
    );
  }
});
test("expiry during completion rolls back the inserted private result", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  await db.pool.query(
    "ALTER TABLE plan_requests DISABLE TRIGGER plan_request_immutable",
  );
  try {
    await db.pool.query(
      "UPDATE plan_requests SET expires_at=clock_timestamp()+interval '1 second' WHERE id=$1",
      [id],
    );
  } finally {
    await db.pool.query(
      "ALTER TABLE plan_requests ENABLE TRIGGER plan_request_immutable",
    );
  }
  await store.begin(id);
  await expect(
    store.verifyAndComplete(
      id,
      () => new Promise((resolve) => setTimeout(resolve, 1200)),
    ),
  ).rejects.toThrow("INTAKE_EXPIRED_DURING_COMPLETION");
  expect(
    (
      await db.pool.query(
        "SELECT * FROM plan_intake_results WHERE request_id=$1",
        [id],
      )
    ).rowCount,
  ).toBe(0);
  expect((await read(id)).status).toBe(404);
  await store.maintain();
});
test("requests never outlive a shortened owner session", async () => {
  await db.pool.query(
    "UPDATE plan_owners SET expires_at=clock_timestamp()+interval '30 minutes' WHERE id=$1",
    [owner],
  );
  const accepted = await submitPlan(api, session.accessToken);
  const sessionEnd = (
    await db.pool.query("SELECT expires_at FROM plan_owners WHERE id=$1", [
      owner,
    ])
  ).rows[0].expires_at;
  expect(accepted.expiresAt).toBe(sessionEnd.toISOString());
});
test("supported queue cancellation reconciles a stable failed intake without results", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  const queueId = (
    await db.pool.query("SELECT queue_job_id FROM plan_requests WHERE id=$1", [
      id,
    ])
  ).rows[0].queue_job_id;
  await db.boss.cancel(PLAN_QUEUE, queueId);
  await store.maintain();
  expect(await store.read(owner, id)).toMatchObject({
    status: "failed",
    error: { code: "QUEUE_TERMINAL_WITHOUT_RESULT" },
    result: null,
  });
  await store.verifyAndComplete(id);
  expect((await store.read(owner, id)).status).toBe("failed");
});
test("worker pins old evidence after a new catalog is imported and returns only real intake verification", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  const next = structuredClone(catalog);
  next.version = "0.1.1";
  await new CatalogStore(db.pool).import(next);
  await store.begin(id);
  await store.verifyAndComplete(id);
  const completed = await store.read(owner, id);
  expect(completed.evidence.catalogSnapshotId).toBe(snapshot.id);
  expect(completed.result).toEqual({
    kind: "request_intake",
    requestIntegrity: "verified",
    catalogIntegrity: "verified",
    planning: "not_implemented",
    recommendations: null,
    weather: "not_requested",
  });
  await store.verifyAndComplete(id);
  expect(await store.begin(id)).toBeNull();
  expect(
    (
      await db.pool.query(
        "SELECT * FROM plan_intake_results WHERE request_id=$1",
        [id],
      )
    ).rowCount,
  ).toBe(1);
});
test("after-result insertion failure rolls back completion; retry retains one result", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  await store.begin(id);
  await expect(
    store.verifyAndComplete(id, async () => {
      throw new Error("CONTROLLED_RESULT_FAILURE");
    }),
  ).rejects.toThrow("CONTROLLED_RESULT_FAILURE");
  expect((await store.read(owner, id)).status).toBe("running");
  expect(
    (
      await db.pool.query(
        "SELECT * FROM plan_intake_results WHERE request_id=$1",
        [id],
      )
    ).rowCount,
  ).toBe(0);
  await store.verifyAndComplete(id);
  expect((await store.read(owner, id)).status).toBe("completed");
});
test("SQL rejects rewritten input/evidence, invalid terminal state and orphan intake results", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  await expect(
    db.pool.query("UPDATE plan_requests SET input_hash=$2 WHERE id=$1", [
      id,
      "a".repeat(64),
    ]),
  ).rejects.toThrow("PLAN_ACCEPTED_CONTENT_IMMUTABLE");
  await expect(
    db.pool.query(
      "UPDATE plan_requests SET status='failed',completed_at=now() WHERE id=$1",
      [id],
    ),
  ).rejects.toThrow();
  await expect(
    db.pool.query(
      "UPDATE plan_requests SET status='completed',completed_at=now() WHERE id=$1",
      [id],
    ),
  ).rejects.toThrow("PLAN_RESULT_STATE_MISMATCH");
  await store.begin(id);
  await store.verifyAndComplete(id);
  await expect(
    db.pool.query("DELETE FROM plan_intake_results WHERE request_id=$1", [id]),
  ).rejects.toThrow("PLAN_RESULT_STATE_MISMATCH");
  await expect(
    db.pool.query(
      "UPDATE plan_requests SET status='running',completed_at=null WHERE id=$1",
      [id],
    ),
  ).rejects.toThrow("PLAN_TERMINAL_IMMUTABLE");
});
test("controlled stored-input corruption fails safely and cannot produce an intake result", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  await db.pool.query(
    "ALTER TABLE plan_requests DISABLE TRIGGER plan_request_immutable",
  );
  try {
    await db.pool.query("UPDATE plan_requests SET input_hash=$2 WHERE id=$1", [
      id,
      "a".repeat(64),
    ]);
  } finally {
    await db.pool.query(
      "ALTER TABLE plan_requests ENABLE TRIGGER plan_request_immutable",
    );
  }
  const response = await read(id);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ code: "STORED_REQUEST_INVALID" });
  await store.begin(id);
  await store.verifyAndComplete(id);
  expect(
    (
      await db.pool.query(
        "SELECT status,error_code FROM plan_requests WHERE id=$1",
        [id],
      )
    ).rows[0],
  ).toEqual({ status: "failed", error_code: "STORED_REQUEST_INVALID" });
  expect(
    (
      await db.pool.query(
        "SELECT * FROM plan_intake_results WHERE request_id=$1",
        [id],
      )
    ).rowCount,
  ).toBe(0);
});
test("expiry blocks access and repeat before bounded cleanup; late job cannot recreate private rows", async () => {
  const key = randomUUID(),
    input = syntheticPlanInput();
  const { id } = await submitPlan(api, session.accessToken, input, key);
  await expireRequest(id);
  expect((await read(id)).status).toBe(404);
  expect(
    (
      await planHttp(api, "/api/v1/plans", {
        method: "POST",
        token: session.accessToken,
        key,
        body: input,
      })
    ).status,
  ).toBe(404);
  await store.maintain();
  expect(await store.begin(id)).toBeNull();
  await store.verifyAndComplete(id);
  expect(
    (await db.pool.query("SELECT * FROM plan_requests WHERE id=$1", [id]))
      .rowCount,
  ).toBe(0);
  expect(
    (
      await db.pool.query(
        "SELECT * FROM plan_intake_results WHERE request_id=$1",
        [id],
      )
    ).rowCount,
  ).toBe(0);
});
test("owner expiry enforces authentication and cascaded data removal", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  await db.pool.query(
    "UPDATE plan_owners SET created_at=now()-interval '8 days',expires_at=now()-interval '1 day' WHERE id=$1",
    [owner],
  );
  expect((await read(id)).status).toBe(401);
  await store.maintain();
  expect(
    (await db.pool.query("SELECT * FROM plan_owners WHERE id=$1", [owner]))
      .rowCount,
  ).toBe(0);
  expect(
    (await db.pool.query("SELECT * FROM plan_requests WHERE id=$1", [id]))
      .rowCount,
  ).toBe(0);
});
test("owned deletion and session revocation remove private input/results without resurrection", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  await store.begin(id);
  await store.verifyAndComplete(id);
  expect(
    (
      await planHttp(api, "/api/v1/plans/" + id, {
        method: "DELETE",
        token: session.accessToken,
      })
    ).status,
  ).toBe(204);
  expect((await read(id)).status).toBe(404);
  await store.verifyAndComplete(id);
  const second = await submitPlan(api, session.accessToken);
  expect(
    (
      await planHttp(api, "/api/v1/plan-sessions/current", {
        method: "DELETE",
        token: session.accessToken,
      })
    ).status,
  ).toBe(204);
  expect((await read(second.id)).status).toBe(401);
  expect(
    (
      await db.pool.query("SELECT * FROM plan_requests WHERE owner_id=$1", [
        owner,
      ])
    ).rowCount,
  ).toBe(0);
});
test("shared quota allows only its limit across concurrent API/store instances", async () => {
  const responses = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      new PlanStore(db.pool, db.boss, catalog.id, catalog.version).quota(
        "controlled-test-subject",
        3,
        60,
      ),
    ),
  );
  expect(responses.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  expect(
    responses
      .filter((r) => r.status === "rejected")
      .every((r) => r.reason.code === "RATE_LIMITED"),
  ).toBe(true);
});
test("an older quota request cannot roll a newer window backward or reset its limit", async () => {
  const subject = "controlled-window-order";
  await store.quota(subject, 2, 60);
  // Controlled database state represents a request arriving late after a newer
  // window won the row lock; it is not an injectable production clock.
  await db.pool.query(
    "UPDATE plan_quotas SET window_start=window_start+interval '1 minute',count=2 WHERE count=1",
  );
  await expect(store.quota(subject, 2, 60)).rejects.toThrow("RATE_LIMITED");
});
test("per-owner retained request cap produces explicit HTTP 429", async () => {
  for (let i = 0; i < 20; i++) await submitPlan(api, session.accessToken);
  const response = await planHttp(api, "/api/v1/plans", {
    method: "POST",
    token: session.accessToken,
    key: randomUUID(),
    body: syntheticPlanInput(),
  });
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("86400");
});
test("actual table lock cancels submission safely and recovery accepts a new request", async () => {
  const lock = await db.pool.connect();
  await lock.query("BEGIN");
  await lock.query("LOCK TABLE plan_requests IN ACCESS EXCLUSIVE MODE");
  try {
    await expect(
      store.submit(owner, randomUUID(), syntheticPlanInput()),
    ).rejects.toThrow(/statement timeout/);
  } finally {
    await lock.query("ROLLBACK");
    lock.release();
  }
  expect(
    (await db.pool.query("SELECT count(*)::int n FROM plan_requests")).rows[0]
      .n,
  ).toBe(0);
  expect((await submitPlan(api, session.accessToken)).id).toBeDefined();
});
test("database outage changes readiness and lookup to safe failure; restart recovers", async () => {
  const { id } = await submitPlan(api, session.accessToken);
  docker("stop", "-t", "1", db.name);
  try {
    expect((await fetch(api.origin + "/api/v1/health/ready")).status).toBe(503);
    const failure = await read(id);
    expect(failure.status).toBe(503);
    expect(await failure.json()).toEqual({ code: "PLAN_UNAVAILABLE" });
  } finally {
    docker("start", db.name);
    await poll(() => db.pool.query("SELECT 1"));
  }
  await poll(
    async () =>
      (await (await fetch(api.origin + "/api/v1/health/ready")).json())
        .dependenciesReady === true,
  );
  expect((await read(id)).status).toBe(200);
  expect(api.child.output).not.toContain(session.accessToken);
  expect(api.child.output).not.toContain("SYNTHETIC symptom");
});
test("disabled feature is absent; enabled readiness detects missing plan table", async () => {
  const disabled = await startApi(db);
  try {
    expect(
      (
        await planHttp(disabled, "/api/v1/plan-sessions", {
          method: "POST",
          body: {},
        })
      ).status,
    ).toBe(404);
  } finally {
    await stop(disabled.child);
  }
  await db.pool.query(
    "ALTER TABLE plan_quotas RENAME TO controlled_missing_plan_quotas",
  );
  try {
    expect((await fetch(api.origin + "/api/v1/health/ready")).status).toBe(503);
  } finally {
    await db.pool.query(
      "ALTER TABLE controlled_missing_plan_quotas RENAME TO plan_quotas",
    );
  }
});
test("client addresses honour only a configured trusted proxy", async () => {
  const create = (target, forwardedFor) =>
    fetch(target.origin + "/api/v1/plan-sessions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": forwardedFor,
      },
      body: "{}",
    });
  // Untrusted: forged forwarding headers share the socket address's quota.
  // beforeEach already used one of the 20 hourly guest sessions.
  const statuses = [];
  for (let i = 1; i <= 20; i++)
    statuses.push((await create(api, `203.0.113.${i}`)).status);
  expect(statuses.slice(0, 19).every((s) => s === 201)).toBe(true);
  expect(statuses[19]).toBe(429);
  await db.pool.query("TRUNCATE plan_quotas");
  const proxied = await startApi(db, {
    PLANS_ENABLED: "true",
    TRUST_PROXY: "1",
  });
  try {
    for (let i = 0; i < 20; i++)
      expect((await create(proxied, "198.51.100.7")).status).toBe(201);
    expect((await create(proxied, "198.51.100.7")).status).toBe(429);
    expect((await create(proxied, "198.51.100.8")).status).toBe(201);
  } finally {
    await stop(proxied.child);
  }
});

test("guest labels are idempotent, private, and keep old plan hashes/results intact", async () => {
  const input = syntheticPlanInput(),
    key = randomUUID();
  const accepted = await submitPlan(
    api,
    session.accessToken,
    { ...input, label: "Parcelle A" },
    key,
  );
  const path = `/api/v1/plans/${accepted.id}/label`;
  const put = (label, token = session.accessToken) =>
    planHttp(api, path, {
      method: "PUT",
      token,
      body: { label },
    });
  await store.verifyAndComplete(accepted.id);
  const evidence = async () =>
    (
      await db.pool.query(
        "SELECT r.input,r.input_hash,r.evidence,r.updated_at,r.completed_at,s.result FROM plan_requests r JOIN plan_intake_results s ON s.request_id=r.id WHERE r.id=$1",
        [accepted.id],
      )
    ).rows[0];
  const before = await evidence();
  expect(before.input).not.toHaveProperty("label");
  expect((await read(accepted.id)).status).toBe(200);
  expect(await (await read(accepted.id)).json()).toMatchObject({
    label: "Parcelle A",
    parentPlanId: null,
  });
  const other = await planSession(api);
  expect((await put("Private", other.accessToken)).status).toBe(404);
  expect(
    (await planHttp(api, path, { method: "PUT", body: { label: "Private" } }))
      .status,
  ).toBe(401);
  for (let i = 0; i < 2; i++) {
    const response = await put("حقل أ");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: accepted.id, label: "حقل أ" });
  }
  expect(await evidence()).toEqual(before);
  // Replaying acceptance still compares the original label after a rename.
  expect(
    (
      await submitPlan(
        api,
        session.accessToken,
        { ...input, label: "Parcelle A" },
        key,
      )
    ).id,
  ).toBe(accepted.id);
  expect(
    (
      await planHttp(api, "/api/v1/plans", {
        method: "POST",
        token: session.accessToken,
        key,
        body: { ...input, label: "Different" },
      })
    ).status,
  ).toBe(409);
  for (const label of ["x".repeat(81), "bad\n", "bad\u0085"]) {
    expect((await put(label)).status).toBe(400);
    expect(
      (
        await planHttp(api, "/api/v1/plans", {
          method: "POST",
          token: session.accessToken,
          key: randomUUID(),
          body: { ...input, label },
        })
      ).status,
    ).toBe(400);
  }
  const legacy = await submitPlan(api, session.accessToken);
  const listed = await (
    await planHttp(api, "/api/v1/plans?limit=1", { token: session.accessToken })
  ).json();
  expect(listed.items[0]).toMatchObject({
    id: legacy.id,
    label: null,
    parentPlanId: null,
    fieldId: null,
    fieldName: null,
    cropIds: null,
    horizonYears: null,
    topStrategyCropIds: null,
    whatIf: false,
  });
  const next = await (
    await planHttp(api, `/api/v1/plans?limit=1&cursor=${listed.nextCursor}`, {
      token: session.accessToken,
    })
  ).json();
  expect(next.items[0]).toMatchObject({ id: accepted.id, label: "حقل أ" });
  expect(
    (
      await (
        await planHttp(api, "/api/v1/plans", { token: other.accessToken })
      ).json()
    ).items,
  ).toEqual([]);
  expect((await put(null)).status).toBe(200);
  expect((await (await read(accepted.id)).json()).label).toBeNull();
  await expect(
    db.pool.query(
      "UPDATE plan_requests SET initial_label='changed' WHERE id=$1",
      [accepted.id],
    ),
  ).rejects.toThrow("PLAN_ACCEPTED_METADATA_IMMUTABLE");
  await expect(
    db.pool.query(
      'UPDATE plan_requests SET input=input||\'{"label":"changed"}\'::jsonb WHERE id=$1',
      [accepted.id],
    ),
  ).rejects.toThrow("PLAN_ACCEPTED_CONTENT_IMMUTABLE");
});
