import {
  catalogBundleV2Schema,
  benefitEffectCategories,
  type CatalogBundleV2,
  type RegionGeometry,
} from "@rotavise/contracts";
import { CatalogValidationError } from "./validate-catalog.js";

const MAX_BOUNDARY_VERTICES = 100000;
function vertexCount(geometry: RegionGeometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  return polygons.reduce(
    (n, polygon) => n + polygon.reduce((m, ring) => m + ring.length, 0),
    0,
  );
}
function parse(input: unknown): CatalogBundleV2 {
  const parsed = catalogBundleV2Schema.safeParse(input);
  if (!parsed.success)
    throw new CatalogValidationError(
      "CATALOG_INVALID",
      parsed.error.issues.slice(0, 20).map((i) => i.path.join(".")),
    );
  return parsed.data;
}
// Cross-reference checks that the schema alone cannot express.
export function validateCatalogV2Structure(input: unknown): CatalogBundleV2 {
  const catalog = parse(input);
  const errors: string[] = [];
  const unique = (values: string[], path: string) => {
    if (new Set(values).size !== values.length) errors.push(path);
  };
  for (const key of [
    "sources",
    "regions",
    "issues",
    "profiles",
    "conflicts",
  ] as const)
    unique(
      catalog[key].map((v) => v.id),
      key,
    );
  const sources = new Set(catalog.sources.map((s) => s.id));
  const regions = new Set(catalog.regions.map((r) => r.id));
  const crops = new Set(catalog.profiles.map((p) => p.id));
  const issues = new Map(catalog.issues.map((i) => [i.id, i]));
  const cite = (citations: { sourceId: string }[], path: string) => {
    if (citations.some((c) => !sources.has(c.sourceId))) errors.push(path);
  };
  const names = (
    values: { citations?: { sourceId: string }[] | undefined }[],
    path: string,
  ) => {
    values.forEach((n, i) => cite(n.citations ?? [], `${path}.${i}`));
  };
  let vertices = 0;
  for (const region of catalog.regions) {
    cite(region.citations, `regions.${region.id}.citations`);
    if (region.boundary) {
      if (!sources.has(region.boundary.sourceId))
        errors.push(`regions.${region.id}.boundary.source`);
      vertices += vertexCount(region.boundary.geometry);
    }
  }
  if (vertices > MAX_BOUNDARY_VERTICES) errors.push("regions.boundaryVertices");
  for (const issue of catalog.issues) {
    cite(issue.citations, `issues.${issue.id}.citations`);
    names(issue.localNames, `issues.${issue.id}.localNames`);
    unique(issue.hostCropIds, `issues.${issue.id}.hosts`);
    if (issue.hostCropIds.some((id) => !crops.has(id)))
      errors.push(`issues.${issue.id}.hosts`);
  }
  const ruleIds: string[] = [];
  for (const profile of catalog.profiles) {
    const at = `profiles.${profile.id}`;
    cite(profile.identity.citations, `${at}.identity`);
    names(profile.identity.localNames, `${at}.identity.localNames`);
    unique(
      (profile.references ?? []).map((r) => r.id),
      `${at}.references`,
    );
    for (const reference of profile.references ?? [])
      cite(reference.citations, `${at}.references.${reference.id}`);
    unique(
      profile.cultivars.map((c) => c.id),
      `${at}.cultivars`,
    );
    const cultivars = new Set(profile.cultivars.map((c) => c.id));
    for (const cultivar of profile.cultivars) {
      cite(cultivar.citations, `${at}.cultivars.${cultivar.id}`);
      names(
        cultivar.localNames ?? [],
        `${at}.cultivars.${cultivar.id}.localNames`,
      );
    }
    unique(
      profile.applicability.map((a) => a.regionId),
      `${at}.applicability`,
    );
    for (const entry of profile.applicability) {
      cite(entry.citations, `${at}.applicability.citations`);
      if (!regions.has(entry.regionId))
        errors.push(`${at}.applicability.region`);
    }
    if (profile.research) {
      const r = profile.research;
      const entries = [
        ...r.income.facts,
        ...r.income.options,
        ...r.benefits.findings,
        ...(r.benefits.records ?? []),
      ];
      unique(
        r.income.facts.map((f) => f.id),
        `${at}.research.income`,
      );
      unique(
        [...r.benefits.findings, ...(r.benefits.records ?? [])].map(
          (f) => f.id,
        ),
        `${at}.research.benefits`,
      );
      if (
        (r.benefits.version === undefined) !==
        (r.benefits.records === undefined)
      )
        errors.push(`${at}.research.benefits.version`);
      if (r.benefits.records) {
        for (const category of benefitEffectCategories)
          if (!r.benefits.records.some((f) => f.category === category))
            errors.push(`${at}.research.benefits.coverage.${category}`);
        for (const f of r.benefits.records)
          if (
            f.magnitude.status !==
            (f.status === "not_found" ? "not_applicable" : f.status)
          )
            errors.push(`${at}.research.benefits.provenance`);
      }
      for (const entry of entries) {
        cite(entry.citations, `${at}.research.citations`);
        for (const c of entry.citations)
          if (
            catalog.sources.find((s) => s.id === c.sourceId)?.evidence
              .sha256 !== c.sourceSha256
          )
            errors.push(`${at}.research.sourceHash`);
      }
    }
    const durations = profile.rules.filter(
      (r) => r.metric === "cycle_duration",
    );
    for (const rule of profile.rules) {
      const path = `rules.${rule.id}`;
      ruleIds.push(rule.id);
      cite(rule.citations, `${path}.citations`);
      if (
        rule.verification.status !== "model_recall" &&
        rule.citations.every((c) => c.interpretation === "context_only")
      )
        errors.push(`${path}.evidence`);
      if (rule.scope.regionIds.some((id) => !regions.has(id)))
        errors.push(`${path}.region`);
      const scoped = rule.scope.cultivarIds;
      if (Array.isArray(scoped) && scoped.some((id) => !cultivars.has(id)))
        errors.push(`${path}.cultivar`);
      if (rule.metric === "crop_health_break") {
        const issue = issues.get(rule.issueId);
        if (!issue || !issue.hostCropIds.includes(profile.id))
          errors.push(`${path}.issue`);
      }
      if (
        rule.metric === "cycle_duration" &&
        (rule.basis === "stand_lifetime") !==
          (profile.modelType === "multi_year_stand")
      )
        errors.push(`${path}.basis`);
    }
    if (
      durations.some((r) => r.metric === "cycle_duration" && r.minDays > 400) &&
      profile.modelType === "annual"
    )
      errors.push(`${at}.annualDuration`);
  }
  unique(ruleIds, "rules");
  const known = new Set(ruleIds);
  for (const conflict of catalog.conflicts) {
    unique(conflict.ruleIds, `conflicts.${conflict.id}`);
    if (conflict.ruleIds.some((id) => !known.has(id)))
      errors.push(`conflicts.${conflict.id}.rules`);
  }
  if (errors.length)
    throw new CatalogValidationError("CATALOG_INVALID", errors.slice(0, 20));
  return catalog;
}
export function validateProductionCatalogV2(input: unknown): CatalogBundleV2 {
  // Reject synthetic flags before any rule use, including nested evidence.
  const catalog = parse(input);
  if (
    catalog.synthetic ||
    catalog.profiles.some((p) => p.synthetic) ||
    catalog.sources.some((s) => s.synthetic) ||
    catalog.issues.some((i) => i.synthetic)
  )
    throw new CatalogValidationError("CATALOG_SYNTHETIC_REJECTED");
  return validateCatalogV2Structure(catalog);
}
