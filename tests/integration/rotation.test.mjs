import { syntheticResearchCatalog } from "../support/fixtures/research-catalog.mjs";
import { beforeAll, afterAll, beforeEach, test, expect } from "@jest/globals";
import { randomUUID, createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { disposable, startApi, stop } from "../support/index.mjs";
import {
  planHttp,
  planSession,
  syntheticPlanInput,
} from "../support/plans.mjs";
import { syntheticSnapshot } from "../support/climate.mjs";
import {
  rotationCatalog,
  rotationPolicy,
  rotationRequest,
  syntheticScenarioSeries,
  syntheticSeasonalWeather,
} from "../support/rotation.mjs";
import { catalogOptionsSchema } from "../../packages/contracts/dist/index.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { PlanStore } from "../../apps/server/dist/modules/plans/application/plan-store.js";
import {
  PlanningStore,
  currentFutureClimatePolicy,
  rotationPlanningPolicy,
} from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { policyKey } from "../../apps/server/dist/modules/climate-scenarios/application/scenario-store.js";
import { createPlanningHandler } from "../../apps/server/dist/modules/plans/worker/planning.handler.js";
import { WeatherService } from "../../apps/server/dist/modules/weather/application/weather.service.js";
import { WeatherError } from "../../apps/server/dist/modules/weather/providers/weather-provider.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { stableJson } from "../../apps/server/dist/common/serialization/stable-json.js";
import {
  assessRotationsCore,
  rotationNearTermNeedsCore,
  rotationScenarioNeedsCore,
  rotationWeatherNeedsCore,
} from "../../packages/domain/dist/rotation/assess.js";
import { SCENARIO_QUEUE } from "../../apps/server/dist/infrastructure/queue/pg-boss.js";
import {
  cropPhotoResultSchema,
  powerCell,
  rotationPlanningStatusSchema,
} from "../../packages/contracts/dist/index.js";

let db, config, workflow, store, owner;
const today = new Date().toISOString().slice(0, 10);
const day = (n) =>
  new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
// Dates follow the real clock because intake uses database time.
const request = (overrides = {}) =>
  rotationRequest({
    history: {
      status: "known",
      completeness: "complete",
      entries: [
        {
          crop_id: "synthetic-crop-02",
          planted_on: day(-200),
          harvested_on: day(-30),
        },
      ],
    },
    planning: {
      horizon_years: 3,
      earliest_start_date: day(5),
      latest_start_date: day(180),
    },
    ...overrides,
  });
function provider({ failAfter = Infinity } = {}) {
  const calls = [];
  return {
    calls,
    fetch: async (r) => {
      if (calls.length >= failAfter) {
        failAfter = Infinity;
        throw new WeatherError("WEATHER_UPSTREAM_UNAVAILABLE");
      }
      calls.push(r);
      const sample = syntheticSnapshot(
        r.startDate,
        r.endDate,
        1,
        syntheticSeasonalWeather,
        r.variables,
      );
      const snapshot = sample.snapshot;
      const parameter = Object.fromEntries(
        r.variables.map((variable) => [
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
          coordinates: [r.longitude, r.latitude, 528.93],
        },
        properties: { parameter },
        header: {
          api: { name: "POWER Daily API", version: "synthetic-rotation-10" },
          sources: ["MERRA2"],
          fill_value: -999,
          time_standard: "UTC",
          start: r.startDate.replaceAll("-", ""),
          end: r.endDate.replaceAll("-", ""),
        },
        parameters: Object.fromEntries(
          snapshot.provenance.variables.map((p) => [
            p.parameter,
            { units: p.sourceUnit, longname: "Synthetic test fixture" },
          ]),
        ),
        messages: [],
      });
      return { raw, snapshot: normalizeNasa(raw, r, new Date().toISOString()) };
    },
  };
}
const fixture = (scenarios = (needs) => syntheticScenarioSeries(needs)) => ({
  synthetic: true,
  catalog: rotationCatalog(),
  policy: rotationPolicy,
  assess: (
    input,
    catalog,
    weather,
    policy,
    assessedOn,
    series,
    engineVersion,
    analysisContext,
  ) =>
    assessRotationsCore(
      input,
      catalog,
      weather,
      policy,
      assessedOn,
      true,
      series,
      null,
      null,
      engineVersion,
      analysisContext,
    ),
  needs: (input, catalog, policy, assessedOn) =>
    rotationWeatherNeedsCore(input, catalog, policy, assessedOn),
  scenarioNeeds: (input, catalog, policy, assessedOn) =>
    rotationScenarioNeedsCore(input, catalog, policy, assessedOn),
  scenarios,
});
const rotationFixture = fixture();
// Synthetic placeholder rows so plan pins of synthetic series satisfy the
// foreign key; they hold no data and never leave the disposable database.
async function placeholderUnits(input, policy = rotationPolicy) {
  const needs = rotationScenarioNeedsCore(
    input,
    rotationCatalog(),
    policy,
    today,
  );
  for (const s of syntheticScenarioSeries(needs)) {
    const marker = Buffer.from(`synthetic ${s.unitId}`);
    await db.pool.query(
      `INSERT INTO climate_scenario_units(id,unit_key,model,experiment,variable,year,tile_latitude,tile_longitude,raw,raw_sha256,normalized_sha256,retrieved_at)
      VALUES($1,$2,'synthetic','historical','tas',2000,0,0,$3,$4,$5,now())`,
      [
        s.unitId,
        createHash("sha256").update(`key ${s.unitId}`).digest("hex"),
        marker,
        createHash("sha256").update(marker).digest("hex"),
        s.normalizedSha256,
      ],
    );
  }
  return needs;
}
async function build(fake, fixture, settings = config) {
  await workflow?.weather.close();
  workflow = new PlanningStore(
    db.pool,
    db.boss,
    settings,
    new WeatherService(db.pool, fake),
    undefined,
    fixture,
  );
  store = new PlanStore(
    db.pool,
    db.boss,
    config.PLAN_CATALOG_ID,
    config.PLAN_CATALOG_VERSION,
    undefined,
    workflow,
  );
  owner = await store.authenticate(
    (await store.createOwner("synthetic-rotation-ip")).accessToken,
  );
}
async function process(id) {
  await createPlanningHandler(
    store,
    config,
  )([{ data: { requestId: id }, signal: new AbortController().signal }]);
  return store.read(owner, id);
}
beforeAll(async () => {
  db = await disposable();
  const catalogs = new CatalogStore(db.pool);
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.2.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.3.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.4.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.5.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.6.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.7.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.8.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.9.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.11.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.12.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.13.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.14.0"),
  );
  await catalogs.import(
    await loadCatalogRelease("data/catalog/releases/0.15.0"),
  );
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
  await db.pool.query(
    "TRUNCATE plan_owners,plan_quotas,weather_cache,weather_snapshots,climate_scenario_tiles,climate_scenario_units CASCADE",
  );
});

