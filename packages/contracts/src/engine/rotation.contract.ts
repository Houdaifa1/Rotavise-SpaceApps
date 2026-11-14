import {
  rotationResourcesSchema,
  catalogResearchCoverageSchema,
  benefitSelectionSchema,
} from "./research-outputs.contract.js";
import {
  rotationOutputsSchema,
  vulnerabilitySeasonSchema,
} from "./rotation-outputs.contract.js";
import { soilEstimateSchema } from "../soil/soil.contract.js";
import { z } from "zod";
import { calendarDateSchema } from "../weather/weather.contract.js";
import {
  catalogIdSchema,
  catalogShaSchema,
  catalogVersionSchema,
  citationSchema,
} from "../catalog/source.contract.js";
import { farmingSystemSchema } from "../catalog/catalog-v2.contract.js";
import {
  farmerContextSchema,
  planRequestV2Schema,
} from "../plans/plan-v2.contract.js";
import {
  SCENARIO_ATTRIBUTION,
  SCENARIO_DATASET,
  SCENARIO_DATASET_VERSION,
  scenarioExperimentSchema,
  scenarioModelSchema,
} from "../climate-scenarios/scenario.contract.js";

const day = calendarDateSchema;
const loss = z.number().min(0).max(1);
export const rotationDimensions = [
  "climate",
  "water",
  "soil_health",
  "crop_health",
] as const;
export const rotationDimensionSchema = z.enum(rotationDimensions);
const policyFields = {
  // Analog sequences start in these years and keep consecutive years.
  firstAnchorYear: z.number().int().min(1981).max(2100),
  lastAnchorYear: z.number().int().min(1981).max(2100),
  minimumCompleteAnalogs: z.number().int().min(1).max(100),
  // Declared product policy, not a sourced agronomic value; crop rules may raise it.
  preparationGapDays: z.number().int().min(0).max(60),
  representativeStepDays: z.number().int().min(1).max(31),
  beamWidth: z.number().int().min(1).max(2000),
  perFirstCropWidth: z.number().int().min(1).max(500),
  maxExpansions: z.number().int().min(1).max(5000000),
  maxSlots: z.number().int().min(1).max(20),
  // Per climate source: the historical record and each model world.
  maxClimateDayVisits: z.number().int().min(1).max(200000000),
  outputCandidates: z.number().int().min(1).max(500),
};
const year = z.number().int().min(1950).max(2100);
const anchorWindowSchema = z
  .strictObject({
    experiment: scenarioExperimentSchema,
    firstAnchorYear: year,
    lastAnchorYear: year,
    // Data are prepared to this year so late anchors can finish a rotation.
    lastDataYear: year,
  })
  .refine(
    (w) =>
      w.firstAnchorYear <= w.lastAnchorYear &&
      w.lastAnchorYear <= w.lastDataYear,
    "Reversed window",
  );
// A near-term period reported beside mid-century: the same scenarios, anchors
// that start soon, compared with each model's own historical baseline. Its
// data years end before the mid-century anchors begin, so a near-term unit is
// never also a mid-century unit.
const nearTermPolicySchema = z.strictObject({
  windows: z.array(anchorWindowSchema).min(1).max(4),
  // A decade has fewer anchors than the mid-century window, so it has its own
  // declared minimum (product policy, not a sourced value).
  minimumCompleteAnalogs: z.number().int().min(1).max(100),
});
// Model worlds: each model's historical run is its own baseline, so the
// change by mid-century never mixes POWER and model data.
export const futureClimatePolicySchema = z
  .strictObject({
    dataset: z.literal(SCENARIO_DATASET),
    datasetVersion: z.literal(SCENARIO_DATASET_VERSION),
    ensemble: z.literal("isimip3b-primary"),
    models: z.array(scenarioModelSchema).min(1).max(10),
    baseline: anchorWindowSchema,
    futures: z.array(anchorWindowSchema).min(1).max(4),
    minimumCompleteAnalogs: z.number().int().min(1).max(100),
    // Absent in policies pinned before the near-term period existed, so those
    // plans and their stored results read exactly as they did.
    nearTerm: nearTermPolicySchema.optional(),
  })
  .superRefine((p, ctx) => {
    const fail = () =>
      ctx.addIssue({ code: "custom", message: "Invalid future policy" });
    if (
      new Set(p.models.map((m) => m.id)).size !== p.models.length ||
      p.baseline.experiment !== "historical" ||
      p.baseline.lastDataYear > 2014 ||
      p.futures.some(
        (f) => f.experiment === "historical" || f.firstAnchorYear < 2015,
      ) ||
      new Set(p.futures.map((f) => f.experiment)).size !== p.futures.length
    )
      fail();
    const near = p.nearTerm;
    if (
      near &&
      (new Set(near.windows.map((w) => w.experiment)).size !==
        near.windows.length ||
        near.windows.some((w) => {
          const mid = p.futures.find((f) => f.experiment === w.experiment);
          return (
            !mid ||
            w.firstAnchorYear < 2015 ||
            w.lastDataYear >= mid.firstAnchorYear ||
            near.minimumCompleteAnalogs >
              w.lastAnchorYear - w.firstAnchorYear + 1
          );
        }))
    )
      fail();
  });
