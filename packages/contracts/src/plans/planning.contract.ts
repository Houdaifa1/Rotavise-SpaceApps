import { z } from "zod";
import {
  historicalAssessmentSchema,
  historicalPolicySchema,
} from "../engine/climate.contract.js";
import { sequenceContextSchema } from "../engine/sequence.contract.js";
import { catalogBundleSchema } from "../catalog/catalog.contract.js";
import {
  planRequestSchema,
  planEvidenceSchema,
  planLabelSchema,
} from "./plan.contract.js";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const planningVersionsSchema = z.strictObject({
  workflowVersion: z.literal("planning-workflow-1"),
  contextVersion: z.literal("unresolved-context-1"),
  sequenceEngineVersion: z.literal("sequence-engine-2"),
  engineVersion: z.literal("historical-engine-1"),
  rankingVersion: z.literal("ranking-heuristics-1"),
  selectionVersion: z.literal("group-selection-1"),
  context: sequenceContextSchema,
  policy: historicalPolicySchema,
  syntheticFixture: z
    .strictObject({ catalog: catalogBundleSchema, catalogSha256: hash })
    .nullable(),
});
export const planningResultSchema = z
  .strictObject({
    kind: z.literal("planning_assessment"),
    synthetic: z.boolean(),
    assessment: historicalAssessmentSchema,
    comparisons: z
      .array(
        z.strictObject({
          groupId: z.string(),
          mainScheduleIds: z.array(z.string()).min(1).max(5000),
          alternativeScheduleIds: z.array(z.string()).max(2),
          sensitive: z.boolean(),
          topSensitive: z.boolean(),
        }),
      )
      .max(5000),
    selectionVersion: z.literal("group-selection-1"),
    recommendationScope: z.literal("within_comparable_groups_only"),
    processing: z.strictObject({
      calendar: z.literal("evaluated"),
      weather: z.enum(["evaluated", "not_needed"]),
      ranking: z.enum(["available", "insufficient_evidence"]),
      irrigationAdequacy: z.literal("unknown"),
      agronomicValidation: z.literal("pending"),
    }),
  })
  .superRefine((v, ctx) => {
    if (
      v.synthetic !== v.assessment.synthetic ||
      v.comparisons.length !== v.assessment.ranking.groups.length ||
      new Set(v.comparisons.map((g) => g.groupId)).size !== v.comparisons.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent planning comparison",
      });
    for (const choice of v.comparisons) {
      const group = v.assessment.ranking.groups.find(
        (g) => g.id === choice.groupId,
      );
      if (
        !group ||
        choice.sensitive !== group.sensitive ||
        choice.topSensitive !== group.topSensitive ||
        JSON.stringify([...choice.mainScheduleIds].sort()) !==
          JSON.stringify(
            group.entries
              .filter((e) => e.rank === 1)
              .map((e) => e.scheduleId)
              .sort(),
          ) ||
        choice.alternativeScheduleIds.some(
          (id) => !group.entries.some((e) => e.scheduleId === id && e.rank > 1),
        ) ||
        new Set(choice.alternativeScheduleIds).size !==
          choice.alternativeScheduleIds.length
      )
        ctx.addIssue({ code: "custom", message: "Invalid grouped selection" });
    }
    if (
      (v.processing.weather === "evaluated") !==
        v.assessment.evidence.length > 0 ||
      (v.processing.ranking === "available") !== v.comparisons.length > 0
    )
      ctx.addIssue({ code: "custom", message: "Invalid processing summary" });
  });
export const planningStatusSchema = z
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
    input: planRequestSchema,
    intakeEvidence: planEvidenceSchema,
    versions: planningVersionsSchema,
    weatherSnapshotIds: z.array(z.uuid()).max(128),
    result: planningResultSchema.nullable(),
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
    if (
      (v.status === "completed") !== (v.result !== null) ||
      (v.status === "failed") !== (v.error !== null) ||
      (v.stage === "complete") !== (v.status === "completed") ||
      (v.stage === "failed") !== (v.status === "failed") ||
      (v.status === "queued" && v.stage !== "awaiting_processing") ||
      new Set(v.weatherSnapshotIds).size !== v.weatherSnapshotIds.length
    )
      ctx.addIssue({ code: "custom", message: "Inconsistent planning state" });
    if (v.result) {
      const a = v.result.assessment,
        c = v.versions.syntheticFixture?.catalog;
      const expectedCatalog = c
        ? {
            id: c.id,
            version: c.version,
            sha256: v.versions.syntheticFixture!.catalogSha256,
          }
        : {
            id: v.intakeEvidence.catalogId,
            version: v.intakeEvidence.catalogVersion,
            sha256: v.intakeEvidence.catalogSha256,
          };
      if (
        JSON.stringify(a.sequence.input) !== JSON.stringify(v.input) ||
        JSON.stringify(a.sequence.context) !==
          JSON.stringify(v.versions.context) ||
        JSON.stringify(a.policy) !== JSON.stringify(v.versions.policy) ||
        JSON.stringify(a.sequence.catalog) !==
          JSON.stringify(expectedCatalog) ||
        a.engineVersion !== v.versions.engineVersion ||
        a.rankingVersion !== v.versions.rankingVersion ||
        a.sequence.engineVersion !== v.versions.sequenceEngineVersion ||
        v.result.synthetic !== (v.versions.syntheticFixture !== null) ||
        JSON.stringify(a.evidence.map((e) => e.snapshotId).sort()) !==
          JSON.stringify([...v.weatherSnapshotIds].sort())
      )
        ctx.addIssue({ code: "custom", message: "Planning evidence mismatch" });
    }
  });
export type PlanningVersions = z.infer<typeof planningVersionsSchema>;
export type PlanningResult = z.infer<typeof planningResultSchema>;
