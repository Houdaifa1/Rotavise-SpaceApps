import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";
import {
  catalogIdSchema,
  catalogVersionSchema,
  catalogShaSchema,
  citationSchema,
} from "../catalog/source.contract.js";
import { planRequestSchema } from "../plans/plan.contract.js";

const day = calendarDateSchema.refine(
  (v) => v >= "1900-01-01" && v <= "2100-12-31",
);
const observationIdentity = {
  cropId: catalogIdSchema,
  kind: z.enum(["disease", "pest"]),
  name: z.string().trim().min(1).max(120),
  observedOn: day,
};
export const sequenceContextSchema = z
  .strictObject({
    assessedOn: day,
    location: z.strictObject({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
    }),
    region: z.discriminatedUnion("status", [
      z.strictObject({ status: z.literal("unresolved") }),
      z.strictObject({
        status: z.literal("resolved"),
        regionId: catalogIdSchema,
        resolutionId: catalogIdSchema,
        resolutionVersion: catalogVersionSchema,
      }),
    ]),
    productionSystem: z.enum(["rainfed", "irrigated"]).nullable(),
    historyCoverageStart: day.nullable(),
    cultivars: z
      .array(
        z.strictObject({
          cropId: catalogIdSchema,
          cultivarId: catalogIdSchema,
        }),
      )
      .max(50),
    // Trusted caller context, not a farmer's claim. No diagnosis verifier is implemented here.
    verifiedHealthObservations: z
      .array(
        z.strictObject({
          ...observationIdentity,
          issueId: catalogIdSchema,
          verificationId: catalogIdSchema,
        }),
      )
      .max(20),
  })
  .superRefine((v, ctx) => {
    if (new Set(v.cultivars.map((x) => x.cropId)).size !== v.cultivars.length)
      ctx.addIssue({
        code: "custom",
        path: ["cultivars"],
        message: "Duplicate cultivar selection",
      });
    const keys = v.verifiedHealthObservations.map((x) =>
      JSON.stringify([x.cropId, x.kind, x.name, x.observedOn]),
    );
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({
        code: "custom",
        path: ["verifiedHealthObservations"],
        message: "Duplicate health verification",
      });
  });
export type SequenceContext = z.infer<typeof sequenceContextSchema>;