export type FutureClimatePolicy = z.infer<typeof futureClimatePolicySchema>;
const anchorsOrdered = (p: {
  firstAnchorYear: number;
  lastAnchorYear: number;
}) => p.firstAnchorYear <= p.lastAnchorYear;
export const rotationPolicyV1Schema = z
  .strictObject({ version: z.literal("rotation-policy-1"), ...policyFields })
  .refine(anchorsOrdered, "Reversed anchors");
export const rotationPolicyV2Schema = z
  .strictObject({
    version: z.literal("rotation-policy-2"),
    ...policyFields,
    futureClimate: futureClimatePolicySchema,
    // No default: absence replays pre-output plans byte-for-byte.
    outputs: z.literal("rotation-outputs-1").optional(),
    research: z.enum(["income-benefits-1", "benefits-2"]).optional(),
    comparison: z.literal("regional-comparison-1").optional(),
  })
  .refine(anchorsOrdered, "Reversed anchors");
export const rotationPolicySchema = z.union([
  rotationPolicyV1Schema,
  rotationPolicyV2Schema,
]);
export type RotationPolicy = z.infer<typeof rotationPolicySchema>;
export type RotationPolicyV2 = z.infer<typeof rotationPolicyV2Schema>;

export const rotationReasonCodes = [
  "CROP_NOT_IN_CATALOG",
  "CATALOG_GAP",
  "CROP_EXCLUDED_BY_FARMER",
  "MODEL_TYPE_UNSUPPORTED",
  "REGION_UNRESOLVED",
  "REGION_BOUNDARY_UNAVAILABLE",
  "CROP_NOT_APPLICABLE_IN_REGION",
  "FARMING_SYSTEM_UNRESOLVED",
  "CULTIVAR_NOT_IN_CATALOG",
  "RULE_NOT_VERIFIED",
  "RULE_REFERENCE_ONLY",
  "RULE_OUT_OF_SCOPE",
  "RULE_SCOPE_UNSPECIFIED",
  "RULE_STAGE_TIMING_UNKNOWN",
  "RULE_MEASUREMENT_UNSUPPORTED",
  "CALENDAR_EVIDENCE_UNAVAILABLE",
  "DURATION_EVIDENCE_UNAVAILABLE",
  "TEMPERATURE_EVIDENCE_UNAVAILABLE",
  "WATER_CLASS_UNAVAILABLE",
  "SOIL_UNKNOWN",
  "SOIL_METHOD_MISMATCH",
  "SOIL_DATE_UNKNOWN",
  "SOIL_LIMIT_FAILED",
  "SOIL_LIMIT_WARNING",
  "SOIL_LIMIT_PASSED",
  "SOIL_CHECK_UNIMPLEMENTED",
  "HISTORY_UNKNOWN",
  "HISTORY_PARTIAL",
  "HISTORY_DATES_UNKNOWN",
  "PREVIOUS_CROP_UNRESOLVED",
  "FIRST_WINDOW_OUTSIDE_RANGE",
  "NO_WINDOW_BEFORE_HORIZON",
  "RETURN_INTERVAL_VIOLATION",
  "PREDECESSOR_FAMILY_PROHIBITED",
  "HEALTH_BREAK_VIOLATION",
  "HEALTH_ISSUE_NOT_IN_CATALOG",
  "HEALTH_REPORT_UNCONFIRMED",
  "WATER_UNKNOWN",
  "RAINFED_ARID_RISK",
  "SOIL_ESTIMATE_USED",
  "SOIL_ESTIMATE_OUTSIDE",
  "SOIL_ESTIMATE_UNAVAILABLE",
  "IRRIGATION_ADEQUACY_UNKNOWN",
  "CLIMATE_ANALOGS_INSUFFICIENT",
  "CLIMATE_CHECKS_DIFFER",
  "SOIL_PREFERENCES_UNEVEN",
  "FUTURE_CLIMATE_UNAVAILABLE",
  "SEARCH_PRUNED",
  "SEARCH_TRUNCATED",
  "NOT_EXPERT_REVIEWED",
  "EXPOSURE_HEAT",
  "EXPOSURE_COLD",
  "EXPOSURE_RAIN_DEFICIT",
  "EXPOSURE_UNAVAILABLE",
  "TERRAIN_CONTEXT_UNRANKED",
  "EROSION_FACTORS_MISSING",
  "INFILTRATION_DRAINAGE_UNKNOWN",
  "EQUIPMENT_DATA_UNAVAILABLE",
  "MARKET_ACCESS_DATA_UNAVAILABLE",
  "INCOME_DATA_UNAVAILABLE",
] as const;
export const rotationReasonSchema = z.strictObject({
  code: z.enum(rotationReasonCodes),
  effect: z.enum(["failure", "gap", "condition", "info", "pass"]),
  cropId: catalogIdSchema.nullable(),
  slot: z.number().int().min(1).max(20).nullable(),
  ruleIds: z.array(catalogIdSchema).max(64),
  citations: z.array(citationSchema).max(64),
  facts: z.record(
    z.string().max(60),
    z.union([z.string().max(300), z.number().finite(), z.boolean(), z.null()]),
  ),
});
export type RotationReason = z.infer<typeof rotationReasonSchema>;

