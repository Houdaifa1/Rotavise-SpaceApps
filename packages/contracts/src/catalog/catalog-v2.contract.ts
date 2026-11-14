import { z } from "zod";
import {
  catalogIdSchema,
  catalogSourceSchema,
  catalogTextSchema,
  catalogVersionSchema,
  citationSchema,
  citationsSchema,
} from "./source.contract.js";
import { cropResearchSchema } from "./research.contract.js";
import { monthDaySchema } from "./rule.contract.js";
import { modelRecallSchema, type ModelRecall } from "./recall.contract.js";
export { modelRecallSchema, type ModelRecall } from "./recall.contract.js";

// Catalog format 2 (Step 10). Format 1 stays readable for earlier plans.
export const farmingSystemSchema = z.enum(["rainfed", "irrigated"]);
const family = z.string().regex(/^[A-Z][a-z]+aceae$/);
const isoDate = z.iso.date();
// Knowledge recalled by the AI model from its training. It has no citation or
// quote, only this small provenance record, and the engine treats it like any
// other rule.
// A name may carry recall (0.12.0) or sourced evidence (0.13.0). Short names
// need short exact quotes; the longer minimum for agronomic rules stays intact.
const nameCitationSchema = citationSchema.extend({
  quote: z.string().min(1).max(800),
});
const localNameSchema = z
  .strictObject({
    // fr French, ar Modern Standard Arabic, ary Moroccan Arabic, zgh Standard Moroccan Amazigh, en English.
    language: z.enum(["fr", "ar", "ary", "zgh", "en"]),
    name: catalogTextSchema.max(120),
    recall: modelRecallSchema.optional(),
    citations: z.array(nameCitationSchema).min(1).max(12).optional(),
    confidence: z.enum(["low", "medium", "high"]).optional(),
    // Optional, with no default: older releases retain their canonical hashes.
    preferred: z.boolean().optional(),
  })
  .refine(
    (n) =>
      (!n.citations || (n.confidence !== undefined && !n.recall)) &&
      (!n.preferred || n.citations !== undefined),
    "Sourced names need confidence, cannot claim recall, and alone may be preferred",
  );
export type LocalName = z.infer<typeof localNameSchema>;
const localNamesSchema = z
  .array(localNameSchema)
  .max(12)
  .refine((names) => {
    const preferred = names.filter((n) => n.preferred).map((n) => n.language);
    return new Set(preferred).size === preferred.length;
  }, "Only one preferred name per language");
// Sourced citations may be absent only when the item carries recalled evidence.
const optionalCitations = z.array(citationSchema).max(12);
const needsEvidence = (v: {
  citations: unknown[];
  recall?: ModelRecall | undefined;
}) => v.citations.length > 0 || v.recall !== undefined;
const EVIDENCE_MESSAGE = "Needs a citation or recalled evidence";

// "any": the source states the rule holds regardless; "unspecified": the source
// is silent, so the engine applies it with a visible condition.
const scoped = <T extends z.ZodType>(item: T, max: number) =>
  z.union([
    z.literal("any"),
    z.literal("unspecified"),
    z.array(item).min(1).max(max),
  ]);
