import { z } from "zod";
import { glossaryResponseSchema } from "../glossary/glossary.contract.js";
import {
  benefitEffectCategories,
  cropResearchSchema,
} from "./research.contract.js";

import {
  catalogIdSchema,
  catalogShaSchema,
  catalogSourceSchema,
  catalogTextSchema,
  catalogVersionSchema,
  citationSchema,
} from "./source.contract.js";
import { catalogRuleSchema } from "./rule.contract.js";
import {
  catalogRuleV2Schema,
  cropIssueSchema,
  cropProfileV2Schema,
  modelRecallSchema,
  profileReferenceSchema,
  ruleVerificationSchema,
} from "./catalog-v2.contract.js";

// Additive: absent on older releases, so their serialized responses stay intact.
export const cropDetailResearchSchema = cropResearchSchema
  .extend({
    benefitEffects: z
      .array(
        z.strictObject({
          category: z.enum(benefitEffectCategories),
          status: z.enum([
            "sourced",
            "model_recall",
            "not_applicable",
            "no_data",
          ]),
          // Null means no confidence was recorded; sourced does not imply high confidence.
          confidence: z.enum(["low", "medium", "high"]).nullable(),
          findingIds: z.array(z.string().min(1).max(200)).max(110),
        }),
      )
      .length(12),
    incomeFields: z
      .array(
        z.strictObject({
          kind: z.enum(["prices", "yields", "costs", "margins"]),
          status: z.enum(["sourced", "no_data"]),
          factIds: z.array(z.string().min(1).max(160)).max(100),
        }),
      )
      .length(4),
    // General explanations, not an assertion that this crop has all four roles.
    // Each citation resolves independently through its recorded URL.
    roleExplanations: z.array(glossaryResponseSchema).length(4),
  })
  .superRefine((value, ctx) => {
    if (
      new Set(value.benefitEffects.map((e) => e.category)).size !== 12 ||
      new Set(value.incomeFields.map((e) => e.kind)).size !== 4
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Research coverage must contain every effect and income field once",
      });
  });
export const cropDetailParamsSchema = z.strictObject({
  catalogId: catalogIdSchema,
  version: catalogVersionSchema,
  cropId: catalogIdSchema,
});
export const cropDetailGapCodeSchema = z.enum([
  "CROP_DETAIL_MISSING",
  "CROP_DETAIL_NAMES_INCOMPLETE",
  "CROP_DETAIL_VERIFICATION_MISSING",
  "CROP_DETAIL_CATALOG_GAP",
]);
export const cropDetailGapSchema = z.strictObject({
  code: cropDetailGapCodeSchema,
  // JSON-style path to the affected entry or section, including its language.
  path: z.string().min(1).max(300),
  reason: catalogTextSchema,
});
const provenanceShape = {
  evidence: z.enum(["sourced", "model_recall"]),
  citations: z.array(citationSchema).max(12),
  recall: modelRecallSchema.nullable(),
  // Null means the catalog records no verification; a citation alone is not
  // an independent check or specialist review.
  verification: ruleVerificationSchema.nullable(),
};
const hasProvenance = (
  value: {
    evidence: "sourced" | "model_recall";
    citations: unknown[];
    recall?: unknown;
    verification: z.infer<typeof ruleVerificationSchema> | null;
  },
  ctx: z.RefinementCtx,
) => {
  const recalled =
    value.recall != null || value.verification?.status === "model_recall";
  if (
    (value.evidence === "sourced" &&
      (value.citations.length === 0 || recalled)) ||
    (value.evidence === "model_recall" && !recalled)
  )
    ctx.addIssue({
      code: "custom",
      message: "Evidence class must match recorded provenance",
    });
};
const nameShape =
  cropProfileV2Schema.shape.identity.shape.localNames.element.shape;
export const cropDetailNameSchema = z
  .strictObject({
    language: nameShape.language,
    name: nameShape.name,
    confidence: nameShape.confidence.unwrap().nullable(),
    preferred: z.boolean().nullable(),
    // Older local names can have neither a citation nor recall metadata.
    evidence: z.enum(["sourced", "model_recall"]).nullable(),
    citations: z.array(nameShape.citations.unwrap().element).max(12),
    recall: modelRecallSchema.nullable(),
  })
  .superRefine((name, ctx) => {
    if (name.evidence === null) {
      if (name.citations.length || name.recall || name.preferred === true)
        ctx.addIssue({
          code: "custom",
          message:
            "Unrecorded name evidence cannot claim provenance or preference",
        });
    } else {
      hasProvenance(
        { ...name, evidence: name.evidence, verification: null },
        ctx,
      );
      if (name.preferred === true && name.evidence !== "sourced")
        ctx.addIssue({
          code: "custom",
          message: "Only sourced names may be preferred",
        });
    }
  });