export const rotationContextSchema = z.strictObject({
  assessedOn: day,
  location: z.strictObject({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  }),
  // Every catalog region whose sourced boundary contains the point.
  regionIds: z.array(catalogIdSchema).max(50),
  regionsWithoutBoundary: z.array(catalogIdSchema).max(50),
  farmingSystem: farmingSystemSchema.nullable(),
  cultivars: z
    .array(
      z.strictObject({ cropId: catalogIdSchema, cultivarId: catalogIdSchema }),
    )
    .max(50),
  horizonEnd: day,
});
export type RotationContext = z.infer<typeof rotationContextSchema>;

const slotSchema = z.strictObject({
  cropId: catalogIdSchema,
  sowEarliest: day,
  sowLatest: day,
  harvestEarliest: day,
  harvestLatest: day,
  durationDays: z.strictObject({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
  }),
  windowRuleIds: z.array(catalogIdSchema).min(1).max(8),
  durationRuleIds: z.array(catalogIdSchema).min(1).max(8),
});
const dimensionScores = z.strictObject({
  climate: z
    .strictObject({
      meanLoss: loss,
      worstDecileLoss: loss,
      completeAnalogs: z.number().int().nonnegative(),
    })
    .nullable(),
  water: loss.nullable(),
  // Engine 6: null when no crop change in any candidate can be checked.
  soil_health: loss.nullable(),
  crop_health: loss,
});
const candidateFields = {
  // Candidate conditions can reference the existing per-crop assessment instead
  // of repeating every crop condition at every slot under the regional policy.
  cropConditions: z.literal("assessment_crops").optional(),
  id: z.string().min(1).max(2000),
  terrainContext: z
    .strictObject({
      fieldId: z.uuid().nullable(),
      rankingApplied: z.literal(false),
      code: z.literal("TERRAIN_CONTEXT_UNRANKED"),
      missingErosionFactors: z
        .array(z.enum(["R", "K", "LS", "C", "P"]))
        .min(1)
        .max(5),
    })
    .optional(),
  vulnerabilitySeasons: z.array(vulnerabilitySeasonSchema).max(20).optional(),
  slots: z.array(slotSchema).min(1).max(20),
  status: z.enum(["eligible", "conditional"]),
  startsWithConsidered: z.boolean(),
  reasons: z.array(rotationReasonSchema).max(200),
  scores: dimensionScores,
  weightedLoss: z.number().min(0).max(1),
  rank: z.number().int().positive(),
  tiedWith: z.array(z.string().max(2000)).max(500),
  pareto: z.boolean(),
};
const change = z.number().min(-1).max(1);
// Per scenario and model: the rotation's climate loss in the model's own
// baseline and future, and the farmer-weighted rank in that future world.
const scenarioChangeSchema = z.strictObject({
  experiment: scenarioExperimentSchema,
  models: z
    .array(
      z.strictObject({
        model: z.string().max(40),
        baselineMeanLoss: loss,
        futureMeanLoss: loss,
        change,
        futureWorstDecileLoss: loss,
        // Engine 5: the same FAO-56 balance on the model's own rain.
        baselineWaterLoss: loss.nullable().optional(),
        futureWaterLoss: loss.nullable().optional(),
        waterChange: change.nullable().optional(),
        baselineRainMm: z.number().nonnegative().nullable().optional(),
        futureRainMm: z.number().nonnegative().nullable().optional(),
        hottestDayChangeC: z.number().optional(),
        drySpellChangeDays: z.number().optional(),
        futureDroughtSeasonShare: z.number().min(0).max(1).optional(),
        weightedRank: z.number().int().positive(),
      }),
    )
    .max(10),
  meanChange: change.nullable(),
  minChange: change.nullable(),
  maxChange: change.nullable(),
  meanWaterChange: change.nullable().optional(),
});
const candidateFutureSchema = z.strictObject({
  // Present only under the pinned regional comparison policy. A compared
  // block can contain unavailable candidates; each model/period says why.
  comparisons: z
    .array(
      z.strictObject({
        period: z.enum(["mid_century", "near_term"]),
        model: z.string().max(40),
        experiment: scenarioExperimentSchema,
        status: z.enum(["compared", "not_compared"]),
        reason: z
          .enum([
            "CLIMATE_NOT_COMPARED",
            "SCENARIO_TILE_NOT_PREPARED",
            "SCENARIO_DATA_INCOMPLETE",
            "FUTURE_ANALOGS_INSUFFICIENT",
            "NEAR_TERM_TILE_NOT_PREPARED",
            "NEAR_TERM_DATA_INCOMPLETE",
            "NEAR_TERM_ANALOGS_INSUFFICIENT",
          ])
          .nullable(),
      }),
    )
    .max(80)
    .optional(),
  scenarios: z.array(scenarioChangeSchema).max(4),
  // The same comparison for the near-term period. Present only when the
  // pinned policy has one and it could be compared.
  nearTerm: z.array(scenarioChangeSchema).max(4).optional(),
});
export const rotationCandidateV3Schema = z.strictObject(candidateFields);
export const rotationCandidateSchema = z.strictObject({
  ...candidateFields,
  future: candidateFutureSchema.nullable(),
});
export type RotationCandidateV4 = z.infer<typeof rotationCandidateSchema>;
const weightsSchema = z.strictObject({
  climate: z.number().min(0).max(1),
  water: z.number().min(0).max(1),
  soil_health: z.number().min(0).max(1),
  crop_health: z.number().min(0).max(1),
});
const assessmentFields = {
  kind: z.literal("rotation_assessment"),
  synthetic: z.boolean(),
  outcome: z.enum([
    "comparisons_available",
    "no_feasible_rotation",
    "insufficient_evidence",
  ]),
  catalog: z.strictObject({
    id: catalogIdSchema,
    version: catalogVersionSchema,
    sha256: catalogShaSchema,
  }),
  context: rotationContextSchema,
  input: planRequestV2Schema,
  evidence: z.strictObject({
    // Under regional-comparison-1, ruleIds resolve in this result's immutable
    // catalog. Repeated inline citations may be omitted; tiers remain explicit.
    ruleDetails: z.literal("pinned_catalog").optional(),
    weatherSnapshotIds: z.array(z.uuid()).max(128),
    rulesUsed: z.strictObject({
      double_checked: z.number().int().nonnegative(),
      expert_reviewed: z.number().int().nonnegative(),
      // Provenance: rules recalled by the AI model; present only when some were used.
      model_recall: z.number().int().positive().optional(),
    }),
    expertReviewed: z.boolean(),
  }),
  crops: z
    .array(
      z.strictObject({
        cropId: catalogIdSchema,
        status: z.enum([
          "schedulable",
          "not_in_catalog",
          "excluded",
          "unsupported_for_plan",
          "insufficient_evidence",
          "rejected",
        ]),
        reasons: z.array(rotationReasonSchema).max(200),
      }),
    )
    .max(450),
  choices: z
    .array(
      z.strictObject({
        cropId: catalogIdSchema,
        role: z.enum(["considered", "excluded", "history"]),
        outcome: z.enum([
          "ranked",
          "no_feasible_rotation",
          "not_schedulable",
          "excluded_as_requested",
          "not_in_catalog",
          "recorded",
        ]),
        bestCandidateId: z.string().max(2000).nullable(),
        bestRank: z.number().int().positive().nullable(),
      }),
    )
    .max(120),
  dimensions: z
    .array(
      z.strictObject({
        id: rotationDimensionSchema,
        status: z.enum(["compared", "not_compared"]),
        requestedWeight: z.number().int().min(0).max(5),
        appliedWeight: z.number().min(0).max(1),
        reason: z.string().max(500).nullable(),
      }),
    )
    .length(rotationDimensions.length),
  ranking: z.strictObject({
    weights: weightsSchema,
    sensitivity: z
      .array(
        z.strictObject({
          view: z.string().max(80),
          weights: weightsSchema,
          topCandidateIds: z.array(z.string().max(2000)).max(500),
        }),
      )
      .max(40),
    topStable: z.boolean(),
  }),
  accounting: z.strictObject({
    schedulableCrops: z.number().int().nonnegative(),
    expansions: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    compared: z.number().int().nonnegative(),
    shown: z.number().int().nonnegative(),
    pruned: z.number().int().nonnegative(),
    truncated: z.boolean(),
    rejections: z
      .array(
        z.strictObject({
          code: z.enum(rotationReasonCodes),
          count: z.number().int().positive(),
        }),
      )
      .max(rotationReasonCodes.length),
  }),
  reasons: z.array(rotationReasonSchema).max(200),
  limitations: z.array(z.string().max(500)).min(1).max(20),
};
export const futureClimateReasons = [
  "CLIMATE_NOT_COMPARED",
  "SCENARIO_TILE_NOT_PREPARED",
  "SCENARIO_DATA_INCOMPLETE",
  "FUTURE_ANALOGS_INSUFFICIENT",
] as const;
// Why the near-term comparison is missing. The future-climate reasons repeat
// when the whole future comparison is unavailable.
export const nearTermReasons = [
  "NEAR_TERM_TILE_NOT_PREPARED",
  "NEAR_TERM_DATA_INCOMPLETE",
  "NEAR_TERM_ANALOGS_INSUFFICIENT",
] as const;
const futureWorldsSchema = z
  .array(
    z.strictObject({
      model: z.string().max(40),
      experiment: scenarioExperimentSchema,
      status: z.enum(["compared", "not_compared"]),
      topCandidateIds: z.array(z.string().max(2000)).max(500),
      appliedWeights: weightsSchema.optional(),
      comparedCandidateCount: z.number().int().nonnegative().optional(),
      notComparedCandidateCount: z.number().int().nonnegative().optional(),
    }),
  )
  .max(50);