test("HTTP accepts format 2 with the format 2 catalog, policy and acceptance date; format 1 keeps its workflow", async () => {
  const api = await startApi(db, {
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  });
  try {
    const session = await planSession(api);
    const send = (body) =>
      planHttp(api, "/api/v1/plans", {
        method: "POST",
        token: session.accessToken,
        key: randomUUID(),
        body,
      });
    const v2 = await send(
      request({
        preferences: {
          mode: "consider",
          considered_crop_ids: ["durum-wheat"],
          excluded_crop_ids: [],
          priorities: { climate: 1, water: 1, soil_health: 1, crop_health: 1 },
        },
      }),
    );
    expect(v2.status).toBe(202);
    const v1 = await send(syntheticPlanInput());
    expect(v1.status).toBe(202);
    const rows = (
      await db.pool.query(
        "SELECT r.input->>'schema_version' format,r.evidence->>'catalogVersion' catalog,p.versions FROM plan_requests r JOIN planning_runs p ON p.request_id=r.id ORDER BY 1",
      )
    ).rows;
    expect(
      rows.map((r) => [r.format, r.catalog, r.versions.workflowVersion]),
    ).toEqual([
      ["1", "0.1.0", "planning-workflow-1"],
      ["2", "0.15.0", "planning-workflow-6"],
    ]);
    expect(rows[1].versions).toMatchObject({
      engineVersion: "rotation-engine-7",
      assessedOn: today,
      policy: { ...rotationPlanningPolicy, research: "benefits-2" },
      syntheticFixture: null,
    });
    const invalid = await send({
      ...request(),
      planning: {
        horizon_years: 9,
        earliest_start_date: day(5),
        latest_start_date: day(30),
      },
    });
    expect(invalid.status).toBe(400);
  } finally {
    await stop(api.child);
  }
  const intakeOnly = await startApi(db, { PLANS_ENABLED: "true" });
  try {
    const session = await planSession(intakeOnly);
    const rejected = await planHttp(intakeOnly, "/api/v1/plans", {
      method: "POST",
      token: session.accessToken,
      key: randomUUID(),
      body: request(),
    });
    expect(rejected.status).toBe(400);
  } finally {
    await stop(intakeOnly.child);
  }
});

test("the catalog options route serves crop and variety names by language for catalog 0.12.0", async () => {
  const api = await startApi(db, {
    PLANS_ENABLED: "true",
    PLAN_CATALOG_VERSION: "0.12.0",
  });
  try {
    const response = await fetch(`${api.origin}/api/v1/catalog/options`);
    expect(response.status).toBe(200);
    const options = catalogOptionsSchema.parse(await response.json());
    expect(options.catalogVersion).toBe("0.12.0");
    const languagesOf = (c) => new Set(c.localNames.map((n) => n.language));
    expect(options.crops.length).toBe(246);
    expect(options.crops.every((c) => languagesOf(c).has("fr"))).toBe(true);
    expect(options.crops.every((c) => languagesOf(c).has("ar"))).toBe(true);
    expect(
      options.crops.filter((c) => languagesOf(c).has("ary")).length,
    ).toBeGreaterThan(150);
    const tomato = options.crops.find((c) => c.id === "tomato");
    expect(tomato.localNames.find((n) => n.language === "ary")).toEqual({
      language: "ary",
      name: "ماطيشة",
      confidence: "high",
    });
    const olive = options.crops.find((c) => c.id === "olive");
    expect(olive.cultivars.length).toBeGreaterThan(20);
    expect(
      olive.cultivars
        .find((c) => c.id === "picholine-marocaine")
        .localNames.some((n) => n.language === "ar"),
    ).toBe(true);
    // Names carry no provenance text, only the recorded confidence.
    expect(JSON.stringify(options)).not.toContain("model_recall");
    // Earlier releases still serve, with empty name lists where they have none.
    const older = await fetch(
      `${api.origin}/api/v1/catalog/options/rotavise-pilot/0.11.0`,
    );
    expect(older.status).toBe(200);
    const olderOptions = catalogOptionsSchema.parse(await older.json());
    const olderTomato = olderOptions.crops.find((c) => c.id === "tomato");
    expect(olderTomato.localNames.some((n) => n.language === "ary")).toBe(
      false,
    );
    expect(olderTomato.cultivars.every((c) => c.localNames.length === 0)).toBe(
      true,
    );
  } finally {
    await stop(api.child);
  }
});

test("catalog 0.13.0 options preserve recalled names and expose sourced preference with confidence only", async () => {
  const api = await startApi(db, {
    PLANS_ENABLED: "true",
    PLAN_CATALOG_VERSION: "0.13.0",
  });
  try {
    const response = await fetch(`${api.origin}/api/v1/catalog/options`);
    expect(response.status).toBe(200);
    const options = catalogOptionsSchema.parse(await response.json());
    expect(options.catalogVersion).toBe("0.13.0");
    const carrot = options.crops.find((c) => c.id === "carrot");
    expect(carrot.localNames).toContainEqual({
      language: "ary",
      name: "الخيزو",
      confidence: "high",
    });
    expect(carrot.localNames).toContainEqual({
      language: "ary",
      name: "زرودية",
      confidence: "low",
      preferred: true,
    });
    expect(
      options.crops.filter((c) =>
        c.localNames.some((n) => n.language === "ary" && n.preferred),
      ),
    ).toHaveLength(157);
    const aakria = options.crops
      .find((c) => c.id === "prickly-pear")
      .cultivars.find((c) => c.id === "aakria");
    expect(aakria.localNames).toContainEqual({
      language: "ary",
      name: "عكرية",
      confidence: "low",
      preferred: true,
    });
    for (const c of options.crops)
      for (const n of [
        ...c.localNames,
        ...c.cultivars.flatMap((v) => v.localNames),
      ])
        expect(
          Object.keys(n).every((key) =>
            ["language", "name", "confidence", "preferred"].includes(key),
          ),
        ).toBe(true);
    const older = await fetch(
      `${api.origin}/api/v1/catalog/options/rotavise-pilot/0.12.0`,
    );
    expect(older.status).toBe(200);
    const oldOptions = catalogOptionsSchema.parse(await older.json());
    expect(
      oldOptions.crops.every((c) =>
        c.localNames.every((n) => n.preferred === undefined),
      ),
    ).toBe(true);
  } finally {
    await stop(api.child);
  }
});

