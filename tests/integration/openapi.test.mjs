import { beforeAll, afterAll, test, expect } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { disposable } from "../support/database.mjs";
import { syntheticPlanInput } from "../support/plans.mjs";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  buildOpenApiDocument,
  openApiOperations,
  openApiComponents,
  glossaryResponseSchema,
  healthSchema,
  catalogOptionsSchema,
  cropHealthStatusSchema,
  weatherCapabilitiesSchema,
  authCapabilitiesSchema,
  ownerSessionSchema,
  planSubmittedSchema,
  planStatusSchema,
  fieldRecordSchema,
  fieldPageSchema,
  historyRecordSchema,
  historyPageSchema,
  boundaryRecordSchema,
  boundaryEnvelopeSchema,
  observationListSchema,
  extractionListSchema,
  vegetationAnalysisResponseSchema,
  vegetationHistoryResponseSchema,
  canopyBiomassResponseSchema,
  waterStorageResponseSchema,
  errorBodySchema,
} from "../../packages/contracts/dist/index.js";

let db, api, config, token;
beforeAll(async () => {
  db = await disposable();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  // Every optional feature on, so every route is registered. Synthetic values:
  // no worker runs here, so no provider is contacted and no mail is sent.
  config = loadConfig({
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: db.url,
    PLANS_ENABLED: "true",
    AUTH_ENABLED: "true",
    AUTH_SECRET: "synthetic-auth-secret-07-" + randomUUID(),
    AUTH_BASE_URL: "http://127.0.0.1:3000",
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "1025",
    SMTP_TLS: "local",
    MAIL_FROM: "rotavise@example.invalid",
    OBSERVATIONS_ENABLED: "true",
    EARTHDATA_USERNAME: "synthetic-user",
    EARTHDATA_PASSWORD: "synthetic-password-not-real",
    WEATHER_ENABLED: "true",
    WEATHER_INTERNAL_TOKEN: "synthetic-internal-token-" + "x".repeat(24),
    FIELD_BOUNDARIES_ENABLED: "true",
  });
  api = await createApi(config);
  await api.app.getHttpAdapter().getInstance().ready();
});
afterAll(async () => {
  await api?.close();
  await db?.close();
});