export const ruleScopeSchema = z.strictObject({
  regionIds: z.array(catalogIdSchema).min(1).max(12),
  farmingSystems: scoped(farmingSystemSchema, 2),
  cultivarIds: scoped(catalogIdSchema, 20),
});
// Extracted once; independently re-read against the cited page; or reviewed by
// a named specialist. Only the last two may drive schedules or constraints.
export const ruleVerificationSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("extracted") }),
  z.strictObject({
    status: z.literal("double_checked"),
    checkedOn: isoDate,
    // The quote was found by machine on the cited page and a second reading
    // confirmed the interpretation (Step 12).
    method: z.literal("quote_match_and_second_reading").optional(),
  }),
  z.strictObject({
    status: z.literal("expert_reviewed"),
    reviewer: catalogTextSchema.max(200),
    qualification: catalogTextSchema.max(300),
    reviewedOn: isoDate,
  }),
  // Recalled by the model; provenance only, used by the engine like any rule.
  z.strictObject({
    status: z.literal("model_recall"),
    ...modelRecallSchema.shape,
  }),
]);
const base = {
  id: catalogIdSchema,
  citations: optionalCitations,
  scope: ruleScopeSchema,
  severity: z.enum(["reference", "soft", "hard"]),
  verification: ruleVerificationSchema,
  conditions: catalogTextSchema,
};
export const catalogRuleV2Schema = z
  .discriminatedUnion("metric", [
    z.strictObject({
      ...base,
      metric: z.literal("planting_window"),
      start: monthDaySchema,
      end: monthDaySchema,
      precision: z.enum(["full_month", "approximate", "exact_day"]),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("cycle_duration"),
      basis: z.enum(["sowing_to_harvest", "stand_lifetime"]),
      minDays: z.number().int().min(1).max(18250),
      maxDays: z.number().int().min(1).max(18250),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("preparation_gap"),
      minimumDays: z.number().int().min(0).max(365),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("temperature"),
      basis: z.enum([
        "daily_minimum",
        "daily_maximum",
        "daily_mean",
        "stage_mean",
        "unspecified",
      ]),
      medium: z.enum(["air", "soil", "unspecified"]),
      stage: z.enum([
        "germination",
        "emergence",
        "vegetative_growth",
        "flowering",
        "grain_filling",
        "pod_formation",
        "whole_cycle",
        // Any other stage named in the conditions text; evidence only.
        "other",
      ]),
      // Timing of a stage: days after sowing, or thermal time since sowing
      // by AquaCrop's growing-degree-day method 3 (FAO AquaCrop reference
      // manual, chapter 3), so phenology follows each season's temperatures.
      stageWindow: z
        .discriminatedUnion("basis", [
          z.strictObject({
            basis: z.literal("elapsed_days_from_sowing"),
            startDay: z.number().int().min(0).max(3650),
            endDay: z.number().int().min(0).max(3650),
          }),
          z.strictObject({
            basis: z.literal("growing_degree_days_from_sowing"),
            method: z.literal("aquacrop_method_3"),
            startGdd: z.number().min(0).max(10000),
            endGdd: z.number().min(0).max(10000),
            baseDegC: z.number().min(-10).max(30),
            upperDegC: z.number().min(0).max(50),
          }),
        ])
        .nullable(),
      lowerDegC: z.number().finite().min(-60).max(60).nullable(),
      upperDegC: z.number().finite().min(-60).max(60).nullable(),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("soil_ph"),
      method: z.enum([
        "water_extract",
        "calcium_chloride_extract",
        "unspecified",
      ]),
      min: z.number().min(0).max(14),
      max: z.number().min(0).max(14),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("soil_salinity"),
      method: z.enum(["saturated_paste_ece", "unspecified"]),
      maxDsPerM: z.number().positive().max(100),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("soil_drainage"),
      value: z.enum(["well_drained", "avoid_waterlogging"]),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("water_demand_class"),
      value: z.enum(["low", "moderate", "high"]),
      comparisonMethod: catalogTextSchema,
    }),
    z.strictObject({
      ...base,
      metric: z.literal("crop_water_coefficient"),
      kcIni: z.number().positive().max(2),
      kcMid: z.number().positive().max(2),
      kcEnd: z.number().positive().max(2),
      stageLengths: z.tuple([
        z.number().int().positive().max(1000),
        z.number().int().positive().max(1000),
        z.number().int().positive().max(1000),
        z.number().int().positive().max(1000),
      ]),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("water_reference"),
      basis: z.enum(["seasonal_scenario", "annual_rainfall"]),
      minMm: z.number().nonnegative().max(10000),
      minInclusive: z.boolean(),
      maxMm: z.number().nonnegative().max(10000).nullable(),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("preferred_predecessor_family"),
      family,
    }),
    z.strictObject({
      ...base,
      metric: z.literal("prohibited_predecessor_family"),
      family,
    }),
    z.strictObject({
      ...base,
      metric: z.literal("minimum_return_interval"),
      years: z.number().int().min(1).max(20),
    }),
    z.strictObject({
      ...base,
      metric: z.literal("crop_health_break"),
      issueId: catalogIdSchema,
      minimumBreakDays: z.number().int().min(1).max(7300),
    }),
  ])
  .superRefine((rule, ctx) => {
    const issue = (message: string) =>
      ctx.addIssue({ code: "custom", message });
    if (rule.metric === "planting_window" && rule.precision === "full_month") {
      const [month, day] = rule.end.split("-").map(Number);
      if (
        !rule.start.endsWith("-01") ||
        day !== new Date(Date.UTC(2000, month!, 0)).getUTCDate()
      )
        issue("Full-month windows require whole calendar-month boundaries");
    }
    if ("min" in rule && rule.min > rule.max) issue("Reversed range");
    if ("minDays" in rule && rule.minDays > rule.maxDays)
      issue("Reversed range");
    if (
      rule.metric === "water_reference" &&
      rule.maxMm !== null &&
      rule.minMm > rule.maxMm
    )
      issue("Reversed range");
    if (rule.metric === "temperature") {
      if (rule.lowerDegC === null && rule.upperDegC === null)
        issue("A temperature rule needs at least one bound");
      if (
        rule.lowerDegC !== null &&
        rule.upperDegC !== null &&
        rule.lowerDegC > rule.upperDegC
      )
        issue("Reversed range");
      // A stage without an elapsed-day window has unknown timing: kept as
      // evidence, never evaluated against weather.
      const window = rule.stageWindow;
      if (
        (rule.stage === "whole_cycle" && window !== null) ||
        (window?.basis === "elapsed_days_from_sowing" &&
          window.startDay > window.endDay) ||
        (window?.basis === "growing_degree_days_from_sowing" &&
          (window.startGdd > window.endGdd ||
            window.baseDegC >= window.upperDegC))
      )
        issue("Invalid temperature stage window");
    }
    for (const key of ["farmingSystems", "cultivarIds"] as const) {
      const value = rule.scope[key];
      if (Array.isArray(value) && new Set(value).size !== value.length)
        issue("Duplicate scope values");
    }
    if (new Set(rule.scope.regionIds).size !== rule.scope.regionIds.length)
      issue("Duplicate scope values");
    const binding = rule.severity !== "reference";
    if (binding && rule.verification.status === "extracted")
      issue("Binding rules must be double-checked or expert-reviewed");
    if (rule.verification.status === "model_recall") {
      if (rule.citations.some((c) => c.quote !== undefined))
        issue("A recalled rule carries no quotes");
    } else if (rule.citations.length === 0)
      issue("A sourced rule needs a citation");
    if (
      rule.verification.status === "double_checked" &&
      rule.verification.method === "quote_match_and_second_reading" &&
      !rule.citations.some((c) => c.quote !== undefined && c.page !== undefined)
    )
      issue("A quote-checked rule needs a cited page and quote");
    const underspecified =
      (rule.metric === "temperature" &&
        (rule.medium !== "air" ||
          !["daily_minimum", "daily_maximum", "daily_mean"].includes(
            rule.basis,
          ))) ||
      (rule.metric === "temperature" &&
        rule.stage !== "whole_cycle" &&
        rule.stageWindow === null) ||
      (rule.metric === "soil_ph" && rule.method === "unspecified") ||
      (rule.metric === "soil_salinity" && rule.method === "unspecified") ||
      (rule.metric === "planting_window" && rule.precision === "approximate");
    if (rule.severity === "hard" && underspecified)
      issue("Hard rules need an interpretable measurement basis");
    if (
      (rule.metric === "water_reference" ||
        rule.metric === "water_demand_class") &&
      rule.severity === "hard"
    )
      issue("Water references and classes are not hard limits");
    if (rule.metric === "water_reference" && rule.severity !== "reference")
      issue("Water reference is not irrigation sufficiency");
    if (
      rule.metric === "preferred_predecessor_family" &&
      rule.severity === "hard"
    )
      issue("A preference is not a hard exclusion");
  });