const realPreferences = {
  mode: "consider",
  considered_crop_ids: ["faba-bean", "sugar-beet"],
  excluded_crop_ids: [],
  priorities: { climate: 3, water: 1, soil_health: 2, crop_health: 1 },
};
const realHistory = {
  status: "known",
  completeness: "complete",
  entries: [
    { crop_id: "durum-wheat", planted_on: day(-330), harvested_on: day(-120) },
  ],
};
test("the real catalog resolves a Tadla field, requests its POWER windows and refuses synthetic weather", async () => {
  // The success path with real weather is the Step 12 demo; here the fake
  // transport's synthetic label must stop a production run.
  const fake = provider();
  await build(fake);
  const input = request({ history: realHistory, preferences: realPreferences });
  const real = await loadCatalogRelease("data/catalog/releases/0.15.0");
  const needs = rotationWeatherNeedsCore(
    input,
    real,
    rotationPlanningPolicy,
    today,
  );
  expect(needs.length).toBeGreaterThan(0);
  const accepted = await store.submit(owner, randomUUID(), input);
  await expect(process(accepted.id)).rejects.toThrow("WEATHER_UNAVAILABLE");
  expect(fake.calls.length).toBeGreaterThan(0);
  // Requests go to the POWER grid cell that contains the field.
  const cell = powerCell(input.location.latitude, input.location.longitude);
  expect(
    fake.calls.every(
      (c) => c.latitude === cell.latitude && c.longitude === cell.longitude,
    ),
  ).toBe(true);
  const run = (
    await db.pool.query(
      "SELECT p.status,p.versions->>'engineVersion' engine,r.evidence->>'catalogVersion' catalog FROM planning_runs p JOIN plan_requests r ON r.id=p.request_id WHERE p.request_id=$1",
      [accepted.id],
    )
  ).rows[0];
  expect(run).toEqual({
    status: "queued",
    engine: "rotation-engine-7",
    catalog: "0.15.0",
  });
});

test("a field outside every catalog region returns insufficient evidence and fetches no weather", async () => {
  const fake = provider();
  await build(fake);
  const accepted = await store.submit(
    owner,
    randomUUID(),
    request({
      location: { latitude: 40.42, longitude: -3.7 },
      history: realHistory,
      preferences: realPreferences,
    }),
  );
  const status = await process(accepted.id);
  expect(() => rotationPlanningStatusSchema.parse(status)).not.toThrow();
  expect(status.status).toBe("completed");
  expect(status.result.outcome).toBe("insufficient_evidence");
  expect(status.result.synthetic).toBe(false);
  expect(status.result.context.regionIds).toEqual([]);
  expect(status.weatherSnapshotIds).toEqual([]);
  expect(fake.calls).toEqual([]);
});

test("the synthetic harness runs the full pipeline, pins weather and model data once and refuses production reads", async () => {
  const fake = provider();
  await build(fake, rotationFixture);
  const input = request();
  const needs = await placeholderUnits(input);
  const accepted = await store.submit(owner, randomUUID(), input);
  const status = await process(accepted.id);
  expect(status.status).toBe("completed");
  const result = status.result;
  expect(result.synthetic).toBe(true);
  expect(result.outcome).toBe("comparisons_available");
  expect(result.dimensions.every((d) => d.status === "compared")).toBe(true);
  expect(result.futureClimate.status).toBe("compared");
  // Engine 7 stores the strategies with the result, hash-checked like the rest.
  expect(result.engineVersion).toBe("rotation-engine-7");
  expect(result.strategies.requiredAlternatives).toBe(2);
  expect(result.strategies.items.length).toBeGreaterThan(0);
  expect(result.strategies.reminders.length).toBeGreaterThanOrEqual(3);
  expect(status.scenarioUnitIds).toHaveLength(needs.units.length);
  expect(result.futureClimate.unitIds).toEqual(status.scenarioUnitIds);
  // Stored weather evidence holds the POWER cell centre, not the field.
  const sites = (
    await db.pool.query(
      "SELECT DISTINCT snapshot->'request'->>'latitude' lat,snapshot->'request'->>'longitude' lon,snapshot->'provenance'->>'adapterVersion' v FROM weather_snapshots",
    )
  ).rows;
  expect(sites).toEqual([{ lat: "32.5", lon: "-6.28125", v: "3" }]);
  expect(fake.calls.length).toBeGreaterThan(20);
  expect(status.weatherSnapshotIds.length).toBe(fake.calls.length);
  expect(result.evidence.weatherSnapshotIds).toEqual(
    [...status.weatherSnapshotIds].sort(),
  );
  const row = (
    await db.pool.query(
      "SELECT result,result_hash FROM planning_runs WHERE request_id=$1",
      [accepted.id],
    )
  ).rows[0];
  expect(row.result_hash).toBe(
    createHash("sha256").update(stableJson(row.result)).digest("hex"),
  );
  const calls = fake.calls.length;
  expect((await process(accepted.id)).result).toEqual(result);
  expect(fake.calls.length).toBe(calls);
  const production = new PlanningStore(db.pool, db.boss, config);
  await expect(production.read(owner, accepted.id)).rejects.toMatchObject({
    code: "STORED_REQUEST_INVALID",
  });
  await production.weather.close();
});

test("a provider failure requeues the run and the retry reuses pinned weather", async () => {
  const fake = provider({ failAfter: 5 });
  await build(fake, rotationFixture);
  await placeholderUnits(request());
  const accepted = await store.submit(owner, randomUUID(), request());
  await expect(process(accepted.id)).rejects.toThrow("WEATHER_UNAVAILABLE");
  expect(
    (
      await db.pool.query(
        "SELECT status,attempts FROM planning_runs WHERE request_id=$1",
        [accepted.id],
      )
    ).rows[0],
  ).toEqual({ status: "queued", attempts: 1 });
  expect(fake.calls.length).toBe(5);
  const status = await process(accepted.id);
  expect(status.status).toBe("completed");
  const keys = fake.calls.map((c) => `${c.startDate}/${c.endDate}`);
  expect(new Set(keys).size).toBe(keys.length);
  expect(status.weatherSnapshotIds.length).toBe(keys.length);
});

test("the database refuses a result kind that does not match the workflow", async () => {
  await build(provider());
  const accepted = await store.submit(owner, randomUUID(), request());
  await expect(
    db.pool.query(
      "UPDATE planning_runs SET status='completed',stage='complete',completed_at=now(),result='{\"kind\":\"planning_assessment\"}',result_hash=$2 WHERE request_id=$1",
      [accepted.id, "a".repeat(64)],
    ),
  ).rejects.toThrow(/planning_result/);
});

