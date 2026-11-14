import { test, expect } from "@jest/globals";
import {
  planRequestSchema,
  planStatusSchema,
} from "../../packages/contracts/dist/index.js";
import {
  requestIdentity,
  validateIntakeDates,
} from "../../apps/server/dist/modules/plans/application/plan-policy.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { syntheticPlanInput } from "../support/plans.mjs";
test("unknown states and unsupported crops stay explicit with unrestricted valid coordinates", () => {
  const input = syntheticPlanInput();
  input.location = { latitude: -33.86, longitude: 151.21 };
  const parsed = planRequestSchema.parse(input);
  expect(parsed.soil).toEqual({ status: "unknown" });
  expect(parsed.preferences.considered_next_crop_ids).toContain(
    "unsupported-crop",
  );
  input.preferences = {
    mode: "suggest",
    considered_next_crop_ids: [],
    excluded_crop_ids: [],
    priority: "soil_health",
  };
  expect(planRequestSchema.safeParse(input).success).toBe(true);
});
const invalidCases = [
  ["invalid coordinate", (v) => (v.location.latitude = 91)],
  [
    "impossible calendar date",
    (v) => (v.planning.earliest_start_date = "2027-02-29"),
  ],
  [
    "timestamp replacing date",
    (v) => (v.planning.earliest_start_date = "2026-10-01T00:00:00Z"),
  ],
  [
    "reversed planting window",
    (v) => (v.planning.latest_start_date = "1900-01-01"),
  ],
  ["unbounded search", (v) => (v.planning.search_end_date = "2100-12-31")],
  ["wrong cycle count", (v) => (v.planning.cycles = 3)],
  [
    "duplicate considered crops",
    (v) =>
      (v.preferences.considered_next_crop_ids = ["faba-bean", "faba-bean"]),
  ],
  [
    "considered and excluded crop",
    (v) => (v.preferences.excluded_crop_ids = ["faba-bean"]),
  ],
  [
    "empty considered mode",
    (v) => (v.preferences.considered_next_crop_ids = []),
  ],
  ["suggest mode with choices", (v) => (v.preferences.mode = "suggest")],
  ["extra nested property", (v) => (v.location.api_key = "do not persist")],
  ["synthetic marker passed into API contract", (v) => (v.synthetic = true)],
  [
    "reversed history",
    (v) => (v.history.entries[0].harvested_on = "2024-01-01"),
  ],
  [
    "history overlapping planting",
    (v) => (v.history.entries[0].harvested_on = v.planning.earliest_start_date),
  ],
  [
    "overlapping history entries",
    (v) =>
      v.history.entries.push({
        crop_id: "faba-bean",
        planted_on: "2025-01-01",
        harvested_on: "2025-05-01",
      }),
  ],
  [
    "farmer report called confirmed",
    (v) => (v.crop_health.observations[0].confirmation = "confirmed"),
  ],
  [
    "control character in observation",
    (v) => (v.crop_health.observations[0].name = "bad\u0000text"),
  ],
  [
    "unknown contains invented value",
    (v) => (v.water.availability = "rainfed"),
  ],
  [
    "wrong pH unit",
    (v) =>
      (v.soil = {
        status: "known",
        observations: [
          {
            metric: "ph",
            value: 7,
            unit: "mm",
            method: "water",
            measured_on: null,
            source: "laboratory_report",
          },
        ],
      }),
  ],
  [
    "missing soil measurement method",
    (v) =>
      (v.soil = {
        status: "known",
        observations: [
          {
            metric: "ph",
            value: 7,
            unit: "pH",
            measured_on: null,
            source: "laboratory_report",
          },
        ],
      }),
  ],
  [
    "duplicate observations",
    (v) =>
      v.crop_health.observations.push({ ...v.crop_health.observations[0] }),
  ],
  [
    "too many choices",
    (v) =>
      (v.preferences.considered_next_crop_ids = Array.from(
        { length: 11 },
        (_, i) => "crop-" + i,
      )),
  ],
];
test.each(invalidCases)("rejects %s", (_, edit) => {
  const v = syntheticPlanInput();
  edit(v);
  expect(planRequestSchema.safeParse(v).success).toBe(false);
});
test("leap dates, uncertain history dates, sourced soil method and reported water are representable", () => {
  const v = syntheticPlanInput();
  v.history.entries[0] = {
    crop_id: "durum-wheat",
    planted_on: "2024-02-29",
    harvested_on: null,
  };
  v.soil = {
    status: "known",
    observations: [
      {
        metric: "ph",
        value: 7,
        unit: "pH",
        method: "unknown",
        measured_on: null,
        source: "laboratory_report",
      },
    ],
  };
  v.water = { status: "reported", availability: "irrigation_limited" };
  expect(planRequestSchema.safeParse(v).success).toBe(true);
});
test("normalized object/selection/observation ordering and trimmed text retain input identity", () => {
  const v = syntheticPlanInput();
  const changed = structuredClone(v);
  changed.preferences.considered_next_crop_ids.reverse();
  changed.crop_health.observations[0].name =
    "  " + changed.crop_health.observations[0].name + "  ";
  expect(requestIdentity(changed).hash).toBe(requestIdentity(v).hash);
  changed.water = { status: "reported", availability: "rainfed" };
  expect(requestIdentity(changed).hash).not.toBe(requestIdentity(v).hash);
});
test("acceptance policy rejects past starts, future observations and excessive first-year planting range", () => {
  const v = syntheticPlanInput(),
    today = new Date().toISOString().slice(0, 10);
  expect(validateIntakeDates(v, today)).toBe(true);
  v.crop_health.observations[0].observed_on = "2099-01-01";
  expect(validateIntakeDates(v, today)).toBe(false);
  v.crop_health = { status: "unknown" };
  v.planning.earliest_start_date = "2000-01-01";
  expect(validateIntakeDates(v, today)).toBe(false);
});
test("production cannot enable controlled intake faults", () => {
  expect(() =>
    loadConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://x:x@localhost/x",
      PLANS_ENABLED: "true",
      TEST_PLAN_WORKER_FAULT: "pause",
    }),
  ).toThrow("CONFIG_INVALID");
});
test("a fully populated response rejects absent result and mismatched stage", () => {
  const v = {
    id: "00000000-0000-4000-8000-000000000001",
    status: "completed",
    stage: "intake_complete",
    createdAt: "2026-09-27T00:00:00.000Z",
    updatedAt: "2026-09-27T00:00:00.000Z",
    expiresAt: "2026-09-28T00:00:00.000Z",
    attempts: 1,
    input: syntheticPlanInput(),
    evidence: {
      catalogSnapshotId: "00000000-0000-4000-8000-000000000002",
      catalogId: "synthetic-catalog",
      catalogVersion: "0.1.0",
      catalogSha256: "a".repeat(64),
      intakeVersion: "1",
      policyVersion: "intake-policy-1",
      weatherSnapshotIds: [],
      engineVersion: null,
      rankingVersion: null,
    },
    result: {
      kind: "request_intake",
      requestIntegrity: "verified",
      catalogIntegrity: "verified",
      planning: "not_implemented",
      recommendations: null,
      weather: "not_requested",
    },
    error: null,
  };
  expect(planStatusSchema.safeParse(v).success).toBe(true);
  expect(planStatusSchema.safeParse({ ...v, result: null }).success).toBe(
    false,
  );
  expect(
    planStatusSchema.safeParse({ ...v, stage: "awaiting_intake" }).success,
  ).toBe(false);
});