export type CatalogRuleV2 = z.infer<typeof catalogRuleV2Schema>;

const position = z.tuple([
  z.number().finite().min(-180).max(180),
  z.number().finite().min(-90).max(90),
]);
const ring = z
  .array(position)
  .min(4)
  .max(50000)
  .refine(
    (r) => r[0]![0] === r.at(-1)![0] && r[0]![1] === r.at(-1)![1],
    "Ring must be closed",
  );
const polygon = z.array(ring).min(1).max(200);
// GeoJSON order: [longitude, latitude], WGS84. The first ring is the outer edge.
export const regionGeometrySchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("Polygon"), coordinates: polygon }),
  z.strictObject({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(polygon).min(1).max(500),
  }),
]);
export type RegionGeometry = z.infer<typeof regionGeometrySchema>;
export const catalogRegionV2Schema = z.strictObject({
  id: catalogIdSchema,
  name: catalogTextSchema,
  countryCode: z.string().regex(/^[A-Z]{2}$/),
  scopeNote: catalogTextSchema,
  citations: citationsSchema,
  // Without a sourced boundary the region cannot be resolved from coordinates.
  boundary: z
    .strictObject({
      sourceId: catalogIdSchema,
      locator: catalogTextSchema,
      geometry: regionGeometrySchema,
    })
    .nullable(),
});
export const catalogSourceV2Schema = catalogSourceSchema.extend({
  kind: z.enum([
    "official_guide",
    "official_statistics",
    "variety_register",
    "scientific_paper",
    "fao_method",
    "taxonomy",
    "boundary_dataset",
    "official_communication",
    "other",
  ]),
  rights: z.strictObject({
    reuse: z.enum(["permitted", "unknown", "restricted"]),
    licence: catalogTextSchema.max(200).nullable(),
    note: catalogTextSchema,
  }),
});
export const cropIssueSchema = z
  .strictObject({
    id: catalogIdSchema,
    kind: z.enum(["disease", "pest", "parasitic_plant", "weed"]),
    name: catalogTextSchema.max(200),
    scientificName: catalogTextSchema.max(200).nullable(),
    localNames: localNamesSchema,
    hostCropIds: z.array(catalogIdSchema).min(1).max(50),
    visibleSymptoms: catalogTextSchema.max(800).optional(),
    citations: optionalCitations,
    recall: modelRecallSchema.optional(),
    synthetic: z.boolean(),
  })
  .refine(needsEvidence, EVIDENCE_MESSAGE);