test("crop health routes work for guests and say clearly when no AI key is set", async () => {
  const api = await startApi(db, {
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  });
  try {
    const session = await planSession(api);
    const body = {
      crop_id: "durum-wheat",
      media_type: "image/jpeg",
      image_base64: "A".repeat(200),
      consent: true,
    };
    const post = (path, payload, token = session.accessToken) =>
      fetch(`${api.origin}${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
    expect((await post("/api/v1/crop-health/photo", body, null)).status).toBe(
      401,
    );
    const noConsent = { ...body };
    delete noConsent.consent;
    expect((await post("/api/v1/crop-health/photo", noConsent)).status).toBe(
      400,
    );
    const missing = await post("/api/v1/crop-health/photo", body);
    expect(missing.status).toBe(503);
    expect(await missing.json()).toEqual({ code: "AI_NOT_CONFIGURED" });
    // The interface can ask whether the check is on, without a sign-in.
    const off = await fetch(`${api.origin}/api/v1/crop-health/status`);
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual({
      available: false,
      reason: "AI_NOT_CONFIGURED",
    });
  } finally {
    await stop(api.child);
  }
});

test("a photo check strips metadata, skips uncovered crops and stops at the daily cap", async () => {
  // A local stand-in for the Claude API; no key or network is used.
  const seen = [];
  const provider = createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      seen.push(JSON.parse(raw));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                image_quality: "usable",
                assessment: "possibly_affected",
                candidates: [
                  {
                    issue_id: "fusarium-crown-rot",
                    what_is_visible: "browning",
                  },
                ],
                note: "Check the stem base.",
              }),
            },
          ],
          stop_reason: "end_turn",
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      );
    });
  });
  await new Promise((r) => provider.listen(0, "127.0.0.1", r));
  const api = await startApi(db, {
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
    ANTHROPIC_API_KEY: "test-key",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${provider.address().port}`,
    AI_DAILY_REQUEST_LIMIT: "2",
    ANTHROPIC_MODEL: "claude-sonnet-5-5",
  });
  try {
    const on = await fetch(`${api.origin}/api/v1/crop-health/status`);
    expect(await on.json()).toEqual({ available: true, reason: null });
    const session = await planSession(api);
    const image = readFileSync("tests/support/fixtures/photos/leaf-exif.jpg");
    const post = (crop) =>
      fetch(`${api.origin}/api/v1/crop-health/photo`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${session.accessToken}`,
        },
        body: JSON.stringify({
          crop_id: crop,
          media_type: "image/jpeg",
          image_base64: image.toString("base64"),
          consent: true,
          language: "fr",
        }),
      });
    const first = await post("durum-wheat");
    expect(first.status).toBe(200);
    const result = cropPhotoResultSchema.parse(await first.json());
    expect(result.candidates[0].issue_id).toBe("fusarium-crown-rot");
    expect(result.notice).toMatch(/pas un diagnostic/);
    const sent = Buffer.from(
      seen[0].messages[0].content[0].source.data,
      "base64",
    );
    expect(image.includes("SyntheticCam")).toBe(true);
    expect(sent.includes("SyntheticCam")).toBe(false);
    expect(seen[0].model).toBe("claude-sonnet-5-5");
    // Esparto has no problem list in the catalog: refused without a model call.
    const uncovered = await post("esparto");
    expect(uncovered.status).toBe(422);
    expect(await uncovered.json()).toEqual({ code: "CROP_NOT_COVERED" });
    expect(seen).toHaveLength(1);
    expect((await post("durum-wheat")).status).toBe(200);
    const capped = await post("durum-wheat");
    expect(capped.status).toBe(503);
    expect(await capped.json()).toEqual({ code: "AI_DAILY_LIMIT" });
    expect(seen).toHaveLength(2);
  } finally {
    await stop(api.child);
    await new Promise((r) => provider.close(r));
  }
});

test("a guest owns fields and outlines, privately, until the guest session ends", async () => {
  const api = await startApi(db, { PLANS_ENABLED: "true" });
  try {
    const guest = await planSession(api);
    const other = await planSession(api);
    const call = (token, path, method = "GET", body) =>
      fetch(`${api.origin}/api/v1${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const created = await call(guest.accessToken, "/fields", "POST", {
      schema_version: "1",
      name: "Synthetic guest field",
      location: { latitude: 32.3, longitude: -6.3 },
      soil: { status: "unknown" },
      water: { status: "unknown" },
      crop_health: { status: "unknown" },
    });
    expect(created.status).toBe(201);
    const field = await created.json();
    expect(
      (await (await call(guest.accessToken, "/fields")).json()).items,
    ).toHaveLength(1);
    expect((await call(guest.accessToken, `/fields/${field.id}`)).status).toBe(
      200,
    );
    expect((await call(other.accessToken, `/fields/${field.id}`)).status).toBe(
      404,
    );
    expect(
      (await (await call(other.accessToken, "/fields")).json()).items,
    ).toHaveLength(0);
    // A guest's data goes with the session.
    expect(
      (await call(guest.accessToken, "/plan-sessions/current", "DELETE"))
        .status,
    ).toBe(204);
    expect(
      (
        await db.pool.query("SELECT count(*)::int n FROM fields WHERE id=$1", [
          field.id,
        ])
      ).rows[0].n,
    ).toBe(0);
  } finally {
    await stop(api.child);
  }
});

test("an unprepared tile is requested within the daily limit and the plan completes without future climate", async () => {
  const settings = (limit) =>
    loadConfig({
      ...db.config,
      PLANS_ENABLED: "true",
      PLANNING_ENABLED: "true",
      CLIMATE_SCENARIOS_ENABLED: "true",
      SCENARIO_TILES_PER_DAY: String(limit),
    });
  await build(
    provider(),
    fixture(() => null),
    settings(1),
  );
  // Another tile was already requested today, so this plan is over the limit.
  await workflow.scenarios.request(
    { latitude: 30, longitude: -10 },
    rotationPolicy.futureClimate,
    1,
  );
  const limited = await process(
    (await store.submit(owner, randomUUID(), request())).id,
  );
  expect(limited.status).toBe("completed");
  expect(limited.result.futureClimate).toMatchObject({
    status: "unavailable",
    reason: "SCENARIO_TILE_NOT_PREPARED",
    cell: { latitude: 32.375, longitude: -6.375 },
  });
  expect(limited.scenarioUnitIds).toEqual([]);
  const tiles = async () =>
    (
      await db.pool.query(
        "SELECT tile_latitude,tile_longitude,status FROM climate_scenario_tiles ORDER BY 1",
      )
    ).rows;
  expect(await tiles()).toEqual([
    { tile_latitude: 30, tile_longitude: -10, status: "requested" },
  ]);
  await build(
    provider(),
    fixture(() => null),
    settings(2),
  );
  await process((await store.submit(owner, randomUUID(), request())).id);
  expect(await tiles()).toEqual([
    { tile_latitude: 30, tile_longitude: -10, status: "requested" },
    { tile_latitude: 32, tile_longitude: -7, status: "requested" },
  ]);
  const jobs = await db.boss.findJobs(SCENARIO_QUEUE, {});
  expect(jobs.filter((j) => j.state === "created")).toHaveLength(1);
  expect(jobs[0].data.tile).toEqual({ latitude: 32, longitude: -7 });
});

const livePolicy = {
  ...rotationPolicy,
  futureClimate: currentFutureClimatePolicy,
};
// Near-term ids sit in their own range so they never collide with the
// mid-century ones.
const nearIds = (series) =>
  series.map((s) => ({
    ...s,
    unitId: s.unitId.replace("-9000-", "-9100-"),
  }));
async function placeholderRows(series) {
  for (const s of series) {
    const marker = Buffer.from(`synthetic ${s.unitId}`);
    await db.pool.query(
      `INSERT INTO climate_scenario_units(id,unit_key,model,experiment,variable,year,tile_latitude,tile_longitude,raw,raw_sha256,normalized_sha256,retrieved_at)
      VALUES($1,$2,'synthetic','historical','tas',2000,0,0,$3,$4,$5,now())`,
      [
        s.unitId,
        createHash("sha256").update(`key ${s.unitId}`).digest("hex"),
        marker,
        createHash("sha256").update(marker).digest("hex"),
        s.normalizedSha256,
      ],
    );
  }
}
// The live policy with synthetic series; a tile "not extended" gives no
// near-term series, like a tile prepared before the near-term period existed.
const nearFixture = (prepared) => ({
  ...fixture((needs) =>
    needs.near
      ? prepared
        ? nearIds(syntheticScenarioSeries(needs))
        : null
      : syntheticScenarioSeries(needs),
  ),
  policy: livePolicy,
  nearTermNeeds: (input, catalog, policy, assessedOn) => {
    const needs = rotationNearTermNeedsCore(input, catalog, policy, assessedOn);
    return needs && { ...needs, near: true };
  },
});

test("a plan pins the near-term units apart, and a tile without them still completes with mid-century and asks to be extended", async () => {
  const input = request();
  const wanted = (policy) => [
    rotationScenarioNeedsCore(input, rotationCatalog(), policy, today),
    rotationNearTermNeedsCore(input, rotationCatalog(), policy, today),
  ];
  const [mid, near] = wanted(livePolicy);
  expect(wanted(rotationPolicy)[1]).toBeNull();
  const settings = loadConfig({
    ...db.config,
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
    CLIMATE_SCENARIOS_ENABLED: "true",
    SCENARIO_TILES_PER_DAY: "4",
  });
  await placeholderRows(syntheticScenarioSeries(mid));
  await placeholderRows(nearIds(syntheticScenarioSeries(near)));

  await build(provider(), nearFixture(true), settings);
  const accepted = await store.submit(owner, randomUUID(), input);
  const done = await process(accepted.id);
  expect(done.status).toBe("completed");
  const block = done.result.futureClimate;
  expect(block.status).toBe("compared");
  expect(block.nearTerm).toMatchObject({
    status: "compared",
    reason: null,
    notAForecast: true,
  });
  expect(
    done.result.candidates.some((c) => c.future?.nearTerm?.length === 2),
  ).toBe(true);
  // Both sets are pinned to the plan and listed in the result, which the
  // status contract checks on every read.
  expect(done.scenarioUnitIds).toHaveLength(
    mid.units.length + near.units.length,
  );
  expect(block.unitIds).toEqual(done.scenarioUnitIds);
  const pinned = (
    await db.pool.query(
      "SELECT versions FROM planning_runs WHERE request_id=$1",
      [accepted.id],
    )
  ).rows[0].versions;
  expect(pinned.policy.futureClimate.nearTerm.windows).toHaveLength(2);
  expect((await process(accepted.id)).result).toEqual(done.result);

  await db.pool.query("TRUNCATE planning_scenario_units");
  await build(provider(), nearFixture(false), settings);
  const missing = await process(
    (await store.submit(owner, randomUUID(), input)).id,
  );
  expect(missing.status).toBe("completed");
  expect(missing.result.futureClimate.status).toBe("compared");
  expect(missing.result.futureClimate.nearTerm).toMatchObject({
    status: "unavailable",
    reason: "NEAR_TERM_TILE_NOT_PREPARED",
    notAForecast: true,
  });
  expect(missing.scenarioUnitIds).toHaveLength(mid.units.length);
  // The tile asks to be extended under the live policy's own key.
  const tiles = (
    await db.pool.query(
      "SELECT tile_latitude,tile_longitude,status,policy_key FROM climate_scenario_tiles",
    )
  ).rows;
  expect(tiles).toEqual([
    {
      tile_latitude: 32,
      tile_longitude: -7,
      status: "requested",
      policy_key: policyKey(currentFutureClimatePolicy),
    },
  ]);
  const jobs = await db.boss.findJobs(SCENARIO_QUEUE, {});
  expect(
    jobs.filter(
      (j) =>
        j.state === "created" &&
        j.data.policyKey === policyKey(currentFutureClimatePolicy),
    ),
  ).toHaveLength(1);
});

test("an unfinished workflow 2 run fails as unsupported instead of running retired engine code", async () => {
  await build(provider(), rotationFixture);
  const accepted = await store.submit(owner, randomUUID(), request());
  const row = (
    await db.pool.query(
      "SELECT versions FROM planning_runs WHERE request_id=$1",
      [accepted.id],
    )
  ).rows[0];
  const policy = { ...row.versions.policy, version: "rotation-policy-1" };
  delete policy.futureClimate;
  const versions = {
    ...row.versions,
    workflowVersion: "planning-workflow-2",
    engineVersion: "rotation-engine-3",
    policy,
  };
  await db.pool.query("DELETE FROM planning_runs WHERE request_id=$1", [
    accepted.id,
  ]);
  await db.pool.query(
    "INSERT INTO planning_runs(request_id,versions,versions_hash) VALUES($1,$2,$3)",
    [
      accepted.id,
      versions,
      createHash("sha256").update(stableJson(versions)).digest("hex"),
    ],
  );
  const status = await process(accepted.id);
  expect(status.status).toBe("failed");
  expect(status.error).toEqual({ code: "WORKFLOW_VERSION_UNSUPPORTED" });
  expect(status.versions.workflowVersion).toBe("planning-workflow-2");
});

test("a what-if reruns a stored plan with the request plus its changes, labelled, hash-checked and owner-scoped", async () => {
  const fake = provider();
  await build(fake, rotationFixture);
  const input = request();
  await placeholderUnits(input);
  const original = await store.submit(owner, randomUUID(), input);
  const plain = (await process(original.id)).result;
  expect("whatIf" in plain).toBe(false);
  const whatIf = {
    rainfall_change_percent: -30,
    temperature_change_c: 3,
    sowing_shift_days: 7,
  };
  const key = randomUUID();
  const rerun = await store.submitWhatIf(owner, key, original.id, whatIf);
  expect(rerun.id).not.toBe(original.id);
  // The same key and the same changes are the same plan.
  expect((await store.submitWhatIf(owner, key, original.id, whatIf)).id).toBe(
    rerun.id,
  );
  await expect(
    store.submitWhatIf(owner, key, original.id, {
      ...whatIf,
      temperature_change_c: 4,
    }),
  ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  const status = await process(rerun.id);
  expect(status.status).toBe("completed");
  // Stored input is the original request plus what_if, hashed with it.
  expect(status.parentPlanId).toBe(original.id);
  expect((await store.list(owner, undefined, 20)).items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        id: rerun.id,
        parentPlanId: original.id,
        whatIf: true,
      }),
    ]),
  );
  expect(status.input.what_if).toEqual(whatIf);
  const stored = (
    await db.pool.query(
      "SELECT input,input_hash FROM plan_requests WHERE id IN ($1,$2) ORDER BY created_at",
      [original.id, rerun.id],
    )
  ).rows;
  expect(stored[0].input_hash).not.toBe(stored[1].input_hash);
  const rest = structuredClone(stored[1].input);
  delete rest.what_if;
  expect(rest).toEqual(stored[0].input);
  const result = status.result;
  expect(result.whatIf).toMatchObject({
    notAForecast: true,
    sowingShiftDays: 7,
    appliedTo: { historicalWeather: true, futureModelWorlds: "applied" },
  });
  expect(result.limitations.at(-1)).toContain("nothing here is a forecast");
  expect(result.input).toEqual(status.input);
  expect(result.candidates[0].scores.climate.meanLoss).not.toBe(
    plain.candidates[0].scores.climate.meanLoss,
  );
  const row = (
    await db.pool.query(
      "SELECT result,result_hash FROM planning_runs WHERE request_id=$1",
      [rerun.id],
    )
  ).rows[0];
  expect(row.result_hash).toBe(
    createHash("sha256").update(stableJson(row.result)).digest("hex"),
  );
  const secondParent = await store.submit(owner, randomUUID(), input);
  await expect(
    store.submitWhatIf(owner, key, secondParent.id, whatIf),
  ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  await expect(
    db.pool.query("UPDATE plan_requests SET parent_plan_id=$2 WHERE id=$1", [
      rerun.id,
      secondParent.id,
    ]),
  ).rejects.toThrow("PLAN_ACCEPTED_METADATA_IMMUTABLE");
  // Another owner cannot read or rerun this plan.
  const other = await store.authenticate(
    (await store.createOwner("synthetic-rotation-other")).accessToken,
  );
  await expect(
    store.submitWhatIf(other, randomUUID(), original.id, whatIf),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  // Out-of-range or empty changes never reach the queue.
  for (const bad of [
    { rainfall_change_percent: 80 },
    {},
    { temperature_change_c: 2, unknown: 1 },
  ])
    await expect(
      store.submitWhatIf(owner, randomUUID(), original.id, bad),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
});

test("HTTP what-if route needs a plan, a key and valid changes", async () => {
  const api = await startApi(db, {
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  });
  try {
    const session = await planSession(api);
    const other = await planSession(api);
    const submitted = await planHttp(api, "/api/v1/plans", {
      method: "POST",
      token: session.accessToken,
      key: randomUUID(),
      body: { ...request(), label: "Original rotation" },
    });
    expect(submitted.status).toBe(202);
    const { id } = await submitted.json();
    const send = (token, path, body, key = randomUUID()) =>
      planHttp(api, path, { method: "POST", token, key, body });
    const changes = { what_if: { temperature_change_c: 2 } };
    const ok = await send(
      session.accessToken,
      `/api/v1/plans/${id}/what-if`,
      changes,
    );
    expect(ok.status).toBe(202);
    const created = await ok.json();
    expect(ok.headers.get("location")).toBe(`/api/v1/plans/${created.id}`);
    expect(created.id).not.toBe(id);
    const read = await planHttp(api, `/api/v1/plans/${created.id}`, {
      token: session.accessToken,
    });
    const childStatus = await read.json();
    expect(childStatus.parentPlanId).toBe(id);
    expect(childStatus.label).toBeNull();
    const parentStatus = await planHttp(api, `/api/v1/plans/${id}`, {
      token: session.accessToken,
    });
    expect((await parentStatus.json()).label).toBe("Original rotation");
    const list = await planHttp(api, "/api/v1/plans", {
      token: session.accessToken,
    });
    expect((await list.json()).items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: created.id,
          parentPlanId: id,
          whatIf: true,
        }),
      ]),
    );
    expect(childStatus.input.what_if).toEqual({
      rainfall_change_percent: 0,
      temperature_change_c: 2,
      sowing_shift_days: 0,
    });
    expect(
      (await send(other.accessToken, `/api/v1/plans/${id}/what-if`, changes))
        .status,
    ).toBe(404);
    expect(
      (await send(undefined, `/api/v1/plans/${id}/what-if`, changes)).status,
    ).toBe(401);
    for (const body of [
      {},
      { what_if: { rainfall_change_percent: 99 } },
      { what_if: {} },
      { what_if: { temperature_change_c: 1 }, extra: 1 },
    ])
      expect(
        (await send(session.accessToken, `/api/v1/plans/${id}/what-if`, body))
          .status,
      ).toBe(400);
    expect(
      (
        await send(
          session.accessToken,
          `/api/v1/plans/${id}/what-if`,
          changes,
          "bad key",
        )
      ).status,
    ).toBe(400);
  } finally {
    await stop(api.child);
  }
});