test("plan labels are transport metadata and reject all control characters", async () => {
  const {
    planCreateRequestSchema,
    rotationPlanCreateRequestSchema,
    planLabelRequestSchema,
    planRequestV2Schema,
  } = await import("../../packages/contracts/dist/index.js");
  const { rotationRequest } = await import("../support/rotation.mjs");
  for (const [schema, calculation, input] of [
    [planCreateRequestSchema, planRequestSchema, syntheticPlanInput()],
    [rotationPlanCreateRequestSchema, planRequestV2Schema, rotationRequest()],
  ]) {
    const { label, ...parsed } = schema.parse({
      ...input,
      label: "حقل / Parcelle",
    });
    expect(label).toBe("حقل / Parcelle");
    expect(parsed).toEqual(calculation.parse(input));
    expect(calculation.safeParse({ ...input, label }).success).toBe(false);
    expect(schema.safeParse({ ...input, label: "x".repeat(80) }).success).toBe(
      true,
    );
    for (const bad of [
      "x".repeat(81),
      "\nfield",
      "field\t",
      "a\u0000b",
      "a\u007fb",
      "a\u0085b",
      null,
      1,
    ])
      expect(schema.safeParse({ ...input, label: bad }).success).toBe(false);
  }
  expect(planLabelRequestSchema.parse({ label: null })).toEqual({
    label: null,
  });
  expect(planLabelRequestSchema.parse({ label: "" })).toEqual({ label: "" });
  expect(planLabelRequestSchema.safeParse({}).success).toBe(false);
  expect(
    planLabelRequestSchema.safeParse({ label: "ok", extra: true }).success,
  ).toBe(false);
});

test("list summary uses declared crops and existing strategy rank, with explicit legacy nulls", async () => {
  const { planSummary } =
    await import("../../apps/server/dist/modules/plans/application/plan-summary.js");
  const { rotationRequest } = await import("../support/rotation.mjs");
  expect(planSummary(syntheticPlanInput(), "completed", null)).toEqual({
    fieldId: null,
    cropIds: null,
    horizonYears: null,
    topStrategyCropIds: null,
    whatIf: false,
  });
  const input = rotationRequest({
    current_rotation: {
      crop_ids: ["synthetic-crop-02", "synthetic-crop-01", "synthetic-crop-02"],
    },
  });
  const result = {
    strategies: {
      items: [
        { rank: 2, cropIds: ["synthetic-crop-02"] },
        { rank: 1, cropIds: ["synthetic-crop-01", "synthetic-crop-02"] },
      ],
    },
  };
  const summary = planSummary(input, "completed", result);
  expect(summary.cropIds).toEqual(input.current_rotation.crop_ids);
  expect(summary.topStrategyCropIds).toEqual(
    result.strategies.items[1].cropIds,
  );
  expect(planSummary(input, "queued", result).topStrategyCropIds).toBeNull();
  expect(
    planSummary(input, "completed", { candidates: [] }).topStrategyCropIds,
  ).toBeNull();
});

test("capabilities uses validated configuration and defaults field detection off", async () => {
  const { capabilities } =
    await import("../../apps/server/dist/modules/health/capabilities.js");
  const config = loadConfig({
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://x:x@localhost/x",
  });
  expect(capabilities(config)).toMatchObject({
    version: "1",
    plans: false,
    auth: { email: false, google: false },
    observations: false,
    weather: false,
    cropHealth: { available: false, reason: "AI_NOT_CONFIGURED" },
    climateScenarios: false,
    fieldDetection: { available: false },
    catalog: {
      id: config.PLAN_CATALOG_ID,
      version: config.PLAN_CATALOG_VERSION,
    },
  });
});