export type CropIssue = z.infer<typeof cropIssueSchema>;
export const profileReferenceSchema = z
  .strictObject({
    id: catalogIdSchema,
    topic: z.enum([
      "yield",
      "chill_requirement",
      "harvest_window",
      "presence",
      "planner_fit",
      "background",
      // Rotation-benefit classes (0.11.0): value is an ordinal class or range.
      "nitrogen_fixation",
      "rooting_depth",
      "organic_matter_contribution",
      "erosion_protection",
      // Dimensionless RUSLE C factor; ordinal protection is never converted.
      "rusle_cover_management_factor",
      "forage_value",
    ]),
    summary: catalogTextSchema.max(800),
    value: z
      .strictObject({
        unit: z.string().trim().min(1).max(60),
        min: z.number().finite().nullable(),
        max: z.number().finite().nullable(),
      })
      .nullable(),
    citations: optionalCitations,
    recall: modelRecallSchema.optional(),
  })
  .refine(needsEvidence, EVIDENCE_MESSAGE);
export const cropProfileV2Schema = z.strictObject({
  id: catalogIdSchema,
  version: catalogVersionSchema,
  synthetic: z.boolean(),
  identity: z
    .strictObject({
      name: catalogTextSchema,
      localNames: localNamesSchema,
      scientificName: catalogTextSchema,
      family,
      citations: optionalCitations,
      recall: modelRecallSchema.optional(),
    })
    .refine(needsEvidence, EVIDENCE_MESSAGE),
  harvestProduct: z.enum([
    "dry_grain",
    "green_pods",
    "sugar_root",
    "root_tuber",
    "oilseed",
    "forage",
    "fiber",
    "vegetable",
    "fruit",
    "other",
  ]),
  // Orchards and protected crops are listed but not planned by the rotation engine.
  // Orchards, protected crops and wild-harvested plants are listed, not planned.
  modelType: z.enum([
    "annual",
    "multi_year_stand",
    "orchard",
    "protected",
    "wild_harvested",
  ]),
  cultivars: z
    .array(
      z
        .strictObject({
          id: catalogIdSchema,
          name: catalogTextSchema.max(200),
          registration: z.enum(["registered", "not_registered", "unknown"]),
          // Added in 0.12.0; absent in earlier releases.
          localNames: localNamesSchema.optional(),
          citations: optionalCitations,
          recall: modelRecallSchema.optional(),
          notes: catalogTextSchema.max(600).optional(),
        })
        .refine(needsEvidence, EVIDENCE_MESSAGE),
    )
    .max(50),
  applicability: z
    .array(
      z
        .strictObject({
          regionId: catalogIdSchema,
          status: z.enum(["candidate", "reviewed"]),
          citations: optionalCitations,
          recall: modelRecallSchema.optional(),
          note: catalogTextSchema,
        })
        .refine(needsEvidence, EVIDENCE_MESSAGE),
    )
    .min(1)
    .max(12),
  rules: z.array(catalogRuleV2Schema).max(64),
  research: cropResearchSchema.optional(),
  // Facts that are not planner rules: yield ranges, chill hours, background.
  references: z.array(profileReferenceSchema).max(60).optional(),
  gaps: z
    .array(
      z.strictObject({
        topic: z.enum([
          "planting_window",
          "cycle_duration",
          "temperature",
          "soil",
          "water_demand",
          "rotation",
          "crop_health",
          "cultivar",
          "other",
        ]),
        reason: catalogTextSchema,
      }),
    )
    .max(20),
  limitations: z.array(catalogTextSchema).min(1).max(20),
});
export type CropProfileV2 = z.infer<typeof cropProfileV2Schema>;
export const catalogBundleV2Schema = z.strictObject({
  schemaVersion: z.literal("2"),
  id: catalogIdSchema,
  version: catalogVersionSchema,
  synthetic: z.boolean(),
  regions: z.array(catalogRegionV2Schema).min(1).max(50),
  sources: z.array(catalogSourceV2Schema).min(1).max(600),
  issues: z.array(cropIssueSchema).max(1500),
  profiles: z.array(cropProfileV2Schema).min(1).max(300),
  conflicts: z
    .array(
      z.strictObject({
        id: catalogIdSchema,
        ruleIds: z.array(catalogIdSchema).min(2).max(10),
        description: catalogTextSchema,
        resolution: catalogTextSchema.nullable(),
      }),
    )
    .max(300),
});
export type CatalogBundleV2 = z.infer<typeof catalogBundleV2Schema>;
export const catalogReleaseV2Schema = catalogBundleV2Schema
  .omit({ sources: true, profiles: true })
  .extend({
    sourceFile: z.literal("sources.json"),
    profileFiles: z
      .array(z.string().regex(/^profiles\/[a-z][a-z0-9-]{2,79}\.json$/))
      .min(1)
      .max(300),
  })
  .superRefine((release, ctx) => {
    if (new Set(release.profileFiles).size !== release.profileFiles.length)
      ctx.addIssue({
        code: "custom",
        path: ["profileFiles"],
        message: "Duplicate files",
      });
  });