const call = (method, url, { body, headers = {} } = {}) =>
  api.app.inject({
    method,
    url,
    headers: {
      ...(token ? { authorization: "Bearer " + token } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { payload: JSON.stringify(body) } : {}),
  });
const valid = (schema, response, status) => {
  expect([response.statusCode, response.body.slice(0, 300)]).toEqual([
    status,
    expect.any(String),
  ]);
  const parsed = schema.safeParse(response.json());
  expect([parsed.success, parsed.error?.issues.slice(0, 3)]).toEqual([
    true,
    undefined,
  ]);
  return parsed.data;
};

test("every route the server registers is in the OpenAPI document, and every operation is a real route", () => {
  const document = buildOpenApiDocument();
  const documented = new Set(
    Object.entries(document.paths).flatMap(([path, methods]) =>
      Object.keys(methods).map((m) => `${m.toUpperCase()} ${path}`),
    ),
  );
  const open = (url) => url.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
  const registered = new Set(
    api.routes
      .filter(
        (r) =>
          (r.url.startsWith("/api/v1/") || r.url.startsWith("/health/")) &&
          // Left out on purpose: the internal weather route and the
          // development test jobs; both are off in production.
          !r.url.startsWith("/api/v1/internal/") &&
          !r.url.startsWith("/api/v1/dev/") &&
          !["HEAD", "OPTIONS"].includes(r.method),
      )
      .map((r) => `${r.method} ${open(r.url)}`),
  );
  expect([...registered].filter((r) => !documented.has(r)).sort()).toEqual([]);
  expect([...documented].filter((d) => !registered.has(d)).sort()).toEqual([]);
  expect(documented.size).toBe(openApiOperations.length);
});

test("the server serves the same document with an ETag", async () => {
  const response = await call("GET", "/api/v1/openapi.json");
  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toContain("application/json");
  expect(response.json()).toEqual(
    JSON.parse(JSON.stringify(buildOpenApiDocument())),
  );
  const again = await call("GET", "/api/v1/openapi.json", {
    headers: { "if-none-match": response.headers.etag },
  });
  expect(again.statusCode).toBe(304);
  expect((await call("GET", "/api/v1/openapi.json?x=1")).statusCode).toBe(400);
});

test("the glossary is served in four languages, can be narrowed, and refuses unknown choices", async () => {
  const etags = new Set();
  let keys;
  for (const [lang, direction] of [
    ["en", "ltr"],
    ["fr", "ltr"],
    ["ar", "rtl"],
    ["ary", "rtl"],
  ]) {
    const response = await call("GET", `/api/v1/glossary?lang=${lang}`);
    const doc = valid(glossaryResponseSchema, response, 200);
    expect(doc.language).toBe(lang);
    expect(doc.direction).toBe(direction);
    expect(response.headers["content-language"]).toBe(lang);
    expect(doc.languages).toEqual(["en", "fr", "ar", "ary"]);
    expect(doc.provenance.text).toBe(
      lang === "en"
        ? "model_written_unreviewed"
        : "model_translated_unreviewed",
    );
    const languageKeys = doc.entries.map((e) => [e.group, e.code]);
    if (keys) expect(languageKeys).toEqual(keys);
    else keys = languageKeys;
    expect(doc.entries.length).toBeGreaterThan(0);
    for (const entry of doc.entries) {
      expect(entry.term.trim().length).toBeGreaterThan(0);
      expect(entry.meaning.trim().length).toBeGreaterThan(0);
    }
    etags.add(response.headers.etag);
    expect(
      (
        await call("GET", `/api/v1/glossary?lang=${lang}`, {
          headers: { "if-none-match": response.headers.etag },
        })
      ).statusCode,
    ).toBe(304);
  }
  expect(etags.size).toBe(4);
  for (const lang of ["en", "fr", "ar", "ary"]) {
    const roles = valid(
      glossaryResponseSchema,
      await call("GET", `/api/v1/glossary?lang=${lang}&group=role`),
      200,
    );
    expect(roles.groups).toEqual(["role"]);
    expect(roles.entries).toHaveLength(4);
    expect(
      roles.entries.every(
        (e) =>
          e.evidence.status === "sourced" &&
          e.evidence.citations.every(
            (c) => c.quote && c.sourceSha256 && c.url.startsWith("https://"),
          ),
      ),
    ).toBe(true);
  }
  const darijaErrors = valid(
    glossaryResponseSchema,
    await call("GET", "/api/v1/glossary?lang=ary&group=error"),
    200,
  );
  expect(darijaErrors.language).toBe("ary");
  expect(darijaErrors.direction).toBe("rtl");
  expect(darijaErrors.groups).toEqual(["error"]);
  expect(darijaErrors.entries.every((e) => e.group === "error")).toBe(true);
  const fallback = valid(
    glossaryResponseSchema,
    await call("GET", "/api/v1/glossary"),
    200,
  );
  expect(fallback.language).toBe("en");
  const errors = valid(
    glossaryResponseSchema,
    await call("GET", "/api/v1/glossary?lang=fr&group=error"),
    200,
  );
  expect(errors.groups).toEqual(["error"]);
  const etag = (await call("GET", "/api/v1/glossary?lang=fr")).headers.etag;
  expect(
    (
      await call("GET", "/api/v1/glossary?lang=fr", {
        headers: { "if-none-match": etag },
      })
    ).statusCode,
  ).toBe(304);
  for (const bad of ["lang=de", "group=nothing", "extra=1", "lang=en&lang=fr"])
    expect((await call("GET", `/api/v1/glossary?${bad}`)).statusCode).toBe(400);
});

test("real responses match the schemas the document names", async () => {
  valid(healthSchema, await call("GET", "/api/v1/health/ready"), 200);
  valid(
    authCapabilitiesSchema,
    await call("GET", "/api/v1/auth/capabilities"),
    200,
  );
  valid(
    weatherCapabilitiesSchema,
    await call("GET", "/api/v1/weather/capabilities"),
    200,
  );
  valid(
    catalogOptionsSchema,
    await call("GET", "/api/v1/catalog/options"),
    200,
  );
  valid(
    cropHealthStatusSchema,
    await call("GET", "/api/v1/crop-health/status"),
    200,
  );

  const session = valid(
    ownerSessionSchema,
    await call("POST", "/api/v1/plan-sessions", { body: {} }),
    201,
  );
  token = session.accessToken;

  const profile = {
    schema_version: "1",
    name: "Synthetic test field",
    location: { latitude: 32.4, longitude: -6.55 },
    soil: { status: "unknown" },
    water: { status: "unknown" },
    crop_health: { status: "unknown" },
  };
  const field = valid(
    fieldRecordSchema,
    await call("POST", "/api/v1/fields", { body: profile }),
    201,
  );
  valid(
    fieldRecordSchema,
    await call("GET", `/api/v1/fields/${field.id}`),
    200,
  );
  const listed = valid(
    fieldPageSchema,
    await call("GET", "/api/v1/fields"),
    200,
  );
  expect(listed.items.map((f) => f.id)).toContain(field.id);
  valid(
    fieldRecordSchema,
    await call("PUT", `/api/v1/fields/${field.id}`, {
      body: {
        expectedVersion: field.version,
        profile: { ...profile, name: "Renamed field" },
      },
    }),
    200,
  );

  valid(
    boundaryEnvelopeSchema,
    await call("GET", `/api/v1/fields/${field.id}/boundary`),
    200,
  );
  valid(
    boundaryRecordSchema,
    await call("PUT", `/api/v1/fields/${field.id}/boundary`, {
      body: {
        expectedVersion: null,
        boundary: {
          type: "Polygon",
          coordinates: [
            [
              [-6.5503, 32.3998],
              [-6.5496, 32.3998],
              [-6.5496, 32.4004],
              [-6.5503, 32.4004],
              [-6.5503, 32.3998],
            ],
          ],
        },
      },
    }),
    200,
  );

  const entry = valid(
    historyRecordSchema,
    await call("POST", `/api/v1/fields/${field.id}/history`, {
      body: {
        schema_version: "1",
        crop_id: "durum-wheat",
        planted_on: "2024-11-15",
        harvested_on: "2025-06-10",
      },
    }),
    201,
  );
  const history = valid(
    historyPageSchema,
    await call("GET", `/api/v1/fields/${field.id}/history`),
    200,
  );
  expect(history.items.map((e) => e.id)).toContain(entry.id);

  valid(
    observationListSchema,
    await call("GET", `/api/v1/fields/${field.id}/observations`),
    200,
  );
  valid(
    extractionListSchema,
    await call("GET", `/api/v1/fields/${field.id}/extractions`),
    200,
  );
  valid(
    vegetationAnalysisResponseSchema,
    await call("GET", `/api/v1/fields/${field.id}/analysis/vegetation`),
    200,
  );
  valid(
    vegetationHistoryResponseSchema,
    await call("GET", `/api/v1/fields/${field.id}/analysis/vegetation-history`),
    200,
  );
  valid(
    canopyBiomassResponseSchema,
    await call("GET", `/api/v1/fields/${field.id}/canopy-biomass`),
    200,
  );
  valid(
    waterStorageResponseSchema,
    await call("GET", `/api/v1/fields/${field.id}/water-storage`),
    200,
  );

  const submitted = valid(
    planSubmittedSchema,
    await call("POST", "/api/v1/plans", {
      body: syntheticPlanInput(),
      headers: { "idempotency-key": randomUUID() },
    }),
    202,
  );
  valid(
    planStatusSchema,
    await call("GET", `/api/v1/plans/${submitted.id}`),
    200,
  );

  // Errors are the documented body, with a code the glossary explains.
  const missing = await call("GET", `/api/v1/fields/${randomUUID()}`);
  expect(missing.statusCode).toBe(404);
  expect(errorBodySchema.parse(missing.json()).code).toBe("NOT_FOUND");
  const unsigned = await api.app.inject("/api/v1/fields");
  expect(unsigned.statusCode).toBe(401);
  expect(errorBodySchema.parse(unsigned.json()).code).toBe("UNAUTHORIZED");

  expect(Object.keys(openApiComponents)).toContain("PlanSubmitted");
});

test("public capabilities reflects every feature switch, credential pairing and the AI budget without contacting providers", async () => {
  const { capabilitiesSchema } =
    await import("../../packages/contracts/dist/index.js");
  const base = {
    ...config,
    PLANS_ENABLED: "false",
    PLANNING_ENABLED: "false",
    AUTH_ENABLED: "false",
    OBSERVATIONS_ENABLED: "false",
    WEATHER_ENABLED: "false",
    CLIMATE_SCENARIOS_ENABLED: "false",
    FIELD_DETECTION_ENABLED: "false",
    FIELD_BOUNDARIES_ENABLED: "false",
    ANTHROPIC_API_KEY: undefined,
  };
  const cases = [
    [
      base,
      {
        plans: false,
        auth: { email: false, google: false },
        observations: false,
        weather: false,
        cropHealth: { available: false, reason: "AI_NOT_CONFIGURED" },
        climateScenarios: false,
        fieldDetection: { available: false },
        catalog: { version: config.PLAN_CATALOG_VERSION },
      },
    ],
    [
      { ...base, PLANS_ENABLED: "true" },
      { plans: true, cropHealth: { available: false } },
    ],
    [
      { ...base, AUTH_ENABLED: "true" },
      { auth: { email: true, google: false } },
    ],
    [
      {
        ...base,
        AUTH_ENABLED: "true",
        GOOGLE_CLIENT_ID: "synthetic-google-client",
        GOOGLE_CLIENT_SECRET: "synthetic-google-secret",
      },
      { auth: { email: true, google: true } },
    ],
    [
      { ...base, PLANS_ENABLED: "true", OBSERVATIONS_ENABLED: "true" },
      { observations: true },
    ],
    [{ ...base, WEATHER_ENABLED: "true" }, { weather: true }],
    [
      {
        ...base,
        PLANS_ENABLED: "true",
        ANTHROPIC_API_KEY: "synthetic-unused-key",
      },
      { cropHealth: { available: true, reason: null } },
    ],
    [
      {
        ...base,
        PLANS_ENABLED: "true",
        ANTHROPIC_API_KEY: "synthetic-unused-key",
        AI_DAILY_REQUEST_LIMIT: "0",
      },
      { cropHealth: { available: false, reason: "AI_NOT_CONFIGURED" } },
    ],
    [
      {
        ...base,
        PLANS_ENABLED: "true",
        PLANNING_ENABLED: "true",
        CLIMATE_SCENARIOS_ENABLED: "true",
      },
      {
        climateScenarios: true,
        catalog: { version: config.ROTATION_CATALOG_VERSION },
      },
    ],
    [
      { ...base, FIELD_DETECTION_ENABLED: "true" },
      { fieldDetection: { available: true } },
    ],
    [
      { ...base, FIELD_BOUNDARIES_ENABLED: "true" },
      { fieldBoundaries: { available: false } },
    ],
    [
      { ...base, FIELD_BOUNDARIES_ENABLED: "true", PLANS_ENABLED: "true" },
      { fieldBoundaries: { available: true } },
    ],
  ];
  for (const [settings, expected] of cases) {
    const instance = await createApi(loadConfig(settings));
    try {
      await instance.app.getHttpAdapter().getInstance().ready();
      const response = await instance.app.inject("/api/v1/capabilities");
      const result = valid(capabilitiesSchema, response, 200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(result).toMatchObject(expected);
      expect(result.glossaryVersion).toBe(
        (await instance.app.inject("/api/v1/glossary")).json().version,
      );
      expect(result.catalog.id).toBe(config.PLAN_CATALOG_ID);
      expect(JSON.stringify(result)).not.toContain("synthetic-unused-key");
      expect(
        (await instance.app.inject("/api/v1/capabilities?extra=1")).statusCode,
      ).toBe(400);
    } finally {
      await instance.close();
    }
  }
});
