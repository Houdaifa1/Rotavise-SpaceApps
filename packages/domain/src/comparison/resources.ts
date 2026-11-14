import type {
  CatalogBundle,
  CatalogRule,
  HistoricalCandidate,
  HistoricalReason,
  SequenceResult,
  SequenceSchedule,
} from "@rotavise/contracts";
import { conditionsEncoded, ruleApplicable } from "../evidence/profile.js";
import { compare } from "../constraints/reasons.js";
import { climateReason } from "../climate/reasons.js";

export function resourceComparisons(
  sequence: SequenceResult,
  catalog: CatalogBundle,
  schedule: SequenceSchedule,
) {
  const context = sequence.context,
    reasons: HistoricalReason[] = [];
  const usable = (r: CatalogRule, cropId: string) =>
    r.reviewStatus === "reviewed" &&
    r.severity !== "reference" &&
    conditionsEncoded(r, context, cropId) &&
    ruleApplicable(r, context);
  const profiles = [schedule.first, schedule.second].map((c) =>
    catalog.profiles.find((p) => p.id === c.cropId)!,
  );
  type WaterRule = Extract<CatalogRule, { metric: "water_demand_class" }>;
  const waterRules = profiles.map((p, i) => {
    const group = p.knowledge.waterDemandClass;
    const all =
      group.status === "sourced"
        ? group.rules.filter(
            (r): r is WaterRule => r.metric === "water_demand_class",
          )
        : [];
    const rules = all.filter((r) => usable(r, p.id));
    if (rules.length !== 1 || rules.length !== all.length) {
      reasons.push(
        climateReason(
          "WATER_CLASS_UNAVAILABLE",
          "gap",
          p.id,
          (i + 1) as 1 | 2,
          all,
        ),
      );
      return null;
    }
    return rules[0]!;
  });
  const method =
    waterRules.every((r) => r !== null) &&
    waterRules[0]!.comparisonMethod === waterRules[1]!.comparisonMethod
      ? waterRules[0]!.comparisonMethod
      : null;
  if (waterRules.every((r) => r !== null) && method === null)
    reasons.push(
      climateReason(
        "WATER_METHOD_INCOMPATIBLE",
        "gap",
        null,
        null,
        waterRules as WaterRule[],
      ),
    );
  const classes: HistoricalCandidate["water"]["classes"] = method
    ? [waterRules[0]!.value, waterRules[1]!.value]
    : null;
  const loss = { low: 0, moderate: 0.5, high: 1 };
  const water: HistoricalCandidate["water"] = {
    classes,
    comparisonMethod: method,
    sourceIds: method
      ? [
          ...new Set(
            waterRules.flatMap((r) => r!.citations.map((c) => c.sourceId)),
          ),
        ].sort(compare)
      : [],
    ordinalLoss: classes ? (loss[classes[0]] + loss[classes[1]]) / 2 : null,
    irrigationAdequacy: "unknown",
    reportedAvailability:
      sequence.input.water.status === "reported"
        ? sequence.input.water.availability
        : "unknown",
    ruleIds: waterRules
      .filter((r) => r !== null)
      .map((r) => r.id)
      .sort(compare),
  };
  if (classes)
    reasons.push(
      climateReason(
        "WATER_CLASS_COMPARISON",
        "info",
        null,
        null,
        waterRules as WaterRule[],
        {
          firstClass: classes[0],
          secondClass: classes[1],
          ordinalLoss: water.ordinalLoss,
          method: method!,
        },
        ["input.water", "input.preferences.priority"],
      ),
    );
  reasons.push(
    climateReason(
      "IRRIGATION_ADEQUACY_UNKNOWN",
      "condition",
      null,
      null,
      [],
      {
        availability: water.reportedAvailability,
        reason:
          "No effective-rainfall/root-zone/crop-ET/delivery water balance",
      },
      ["input.water"],
    ),
  );

  const history = sequence.input.history;
  let previous: string | null = null;
  if (
    history.status === "known" &&
    history.completeness === "complete" &&
    history.entries.every(
      (e) => e.planted_on !== null && e.harvested_on !== null,
    )
  ) {
    const latest = history.entries.reduce(
      (d, e) => (e.harvested_on! > d ? e.harvested_on! : d),
      "",
    );
    const entries = history.entries.filter((e) => e.harvested_on === latest);
    if (entries.length === 1)
      previous =
        catalog.profiles.find((p) => p.id === entries[0]!.crop_id)?.identity
          .family ?? null;
  }
  const predecessorFamilies = [previous, profiles[0]!.identity.family];
  let preferred = 0,
    known = true;
  const rotationRules: CatalogRule[] = [];
  for (const [i, p] of profiles.entries()) {
    const group = p.knowledge.rotationRestrictions;
    const all =
      group.status === "sourced"
        ? group.rules.filter((r) => r.metric === "preferred_predecessor_family")
        : [];
    const rules = all.filter((r) => usable(r, p.id));
    rotationRules.push(...rules);
    if (
      !predecessorFamilies[i] ||
      !rules.length ||
      rules.length !== all.length
    ) {
      known = false;
      reasons.push(
        climateReason(
          "ROTATION_PROXY_UNAVAILABLE",
          "gap",
          p.id,
          (i + 1) as 1 | 2,
          all,
          {},
          ["input.history", "context.historyCoverageStart"],
        ),
      );
    } else if (
      rules.some(
        (r) =>
          r.metric === "preferred_predecessor_family" &&
          r.family === predecessorFamilies[i],
      )
    )
      preferred++;
  }
  const rotation: HistoricalCandidate["rotation"] = {
    preferredTransitions: known ? preferred : null,
    ordinalLoss: known ? 1 - preferred / 2 : null,
    claim: "sourced_family_transition_proxy_only",
    ruleIds: rotationRules.map((r) => r.id).sort(compare),
  };
  if (known)
    reasons.push(
      climateReason(
        "ROTATION_PROXY_COMPARISON",
        "info",
        null,
        null,
        rotationRules,
        {
          preferredTransitions: preferred,
          transitions: 2,
          ordinalLoss: rotation.ordinalLoss,
        },
        ["input.history", "input.preferences.priority"],
      ),
    );
  return { water, rotation, reasons };
}