test("new output policy pins owned field context once and keeps replay independent of extraction edits", async () => {
  const { FieldStore } =
    await import("../../apps/server/dist/modules/fields/application/field-store.js");
  const { TERRAIN_PROVENANCE } =
    await import("../../packages/domain/dist/index.js");
  const f = {
    ...fixture(() => null),
    policy: { ...rotationPolicy, outputs: "rotation-outputs-1" },
  };
  await build(provider(), f);
  const field = await new FieldStore(db.pool).create(owner, {
    schema_version: "1",
    name: "Synthetic context field",
    location: rotationRequest().location,
    soil: { status: "unknown" },
    water: { status: "unknown" },
    crop_health: { status: "unknown" },
  });
  const terrain = {
    kind: "terrain",
    policyVersion: "terrain-policy-1",
    product: "NASADEM_NC.001 elevation (30 m) via AppEEARS",
    resolutionMeters: 30,
    grid: {
      rows: 3,
      cols: 3,
      cellNorthM: 30,
      cellEastM: 30,
      stride: 1,
      requestedPoints: 9,
      missingPoints: 0,
    },
    elevation: null,
    slope: {
      cells: 4,
      meanPercent: 7,
      p90Percent: 8,
      maxPercent: 9,
      noiseFloorPercent: 6.1,
      dominantAspectDeg: 270,
      aspectConsistency: 1,
      classShares: { sloping: 1 },
    },
    erosion: {
      slopeLengthM: 90,
      lsFactorMean: 1.5,
      referenceBand: "above_unit_plot",
    },
    frostPocket: { status: "unknown", belowSurroundingM: null, ringPoints: 0 },
    explanations: [],
    provenance: [...TERRAIN_PROVENANCE],
    limitations: ["Synthetic test summary; no NASA evidence."],
  };
  const extractionId = randomUUID();
  const hash = (value) =>
    createHash("sha256").update(stableJson(value)).digest("hex");
  await db.pool.query(
    "INSERT INTO field_extractions(id,field_id,kind,status,request,result,result_hash,completed_at) VALUES($1,$2,'terrain','completed',$3,$4,$5,now())",
    [
      extractionId,
      field.id,
      { points: [{ id: "synthetic", ...rotationRequest().location }] },
      terrain,
      hash(terrain),
    ],
  );
  const input = request({ field_id: field.id });
  input.preferences.income_weight = 5;
  const accepted = await store.submit(owner, randomUUID(), input);
  const pinned = await workflow.load(accepted.id);
  expect(pinned.versions.analysisContext.terrain.sha256).toBe(hash(terrain));
  // Mutate the source before processing; the accepted versions remain the input.
  const changed = { ...terrain, slope: { ...terrain.slope, meanPercent: 12 } };
  await db.pool.query(
    "UPDATE field_extractions SET result=$2,result_hash=$3 WHERE id=$1",
    [extractionId, changed, hash(changed)],
  );
  const completed = await process(accepted.id);
  expect(completed.status).toBe("completed");
  const result = (await workflow.load(accepted.id)).result;
  expect(result.outputs.terrain.slope.meanPercent).toBe(7);
  expect(result.outputs.terrain.rankingApplied).toBe(false);
  expect(result.outputs.terrain.erosion.missingFactors).toEqual([
    "R",
    "K",
    "C",
    "P",
  ]);
  expect(result.outputs.priorities[0].code).toBe("INCOME_DATA_UNAVAILABLE");
  expect(
    result.outputs.grids.find((g) => g.input === "NASADEM").evidenceIds,
  ).toEqual([extractionId, hash(terrain)]);
  expect(
    result.strategies.items.every((s) =>
      s.notes.every((n) => n.code !== "GAP_EROSION_NOT_ASSESSED"),
    ),
  ).toBe(true);
  const other = await store.authenticate(
    (await store.createOwner("synthetic-other-context-ip")).accessToken,
  );
  await expect(store.submit(other, randomUUID(), input)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  await expect(
    store.submit(owner, randomUUID(), {
      ...input,
      location: { latitude: 32, longitude: -6 },
    }),
  ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  await expect(store.submit(owner, randomUUID(), input)).resolves.toBeDefined();
  await db.pool.query(
    "UPDATE field_extractions SET result_hash=$2 WHERE id=$1",
    [extractionId, "0".repeat(64)],
  );
  await expect(store.submit(owner, randomUUID(), input)).rejects.toMatchObject({
    code: "INVALID_INPUT",
  });
});

test("rotation list summaries derive stored field/crop/horizon/rank data without rewriting evidence", async () => {
  const { FieldStore } =
    await import("../../apps/server/dist/modules/fields/application/field-store.js");
  const fieldFixture = JSON.parse(
    readFileSync("tests/support/fixtures/bg-b0.synthetic.json", "utf8"),
  );
  const summaryFixture = {
    ...rotationFixture,
    policy: { ...rotationPolicy, outputs: "rotation-outputs-1" },
  };
  await build(provider(), summaryFixture);
  const fields = new FieldStore(db.pool);
  const field = await fields.create(owner, fieldFixture.profile);
  const input = request({
    field_id: field.id,
    current_rotation: { crop_ids: ["synthetic-crop-02", "synthetic-crop-01"] },
  });
  await placeholderUnits(input, summaryFixture.policy);
  const accepted = await store.submit(owner, randomUUID(), input, undefined, {
    label: "Rotation A",
  });
  const queued = (await store.list(owner, undefined, 20)).items[0];
  expect(queued).toMatchObject({
    id: accepted.id,
    fieldId: field.id,
    fieldName: fieldFixture.profile.name,
    cropIds: input.current_rotation.crop_ids,
    horizonYears: 3,
    topStrategyCropIds: null,
    whatIf: false,
    parentPlanId: null,
    label: "Rotation A",
  });
  const completed = await process(accepted.id);
  const evidence = async () =>
    (
      await db.pool.query(
        "SELECT r.input,r.input_hash,p.result,p.result_hash,p.versions_hash FROM plan_requests r JOIN planning_runs p ON p.request_id=r.id WHERE r.id=$1",
        [accepted.id],
      )
    ).rows[0];
  const before = await evidence();
  const top = completed.result.strategies.items.find((item) => item.rank === 1);
  expect(top).toBeDefined();
  expect(
    (await store.list(owner, undefined, 20)).items[0].topStrategyCropIds,
  ).toEqual(top.cropIds);
  await store.setLabel(owner, accepted.id, "Rotation B");
  expect(await store.read(owner, accepted.id)).toMatchObject({
    label: "Rotation B",
    parentPlanId: null,
  });
  expect(await evidence()).toEqual(before);
  await fields.remove(owner, field.id);
  expect((await store.list(owner, undefined, 20)).items[0]).toMatchObject({
    fieldId: field.id,
    fieldName: null,
  });
  const foreign = await store.authenticate(
    (await store.createOwner("synthetic-summary-other")).accessToken,
  );
  const privateField = await fields.create(foreign, fieldFixture.profile);
  // Legacy requests can reference an unpinned field: the list must not reveal
  // the name of a field now held by another owner.
  const otherInput = request({ field_id: privateField.id });
  // Current acceptance rejects foreign fields, independently of list ownership.
  await expect(
    store.submit(owner, randomUUID(), otherInput),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test.each([
  ["0.14.0", "income-benefits-1"],
  ["0.15.0", "benefits-2"],
])(
  "%s explicit pin preserves %s beside the new default and earlier acceptance policy",
  async (version, researchPolicy) => {
    await build(provider(), undefined, {
      ...config,
      ROTATION_CATALOG_VERSION: version,
    });
    const input = request({
      location: { latitude: 32.3, longitude: -6.3 },
      history: { status: "unknown" },
      preferences: {
        mode: "consider",
        considered_crop_ids: ["barley", "lentil"],
        excluded_crop_ids: [],
        priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
        income_weight: 5,
      },
    });
    const explicit = new PlanStore(
      db.pool,
      db.boss,
      config.PLAN_CATALOG_ID,
      version,
      undefined,
      workflow,
    );
    const accepted = await explicit.submit(owner, randomUUID(), input);
    const status = await workflow.read(owner, accepted.id);
    expect(status.versions.policy.research).toBe(researchPolicy);
    expect(status.versions.policy.outputs).toBe("rotation-outputs-1");
    expect(config.ROTATION_CATALOG_VERSION).toBe("0.15.0");
    await build(provider(), undefined, {
      ...config,
      ROTATION_CATALOG_VERSION: "0.13.0",
    });
    const earlier = await store.submit(owner, randomUUID(), input);
    expect(
      (await workflow.read(owner, earlier.id)).versions.policy.research,
    ).toBeUndefined();
  },
);

test.each([
  ["0.14.0", "income-benefits-1"],
  ["0.15.0", "benefits-2"],
])(
  "%s result and %s policy persist with verified hashes on PostgreSQL and idempotent owned replay",
  async (version, researchPolicy) => {
    const real = await loadCatalogRelease(`data/catalog/releases/${version}`);
    // Controlled fixture flag: the source facts are real; weather is synthetic.
    const f = {
      ...fixture(() => null),
      catalog: syntheticResearchCatalog(real),
      policy: {
        ...rotationPolicy,
        outputs: "rotation-outputs-1",
        research: researchPolicy,
      },
    };
    await build(provider(), f);
    const input = request();
    input.preferences.income_weight = 5;
    const key = randomUUID();
    const accepted = await store.submit(owner, key, input);
    await process(accepted.id);
    const status = await workflow.read(owner, accepted.id);
    expect(status.status).toBe("completed");
    const originalBytes = JSON.stringify(status);
    expect(workflow.serializeRead(status)).toBe(originalBytes);
    expect(
      (
        await db.pool.query(
          "SELECT strategy_summary=result->'strategies' AS same FROM planning_runs WHERE request_id=$1",
          [accepted.id],
        )
      ).rows[0].same,
    ).toBe(true);
    expect(await workflow.read(owner, accepted.id)).toBe(status);
    expect(Object.isFrozen(status.result)).toBe(true);
    expect(JSON.stringify(await workflow.read(owner, accepted.id))).toBe(
      originalBytes,
    );
    await db.pool.query(
      "UPDATE plan_requests SET label='Changed after cached read' WHERE id=$1",
      [accepted.id],
    );
    const renamed = await workflow.read(owner, accepted.id);
    expect(renamed).not.toBe(status);
    expect(renamed.label).toBe("Changed after cached read");
    expect(JSON.parse(workflow.serializeRead(renamed)).label).toBe(
      "Changed after cached read",
    );
    expect(renamed.result).toEqual(status.result);
    if (version === "0.15.0") {
      const cold = new PlanningStore(
        db.pool,
        db.boss,
        config,
        workflow.weather,
        undefined,
        f,
      );
      // Hold all eight real-PostgreSQL loads before publication so scheduler
      // timing cannot accidentally turn the intended cold misses into hits.
      const load = cold.load.bind(cold);
      let arrived = 0,
        release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      cold.load = async (...args) => {
        const row = await load(...args);
        if (++arrived === 8) release();
        await gate;
        return row;
      };
      const parallel = await Promise.all(
        Array.from({ length: 8 }, () => cold.read(owner, accepted.id)),
      );
      for (const value of parallel) expect(value).toEqual(renamed);
      // Eight overlapping misses replace one document, so it consumes exactly
      // one document's accounted bytes, not eight charges or phantom evictions.
      expect(cold.completedReadBytes).toBe(
        Buffer.byteLength(JSON.stringify(renamed)),
      );
      expect(await cold.read(owner, accepted.id)).toEqual(renamed);
    }
    expect(status.result.catalogResearch.incomeDerivable).toBeGreaterThan(0);
    expect(status.result.catalogResearch.erosionRankable).toBe(0);
    expect(status.result.strategies.items.every((s) => s.resources)).toBe(true);
    if (version === "0.15.0") {
      expect(status.result.catalogResearch.benefitVersion).toBe("benefits-2");
      expect(
        status.result.strategies.items.every((s) =>
          s.notes.some(
            (n) => n.code === "BENEFIT_ORGANIC_MATTER" && n.benefitEvidence,
          ),
        ),
      ).toBe(true);
      expect(
        status.result.candidates.every((c) =>
          c.resources.benefits.every((b) => b.effects.length === 12),
        ),
      ).toBe(true);
    }
    expect(() => rotationPlanningStatusSchema.parse(status)).not.toThrow();
    expect((await store.submit(owner, key, input)).id).toBe(accepted.id);
    expect(await workflow.read(randomUUID(), accepted.id)).toBeNull();
    const row = (
      await db.pool.query(
        "SELECT result,result_hash,versions,versions_hash FROM planning_runs WHERE request_id=$1",
        [accepted.id],
      )
    ).rows[0];
    expect(
      createHash("sha256").update(stableJson(row.result)).digest("hex"),
    ).toBe(row.result_hash);
    expect(
      createHash("sha256").update(stableJson(row.versions)).digest("hex"),
    ).toBe(row.versions_hash);
  },
);

test("unversioned options follows the planning catalog and caches identical verified bytes", async () => {
  const api = await startApi(db, {
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  });
  try {
    const caps = await (
      await fetch(api.origin + "/api/v1/capabilities")
    ).json();
    const first = await fetch(api.origin + "/api/v1/catalog/options");
    expect(first.status).toBe(200);
    const bytes = await first.text(),
      options = catalogOptionsSchema.parse(JSON.parse(bytes));
    expect(options.catalogVersion).toBe("0.15.0");
    expect(options.catalogVersion).toBe(caps.catalog.version);
    expect(options.crops).toHaveLength(246);
    const again = await fetch(api.origin + "/api/v1/catalog/options");
    expect(again.status).toBe(200);
    expect(await again.text()).toBe(bytes);
    expect(again.headers.get("cache-control")).toBe("no-store");
    expect(Buffer.byteLength(bytes)).toBeLessThanOrEqual(2 * 1024 * 1024);
    const old = await fetch(
      api.origin + "/api/v1/catalog/options/rotavise-pilot/0.13.0",
    );
    expect(old.status).toBe(200);
    expect((await old.json()).catalogVersion).toBe("0.13.0");
  } finally {
    await stop(api.child);
  }
});