// A model projection of the next years, never a forecast of any season.
const nearTermBlockSchema = z.strictObject({
  status: z.enum(["compared", "unavailable"]),
  reason: z.enum([...futureClimateReasons, ...nearTermReasons]).nullable(),
  notAForecast: z.literal(true),
  windows: z.array(anchorWindowSchema).max(4),
  minimumCompleteAnalogs: z.number().int().min(1).max(100),
  worlds: futureWorldsSchema,
  topStableAcrossFutures: z.boolean().nullable(),
});
export type NearTermBlock = z.infer<typeof nearTermBlockSchema>;
const futureClimateSchema = z.strictObject({
  status: z.enum(["compared", "unavailable"]),
  reason: z.enum(futureClimateReasons).nullable(),
  // The 0.25° source cell, never the field position.
  cell: z
    .strictObject({ latitude: z.number(), longitude: z.number() })
    .nullable(),
  unitIds: z.array(z.uuid()).max(4000),
  worlds: futureWorldsSchema,
  topStableAcrossFutures: z.boolean().nullable(),
  attribution: z.literal(SCENARIO_ATTRIBUTION),
  // Absent unless the pinned policy has a near-term period.
  nearTerm: nearTermBlockSchema.optional(),
});
// Engine 3 results (Step 10) stay readable; engine 4 adds model futures.
export const rotationAssessmentV3Schema = z.strictObject({
  ...assessmentFields,
  engineVersion: z.literal("rotation-engine-3"),
  policy: rotationPolicyV1Schema,
  candidates: z.array(rotationCandidateV3Schema).max(500),
});
export const rotationAssessmentV4Schema = z.strictObject({
  ...assessmentFields,
  engineVersion: z.literal("rotation-engine-4"),
  policy: rotationPolicyV2Schema,
  candidates: z.array(rotationCandidateSchema).max(500),
  futureClimate: futureClimateSchema,
});
// Crop model parameter sets. Faba bean has none, and is reported as having none.
export const aquaCropParameterSets: Record<string, string> = {
  "durum-wheat": "WheatGDD",
  "bread-wheat": "WheatGDD",
  barley: "BarleyGDD",
  "sugar-beet": "SugarBeetGDD",
  sunflower: "SunflowerGDD",
  potato: "PotatoGDD",
  tomato: "TomatoGDD",
  maize: "MaizeGDD",
};
const yieldSlotSchema = z.strictObject({
  cropId: catalogIdSchema,
  status: z.enum(["estimated", "no_crop_model", "incomplete"]),
  seasons: z.number().int().nonnegative(),
  meanYieldTPerHa: z.number().nonnegative().nullable(),
  worstDecileYieldTPerHa: z.number().nonnegative().nullable(),
  meanIrrigationMm: z.number().nonnegative().nullable(),
  // Mean yield as a share of the crop's own unstressed potential in that year.
  attainment: z.number().min(0).max(1).nullable().optional(),
});
export const rotationYieldsSchema = z.strictObject({
  model: z.string().max(40),
  modelVersion: z.string().max(40),
  serviceVersion: z.string().max(20),
  // Default parameters: compare crops and years, do not read as farm yields.
  calibration: z.literal("uncalibrated_default_parameters"),
  soilClass: z.string().max(40),
  soilAssumed: z.boolean(),
  irrigated: z.boolean(),
  // Share of the final order that comes from attainment; 0 for older plans.
  rankingWeight: z.number().min(0).max(1).optional(),
  candidates: z
    .array(
      z.strictObject({
        id: z.string().max(2000),
        attainment: z.number().min(0).max(1).nullable().optional(),
        slots: z.array(yieldSlotSchema).max(20),
      }),
    )
    .max(50),
});
export type RotationYields = z.infer<typeof rotationYieldsSchema>;
export const rotationSoilCarbonSchema = z.strictObject({
  model: z.string().max(40),
  calibration: z.literal("uncalibrated"),
  depth: z.literal("0-30cm"),
  years: z.literal(20),
  startTCPerHa: z.number().nonnegative(),
  keptResidueShare: z.number().min(0).max(1),
  candidates: z
    .array(
      z.strictObject({
        id: z.string().max(2000),
        status: z.enum(["estimated", "no_residue_data"]),
        annualInputGrazedTCPerHa: z.number().nonnegative().nullable(),
        annualInputKeptTCPerHa: z.number().nonnegative().nullable(),
        after20YearsGrazedTCPerHa: z.number().nonnegative().nullable(),
        after20YearsKeptTCPerHa: z.number().nonnegative().nullable(),
      }),
    )
    .max(50),
});
export type RotationSoilCarbon = z.infer<typeof rotationSoilCarbonSchema>;
// Engine 5 adds the FAO-56 water balance per candidate.
const waterBalanceSchema = z
  .strictObject({
    meanLoss: z.number().min(0).max(1),
    worstDecileLoss: z.number().min(0).max(1),
    completeAnalogs: z.number().int().nonnegative(),
    meanCropWaterUseMm: z.number().nonnegative(),
    meanRainMm: z.number().nonnegative(),
    meanShortfallMm: z.number().nonnegative(),
    meanAnnualRainMm: z.number().nonnegative(),
  })
  .nullable();