export const constraintCodes = [
  "FARMER_EXCLUDED",
  "CROP_NOT_IN_CATALOG",
  "REGION_UNRESOLVED",
  "REGION_NOT_IN_CATALOG",
  "NO_APPLICABLE_EVIDENCE",
  "PROFILE_REVIEW_PENDING",
  "PRODUCTION_SYSTEM_UNRESOLVED",
  "SYSTEM_NOT_SUPPORTED",
  "CULTIVAR_UNRESOLVED",
  "CALENDAR_EVIDENCE_UNAVAILABLE",
  "DURATION_EVIDENCE_UNAVAILABLE",
  "RULE_NOT_APPLICABLE",
  "RULE_NOT_REVIEWED",
  "RULE_CONDITIONS_UNRESOLVED",
  "RULE_REFERENCE_ONLY",
  "CALENDAR_OUTSIDE_FIRST_RANGE",
  "SECOND_CALENDAR_UNAVAILABLE",
  "SEARCH_HORIZON_EXCEEDED",
  "NON_OVERLAPPING_CYCLES",
  "DURATION_ENVELOPE",
  "SOIL_KNOWLEDGE_UNAVAILABLE",
  "SOIL_UNKNOWN",
  "SOIL_METRIC_UNAVAILABLE",
  "SOIL_METHOD_MISMATCH",
  "SOIL_PH_OUTSIDE_RANGE",
  "SOIL_PH_WITHIN_RANGE",
  "SOIL_CHECK_UNIMPLEMENTED",
  "ROTATION_KNOWLEDGE_UNAVAILABLE",
  "RETURN_INTERVAL_UNESTABLISHED",
  "HISTORY_UNKNOWN",
  "HISTORY_PARTIAL",
  "HISTORY_DATES_UNKNOWN",
  "PREVIOUS_CROP_UNRESOLVED",
  "HISTORY_COVERAGE_UNESTABLISHED",
  "PREDECESSOR_FAMILY_PROHIBITED",
  "PREDECESSOR_FAMILY_ALLOWED",
  "PREDECESSOR_PREFERENCE_UNMET",
  "RETURN_INTERVAL_VIOLATION",
  "RETURN_INTERVAL_SATISFIED",
  "HEALTH_KNOWLEDGE_UNAVAILABLE",
  "HEALTH_HISTORY_UNKNOWN",
  "HEALTH_OBSERVATION_UNSUPPORTED",
  "HEALTH_OBSERVATION_UNVERIFIED",
  "HEALTH_HISTORY_UNLINKED",
  "HEALTH_BREAK_VIOLATION",
  "HEALTH_BREAK_SATISFIED",
  "WEATHER_NOT_EVALUATED",
  "IRRIGATION_ADEQUACY_UNKNOWN",
  "WATER_UNKNOWN",
  "WATER_REPORTED_NOT_QUANTIFIED",
  "RANKING_NOT_IMPLEMENTED",
] as const;
export const constraintReasonSchema = z.strictObject({
  code: z.enum(constraintCodes),
  effect: z.enum(["pass", "condition", "failure", "gap", "deferred"]),
  cropId: catalogIdSchema.nullable(),
  cycle: z.union([z.literal(1), z.literal(2)]).nullable(),
  inputPaths: z.array(z.string().min(1).max(200)).max(25),
  ruleIds: z.array(catalogIdSchema).max(64),
  citations: z.array(citationSchema).max(384),
  facts: z.record(
    z.string().min(1).max(80),
    z.union([z.string().max(2000), z.number().finite(), z.boolean(), z.null()]),
  ),
});
export type ConstraintReason = z.infer<typeof constraintReasonSchema>;
export const candidateStatusSchema = z.enum([
  "eligible",
  "conditional",
  "excluded",
  "insufficient_evidence",
]);
export type CandidateStatus = z.infer<typeof candidateStatusSchema>;
export const cropCycleSchema = z
  .strictObject({
    cropId: catalogIdSchema,
    sownOn: day,
    harvestEarliest: calendarDateSchema,
    harvestLatest: calendarDateSchema,
    durationDays: z.strictObject({
      min: z.number().int().min(1).max(730),
      max: z.number().int().min(1).max(730),
    }),
    plantingRuleIds: z.array(catalogIdSchema).min(1).max(32),
    durationRuleIds: z.array(catalogIdSchema).min(1).max(32),
  })
  .superRefine((v, ctx) => {
    if (
      v.durationDays.min > v.durationDays.max ||
      v.sownOn >= v.harvestEarliest ||
      v.harvestEarliest > v.harvestLatest
    )
      ctx.addIssue({ code: "custom", message: "Invalid crop cycle envelope" });
    const elapsed = (date: string) =>
      (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${v.sownOn}T00:00:00Z`)) /
      86400000;
    if (
      elapsed(v.harvestEarliest) !== v.durationDays.min ||
      elapsed(v.harvestLatest) !== v.durationDays.max
    )
      ctx.addIssue({
        code: "custom",
        message: "Duration does not match harvest dates",
      });
  });
export type CropCycle = z.infer<typeof cropCycleSchema>;
const schedule = z
  .strictObject({
    id: z.string().min(1).max(250),
    first: cropCycleSchema,
    second: cropCycleSchema,
    status: candidateStatusSchema,
    reasons: z.array(constraintReasonSchema).max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.second.sownOn <= v.first.harvestLatest)
      ctx.addIssue({ code: "custom", message: "Overlapping cycles" });
  });
export type SequenceSchedule = z.infer<typeof schedule>;
const pair = z.strictObject({
  id: z.string().min(1).max(170),
  firstCropId: catalogIdSchema,
  secondCropId: catalogIdSchema,
  startsWithFarmerChoice: z.boolean(),
  status: candidateStatusSchema,
  reasons: z.array(constraintReasonSchema).max(2000),
  schedules: z.array(schedule).max(5000),
  calendarRejections: z.strictObject({
    firstOutsideWindow: z.number().int().nonnegative(),
    firstBeyondHorizon: z.number().int().nonnegative(),
    secondOverlap: z.number().int().nonnegative(),
    secondBeyondHorizon: z.number().int().nonnegative(),
  }),
});
export type SequencePair = z.infer<typeof pair>;
export const sequenceResultSchema = z
  .strictObject({
    kind: z.literal("calendar_constraint_assessment"),
    scope: z.literal("calendars_and_constraints_only"),
    engineVersion: z.literal("sequence-engine-2"),
    policyVersion: z.literal("sequence-policy-2"),
    synthetic: z.boolean(),
    complete: z.literal(true),
    recommendations: z.null(),
    outcome: z.enum([
      "sequences_generated",
      "no_feasible_sequence",
      "insufficient_evidence",
    ]),
    context: sequenceContextSchema,
    catalog: z.strictObject({
      id: catalogIdSchema,
      version: catalogVersionSchema,
      sha256: catalogShaSchema,
    }),
    input: planRequestSchema,
    deferredChecks: z.tuple([
      z.literal("weather"),
      z.literal("water_balance"),
      z.literal("ranking"),
      z.literal("agronomic_validation"),
    ]),
    pairs: z.array(pair).min(1).max(3000),
    consideredChoices: z
      .array(
        z.strictObject({
          cropId: catalogIdSchema,
          status: candidateStatusSchema,
          pairIds: z.array(z.string()).min(1).max(50),
        }),
      )
      .max(10),
    counts: z.strictObject({
      pairs: z.number().int().nonnegative(),
      schedules: z.number().int().nonnegative().max(5000),
      combinationsExamined: z.number().int().nonnegative().max(250000),
    }),
  })
  .superRefine((v, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    const status = (reasons: ConstraintReason[]): CandidateStatus =>
      reasons.some((r) => r.effect === "failure")
        ? "excluded"
        : reasons.some((r) => r.effect === "gap")
          ? "insufficient_evidence"
          : reasons.some((r) => r.effect === "condition")
            ? "conditional"
            : "eligible";
    const best = (statuses: CandidateStatus[]) =>
      ["eligible", "conditional", "insufficient_evidence", "excluded"].find(
        (s) => statuses.includes(s as CandidateStatus),
      );
    if (
      v.counts.pairs !== v.pairs.length ||
      v.counts.schedules !== v.pairs.reduce((n, p) => n + p.schedules.length, 0)
    )
      issue("Inconsistent result counts");
    if (
      v.counts.combinationsExamined !==
      v.pairs.reduce(
        (n, p) =>
          n +
          p.schedules.length +
          p.calendarRejections.secondOverlap +
          p.calendarRejections.secondBeyondHorizon,
        0,
      )
    )
      issue("Inconsistent exhaustive search accounting");
    if (new Set(v.pairs.map((p) => p.id)).size !== v.pairs.length)
      issue("Duplicate pairs");
    const selected = v.input.preferences.considered_next_crop_ids;
    if (
      v.consideredChoices.length !== selected.length ||
      new Set(v.consideredChoices.map((c) => c.cropId)).size !==
        selected.length ||
      v.consideredChoices.some((c) => !selected.includes(c.cropId))
    )
      issue("Considered choices not preserved");
    for (const p of v.pairs) {
      if (
        p.id !== `${p.firstCropId}>${p.secondCropId}` ||
        p.startsWithFarmerChoice !== selected.includes(p.firstCropId)
      )
        issue("Inconsistent pair identity");
      if (new Set(p.schedules.map((s) => s.id)).size !== p.schedules.length)
        issue("Duplicate schedules");
      if (
        p.status !==
        (p.schedules.length
          ? best(p.schedules.map((s) => s.status))
          : status(p.reasons))
      )
        issue("Inconsistent pair assessment");
      for (const s of p.schedules) {
        if (
          s.first.cropId !== p.firstCropId ||
          s.second.cropId !== p.secondCropId ||
          s.id !== `${p.id}@${s.first.sownOn}/${s.second.sownOn}`
        )
          issue("Inconsistent schedule identity");
        if (
          s.first.sownOn < v.input.planning.earliest_start_date ||
          s.first.sownOn > v.input.planning.latest_start_date ||
          s.second.harvestLatest > v.input.planning.search_end_date
        )
          issue("Schedule outside requested range");
        if (s.status !== status([...p.reasons, ...s.reasons]))
          issue("Constraint effects disagree with assessment");
      }
    }
    for (const choice of v.consideredChoices) {
      const pairs = v.pairs.filter((p) => p.firstCropId === choice.cropId);
      if (
        choice.pairIds.length !== pairs.length ||
        new Set(choice.pairIds).size !== pairs.length ||
        pairs.some((p) => !choice.pairIds.includes(p.id)) ||
        choice.status !== best(pairs.map((p) => p.status))
      )
        issue("Inconsistent considered choice assessment");
    }
    const outcome = v.pairs.some((p) =>
      p.schedules.some(
        (s) => s.status === "eligible" || s.status === "conditional",
      ),
    )
      ? "sequences_generated"
      : v.pairs.some((p) => p.status === "insufficient_evidence")
        ? "insufficient_evidence"
        : "no_feasible_sequence";
    if (v.outcome !== outcome) issue("Inconsistent result outcome");
  });
export type SequenceResult = z.infer<typeof sequenceResultSchema>;
