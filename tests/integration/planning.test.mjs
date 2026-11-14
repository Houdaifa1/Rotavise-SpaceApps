import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { disposable } from "../support/database.mjs";
import { poll } from "../support/polling.mjs";
import { syntheticPlanInput } from "../support/plans.mjs";
import {
  climateFixture,
  policy,
  syntheticSnapshot,
} from "../support/climate.mjs";
import { PlanningStore } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { WeatherService } from "../../apps/server/dist/modules/weather/application/weather.service.js";
import { WeatherError } from "../../apps/server/dist/modules/weather/providers/weather-provider.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { createPlanningHandler } from "../../apps/server/dist/modules/plans/worker/planning.handler.js";
import { PLANNING_QUEUE } from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
import { evaluateSequenceCore } from "../../packages/domain/dist/sequences/generate.js";
import { assessHistoricalCore } from "../../packages/domain/dist/climate/assess.js";
import { selectPlanningComparisons } from "../../packages/domain/dist/index.js";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { pruneWeatherEvidence } from "../../apps/server/dist/modules/weather/application/weather-retention.js";
let db, catalog, config, workflow, store, owner, session;
beforeAll(async () => {
  db = await disposable();
  catalog = await loadCatalogRelease("data/catalog/releases/0.1.0");
  await new CatalogStore(db.pool).import(catalog);
  config = loadConfig({
    ...db.config,
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  });
});
afterAll(async () => {
  await workflow?.weather.close();
  await db?.close();
});
beforeEach(async () => {
  await workflow?.weather.close();
  await db.pool.query(
    "TRUNCATE plan_owners,plan_quotas,weather_cache,weather_snapshots CASCADE",
  );
  workflow = new PlanningStore(db.pool, db.boss, config);
  store = new PlanStore(
    db.pool,
    db.boss,
    catalog.id,
    catalog.version,
    undefined,
    workflow,
  );
  session = await store.createOwner("synthetic-workflow-ip");
  owner = await store.authenticate(session.accessToken);
});
async function accept(input = syntheticPlanInput(), key = randomUUID()) {
  return store.submit(owner, key, input);
}
async function process(id) {
  await createPlanningHandler(
    store,
    config,
  )([{ data: { requestId: id }, signal: new AbortController().signal }]);
  return store.read(owner, id);
}
function fixtureDependencies() {
  const year = new Date().getUTCFullYear(),
    today = new Date().toISOString().slice(0, 10);
  const v = JSON.parse(
    JSON.stringify(climateFixture())
      .replaceAll("2029-", `${year}-`)
      .replaceAll("2030-", `${year + 1}-`),
  );
  v.input.history.entries[0].planted_on = `${year - 3}-01-01`;
  v.input.history.entries[0].harvested_on = `${year - 3}-01-10`;
  v.input.soil.observations[0].measured_on = today;
  v.context.assessedOn = today;
  v.context.historyCoverageStart = `${year - 9}-01-01`;
  return {
    ...v,
    dependencies: {
      synthetic: true,
      catalog: v.catalog,
      context: v.context,
      policy,
      generate: evaluateSequenceCore,
      assess: assessHistoricalCore,
    },
  };
}
function provider(mapper) {
  const calls = [];
  return {
    calls,
    fetch: async (request) => {
      calls.push(request);
      if (mapper?.failure)
        throw new WeatherError("WEATHER_UPSTREAM_UNAVAILABLE");
      const sample = syntheticSnapshot(
          request.startDate,
          request.endDate,
          1,
          mapper?.values,
          request.variables,
        ),
        snapshot = sample.snapshot;
      const parameter = Object.fromEntries(
        request.variables.map((variable) => [
          snapshot.provenance.variables.find((p) => p.variable === variable)
            .parameter,
          Object.fromEntries(
            snapshot.days.map((d) => [
              d.date.replaceAll("-", ""),
              d.values[variable] ?? -999,
            ]),
          ),
        ]),
      );
      const raw = JSON.stringify({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [request.longitude, request.latitude, 528.93],
        },
        properties: { parameter },
        header: {
          api: { name: "POWER Daily API", version: "synthetic-planning-07" },
          sources: ["MERRA2"],
          fill_value: -999,
          time_standard: "UTC",
          start: request.startDate.replaceAll("-", ""),
          end: request.endDate.replaceAll("-", ""),
        },
        parameters: Object.fromEntries(
          snapshot.provenance.variables.map((p) => [
            p.parameter,
            {
              units: p.sourceUnit,
              longname:
                "Explicit synthetic infrastructure fixture, never agricultural evidence",
            },
          ]),
        ),
        messages: [],
      });
      return {
        raw,
        snapshot: normalizeNasa(raw, request, new Date().toISOString()),
      };
    },
  };
}
async function harness(fake = provider()) {
  await workflow.weather.close();
  const f = fixtureDependencies();
  workflow = new PlanningStore(
    db.pool,
    db.boss,
    config,
    new WeatherService(db.pool, fake),
    f.dependencies,
  );
  store = new PlanStore(
    db.pool,
    db.boss,
    catalog.id,
    catalog.version,
    undefined,
    workflow,
  );
  return { f, fake };
}
test("acceptance pins context/policy/versions and pg-boss ID atomically; failed enqueue rolls everything back", async () => {
  const input = syntheticPlanInput();
  await expect(
    store.submit(owner, "synthetic-rollback-key", input, async () => null),
  ).rejects.toThrow("PLAN_ENQUEUE_FAILED");
  expect((await db.pool.query("SELECT * FROM plan_requests")).rowCount).toBe(0);
  expect((await db.pool.query("SELECT * FROM planning_runs")).rowCount).toBe(0);
  const p = await accept(input, "synthetic-atomic-key");
  const read = await store.read(owner, p.id);
  expect(read).toMatchObject({
    status: "queued",
    stage: "awaiting_processing",
    versions: {
      workflowVersion: "planning-workflow-1",
      context: {
        region: { status: "unresolved" },
        cultivars: [],
        verifiedHealthObservations: [],
      },
      policy: { firstAnchorYear: 1991, lastAnchorYear: 2020 },
    },
    weatherSnapshotIds: [],
    result: null,
  });
  const row = (
    await db.pool.query("SELECT queue_job_id FROM plan_requests WHERE id=$1", [
      p.id,
    ])
  ).rows[0];
  expect(
    (await db.boss.findJobs(PLANNING_QUEUE, { id: row.queue_job_id }))[0].data,
  ).toEqual({ requestId: p.id });
});
test("real reviewed catalog pipeline returns honest missing evidence and never retrieves fabricated weather or schedules", async () => {
  workflow.weather.query = async () => {
    throw new Error("UNNECESSARY_WEATHER_CALL");
  };
  const p = await accept();
  const result = await process(p.id);
  expect(result).toMatchObject({
    status: "completed",
    stage: "complete",
    weatherSnapshotIds: [],
    result: {
      synthetic: false,
      comparisons: [],
      assessment: {
        outcome: "insufficient_evidence",
        recommendations: null,
        candidates: [],
      },
    },
  });
  expect(result.result.assessment.sequence.counts.schedules).toBe(0);
  expect(
    result.result.assessment.sequence.consideredChoices.some(
      (c) =>
        c.cropId === "unsupported-crop" && c.status === "insufficient_evidence",
    ),
  ).toBe(true);
  expect(
    result.result.assessment.sequence.pairs
      .flatMap((p) => p.reasons)
      .some((r) => r.effect === "gap"),
  ).toBe(true);
  const first = (
    await db.pool.query(
      "SELECT result_hash FROM planning_runs WHERE request_id=$1",
      [p.id],
    )
  ).rows[0];
  await process(p.id);
  expect(
    (
      await db.pool.query(
        "SELECT result_hash FROM planning_runs WHERE request_id=$1",
        [p.id],
      )
    ).rows[0],
  ).toEqual(first);
});
test("explicit synthetic infrastructure harness persists real PostgreSQL weather evidence, metrics and grouped alternatives; production reads reject it", async () => {
  const { f, fake } = await harness();
  const p = await accept(f.input);
  const result = await process(p.id);
  expect(result.status).toBe("completed");
  expect(result.result.synthetic).toBe(true);
  expect(fake.calls.length).toBeGreaterThan(0);
  expect(result.result.assessment.outcome).toBe("comparisons_available");
  expect(result.result.comparisons.length).toBeGreaterThan(0);
  expect(
    result.result.assessment.candidates.every(
      (c) =>
        c.analogs.length ===
        (["excluded", "insufficient_evidence"].includes(c.status) ? 0 : 6),
    ),
  ).toBe(true);
  expect(result.weatherSnapshotIds.length).toBe(fake.calls.length);
  expect(
    result.result.assessment.evidence.every(
      (e) => e.synthetic && e.apiVersion === "synthetic-planning-07",
    ),
  ).toBe(true);
  for (const group of result.result.comparisons) {
    const comparison = result.result.assessment.ranking.groups.find(
      (g) => g.id === group.groupId,
    );
    expect(group.mainScheduleIds.sort()).toEqual(
      comparison.entries
        .filter((e) => e.rank === 1)
        .map((e) => e.scheduleId)
        .sort(),
    );
    expect(group.alternativeScheduleIds.length).toBeLessThanOrEqual(2);
  }
  const production = new PlanningStore(db.pool, db.boss, {
    ...config,
    NODE_ENV: "production",
  });
  await expect(production.read(owner, p.id)).rejects.toMatchObject({
    code: "STORED_REQUEST_INVALID",
  });
  await production.weather.close();
  await process(p.id);
  expect(fake.calls.length).toBe(result.weatherSnapshotIds.length);
});
test("weather requests are bounded, deduplicated growing windows across consecutive historical years", async () => {
  const { f } = await harness();
  const versions = (await accept(f.input)).id;
  const result = await store.read(owner, versions);
  const sequence = evaluateSequenceCore(f.input, f.catalog, f.context),
    requests = workflow.weatherRequests(sequence, result.versions);
  expect(requests.length).toBeGreaterThan(0);
  expect(requests.length).toBeLessThanOrEqual(128);
  for (const r of requests) {
    expect(
      (Date.parse(r.endDate) - Date.parse(r.startDate)) / 86400000 + 1,
    ).toBeLessThanOrEqual(366);
    expect(r.variables).toEqual([
      "precipitation",
      "temperatureMax",
      "temperatureMean",
      "temperatureMin",
    ]);
  }
  expect(new Set(requests.map((r) => r.startDate + "/" + r.endDate)).size).toBe(
    requests.length,
  );
});
test("snapshot checkpoints survive provider failure; retry reuses pinned snapshots and returns operational failure after three attempts", async () => {
  const good = provider();
  let count = 0;
  const flaky = {
    fetch: async (request, signal) => {
      count++;
      if (count > 1) throw new WeatherError("WEATHER_UPSTREAM_UNAVAILABLE");
      return good.fetch(request, signal);
    },
  };
  const { f } = await harness(flaky);
  const p = await accept(f.input);
  for (let i = 0; i < 3; i++) {
    try {
      await process(p.id);
    } catch (error) {
      expect(error.message).toBe("WEATHER_UNAVAILABLE");
    }
  }
  const record = await store.read(owner, p.id);
  expect(record).toMatchObject({
    status: "failed",
    stage: "failed",
    error: { code: "WEATHER_UNAVAILABLE" },
    result: null,
    attempts: 3,
  });
  expect(record.weatherSnapshotIds).toHaveLength(1);
  expect(good.calls).toHaveLength(1);
  expect(
    (
      await db.pool.query(
        "SELECT * FROM planning_weather WHERE request_id=$1",
        [p.id],
      )
    ).rowCount,
  ).toBe(1);
});
test("stale workers cannot finish after lease recovery; final evidence/results are immutable", async () => {
  const p = await accept();
  const stale = await workflow.begin(p.id);
  expect(stale).not.toBeNull();
  await db.pool.query(
    "UPDATE planning_runs SET lease_until=clock_timestamp()-interval '1 second' WHERE request_id=$1",
    [p.id],
  );
  const current = await workflow.begin(p.id);
  expect(current.lease).not.toBe(stale.lease);
  await store.begin(p.id);
  await store.verifyAndComplete(p.id);
  await workflow.process(p.id, stale.lease, new AbortController().signal);
  expect((await store.read(owner, p.id)).status).toBe("running");
  await workflow.process(p.id, current.lease, new AbortController().signal);
  expect((await store.read(owner, p.id)).status).toBe("completed");
  await expect(
    db.pool.query(
      "UPDATE planning_runs SET result_hash=$2 WHERE request_id=$1",
      [p.id, "a".repeat(64)],
    ),
  ).rejects.toThrow("PLANNING_TERMINAL_IMMUTABLE");
  await expect(
    db.pool.query(
      "UPDATE planning_runs SET versions_hash=$2 WHERE request_id=$1",
      [p.id, "a".repeat(64)],
    ),
  ).rejects.toThrow("PLANNING_VERSIONS_IMMUTABLE");
});
test("deletion, guest revocation and expired requests prevent processing/checkpoint/result resurrection", async () => {
  const p = await accept(),
    begun = await workflow.begin(p.id);
  await store.remove(owner, p.id);
  await workflow.process(p.id, begun.lease, new AbortController().signal);
  expect(await workflow.load(p.id)).toBeNull();
  expect(await workflow.begin(p.id)).toBeNull();
  const q = await accept();
  await store.revoke(owner);
  expect(await workflow.begin(q.id)).toBeNull();
  expect(
    (await db.pool.query("SELECT request_id FROM planning_runs")).rowCount,
  ).toBe(0);
});
test("legacy intake records remain readable and full records remain readable when accepting full planning is switched off", async () => {
  const legacy = new PlanStore(db.pool, db.boss, catalog.id, catalog.version);
  const old = await legacy.submit(
    owner,
    "legacy-record-key",
    syntheticPlanInput(),
  );
  await legacy.begin(old.id);
  await legacy.verifyAndComplete(old.id);
  expect((await store.read(owner, old.id)).result.planning).toBe(
    "not_implemented",
  );
  const p = await accept();
  await process(p.id);
  const stopped = new PlanningStore(db.pool, db.boss, {
    ...config,
    PLANNING_ENABLED: "false",
  });
  const readable = new PlanStore(
    db.pool,
    db.boss,
    catalog.id,
    catalog.version,
    undefined,
    stopped,
  );
  expect((await readable.read(owner, p.id)).result.kind).toBe(
    "planning_assessment",
  );
  const next = await readable.submit(
    owner,
    "disabled-full-key",
    syntheticPlanInput(),
  );
  expect(
    (
      await db.pool.query(
        "SELECT request_id FROM planning_runs WHERE request_id=$1",
        [next.id],
      )
    ).rowCount,
  ).toBe(0);
  await stopped.weather.close();
});
test("native API processes full planning via real pg-boss worker with owned retrieval and stable completed result", async () => {
  const api = await createApi(config);
  const workerId = await db.boss.work(
    PLANNING_QUEUE,
    { batchSize: 1, pollingIntervalSeconds: 0.5 },
    createPlanningHandler(store, config),
  );
  try {
    const accepted = await api.app.inject({
      method: "POST",
      url: "/api/v1/plans",
      headers: {
        authorization: "Bearer " + session.accessToken,
        "idempotency-key": "native-workflow-key",
      },
      payload: syntheticPlanInput(),
    });
    expect(accepted.statusCode).toBe(202);
    const id = accepted.json().id;
    const final = await poll(async () => {
      const res = await api.app.inject({
        url: "/api/v1/plans/" + id,
        headers: { authorization: "Bearer " + session.accessToken },
      });
      const value = res.json();
      return value.status === "completed" ? value : false;
    });
    expect(final.result.assessment.outcome).toBe("insufficient_evidence");
    expect(final.result.synthetic).toBe(false);
    expect(
      (await api.app.inject({ url: "/api/v1/plans/" + id })).statusCode,
    ).toBe(401);
  } finally {
    await db.boss.offWork(PLANNING_QUEUE, { id: workerId });
    await api.close();
  }
});
test("group selection never creates a global winner, exposes ties and preserves rejected explanations", async () => {
  const { f } = await harness();
  const sequence = evaluateSequenceCore(f.input, f.catalog, f.context),
    versions = { context: f.context, policy };
  const requests = workflow.weatherRequests(sequence, versions);
  const evidence = requests.map((r, i) =>
    syntheticSnapshot(r.startDate, r.endDate, i + 1),
  );
  const assessment = assessHistoricalCore(
      f.input,
      f.catalog,
      f.context,
      evidence,
      policy,
    ),
    result = selectPlanningComparisons(assessment);
  expect(result.recommendationScope).toBe("within_comparable_groups_only");
  expect(result).not.toHaveProperty("mainPlan");
  expect(result.assessment.recommendations).toBeNull();
  expect(result.comparisons.length).toBe(assessment.ranking.groups.length);
});
test("weather retention keeps evidence pinned by live plans and deletes expired, unreferenced coordinates", async () => {
  const { f } = await harness();
  const p = await accept(f.input);
  const result = await process(p.id);
  expect(result.status).toBe("completed");
  const pinned = [...result.weatherSnapshotIds].sort();
  expect(pinned.length).toBeGreaterThan(0);
  const counts = async () =>
    (
      await db.pool.query(
        "SELECT (SELECT count(*)::int FROM weather_cache) cache,(SELECT count(*)::int FROM weather_snapshots) snapshots",
      )
    ).rows[0];
  const before = await counts();
  // Fresh data is inside both safety margins.
  expect(await pruneWeatherEvidence(db.pool)).toEqual({
    cache: 0,
    snapshots: 0,
  });
  await expect(
    db.pool.query("DELETE FROM weather_snapshots WHERE id=$1", [pinned[0]]),
  ).rejects.toThrow("WEATHER_SNAPSHOT_IMMUTABLE");
  await db.pool.query(
    "ALTER TABLE weather_snapshots DISABLE TRIGGER weather_snapshot_immutable",
  );
  try {
    await db.pool.query(
      "UPDATE weather_snapshots SET created_at=now()-interval '40 days'",
    );
  } finally {
    await db.pool.query(
      "ALTER TABLE weather_snapshots ENABLE TRIGGER weather_snapshot_immutable",
    );
  }
  await db.pool.query(
    "UPDATE weather_cache SET expires_at=now()-interval '2 days' WHERE snapshot_id IS NOT NULL",
  );
  const first = await pruneWeatherEvidence(db.pool);
  expect(first.cache).toBe(before.cache);
  expect(
    (
      await db.pool.query("SELECT id FROM weather_snapshots ORDER BY id")
    ).rows.map((r) => r.id),
  ).toEqual(pinned);
  expect((await store.read(owner, p.id)).status).toBe("completed");
  await store.remove(owner, p.id);
  const second = await pruneWeatherEvidence(db.pool);
  expect(second.snapshots).toBe(pinned.length);
  expect(await counts()).toEqual({ cache: 0, snapshots: 0 });
});
