import type {
  CatalogRule,
  CropProfile,
  SequenceContext,
  CropCycle,
  TemperatureExposure,
  HistoricalReason,
} from "@rotavise/contracts";
import { conditionsEncoded, ruleApplicable } from "../evidence/profile.js";
import { compare } from "../constraints/reasons.js";
import {
  addDays,
  calendarDays,
  shiftCalendarYears,
} from "../calendar/dates.js";
import { climateReason } from "./reasons.js";
import type { WeatherIndex } from "./weather.js";

export type TemperatureRule = Extract<CatalogRule, { metric: "temperature" }>;
const variables = {
  daily_minimum: "temperatureMin",
  daily_maximum: "temperatureMax",
  daily_mean: "temperatureMean",
} as const;
export function temperatureRules(
  profile: CropProfile,
  context: SequenceContext,
  cycle: CropCycle,
  position: 1 | 2,
) {
  const reasons: HistoricalReason[] = [],
    rules: TemperatureRule[] = [];
  const group = profile.knowledge.temperatureRequirements;
  if (group.status === "sourced")
    for (const rule of group.rules) {
      if (rule.metric !== "temperature") continue;
      const interpreted =
        rule.medium === "air" &&
        rule.timeBasis in variables &&
        (rule.stage === "whole_cycle" ||
          (rule.stageWindow !== undefined &&
            rule.stageWindow.endDay <= cycle.durationDays.min));
      if (
        rule.reviewStatus !== "reviewed" ||
        rule.severity === "reference" ||
        !conditionsEncoded(rule, context, profile.id) ||
        !ruleApplicable(rule, context)
      ) {
        reasons.push(
          climateReason(
            "TEMPERATURE_RULE_UNREVIEWED",
            "gap",
            profile.id,
            position,
            [rule],
            { conditions: rule.conditions },
            ["context.cultivars", "context.region", "context.productionSystem"],
          ),
        );
      } else if (!interpreted) {
        reasons.push(
          climateReason(
            "TEMPERATURE_RULE_UNSUPPORTED",
            "gap",
            profile.id,
            position,
            [rule],
            {
              stage: rule.stage,
              timeBasis: rule.timeBasis,
              medium: rule.medium,
            },
          ),
        );
      } else rules.push(rule);
    }
  if (!rules.length)
    reasons.push(
      climateReason(
        "TEMPERATURE_RULE_UNAVAILABLE",
        "gap",
        profile.id,
        position,
      ),
    );
  const keys = rules.map((r) =>
    JSON.stringify([r.timeBasis, r.stage, r.stageWindow ?? null]),
  );
  if (new Set(keys).size !== keys.length) {
    reasons.push(
      climateReason(
        "TEMPERATURE_RULE_AMBIGUOUS",
        "gap",
        profile.id,
        position,
        rules,
      ),
    );
    return { rules: [], reasons, signature: null };
  }
  rules.sort((a, b) => compare(a.id, b.id));
  // Same measurement/window basis is required; crop-specific bounds may differ.
  const signature =
    rules.length && !reasons.length
      ? JSON.stringify([...keys].sort(compare))
      : null;
  return { rules, reasons, signature };
}
export function measureExposure(
  index: WeatherIndex,
  rule: TemperatureRule,
  start: string,
  end: string,
  horizon: TemperatureExposure["horizon"],
): TemperatureExposure {
  const variable = variables[rule.timeBasis as keyof typeof variables];
  const dates = calendarDays(start, end),
    ids = new Set<string>();
  index.budget.visit(dates.length);
  let observed = 0,
    below = 0,
    above = 0;
  for (const date of dates) {
    const cell = index.days.get(date)?.[variable];
    if (cell) for (const id of cell.snapshotIds) ids.add(id);
    if (!cell || cell.value === null) continue;
    observed++;
    if (cell.value < rule.min) below++;
    if (cell.value > rule.max) above++;
  }
  const complete = observed === dates.length;
  return {
    ruleId: rule.id,
    stage: rule.stage,
    variable,
    severity: rule.severity as "soft" | "hard",
    horizon,
    startDate: start,
    endDate: end,
    expectedDays: dates.length,
    observedDays: observed,
    lowerDegC: rule.min,
    upperDegC: rule.max,
    belowDays: complete ? below : null,
    aboveDays: complete ? above : null,
    outsideFraction: complete ? (below + above) / dates.length : null,
    snapshotIds: [...ids].sort(compare),
    citations: rule.citations,
  };
}
export function cycleExposures(
  index: WeatherIndex,
  rules: TemperatureRule[],
  cycle: CropCycle,
  years = 0,
) {
  const shift = (d: string) => shiftCalendarYears(d, years);
  return rules.flatMap((rule) =>
    rule.stage === "whole_cycle"
      ? [
          measureExposure(
            index,
            rule,
            shift(cycle.sownOn),
            shift(cycle.harvestEarliest),
            "earliest",
          ),
          measureExposure(
            index,
            rule,
            shift(cycle.sownOn),
            shift(cycle.harvestLatest),
            "latest",
          ),
        ]
      : [
          measureExposure(
            index,
            rule,
            shift(addDays(cycle.sownOn, rule.stageWindow!.startDay)),
            shift(addDays(cycle.sownOn, rule.stageWindow!.endDay)),
            "stage",
          ),
        ],
  );
}
export function conservativeExposureLoss(
  exposures: TemperatureExposure[],
): number | null {
  if (!exposures.length || exposures.some((e) => e.outsideFraction === null))
    return null;
  const perRule = new Map<string, number>();
  for (const e of exposures)
    perRule.set(
      e.ruleId,
      Math.max(perRule.get(e.ruleId) ?? 0, e.outsideFraction!),
    );
  return [...perRule.values()].reduce((a, b) => a + b, 0) / perRule.size;
}