const extremesSchema = z
  .strictObject({
    meanHottestDayC: z.number(),
    hottestDayC: z.number(),
    meanColdestNightC: z.number(),
    coldestNightC: z.number(),
    meanLongestDrySpellDays: z.number().nonnegative(),
    longestDrySpellDays: z.number().int().nonnegative(),
    meanWettestDayMm: z.number().nonnegative(),
    wettestDayMm: z.number().nonnegative(),
    droughtSeasonShare: z.number().min(0).max(1),
  })
  .nullable();
export const rotationCandidateV5Schema = z.strictObject({
  ...candidateFields,
  resources: rotationResourcesSchema.optional(),
  extremes: extremesSchema,
  future: candidateFutureSchema.nullable(),
  waterBalance: waterBalanceSchema,
});
// Engine 6 has the same shape; it ranks on a dimension only when every
// schedulable crop was checked the same way (DECISIONS: "Fair ranking").
// Engine 7: present only when the request asked for a what-if test. It names
// the assumptions and says plainly that this is a scenario test, not a forecast.
export const whatIfResultSchema = z.strictObject({
  kind: z.literal("what_if"),
  notAForecast: z.literal(true),
  label: z.string().min(1).max(200),
  rainfallChangePercent: z.number().int(),
  temperatureChangeC: z.number(),
  sowingShiftDays: z.number().int(),
  appliedTo: z.strictObject({
    historicalWeather: z.boolean(),
    futureModelWorlds: z.enum([
      "applied",
      "not_prepared",
      "incomplete",
      "not_needed",
    ]),
  }),
  planning: z.strictObject({
    requestedEarliestStartDate: calendarDateSchema,
    requestedLatestStartDate: calendarDateSchema,
    effectiveEarliestStartDate: calendarDateSchema,
    effectiveLatestStartDate: calendarDateSchema,
  }),
});
export type WhatIfResult = z.infer<typeof whatIfResultSchema>;
export const rotationAssessmentV5Schema = z.strictObject({
  ...assessmentFields,
  engineVersion: z.enum(["rotation-engine-5", "rotation-engine-6"]),
  policy: rotationPolicyV2Schema,
  candidates: z.array(rotationCandidateV5Schema).max(500),
  // Modelled soil for the field's cell; a farmer's test takes precedence.
  soilEstimate: soilEstimateSchema.nullable(),
  // Added after ranking for the top rotations; it does not change their order.
  yields: rotationYieldsSchema.nullable().optional(),
  soilCarbon: rotationSoilCarbonSchema.nullable().optional(),
  rain: z.strictObject({
    source: z.enum(["power_only", "power_corrected_to_gpm"]),
    reference: z.string().max(80).nullable(),
    firstYear: z.number().int().nullable(),
    lastYear: z.number().int().nullable(),
    powerAnnualMm: z.number().nonnegative().nullable(),
    referenceAnnualMm: z.number().nonnegative().nullable(),
    monthlyFactors: z.array(z.number().min(0).max(10)).length(12).nullable(),
  }),
  futureClimate: futureClimateSchema,
  whatIf: whatIfResultSchema.optional(),
  outputs: rotationOutputsSchema.optional(),
  catalogResearch: catalogResearchCoverageSchema.optional(),
});
// Engine 7: the farmer's current rotation is scored beside at least two
// alternatives, each explained with keyed notes. The ranking is the same as
// engine 6's; this section only organises and explains it.
export const strategyNoteKinds = [
  "why",
  "evidence",
  "benefit",
  "gap",
  "risk",
] as const;
export const strategyNoteSchema = z.strictObject({
  kind: z.enum(strategyNoteKinds),
  // Stable key for the interface to translate; `text` is the English default.
  code: z.string().regex(/^[A-Z][A-Z0-9_]{2,59}$/),
  text: z.string().min(1).max(500),
  benefitEvidence: z
    .array(
      benefitSelectionSchema.extend({
        cropId: catalogIdSchema,
      }),
    )
    .min(1)
    .max(60)
    .optional(),
  facts: z.record(
    z.string().max(60),
    z.union([z.string().max(300), z.number().finite(), z.boolean(), z.null()]),
  ),
});
export type StrategyNote = z.infer<typeof strategyNoteSchema>;
const strategyEvidenceSchema = z.strictObject({
  crops: z.array(catalogIdSchema).min(1).max(20),
  extracted: z.number().int().nonnegative(),
  double_checked: z.number().int().nonnegative(),
  expert_reviewed: z.number().int().nonnegative(),
  model_recall: z.number().int().nonnegative(),
});
const strategyChangeSchema = z.number().min(-1).max(1).nullable();
export const rotationStrategySchema = z.strictObject({
  resources: rotationResourcesSchema.optional(),
  id: z.enum(["current", "alternative_1", "alternative_2", "alternative_3"]),
  role: z.enum(["current", "alternative"]),
  source: z.enum(["farmer_declared", "inferred_from_history", "engine_ranked"]),
  candidateId: z.string().min(1).max(2000),
  cropIds: z.array(catalogIdSchema).min(1).max(20),
  rank: z.number().int().positive(),
  weightedLoss: z.number().min(0).max(1),
  scores: dimensionScores,
  // Positive means more loss than the current rotation, negative less.
  versusCurrent: z
    .strictObject({
      weightedLoss: z.number().min(-1).max(1),
      climate: strategyChangeSchema,
      water: strategyChangeSchema,
      soil_health: strategyChangeSchema,
      crop_health: strategyChangeSchema,
    })
    .nullable(),
  evidence: strategyEvidenceSchema,
  notes: z.array(strategyNoteSchema).min(1).max(40),
});
export type RotationStrategy = z.infer<typeof rotationStrategySchema>;
export const rotationStrategiesSchema = z.strictObject({
  status: z.enum([
    "complete",
    "baseline_unavailable",
    "insufficient_alternatives",
  ]),
  requiredAlternatives: z.literal(2),
  alternativesFound: z.number().int().min(0).max(3),
  baseline: z.strictObject({
    status: z.enum(["scored", "not_provided", "not_evaluable"]),
    source: z.enum(["farmer_declared", "inferred_from_history", "none"]),
    cropIds: z.array(catalogIdSchema).max(6),
    notes: z.array(strategyNoteSchema).max(20),
  }),
  items: z.array(rotationStrategySchema).max(4),
  priorities: z.strictObject({
    requested: z.strictObject({
      climate: z.number().int().min(0).max(5),
      water: z.number().int().min(0).max(5),
      soil_health: z.number().int().min(0).max(5),
      crop_health: z.number().int().min(0).max(5),
    }),
    applied: weightsSchema,
    farmerContext: farmerContextSchema.nullable(),
    notes: z.array(strategyNoteSchema).max(10),
  }),
  reminders: z
    .array(
      z.strictObject({
        code: z.string().regex(/^[A-Z][A-Z0-9_]{2,59}$/),
        text: z.string().min(1).max(500),
      }),
    )
    .min(3)
    .max(8),
});
export type RotationStrategies = z.infer<typeof rotationStrategiesSchema>;
export const rotationAssessmentV6Schema = z.strictObject({
  ...assessmentFields,
  engineVersion: z.literal("rotation-engine-7"),
  policy: rotationPolicyV2Schema,
  candidates: z.array(rotationCandidateV5Schema).max(500),
  soilEstimate: soilEstimateSchema.nullable(),
  yields: rotationYieldsSchema.nullable().optional(),
  soilCarbon: rotationSoilCarbonSchema.nullable().optional(),
  rain: rotationAssessmentV5Schema.shape.rain,
  futureClimate: futureClimateSchema,
  strategies: rotationStrategiesSchema,
  whatIf: whatIfResultSchema.optional(),
  outputs: rotationOutputsSchema.optional(),
  catalogResearch: catalogResearchCoverageSchema.optional(),
});
export const rotationAssessmentSchema = z
  .union([
    rotationAssessmentV3Schema,
    rotationAssessmentV4Schema,
    rotationAssessmentV5Schema,
    rotationAssessmentV6Schema,
  ])
  .superRefine((result, ctx) => {
    if (
      "comparison" in result.policy &&
      result.policy.comparison &&
      "futureClimate" in result
    ) {
      const fail = () =>
        ctx.addIssue({
          code: "custom",
          message: "Regional climate coverage mismatch",
        });
      for (const block of [
        result.futureClimate,
        ...(result.futureClimate.nearTerm
          ? [result.futureClimate.nearTerm]
          : []),
      ]) {
        if (
          (block.status === "compared") !==
            block.worlds.some((w) => (w.comparedCandidateCount ?? 0) > 0) ||
          (block.status === "compared") !== (block.reason === null)
        )
          fail();
        for (const w of block.worlds)
          if (
            w.comparedCandidateCount === undefined ||
            w.notComparedCandidateCount === undefined ||
            w.comparedCandidateCount + w.notComparedCandidateCount !==
              result.accounting.compared ||
            (w.status === "compared") !== w.comparedCandidateCount > 0
          )
            fail();
      }
      const policy = result.policy.futureClimate;
      const expected = [
        ...policy.futures.map((w) => ({ period: "mid_century", w })),
        ...(policy.nearTerm?.windows.map((w) => ({ period: "near_term", w })) ??
          []),
      ]
        .flatMap(({ period, w }) =>
          policy.models.map((m) => `${period}|${m.id}|${w.experiment}`),
        )
        .sort();
      for (const c of result.candidates) {
        if (c.cropConditions !== "assessment_crops" || !c.future?.comparisons) {
          fail();
          continue;
        }
        const rows = c.future.comparisons;
        if (
          JSON.stringify(
            rows.map((r) => `${r.period}|${r.model}|${r.experiment}`).sort(),
          ) !== JSON.stringify(expected)
        )
          fail();
        for (const row of rows) {
          const models =
            (row.period === "near_term"
              ? c.future.nearTerm
              : c.future.scenarios
            )?.find((s) => s.experiment === row.experiment)?.models ?? [];
          if (
            (row.status === "compared") !== (row.reason === null) ||
            (row.status === "compared") !==
              models.some((m) => m.model === row.model)
          )
            fail();
        }
      }
    }
    const research =
      "research" in result.policy && result.policy.research !== undefined;
    const report =
      "catalogResearch" in result && result.catalogResearch !== undefined;
    if (
      (!research && report) ||
      result.candidates.some(
        (c) => ("resources" in c && c.resources !== undefined) !== report,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Catalog research policy mismatch",
      });
    const enabled =
      "outputs" in result.policy && result.policy.outputs !== undefined;
    const present = "outputs" in result && result.outputs !== undefined;
    if (
      enabled !== present ||
      result.candidates.some(
        (c) =>
          enabled !==
          (c.vulnerabilitySeasons !== undefined &&
            c.terrainContext !== undefined),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Rotation output policy mismatch",
      });
  });
export type RotationAssessment = z.infer<typeof rotationAssessmentSchema>;
export type RotationAssessmentV4 = z.infer<typeof rotationAssessmentV4Schema>;
export type RotationCandidate = z.infer<typeof rotationCandidateV5Schema>;
export type RotationAssessmentV5 = z.infer<typeof rotationAssessmentV5Schema>;
export type RotationAssessmentV6 = z.infer<typeof rotationAssessmentV6Schema>;
