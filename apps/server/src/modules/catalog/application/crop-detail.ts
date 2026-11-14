import { glossaryFor } from "@rotavise/domain";
import {
  cropDetailSchema,
  benefitEffectCategories,
  type CatalogRule,
  type CatalogRuleV2,
  type CropDetail,
  type LocalName,
  type ModelRecall,
} from "@rotavise/contracts";
import type { VerifiedCatalog } from "./catalog-store.js";

const LANGUAGES = ["en", "fr", "ar", "ary"] as const;
const BENEFIT_TOPICS = new Set([
  "nitrogen_fixation",
  "rooting_depth",
  "organic_matter_contribution",
  "erosion_protection",
  "forage_value",
]);

// Projection only: preserve stored evidence and rule scope; never turn a
// reference, an ordinal class or a recalled value into a recommendation.
export function buildCropDetail(
  stored: Pick<VerifiedCatalog, "catalog" | "sha256" | "format">,
  cropId: string,
): CropDetail | null {
  const profile = stored.catalog.profiles.find((p) => p.id === cropId);
  if (!profile) return null;
  const gaps: CropDetail["gaps"] = [];
  const gap = (
    code: CropDetail["gaps"][number]["code"],
    path: string,
    reason: string,
  ) => gaps.push({ code, path, reason });
  const missing = (path: string) =>
    gap(
      "CROP_DETAIL_MISSING",
      path,
      "This field is not recorded in this catalog profile.",
    );
  const provenance = (
    item: { citations: unknown[]; recall?: ModelRecall | undefined },
    path: string,
  ) => {
    if (!item.recall)
      gap(
        "CROP_DETAIL_VERIFICATION_MISSING",
        path,
        "Citations are recorded, but no verification status is recorded for this item.",
      );
    return {
      evidence: item.recall ? ("model_recall" as const) : ("sourced" as const),
      recall: item.recall ?? null,
      verification: item.recall
        ? { status: "model_recall" as const, ...item.recall }
        : null,
    };
  };
  const names = (
    items: LocalName[],
    path: string,
  ): CropDetail["identity"]["names"] => {
    for (const language of LANGUAGES)
      if (!items.some((n) => n.language === language))
        gap(
          "CROP_DETAIL_NAMES_INCOMPLETE",
          `${path}.${language}`,
          "No name is explicitly labelled with this language in the catalog; the primary name has no recorded language.",
        );
    return items.map((n, index) => {
      if (
        (!n.citations && !n.recall && !n.origin) ||
        n.preferred === undefined ||
        (!n.confidence && !n.recall && !n.origin)
      )
        gap(
          "CROP_DETAIL_NAMES_INCOMPLETE",
          `${path}[${index}]`,
          "Some name provenance, confidence or preference metadata is not recorded; null does not mean confirmed or not preferred.",
        );
      return {
        language: n.language,
        name: n.name,
        confidence: n.confidence ?? n.recall?.confidence ?? null,
        preferred: n.preferred ?? null,
        ...(n.origin ? { origin: n.origin } : {}),
        evidence: n.recall
          ? "model_recall"
          : n.citations?.length
            ? "sourced"
            : null,
        citations: n.citations ?? [],
        recall: n.recall ?? null,
      };
    });
  };
  const ruleItem = (
    rule: CatalogRule | CatalogRuleV2,
  ): CropDetail["calendar"]["plantingWindows"][number] => {
    const verification = "verification" in rule ? rule.verification : null;
    if (!verification)
      gap(
        "CROP_DETAIL_VERIFICATION_MISSING",
        `rules.${rule.id}`,
        "Legacy rule reviewStatus is preserved; this catalog format has no rule verification record.",
      );
    return {
      evidence:
        verification?.status === "model_recall" ? "model_recall" : "sourced",
      unit:
        rule.metric === "planting_window"
          ? "month_day"
          : rule.metric === "minimum_return_interval"
            ? "calendar_year"
            : rule.metric.endsWith("predecessor_family")
              ? "family"
              : "calendar_day",
      verification,
      rule,
    };
  };
  // Narrow the profile by its actual format; do not convert immutable releases.
  const v2 = "rules" in profile ? profile : null;
  const v1 = "knowledge" in profile ? profile : null;
  const allRules =
    v2?.rules ??
    Object.values(v1!.knowledge).flatMap((k) =>
      k?.status === "sourced" ? k.rules : [],
    );
  const selected = (metrics: string[], path: string) => {
    const items = allRules
      .filter((r) => metrics.includes(r.metric))
      .map(ruleItem);
    if (!items.length) missing(path);
    return items;
  };
  const facts = (v2?.references ?? []).map((fact) => ({
    ...fact,
    ...provenance(fact, `facts.${fact.id}`),
    // Keep the optional recall field exactly as stored for reference contracts.
    ...(fact.recall ? { recall: fact.recall } : { recall: undefined }),
  }));
  const benefits = facts.filter((fact) => BENEFIT_TOPICS.has(fact.topic));
  if (!facts.length) missing("facts");
  if (!benefits.length) missing("benefits");
  if (!v2) missing("modelType");
  const issues: CropDetail["issues"] =
    stored.format === "2" && "issues" in stored.catalog
      ? stored.catalog.issues
          .filter((i) => i.hostCropIds.includes(cropId))
          .map((issue) => ({
            issue_id: issue.id,
            kind: issue.kind,
            name: issue.name,
            scientificName: issue.scientificName,
            names: names(issue.localNames, `issues.${issue.id}.names`),
            visibleSymptoms: issue.visibleSymptoms ?? null,
            citations: issue.citations,
            ...provenance(issue, `issues.${issue.id}`),
          }))
      : [];
  if (!issues.length) missing("issues");
  for (const issue of issues) {
    if (issue.scientificName === null)
      missing(`issues.${issue.issue_id}.scientificName`);
    if (issue.visibleSymptoms === null)
      missing(`issues.${issue.issue_id}.visibleSymptoms`);
  }
  // This is a catalog classification gap, not a claim that the crop cannot
  // have these problems. Preserve weeds/parasitic plants instead of relabelling.
  gap(
    "CROP_DETAIL_MISSING",
    "issues.kinds",
    "The catalog issue contract has disease, pest, parasitic_plant and weed; deficiency and disorder classifications are not recorded.",
  );
  const cultivars: CropDetail["cultivars"] = v2
    ? v2.cultivars.map((c) => ({
        id: c.id,
        name: c.name,
        registration: c.registration,
        names: names(c.localNames ?? [], `cultivars.${c.id}.names`),
        notes: c.notes ?? null,
        citations: c.citations,
        ...provenance(c, `cultivars.${c.id}`),
      }))
    : v1?.cultivar.status === "specified"
      ? [
          {
            id: v1.cultivar.id,
            name: v1.cultivar.name,
            registration: null,
            names: names([], `cultivars.${v1.cultivar.id}.names`),
            notes: null,
            citations: v1.cultivar.citations,
            ...provenance(v1.cultivar, `cultivars.${v1.cultivar.id}`),
          },
        ]
      : [];
  if (!cultivars.length) missing("cultivars");
  for (const cultivar of cultivars) {
    if (cultivar.registration === null)
      missing(`cultivars.${cultivar.id}.registration`);
    if (cultivar.notes === null) missing(`cultivars.${cultivar.id}.notes`);
  }
  for (const g of v2?.gaps ?? [])
    gap("CROP_DETAIL_CATALOG_GAP", `profile.${g.topic}`, g.reason);
  if (v1) {
    for (const [topic, k] of Object.entries(v1.knowledge))
      if (k?.status === "unknown")
        gap("CROP_DETAIL_CATALOG_GAP", `profile.${topic}`, k.reason);
    if (v1.cultivar.status === "unknown")
      gap("CROP_DETAIL_CATALOG_GAP", "profile.cultivar", v1.cultivar.reason);
  }
  const result = {
    catalogId: stored.catalog.id,
    catalogVersion: stored.catalog.version,
    catalogSha256: stored.sha256,
    cropId: profile.id,
    profileVersion: profile.version,
    format: stored.format,
    identity: {
      name: profile.identity.name,
      scientificName: profile.identity.scientificName,
      family: profile.identity.family,
      names: names(v2?.identity.localNames ?? [], "identity.names"),
      citations: profile.identity.citations,
      ...provenance(profile.identity, "identity"),
    },
    modelType: v2?.modelType ?? null,
    harvestProduct: profile.harvestProduct,
    calendar: {
      plantingWindows: selected(
        ["planting_window"],
        "calendar.plantingWindows",
      ),
      durationRanges: selected(["cycle_duration"], "calendar.durationRanges"),
    },
    rotationRules: {
      predecessorFamilies: selected(
        ["preferred_predecessor_family", "prohibited_predecessor_family"],
        "rotationRules.predecessorFamilies",
      ),
      returnIntervals: selected(
        ["minimum_return_interval"],
        "rotationRules.returnIntervals",
      ),
      healthBreaks: selected(
        ["crop_health_break"],
        "rotationRules.healthBreaks",
      ),
    },
    issues,
    facts,
    benefits,
    ...(v2?.research
      ? {
          research: {
            ...v2.research,
            benefitEffects: benefitEffectCategories.map((category) => {
              const all = [
                ...v2.research!.benefits.findings,
                ...(v2.research!.benefits.records ?? []),
              ].filter((f) => f.category === category);
              const sourced = all
                .filter((f) => !("status" in f) || f.status === "sourced")
                .sort((a, b) => Number(a.nonLocal) - Number(b.nonLocal));
              const recalled = all.filter(
                (f) => "status" in f && f.status === "model_recall",
              );
              const selected = sourced.length
                ? sourced
                : recalled.length
                  ? recalled
                  : all;
              const first = selected[0];
              return {
                category,
                status: !first
                  ? ("no_data" as const)
                  : !("status" in first) || first.status === "sourced"
                    ? ("sourced" as const)
                    : first.status === "model_recall"
                      ? ("model_recall" as const)
                      : ("not_applicable" as const),
                confidence:
                  first && "recall" in first ? first.recall.confidence : null,
                findingIds: selected.map((f) => f.id),
              };
            }),
            incomeFields: (
              ["prices", "yields", "costs", "margins"] as const
            ).map((kind) => {
              const facts = v2.research!.income.facts.filter(
                (f) => f.kind === kind,
              );
              return {
                kind,
                status: facts.length
                  ? ("sourced" as const)
                  : ("no_data" as const),
                factIds: facts.map((f) => f.id),
              };
            }),
            roleExplanations: LANGUAGES.map((language) =>
              glossaryFor(language, "role"),
            ),
          },
        }
      : {}),
    cultivars,
    sources: [] as CropDetail["sources"],
    gaps,
    limitations: profile.limitations,
  };
  const sourceIds = new Set<string>();
  const collect = (item: unknown): void => {
    if (Array.isArray(item)) {
      item.forEach(collect);
      return;
    }
    if (item && typeof item === "object") {
      if ("sourceId" in item && typeof item.sourceId === "string")
        sourceIds.add(item.sourceId);
      Object.entries(item)
        .filter(([key]) => key !== "roleExplanations")
        .forEach(([, value]) => collect(value));
    }
  };
  collect(result);
  result.sources = stored.catalog.sources
    .filter((s) => sourceIds.has(s.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      publisher: s.publisher,
      url: s.url,
      limitations: s.limitations,
    }));
  return cropDetailSchema.parse(result);
}
