import {
  catalogBundleSchema,
  type CatalogBundle,
  type CatalogRule,
} from "@rotavise/contracts";

export class CatalogValidationError extends Error {
  constructor(
    public readonly code: "CATALOG_INVALID" | "CATALOG_SYNTHETIC_REJECTED",
    public readonly paths: string[] = [],
  ) {
    super(code);
  }
}
const groups: Record<
  keyof CatalogBundle["profiles"][number]["knowledge"],
  CatalogRule["metric"][]
> = {
  plantingWindows: ["planting_window"],
  duration: ["cycle_duration"],
  soilRequirements: ["soil_ph", "soil_drainage"],
  temperatureRequirements: ["temperature"],
  waterDemandClass: ["water_demand_class"],
  waterReference: ["seasonal_crop_water_reference", "annual_water_reference"],
  rotationRestrictions: [
    "preferred_predecessor_family",
    "minimum_return_interval",
    "prohibited_predecessor_family",
  ],
  healthRestrictions: ["crop_health_break"],
};
export function validateCatalogStructure(input: unknown): CatalogBundle {
  const parsed = catalogBundleSchema.safeParse(input);
  if (!parsed.success)
    throw new CatalogValidationError(
      "CATALOG_INVALID",
      parsed.error.issues.slice(0, 20).map((i) => i.path.join(".")),
    );
  const catalog = parsed.data;
  const errors: string[] = [];
  const unique = (values: string[], path: string) => {
    if (new Set(values).size !== values.length) errors.push(path);
  };
  for (const key of ["sources", "regions", "profiles"] as const)
    unique(
      catalog[key].map((v) => v.id),
      key,
    );
  const sources = new Map(catalog.sources.map((s) => [s.id, s]));
  const regions = new Set(catalog.regions.map((r) => r.id));
  const crops = new Set(catalog.profiles.map((p) => p.id));
  function checkCitations(citations: { sourceId: string }[], path: string) {
    if (citations.some((c) => !sources.has(c.sourceId))) errors.push(path);
  }
  for (const region of catalog.regions)
    checkCitations(region.citations, `regions.${region.id}.citations`);
  const rules: string[] = [];
  for (const profile of catalog.profiles) {
    checkCitations(
      profile.identity.citations,
      `profiles.${profile.id}.identity`,
    );
    if (profile.cultivar.status === "specified")
      checkCitations(
        profile.cultivar.citations,
        `profiles.${profile.id}.cultivar`,
      );
    unique(
      profile.productionSystems,
      `profiles.${profile.id}.productionSystems`,
    );
    unique(
      profile.applicability.map((a) => a.regionId),
      `profiles.${profile.id}.applicability`,
    );
    if (profile.review.status === "reviewed")
      unique(profile.review.regionIds, `profiles.${profile.id}.review`);
    if (
      profile.review.status === "reviewed" &&
      profile.review.regionIds.some((id) => !regions.has(id))
    )
      errors.push(`profiles.${profile.id}.review`);
    for (const entry of profile.applicability) {
      checkCitations(
        entry.citations,
        `profiles.${profile.id}.applicability.citations`,
      );
      if (!regions.has(entry.regionId))
        errors.push(`profiles.${profile.id}.applicability.region`);
      if (
        entry.status === "reviewed" &&
        (profile.review.status !== "reviewed" ||
          !profile.review.regionIds.includes(entry.regionId))
      )
        errors.push(`profiles.${profile.id}.applicability.review`);
    }
    for (const key of Object.keys(groups) as (keyof typeof groups)[]) {
      const knowledge = profile.knowledge[key];
      if (!knowledge || knowledge.status === "unknown") continue;
      for (const rule of knowledge.rules) {
        rules.push(rule.id);
        checkCitations(rule.citations, `rules.${rule.id}.citations`);
        if (
          rule.citations.every(
            (citation) => citation.interpretation === "context_only",
          )
        )
          errors.push(`rules.${rule.id}.evidence`);
        if (!groups[key].includes(rule.metric))
          errors.push(`rules.${rule.id}.metric`);
        if (rule.evidenceRegionIds.some((id) => !regions.has(id)))
          errors.push(`rules.${rule.id}.region`);
        if (
          rule.metric === "minimum_return_interval" &&
          !crops.has(rule.cropId)
        )
          errors.push(`rules.${rule.id}.crop`);
        if (
          rule.metric === "minimum_return_interval" &&
          rule.cropId !== profile.id
        )
          errors.push(`rules.${rule.id}.target`);
        if (
          rule.productionSystems.some(
            (system) => !profile.productionSystems.includes(system),
          )
        )
          errors.push(`rules.${rule.id}.productionSystems`);
        if (
          rule.reviewStatus === "reviewed" &&
          profile.review.status !== "reviewed"
        )
          errors.push(`rules.${rule.id}.review`);
        const review = profile.review;
        if (
          rule.reviewStatus === "reviewed" &&
          review.status === "reviewed" &&
          rule.evidenceRegionIds.some(
            (id) =>
              !review.regionIds.includes(id) ||
              !profile.applicability.some(
                (a) => a.regionId === id && a.status === "reviewed",
              ),
          )
        )
          errors.push(`rules.${rule.id}.reviewScope`);
        if (
          rule.executionScope &&
          (profile.cultivar.status !== "specified" ||
            rule.executionScope.cultivarId !== profile.cultivar.id)
        )
          errors.push(`rules.${rule.id}.cultivarScope`);
        if (
          rule.metric === "crop_health_break" &&
          (rule.hostCropIds.some((id) => !crops.has(id)) ||
            !rule.hostCropIds.includes(profile.id))
        )
          errors.push(`rules.${rule.id}.hosts`);
      }
    }
  }
  unique(rules, "rules");
  if (errors.length)
    throw new CatalogValidationError("CATALOG_INVALID", errors.slice(0, 20));
  return catalog;
}
export function validateProductionCatalog(input: unknown): CatalogBundle {
  // Reject flags before any rule extraction, including nested evidence.
  const parsed = catalogBundleSchema.safeParse(input);
  if (!parsed.success)
    throw new CatalogValidationError(
      "CATALOG_INVALID",
      parsed.error.issues.slice(0, 20).map((i) => i.path.join(".")),
    );
  if (
    parsed.data.synthetic ||
    parsed.data.profiles.some((p) => p.synthetic) ||
    parsed.data.sources.some((s) => s.synthetic)
  )
    throw new CatalogValidationError("CATALOG_SYNTHETIC_REJECTED");
  return validateCatalogStructure(parsed.data);
}
