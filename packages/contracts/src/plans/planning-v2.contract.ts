import { rotationAnalysisContextSchema } from "../engine/rotation-outputs.contract.js";
import { z } from "zod";
import { catalogBundleV2Schema } from "../catalog/catalog-v2.contract.js";
import {
  rotationAssessmentSchema,
  rotationPolicyV1Schema,
  rotationPolicyV2Schema,
} from "../engine/rotation.contract.js";
import { planEvidenceSchema, planLabelSchema } from "./plan.contract.js";
import { planRequestV2Schema } from "./plan-v2.contract.js";
import { calendarDateSchema } from "../weather/weather.contract.js";

const hash = z.string().regex(/^[a-f0-9]{64}$/);
const fixtureSchema = z
  .strictObject({ catalog: catalogBundleV2Schema, catalogSha256: hash })
  .nullable();
// Pinned at acceptance; the worker runs exactly these versions or fails.
// Workflow 2 (Step 10) results stay readable; new requests use workflow 3.
export const rotationPlanningVersionsSchema = z.union([
  z.strictObject({
    workflowVersion: z.literal("planning-workflow-2"),
    engineVersion: z.literal("rotation-engine-3"),
    // Acceptance date: reruns assess against the same "today".
    assessedOn: calendarDateSchema,
    policy: rotationPolicyV1Schema,
    syntheticFixture: fixtureSchema,
  }),
  z.strictObject({
    workflowVersion: z.literal("planning-workflow-3"),
    engineVersion: z.literal("rotation-engine-4"),
    assessedOn: calendarDateSchema,
    policy: rotationPolicyV2Schema,
    syntheticFixture: fixtureSchema,
  }),
  z.strictObject({
    workflowVersion: z.literal("planning-workflow-4"),
    engineVersion: z.literal("rotation-engine-5"),
    assessedOn: calendarDateSchema,
    policy: rotationPolicyV2Schema,
    syntheticFixture: fixtureSchema,
  }),
  z.strictObject({
    workflowVersion: z.literal("planning-workflow-5"),
    engineVersion: z.literal("rotation-engine-6"),
    assessedOn: calendarDateSchema,
    policy: rotationPolicyV2Schema,
    syntheticFixture: fixtureSchema,
  }),
  // Workflow 6 (Step 15): engine 7 adds the current-rotation comparison.
  z.strictObject({
    workflowVersion: z.literal("planning-workflow-6"),
    analysisContext: rotationAnalysisContextSchema.optional(),
    engineVersion: z.literal("rotation-engine-7"),
    assessedOn: calendarDateSchema,
    policy: rotationPolicyV2Schema,
    syntheticFixture: fixtureSchema,
  }),
]);
export type RotationPlanningVersions = z.infer<
  typeof rotationPlanningVersionsSchema
>;
export const rotationPlanningStatusSchema = z
  .strictObject({
    id: z.uuid(),
    label: planLabelSchema.nullable().default(null),
    parentPlanId: z.uuid().nullable().default(null),
    status: z.enum(["queued", "running", "completed", "failed"]),
    stage: z.enum([
      "awaiting_processing",
      "verifying_evidence",
      "generating_sequences",
      "retrieving_weather",
      "calculating",
      "complete",
      "failed",
    ]),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    attempts: z.number().int().nonnegative(),
    input: planRequestV2Schema,
    intakeEvidence: planEvidenceSchema,
    versions: rotationPlanningVersionsSchema,
    weatherSnapshotIds: z.array(z.uuid()).max(128),
    scenarioUnitIds: z.array(z.uuid()).max(4000),
    result: rotationAssessmentSchema.nullable(),
    error: z
      .strictObject({
        code: z.enum([
          "STORED_REQUEST_INVALID",
          "CATALOG_EVIDENCE_INVALID",
          "WEATHER_UNAVAILABLE",
          "PLANNING_LIMIT_EXCEEDED",
          "RETRIES_EXHAUSTED",
          "QUEUE_TERMINAL_WITHOUT_RESULT",
          "WORKFLOW_VERSION_UNSUPPORTED",
          "CALCULATION_FAILED",
        ]),
      })
      .nullable(),
  })
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    if (
      (v.status === "completed") !== (v.result !== null) ||
      (v.status === "failed") !== (v.error !== null) ||
      (v.stage === "complete") !== (v.status === "completed") ||
      (v.stage === "failed") !== (v.status === "failed") ||
      (v.status === "queued" && v.stage !== "awaiting_processing") ||
      new Set(v.weatherSnapshotIds).size !== v.weatherSnapshotIds.length ||
      new Set(v.scenarioUnitIds).size !== v.scenarioUnitIds.length ||
      (v.versions.workflowVersion === "planning-workflow-2" &&
        v.scenarioUnitIds.length > 0)
    )
      fail("Inconsistent planning state");
    if (!v.result) return;
    const fixture = v.versions.syntheticFixture;
    const catalog = fixture
      ? {
          id: fixture.catalog.id,
          version: fixture.catalog.version,
          sha256: fixture.catalogSha256,
        }
      : {
          id: v.intakeEvidence.catalogId,
          version: v.intakeEvidence.catalogVersion,
          sha256: v.intakeEvidence.catalogSha256,
        };
    if (
      JSON.stringify(v.result.input) !== JSON.stringify(v.input) ||
      JSON.stringify(v.result.policy) !== JSON.stringify(v.versions.policy) ||
      JSON.stringify(v.result.catalog) !== JSON.stringify(catalog) ||
      v.result.engineVersion !== v.versions.engineVersion ||
      v.result.context.assessedOn !== v.versions.assessedOn ||
      v.result.synthetic !== (fixture !== null) ||
      JSON.stringify(v.result.evidence.weatherSnapshotIds) !==
        JSON.stringify([...v.weatherSnapshotIds].sort()) ||
      ("futureClimate" in v.result &&
        JSON.stringify(v.result.futureClimate.unitIds) !==
          JSON.stringify([...v.scenarioUnitIds].sort()))
    )
      fail("Planning evidence mismatch");
  });
export type RotationPlanningStatus = z.infer<
  typeof rotationPlanningStatusSchema
>;