const names = z.array(cropDetailNameSchema).max(12);
export const cropDetailRuleSchema = z
  .strictObject({
    evidence: provenanceShape.evidence,
    unit: z.enum(["month_day", "calendar_day", "calendar_year", "family"]),
    verification: ruleVerificationSchema.nullable(),
    // Preserve the exact stored scope, conditions, severity and original values
    // of both formats. No aggregation erases disagreements between sources.
    rule: z.union([catalogRuleSchema, catalogRuleV2Schema]),
  })
  .superRefine((item, ctx) => {
    hasProvenance({ ...item.rule, ...item }, ctx);
    const metric = item.rule.metric;
    const unit =
      metric === "planting_window"
        ? "month_day"
        : metric === "minimum_return_interval"
          ? "calendar_year"
          : metric.endsWith("predecessor_family")
            ? "family"
            : "calendar_day";
    if (
      item.unit !== unit ||
      ("verification" in item.rule &&
        JSON.stringify(item.verification) !==
          JSON.stringify(item.rule.verification)) ||
      (!("verification" in item.rule) && item.verification !== null)
    )
      ctx.addIssue({
        code: "custom",
        message: "Rule metadata must preserve the stored unit and verification",
      });
  });
const rulesFor = (metrics: string[]) =>
  z
    .array(cropDetailRuleSchema)
    .max(256)
    .refine(
      (items) => items.every((item) => metrics.includes(item.rule.metric)),
      "Rule metric does not belong to this section",
    );
export const cropDetailFactSchema = profileReferenceSchema
  .safeExtend({
    evidence: provenanceShape.evidence,
    verification: ruleVerificationSchema.nullable(),
  })
  .superRefine(hasProvenance);
export const cropDetailIssueSchema = z
  .strictObject({
    issue_id: catalogIdSchema,
    // Preserve the actual catalog vocabulary. There is no deficiency/disorder
    // classification in the current catalog contract.
    kind: cropIssueSchema.shape.kind,
    name: catalogTextSchema.max(200),
    scientificName: catalogTextSchema.max(200).nullable(),
    names,
    visibleSymptoms: catalogTextSchema.max(800).nullable(),
    ...provenanceShape,
  })
  .superRefine(hasProvenance);
export const cropDetailSchema = z.strictObject({
  catalogId: catalogIdSchema,
  catalogVersion: catalogVersionSchema,
  catalogSha256: catalogShaSchema,
  cropId: catalogIdSchema,
  profileVersion: catalogVersionSchema,
  format: z.enum(["1", "2"]),
  identity: z
    .strictObject({
      name: catalogTextSchema,
      scientificName: catalogTextSchema,
      family: cropProfileV2Schema.shape.identity.shape.family,
      names,
      ...provenanceShape,
    })
    .superRefine(hasProvenance),
  modelType: cropProfileV2Schema.shape.modelType.nullable(),
  harvestProduct: cropProfileV2Schema.shape.harvestProduct,
  calendar: z.strictObject({
    plantingWindows: rulesFor(["planting_window"]),
    durationRanges: rulesFor(["cycle_duration"]),
  }),
  rotationRules: z.strictObject({
    predecessorFamilies: rulesFor([
      "preferred_predecessor_family",
      "prohibited_predecessor_family",
    ]),
    returnIntervals: rulesFor(["minimum_return_interval"]),
    healthBreaks: rulesFor(["crop_health_break"]),
  }),
  issues: z.array(cropDetailIssueSchema).max(1500),
  benefits: z.array(cropDetailFactSchema).max(60),
  research: cropDetailResearchSchema.optional(),
  facts: z.array(cropDetailFactSchema).max(60),
  cultivars: z
    .array(
      z
        .strictObject({
          id: catalogIdSchema,
          name: catalogTextSchema.max(200),
          names,
          registration: z
            .enum(["registered", "not_registered", "unknown"])
            .nullable(),
          notes: catalogTextSchema.max(600).nullable(),
          ...provenanceShape,
        })
        .superRefine(hasProvenance),
    )
    .max(50),
  // Only sources referenced by this response, with their recorded limitations.
  sources: z
    .array(
      catalogSourceSchema.pick({
        id: true,
        title: true,
        publisher: true,
        url: true,
        limitations: true,
      }),
    )
    .max(600),
  gaps: z.array(cropDetailGapSchema).max(12000),
  limitations: z.array(catalogTextSchema).min(1).max(20),
});
export type CropDetail = z.infer<typeof cropDetailSchema>;
