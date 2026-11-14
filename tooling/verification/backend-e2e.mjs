// Real API + production worker/engine + PostgreSQL. Original NASA extraction
// bytes replace only remote AppEEARS waiting. POWER is live (no credentials).
// Default: pnpm test:backend-e2e [--benchmark], using a disposable database.
// Real-climate mode uses the configured consolidated store and a private role.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import * as contracts from "../../packages/contracts/dist/index.js";
import { openApiComponents as schemas } from "../../packages/contracts/dist/openapi/operations.js";
import {
  disposable,
  freePort,
  processEnv,
  stop,
} from "../../tests/support/index.mjs";
import {
  disposableMail,
  TEST_PASSWORD,
} from "../../tests/support/accounts.mjs";
import { syntheticPlanInput } from "../../tests/support/plans.mjs";
import {
  evidenceRoot,
  available,
  requiredFiles,
} from "../../tests/support/fixtures/backend-e2e-transports.mjs";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { WaterStorageService } from "../../apps/server/dist/modules/earth-observations/application/water-storage.service.js";
import { CanopyBiomassService } from "../../apps/server/dist/modules/earth-observations/application/canopy-biomass.service.js";
import { stableJson } from "../../apps/server/dist/common/serialization/stable-json.js";

async function poll(
  run,
  { timeout = 30000, label = "condition", interval = 1000 } = {},
) {
  const deadline = performance.now() + timeout;
  while (performance.now() < deadline) {
    const value = await run();
    if (value) return value;
    await delay(interval);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
const started = performance.now();
const report = {
  date: new Date().toISOString(),
  machine: {
    model: os.cpus()[0].model,
    platform: os.platform(),
    arch: os.arch(),
    node: process.version,
    load: os.loadavg(),
  },
  verified: [],
  skipped: [],
  measurements: {},
};
const pass = (text) => {
  report.verified.push(text);
  console.log(`PASS ${text}`);
};
const skip = (text) => {
  report.skipped.push(text);
  console.log(`SKIP ${text}`);
};
const sha = (v) =>
  createHash("sha256")
    .update(typeof v === "string" || Buffer.isBuffer(v) ? v : stableJson(v))
    .digest("hex");
function assertRealFutures(future) {
  assert.equal(
    future.status,
    "compared",
    "real prepared mid-century tile is required",
  );
  assert.equal(
    future.nearTerm.status,
    "compared",
    "real prepared near-term tile is required",
  );
  const identities = [
    "GFDL-ESM4",
    "IPSL-CM6A-LR",
    "MPI-ESM1-2-HR",
    "MRI-ESM2-0",
    "UKESM1-0-LL",
  ]
    .flatMap((model) =>
      ["ssp245", "ssp585"].map((experiment) => `${model}|${experiment}`),
    )
    .sort();
  for (const period of [future, future.nearTerm]) {
    assert.deepEqual(
      period.worlds.map((world) => `${world.model}|${world.experiment}`).sort(),
      identities,
    );
    assert.ok(
      period.worlds.every((world) => world.status === "compared"),
      "every required model world must compare",
    );
  }
}
const f = JSON.parse(readFileSync("tests/support/fixtures/backend-e2e.json"));
assert.equal(f.synthetic, true);
// Verify saved file identities before starting services. Missing evidence is a
// visible skip; changed evidence is a failure, never a silent fallback.
if (existsSync(`${evidenceRoot}/manifest.json`)) {
  const manifest = JSON.parse(readFileSync(`${evidenceRoot}/manifest.json`));
  for (const file of manifest.files) {
    const path = `${evidenceRoot}/${file.file}`;
    if (existsSync(path))
      assert.equal(sha(readFileSync(path)), file.sha256, path);
  }
}
const realClimate = process.argv.includes("--real-climate");
const db = realClimate
  ? await (await import("./real-database.mjs")).realDatabase()
  : await disposable();
const testIp = `192.0.2.${10 + Math.floor(Math.random() * 200)}`;
db.trackIp?.(testIp);
report.testIp = testIp;
const clearBenchmarkQuotas = () =>
  realClimate ? db.clearQuotas() : db.pool.query("TRUNCATE plan_quotas");
let api, worker, inbox;
let token, cookie;
try {
  const store = new CatalogStore(db.pool);
  const configBase = loadConfig(processEnv(db));
  const catalog = await loadCatalogRelease(
    `data/catalog/releases/${configBase.ROTATION_CATALOG_VERSION}`,
  );
  if (!realClimate) {
    await store.import(catalog);
    await store.import(await loadCatalogRelease("data/catalog/releases/0.1.0"));
  }
  inbox = await disposableMail();
  const port = await freePort(),
    workerPort = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const env = processEnv(db, {
    API_PORT: String(port),
    TRUST_PROXY: "1",
    WORKER_PORT: String(workerPort),
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
    OBSERVATIONS_ENABLED: "true",
    AUTH_ENABLED: "true",
    AUTH_SECRET: randomUUID() + randomUUID(),
    AUTH_BASE_URL: origin,
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(inbox.smtpPort),
    SMTP_TLS: "local",
    MAIL_FROM: "backend-e2e@example.invalid",
    SCIENCE_URL: "",
    EARTHDATA_USERNAME: "replay-test-only",
    EARTHDATA_PASSWORD: "replay-test-only",
    ANTHROPIC_API_KEY: undefined,
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
  });
  // Do not inherit credentials from the invoking shell into the replay worker.
  for (const key of Object.keys(env))
    if (env[key] === undefined || env[key] === "") delete env[key];
  api = await createApi(loadConfig(env));
  await api.app.listen(port, "127.0.0.1");
  worker = spawn(process.execPath, ["tests/support/backend-e2e-worker.mjs"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  worker.output = "";
  worker.stdout.on("data", (d) => {
    worker.output += d;
  });
  worker.stderr.on("data", (d) => {
    worker.output += d;
  });
  worker.exited = once(worker, "exit");
  await poll(
    () => {
      if (worker.exitCode !== null) throw Error(worker.output);
      return worker.output.includes("worker_ready");
    },
    { label: "production worker ready" },
  );
  const http = async (
    path,
    {
      method = "GET",
      body,
      expected = 200,
      schema,
      owner = true,
      account = false,
      key,
      extra = {},
    } = {},
  ) => {
    const r = await fetch(origin + "/api/v1" + path, {
      method,
      headers: {
        "x-forwarded-for": testIp,
        ...(owner && token && !account
          ? { authorization: `Bearer ${token}` }
          : {}),
        ...(account ? { cookie, origin } : {}),
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
        ...(key ? { "idempotency-key": key } : {}),
        ...extra,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await r.text();
    assert.equal(
      r.status,
      expected,
      `${method} ${path}: ${text.slice(0, 1200)}`,
    );
    const data = text ? JSON.parse(text) : null;
    if (schema) schema.parse(data);
    if (path === "/plan-sessions" && data?.accessToken)
      await db.trackSession?.(data.accessToken);
    if (method === "POST" && (path === "/plans" || path.endsWith("/what-if")))
      db.trackPlan?.(data.id);
    if (method === "POST" && path.endsWith("/extractions"))
      db.trackExtraction?.(data.id);
    if (
      data?.status === "completed" &&
      data?.result?.kind === "rotation_assessment"
    )
      await db.captureEvidence?.(data.id);
    return { data, headers: r.headers, bytes: Buffer.byteLength(text), text };
  };
  const caps = (
    await http("/capabilities", {
      schema: contracts.capabilitiesSchema,
      owner: false,
    })
  ).data;
  assert.equal(caps.catalog.version, "0.15.0");
  if (realClimate) {
    assert.equal(caps.dataCompleteness.ok, true);
    const readiness = (
      await http("/health/ready", {
        schema: contracts.healthSchema,
        owner: false,
      })
    ).data;
    assert.equal(readiness.status, "ready");
    assert.equal(readiness.dataCompleteness.ok, true);
    const rootReady = await fetch(origin + "/health/ready");
    assert.equal(rootReady.status, 200);
    assert.equal((await rootReady.json()).dataCompleteness.ok, true);
    report.dataCompleteness = caps.dataCompleteness;
    pass(
      "capabilities and both readiness aliases report complete national data",
    );
  }
  token = (
    await http("/plan-sessions", {
      method: "POST",
      body: {},
      expected: 201,
      schema: contracts.ownerSessionSchema,
      owner: false,
    })
  ).data.accessToken;
  pass("capabilities → guest session; real default catalog 0.15.0");
  const options = (
    await http("/catalog/options", { schema: contracts.catalogOptionsSchema })
  ).data;
  assert.equal(options.catalogVersion, caps.catalog.version);
  assert.equal(options.crops.length, 246);
  const names = Object.fromEntries(
    ["en", "fr", "ar", "ary"].map((lang) => [
      lang,
      options.crops.filter((c) => c.localNames.some((n) => n.language === lang))
        .length,
    ]),
  );
  const cropPath = `/catalog/crops/${catalog.id}/${catalog.version}/faba-bean`;
  const detail = await http(cropPath, { schema: contracts.cropDetailSchema });
  assert.equal(detail.data.research.benefitEffects.length, 12);
  assert.ok(detail.data.issues.length > 0);
  await http(cropPath, {
    expected: 304,
    extra: { "if-none-match": detail.headers.get("etag") },
  });
  const glossaries = {};
  for (const lang of ["fr", "en"]) {
    glossaries[lang] = (
      await http(`/glossary?lang=${lang}`, {
        schema: contracts.glossaryResponseSchema,
      })
    ).data;
    const role = (
      await http(`/glossary?lang=${lang}&group=role`, {
        schema: contracts.glossaryResponseSchema,
      })
    ).data;
    assert.equal(role.entries.length, 4);
    assert.ok(
      role.entries.every((e) =>
        e.evidence.citations.every((c) => c.quote && c.url),
      ),
    );
  }
  report.catalog = {
    version: catalog.version,
    sha256: options.catalogSha256,
    crops: options.crops.length,
    names,
    issues: detail.data.issues.length,
  };
  pass(
    "catalog options, crop detail, ETag and four cited role explanations in fr/en (missing crop-name languages stay absent)",
  );
  let field = (
    await http("/fields", {
      method: "POST",
      body: {
        ...f.profile,
        soil: { status: "unknown" },
        water: { status: "unknown" },
        crop_health: { status: "unknown" },
        boundary: f.boundary,
      },
      expected: 201,
      schema: schemas.FieldRecord,
    })
  ).data;
  const base = `/fields/${field.id}`;
  const boundary = (
    await http(base + "/boundary", { schema: schemas.BoundaryEnvelope })
  ).data.boundary;
  assert.deepEqual(boundary.boundary, f.boundary);
  assert.ok(boundary.hectares > 0.3 && boundary.hectares < 0.5);
  const history = (
    await http(base + "/history", {
      method: "POST",
      body: f.history,
      expected: 201,
      schema: schemas.HistoryRecord,
    })
  ).data;
  field = (
    await http(base, {
      method: "PUT",
      body: { expectedVersion: field.version, profile: f.profile },
      schema: schemas.FieldRecord,
    })
  ).data;
  assert.deepEqual(field.profile, f.profile);
  pass(
    "atomic pilot field + 0.4 ha boundary → history → saved soil/water/reported health (illustrative inputs labelled in fixture)",
  );
  const extractions = {};
  for (const kind of ["terrain", "ecostress", "modis"]) {
    if (!available(kind)) {
      skip(
        `${kind}: missing real raw/reference file(s): ${requiredFiles(kind)
          .filter((path) => !existsSync(path))
          .join(", ")}`,
      );
      continue;
    }
    const queued = (
      await http(base + "/extractions", {
        method: "POST",
        body: { kind },
        expected: 202,
        schema: contracts.extractionStatusSchema,
      })
    ).data;
    extractions[kind] = await poll(
      async () => {
        const status = (
          await http(base + `/extractions/${queued.id}`, {
            schema: contracts.extractionStatusSchema,
          })
        ).data;
        if (status.status === "failed")
          throw Error(
            `${kind} failed: ${JSON.stringify(status.error)} ${worker.output.slice(-2000)}`,
          );
        return status.status === "completed" ? status : false;
      },
      { label: `${kind} real raw replay`, timeout: 60000 },
    );
    const saved = (
      await db.pool.query(
        "SELECT name,raw,sha256 FROM field_extraction_files WHERE extraction_id=$1 ORDER BY name",
        [queued.id],
      )
    ).rows;
    for (const file of saved) assert.equal(sha(file.raw), file.sha256);
    pass(
      `${kind}: queued → worker submit/poll/download → real raw hashes → completed contract`,
    );
  }
  // Stored pilot results are a comparison reference, never injected as results.
  const old = existsSync(`${evidenceRoot}/pilot-extractions.json`)
    ? JSON.parse(readFileSync(`${evidenceRoot}/pilot-extractions.json`))
    : [];
  for (const kind of ["terrain", "modis"])
    if (extractions[kind])
      assert.deepEqual(
        extractions[kind].result,
        kind === "modis"
          ? {
              ...old.find((r) => r.kind === kind).result,
              period: {
                ...old.find((r) => r.kind === kind).result.period,
                end: new Date().toISOString().slice(0, 10),
              },
            }
          : old.find((r) => r.kind === kind).result,
      );
  if (extractions.ecostress)
    assert.equal(
      extractions.ecostress.result.policyVersion,
      "ecostress-policy-2",
    );
  for (const [file, Service] of [
    ["pilot-grace.json", WaterStorageService],
    ["pilot-gedi.json", CanopyBiomassService],
  ]) {
    const path = `${evidenceRoot}/${file}`;
    if (existsSync(path) && !realClimate)
      await new Service(db.pool).import(JSON.parse(readFileSync(path)));
    else if (!existsSync(path)) skip(`regional context: missing real ${path}`);
  }
  const water = (
    await http(base + "/water-storage", {
      schema: schemas.WaterStorageResponse,
    })
  ).data;
  const canopy = (
    await http(base + "/canopy-biomass", {
      schema: contracts.canopyBiomassResponseSchema,
    })
  ).data;
  if (existsSync(`${evidenceRoot}/pilot-grace.json`)) {
    assert.equal(water.available, true);
    assert.equal(water.result.trend.direction, "declining");
  }
  if (existsSync(`${evidenceRoot}/pilot-gedi.json`))
    assert.equal(canopy.available, true);
  const vegetation = (
    await http(base + "/analysis/vegetation-history", {
      schema: contracts.vegetationHistoryResponseSchema,
    })
  ).data;
  if (extractions.modis) assert.equal(vegetation.status, "ready");
  await http(base + "/analysis/vegetation", {
    schema: contracts.vegetationAnalysisResponseSchema,
  });
  await http(base + "/analysis/rain", {
    schema: contracts.rainSeriesResponseSchema,
  });
  pass(
    "GRACE + GEDI reads and vegetation/rain analyses; missing HLS/GPM remain explicit unavailable states",
  );
  if (!realClimate)
    skip(
      "Giovanni baseline: no stored real 2001–2020 pilot daily file; POWER rain fallback is asserted. NEX-GDDP tile not in repository: futureClimate unavailable is asserted. No remote multi-hour job or credentials used.",
    );
  const today = new Date().toISOString().slice(0, 10);
  const day = (n) =>
    new Date(Date.parse(today) + n * 86400000).toISOString().slice(0, 10);
  const p = field.profile;
  const request = contracts.planRequestV2Schema.parse({
    schema_version: "2",
    field_id: field.id,
    location: p.location,
    history: {
      status: "known",
      completeness: "partial",
      entries: [
        Object.fromEntries(
          Object.entries(history.entry).filter(([k]) => k !== "schema_version"),
        ),
      ],
    },
    crop_health: {
      status: "reported",
      observations: p.crop_health.observations.map((o) => ({
        crop_id: o.crop_id,
        issue: { other_name: o.name },
        observed_on: o.observed_on,
        source: o.source,
        confirmation: o.confirmation,
      })),
    },
    soil: {
      status: "known",
      observations: p.soil.observations.map((o) => {
        const copy = { ...o };
        delete copy.unit;
        if (copy.metric === "organic_matter") {
          copy.value_percent = copy.value;
          delete copy.value;
        }
        return copy;
      }),
    },
    water: { ...p.water, allocation: null },
    planning: {
      horizon_years: 3,
      earliest_start_date: day(5),
      latest_start_date: day(172),
    },
    cultivars: [],
    preferences: f.preferences,
    current_rotation: f.current_rotation,
    farmer_context: f.farmer_context,
  });
  const accepted = (
    await http("/plans", {
      method: "POST",
      body: request,
      key: randomUUID(),
      expected: 202,
      schema: schemas.PlanSubmitted,
    })
  ).data;
  const completed = async (id) =>
    poll(
      async () => {
        const r = (
          await http(`/plans/${id}`, {
            schema: contracts.rotationPlanningStatusSchema,
          })
        ).data;
        if (r.status === "failed")
          throw Error(
            `Plan failed: ${JSON.stringify(r.error)} ${worker.output.slice(-1500)}`,
          );
        return r.status === "completed" ? r : false;
      },
      {
        label: "real planning workflow (live POWER)",
        timeout: 180000,
        interval: 2000,
      },
    );
  const plan = await completed(accepted.id),
    result = plan.result;
  assert.equal(result.synthetic, false);
  assert.equal(result.catalog.version, "0.15.0");
  assert.ok(result.strategies.items.some((s) => s.role === "current"));
  assert.ok(result.strategies.alternativesFound >= 2);
  for (const s of result.strategies.items)
    for (const note of s.notes)
      for (const lang of ["fr", "en"])
        assert.ok(
          glossaries[lang].entries.some((e) => e.code === note.code),
          `Missing glossary ${lang} ${note.code}`,
        );
  assert.ok(
    result.evidence.rulesUsed.model_recall +
      result.evidence.rulesUsed.double_checked >
      0,
  );
  if (realClimate) {
    assertRealFutures(result.futureClimate);
    const { unitIds, ...futureReport } = result.futureClimate;
    report.futureClimate = {
      ...futureReport,
      unitCount: unitIds.length,
      unitIdsSha256: sha(unitIds),
    };
  } else assert.equal(result.futureClimate.status, "unavailable");
  assert.equal(result.rain.source, "power_only");
  assert.equal(result.outputs.grids.length, 10);
  assert.ok(result.candidates.some((c) => c.vulnerabilitySeasons.length > 0));
  if (extractions.terrain) {
    assert.deepEqual(
      result.outputs.terrain.slope,
      extractions.terrain.result.slope,
    );
    assert.deepEqual(
      result.outputs.terrain.erosion.ls,
      extractions.terrain.result.erosion,
    );
    assert.equal(result.outputs.terrain.rankingApplied, false);
    assert.equal(result.outputs.terrain.erosion.soilLossTPerHaPerYear, null);
    assert.equal(
      result.outputs.analysisContext.terrain.sha256,
      plan.versions.analysisContext.terrain.sha256,
    );
  }
  for (const s of result.strategies.items) {
    const candidate = result.candidates.find((c) => c.id === s.candidateId);
    assert.ok(candidate);
    assert.deepEqual(candidate.scores, s.scores);
  }
  assert.deepEqual(result.input, plan.input);
  const beforeHash = (
    await db.pool.query(
      "SELECT result_hash FROM planning_runs WHERE request_id=$1",
      [accepted.id],
    )
  ).rows[0].result_hash;
  report.plan = {
    bytes: Buffer.byteLength(JSON.stringify(plan)),
    resultHash: beforeHash,
    strategies: result.strategies.items.length,
    alternatives: result.strategies.alternativesFound,
    evidence: result.evidence,
    futureClimate: result.futureClimate.status,
    grids: result.outputs.grids.map((g) => g.input),
  };
  pass(
    "real plan: current + ≥2 alternatives, fr/en notes, evidence counts, futureClimate, vulnerabilitySeasons, 10 grids and terrain outputs",
  );
  const changes = {
    rainfall_change_percent: -10,
    temperature_change_c: 1,
    sowing_shift_days: 7,
  };
  const what = (
    await http(`/plans/${accepted.id}/what-if`, {
      method: "POST",
      body: { what_if: changes },
      key: randomUUID(),
      expected: 202,
      schema: schemas.PlanSubmitted,
    })
  ).data;
  const after = await completed(what.id);
  if (realClimate) {
    assertRealFutures(after.result.futureClimate);
  }
  assert.equal(after.parentPlanId, accepted.id);
  assert.deepEqual(after.input.what_if, changes);
  assert.ok(after.result.whatIf);
  assert.equal(
    after.result.whatIf.rainfallChangePercent,
    changes.rainfall_change_percent,
  );
  assert.equal(
    after.result.whatIf.temperatureChangeC,
    changes.temperature_change_c,
  );
  assert.equal(after.result.whatIf.sowingShiftDays, changes.sowing_shift_days);
  assert.deepEqual(after.result.whatIf.planning, {
    requestedEarliestStartDate: request.planning.earliest_start_date,
    requestedLatestStartDate: request.planning.latest_start_date,
    effectiveEarliestStartDate: day(12),
    effectiveLatestStartDate: day(179),
  });
  assert.equal(after.result.whatIf.notAForecast, true);
  assert.equal(
    (
      await db.pool.query(
        "SELECT result_hash FROM planning_runs WHERE request_id=$1",
        [accepted.id],
      )
    ).rows[0].result_hash,
    beforeHash,
  );
  report.whatIf = after.result.whatIf;
  if (realClimate)
    report.measurements.engine = worker.output.split("\n").flatMap((line) => {
      try {
        const e = JSON.parse(line);
        return e.event === "rotation_engine_finished" ? [e] : [];
      } catch {
        return [];
      }
    });
  const plans = (await http("/plans", { schema: schemas.PlanList })).data;
  assert.equal(plans.items.length, 2);
  const summary = plans.items.find((p) => p.id === what.id);
  assert.equal(summary.parentPlanId, accepted.id);
  assert.equal(summary.whatIf, true);
  assert.equal(summary.fieldName, f.profile.name);
  assert.ok(summary.topStrategyCropIds.length > 0);
  pass(
    "what-if parent, accepted changes and before/after fields → unchanged parent hash → plan summaries",
  );
  if (process.argv.includes("--benchmark")) {
    const summarize = (values) => {
      const a = [...values].sort((a, b) => a - b);
      return {
        n: a.length,
        p50Ms: a[Math.ceil(a.length * 0.5) - 1],
        p95Ms: a[Math.ceil(a.length * 0.95) - 1],
        maxMs: a.at(-1),
      };
    };
    const endpoints = [
      ["plansList", "/plans", schemas.PlanList],
      [
        "largePlan",
        `/plans/${accepted.id}`,
        contracts.rotationPlanningStatusSchema,
      ],
      ["cropDetail", cropPath, contracts.cropDetailSchema],
      ["catalogOptions", "/catalog/options", contracts.catalogOptionsSchema],
      ["glossary", "/glossary?lang=fr", contracts.glossaryResponseSchema],
      ["fieldList", "/fields", schemas.FieldPage],
      ["boundary", base + "/boundary", schemas.BoundaryEnvelope],
      [
        "vegetationHistory",
        base + "/analysis/vegetation-history",
        contracts.vegetationHistoryResponseSchema,
      ],
      [
        "vegetation",
        base + "/analysis/vegetation",
        contracts.vegetationAnalysisResponseSchema,
      ],
      ["rain", base + "/analysis/rain", contracts.rainSeriesResponseSchema],
      ["grace", base + "/water-storage", schemas.WaterStorageResponse],
      ["gedi", base + "/canopy-biomass", contracts.canopyBiomassResponseSchema],
    ];
    for (const [name, path, schema] of endpoints) {
      const times = [];
      let bytes;
      // Measure through body download. Contract validation is outside timing.
      for (let i = 0; i < 40; i++) {
        if (i % 10 === 0) await clearBenchmarkQuotas();
        const t = performance.now();
        const r = await http(path);
        times.push(performance.now() - t);
        schema.parse(r.data);
        bytes = r.bytes;
        if (name === "largePlan") assert.equal(sha(r.data.result), beforeHash);
      }
      report.measurements[name] = { ...summarize(times), bytes };
      console.log(
        `MEASURE ${name} ${JSON.stringify(report.measurements[name])}`,
      );
      assert.ok(
        report.measurements[name].p95Ms < (name === "largePlan" ? 150 : 100),
        `${name} exceeded read budget`,
      );
    }
    // The map needs both calls; the list contract deliberately carries profiles.
    const mapTimes = [];
    for (let i = 0; i < 40; i++) {
      if (i % 10 === 0) await clearBenchmarkQuotas();
      const t = performance.now();
      const fields = (await http("/fields", { schema: schemas.FieldPage }))
        .data;
      await Promise.all(
        fields.items.map((field) =>
          http(`/fields/${field.id}/boundary`, {
            schema: schemas.BoundaryEnvelope,
          }),
        ),
      );
      mapTimes.push(performance.now() - t);
    }
    report.measurements.fieldListWithBoundaries = summarize(mapTimes);
    if (!caps.fieldBoundaries.available)
      skip(
        "field-boundary tiles: disabled by default; no country dataset imported",
      );
    // Full intake verification, same P8 workload: format 1 / real immutable
    // release, 45 illustrative submissions across three guests, no engine jobs.
    const intakePort = await freePort();
    const intakeApi = await createApi(
      loadConfig({
        ...env,
        API_PORT: String(intakePort),
        PLANNING_ENABLED: "false",
        AUTH_ENABLED: "false",
        OBSERVATIONS_ENABLED: "false",
      }),
    );
    try {
      await intakeApi.app.listen(intakePort, "127.0.0.1");
      const intakeOrigin = `http://127.0.0.1:${intakePort}`;
      const intakeHttp = async (path, body, accessToken) => {
        const res = await fetch(intakeOrigin + "/api/v1" + path, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": testIp,
            ...(accessToken
              ? {
                  authorization: `Bearer ${accessToken}`,
                  "idempotency-key": randomUUID(),
                }
              : {}),
          },
          body: JSON.stringify(body),
        });
        assert.equal(res.status, path === "/plan-sessions" ? 201 : 202);
        const data = await res.json();
        if (path === "/plan-sessions")
          await db.trackSession?.(data.accessToken);
        (path === "/plan-sessions"
          ? contracts.ownerSessionSchema
          : schemas.PlanSubmitted
        ).parse(data);
        return data;
      };
      const intakeStart = performance.now(),
        ids = [];
      for (let s = 0; s < 3; s++) {
        const session = await intakeHttp("/plan-sessions", {});
        for (let batch = 0; batch < 3; batch++)
          await Promise.all(
            Array.from({ length: 5 }, async () => {
              const accepted = await intakeHttp(
                "/plans",
                syntheticPlanInput(),
                session.accessToken,
              );
              ids.push(accepted.id);
            }),
          );
      }
      await poll(
        async () =>
          Number(
            (
              await db.pool.query(
                "SELECT count(*) n FROM plan_requests WHERE id=ANY($1::uuid[]) AND status='completed'",
                [ids],
              )
            ).rows[0].n,
          ) === 45,
        { label: "45 intakes", timeout: 30000, interval: 100 },
      );
      const seconds = (performance.now() - intakeStart) / 1000;
      report.measurements.intake = {
        plans: 45,
        seconds,
        plansPerSecond: 45 / seconds,
      };
      pass(`intake throughput ${JSON.stringify(report.measurements.intake)}`);
    } finally {
      await intakeApi.close();
    }
  }
  if (realClimate) {
    report.regions = [];
    for (const [name, latitude, longitude, regionId] of [
      ["Souss-Massa", 30.4, -9.6, "ma-souss-massa"],
      ["Gharb", 34.3, -6.3, "ma-rabat-sale-kenitra"],
      ["Oriental", 34.7, -1.9, "ma-oriental"],
    ]) {
      await clearBenchmarkQuotas();
      const regionalInput = structuredClone(request);
      delete regionalInput.field_id;
      delete regionalInput.current_rotation;
      regionalInput.location = { latitude, longitude };
      regionalInput.history = { status: "unknown" };
      regionalInput.crop_health = { status: "unknown" };
      regionalInput.preferences.mode = "suggest";
      regionalInput.preferences.considered_crop_ids = [];
      const queued = (
        await http("/plans", {
          method: "POST",
          body: regionalInput,
          key: randomUUID(),
          expected: 202,
          schema: schemas.PlanSubmitted,
        })
      ).data;
      const regional = (await completed(queued.id)).result;
      assert.ok(
        regional.context.regionIds.includes(regionId),
        `${name} must resolve ${regionId}`,
      );
      assert.ok(
        regional.candidates.length > 0,
        `${name} must rank applicable crops`,
      );
      const localIds = regional.context.regionIds.filter(
        (id) => id !== "morocco-general",
      );
      const nationalOnlyEssentials = regional.crops
        .filter((c) => c.status === "schedulable")
        .flatMap((c) => {
          const profile = catalog.profiles.find((p) => p.id === c.cropId);
          const metrics = ["planting_window", "cycle_duration"].filter(
            (metric) => {
              const rules = profile.rules.filter(
                (r) =>
                  r.metric === metric &&
                  r.severity !== "reference" &&
                  r.verification.status !== "extracted",
              );
              return (
                rules.some((r) =>
                  r.scope.regionIds.includes("morocco-general"),
                ) &&
                !rules.some((r) =>
                  r.scope.regionIds.some((id) => localIds.includes(id)),
                )
              );
            },
          );
          return metrics.length ? [{ cropId: c.cropId, metrics }] : [];
        });
      const entry = {
        name,
        location: regionalInput.location,
        regionIds: regional.context.regionIds,
        rankedCrops: [
          ...new Set(
            regional.candidates.flatMap((c) => c.slots.map((s) => s.cropId)),
          ),
        ],
        top: regional.candidates.slice(0, 3).map((c) => ({
          rank: c.rank,
          crops: c.slots.map((s) => s.cropId),
          loss: c.weightedLoss,
        })),
        schedulable: regional.crops.filter((c) => c.status === "schedulable")
          .length,
        nationalOnlyEssentials,
        notApplicable: regional.crops
          .filter((c) =>
            c.reasons.some((r) => r.code === "CROP_NOT_APPLICABLE_IN_REGION"),
          )
          .map((c) => c.cropId),
        unsupported: regional.crops
          .filter((c) => c.status === "unsupported_for_plan")
          .map((c) => c.cropId),
        otherGaps: regional.crops
          .filter((c) => c.status === "insufficient_evidence")
          .map((c) => ({
            cropId: c.cropId,
            codes: [
              ...new Set(
                c.reasons.filter((r) => r.effect === "gap").map((r) => r.code),
              ),
            ],
          })),
        outcome: regional.outcome,
        futureClimate: regional.futureClimate.status,
        futureClimateReason: regional.futureClimate.reason,
        nearTerm: regional.futureClimate.nearTerm.status,
        nearTermReason: regional.futureClimate.nearTerm.reason,
        worlds: regional.futureClimate.worlds,
        nearTermWorlds: regional.futureClimate.nearTerm.worlds,
      };
      report.regions.push(entry);
      pass(
        `${name}: resolved ${regionId}, ${entry.schedulable} schedulable, ${entry.rankedCrops.length} crops in ranked candidates; national-only essentials ${nationalOnlyEssentials.length}`,
      );
    }
    report.measurements.engine = worker.output.split("\n").flatMap((line) => {
      try {
        const e = JSON.parse(line);
        return e.event === "rotation_engine_finished" ? [e] : [];
      } catch {
        return [];
      }
    });
  }
  // Account transport is real, but delivery stays in disposable Mailpit.
  const email = realClimate
    ? `backend-${randomUUID()}@example.invalid`
    : "backend-e2e@example.invalid";
  db.registerAccount?.(email);
  const authPost = async (path, body) =>
    fetch(origin + "/api/auth/" + path, {
      method: "POST",
      headers: {
        origin,
        "content-type": "application/json",
        "x-forwarded-for": testIp,
      },
      body: JSON.stringify(body),
      redirect: "manual",
    });
  assert.equal(
    (
      await authPost("sign-up/email", {
        name: "Backend test account",
        email,
        password: TEST_PASSWORD,
      })
    ).status,
    200,
  );
  const mail = await poll(() => inbox.message(email), {
    label: "worker verification email",
    timeout: 20000,
  });
  const link = mail.Text.match(/https?:\/\/[^\s]+/)[0];
  assert.ok(link.startsWith(origin + "/"));
  assert.ok(
    [200, 302].includes(
      (
        await fetch(link, {
          redirect: "manual",
          headers: { "x-forwarded-for": testIp },
        })
      ).status,
    ),
  );
  const login = await authPost("sign-in/email", {
    email,
    password: TEST_PASSWORD,
  });
  assert.equal(login.status, 200);
  cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.ok(cookie);
  await http(`/plans/${accepted.id}/claim`, {
    method: "POST",
    body: { confirm: true },
    expected: 201,
    account: true,
    extra: { authorization: `Bearer ${token}` },
    schema: schemas.PlanClaimed,
  });
  if (realClimate) await db.trackAccount?.(email);
  await http(`/plans/${accepted.id}`, { expected: 404 });
  await http(`/plans/${accepted.id}`, {
    account: true,
    schema: contracts.rotationPlanningStatusSchema,
  });
  pass(
    "verified account via disposable SMTP → guest plan claim → guest loses access, account reads unchanged result",
  );
  await http(base, { expected: 404 });
  await http(base, { account: true, schema: schemas.FieldRecord });
  assert.deepEqual(
    (
      await http(base + "/boundary", {
        account: true,
        schema: schemas.BoundaryEnvelope,
      })
    ).data.boundary.boundary,
    f.boundary,
  );
  pass(
    "first plan claim atomically moves all guest fields and their boundaries to the account; no separate field-claim endpoint",
  );
  await http(`/plans/${accepted.id}`, {
    method: "DELETE",
    expected: 204,
    account: true,
  });
  await http(`/plans/${what.id}`, { method: "DELETE", expected: 204 });
  await http(base, { method: "DELETE", expected: 204, account: true });
  await http(base, { expected: 404 });
  pass("owned plan and field deletion");
} catch (error) {
  report.failure = error.message;
  throw error;
} finally {
  if (worker) await stop(worker);
  await api?.close();
  inbox?.close();
  await db.close();
  if (realClimate && worker)
    report.measurements.engine = worker.output.split("\n").flatMap((line) => {
      try {
        const event = JSON.parse(line);
        return event.event === "rotation_engine_finished" ? [event] : [];
      } catch {
        return [];
      }
    });
  report.seconds = (performance.now() - started) / 1000;
  const out = process.env.BACKEND_E2E_REPORT;
  if (out) writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  console.log(`BACKEND_E2E_REPORT ${JSON.stringify(report)}`);
}
