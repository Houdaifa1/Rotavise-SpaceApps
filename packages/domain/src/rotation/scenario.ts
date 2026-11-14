import {
  calendarOrdinal,
  calendarYearLength,
  modelDayOrdinal,
  scenarioCell,
  scenarioSeriesSchema,
  type FutureClimatePolicy,
  type ScenarioExperiment,
  type ScenarioModel,
  type ScenarioSeries,
  type ScenarioUnitIdentity,
  type ScenarioVariable,
} from "@rotavise/contracts";
import { compare } from "../constraints/reasons.js";
import { makeSeries, type ClimateSource, type Series } from "./climate.js";
import type { CropSpec } from "./evidence.js";

export class ScenarioInputError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
const target: Record<Exclude<ScenarioVariable, "pr">, keyof Series> = {
  tasmin: "temperatureMin",
  tasmax: "temperatureMax",
  tas: "temperatureMean",
};
const basisVariable: Record<string, ScenarioVariable> = {
  daily_minimum: "tasmin",
  daily_maximum: "tasmax",
  daily_mean: "tas",
};
// A near-term world holds the same model and scenario as the mid-century
// world but only the near-term years, so adding it never changes the
// mid-century world's series.
export const worldKey = (
  model: string,
  experiment: ScenarioExperiment,
  period?: "near_term",
) => (period ? `${model}|${experiment}|${period}` : `${model}|${experiment}`);
export const unitKey = (
  model: string,
  experiment: ScenarioExperiment,
  variable: ScenarioVariable,
  year: number,
) => `${model}|${experiment}|${variable}|${year}`;
// Model variables the schedulable crops' temperature rules read.
export function scenarioVariablesFor(specs: CropSpec[]) {
  return [
    ...new Set(
      specs
        .flatMap((s) =>
          s.temperature.flatMap((r) => [
            basisVariable[r.basis]!,
            // Thermal-time windows need daily maximum and minimum.
            ...(r.stageWindow?.basis === "growing_degree_days_from_sowing"
              ? (["tasmax", "tasmin"] as const)
              : []),
          ]),
        )
        .concat(
          // The future water balance needs temperature range and rain.
          specs.some((s) => s.waterCurve)
            ? (["tasmax", "tasmin", "pr"] as const)
            : [],
        ),
    ),
  ].sort(compare);
}
// Units for one plan: each world's anchors plus the years a rotation spans.
export function scenarioUnits(
  policy: FutureClimatePolicy,
  variables: ScenarioVariable[],
  location: { latitude: number; longitude: number },
  spanYears: number,
): {
  cell: { latitude: number; longitude: number };
  units: ScenarioUnitIdentity[];
} {
  const { cell, tile } = scenarioCell(location.latitude, location.longitude);
  const units: ScenarioUnitIdentity[] = [];
  for (const model of policy.models)
    for (const window of [policy.baseline, ...policy.futures]) {
      const last = Math.min(
        window.lastDataYear,
        window.lastAnchorYear + spanYears,
      );
      for (const variable of variables)
        for (let year = window.firstAnchorYear; year <= last; year++)
          units.push({
            dataset: policy.dataset,
            datasetVersion: policy.datasetVersion,
            model,
            experiment: window.experiment,
            variable,
            year,
            tile,
          });
    }
  return { cell, units };
}
// Units for the near-term period only: none when the policy has none. They
// never overlap the units of scenarioUnits, which the policy guarantees.
export function nearTermUnits(
  policy: FutureClimatePolicy,
  variables: ScenarioVariable[],
  location: { latitude: number; longitude: number },
  spanYears: number,
): {
  cell: { latitude: number; longitude: number };
  units: ScenarioUnitIdentity[];
} | null {
  if (!policy.nearTerm) return null;
  const { cell, tile } = scenarioCell(location.latitude, location.longitude);
  const units: ScenarioUnitIdentity[] = [];
  for (const model of policy.models)
    for (const window of policy.nearTerm.windows) {
      const last = Math.min(
        window.lastDataYear,
        window.lastAnchorYear + spanYears,
      );
      for (const variable of variables)
        for (let year = window.firstAnchorYear; year <= last; year++)
          units.push({
            dataset: policy.dataset,
            datasetVersion: policy.datasetVersion,
            model,
            experiment: window.experiment,
            variable,
            year,
            tile,
          });
    }
  return { cell, units };
}
// One model world as a climate source in that model's calendar. Years absent
// from the evidence stay NaN, so analogs that need them are incomplete.
function source(
  model: ScenarioModel,
  series: ScenarioSeries[],
  latitude: number,
): ClimateSource {
  const years = series.map((s) => s.year);
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  const origin = calendarOrdinal(model.calendar, firstYear, 1, 1)!;
  const length =
    calendarOrdinal(model.calendar, lastYear, 1, 1)! -
    origin +
    calendarYearLength(model.calendar, lastYear);
  const values = makeSeries(length);
  const rain = new Float64Array(length).fill(Number.NaN);
  for (const s of series) {
    const at = calendarOrdinal(model.calendar, s.year, 1, 1)! - origin;
    const out = s.variable === "pr" ? rain : values[target[s.variable]];
    s.values.forEach((v, i) => {
      if (v !== null) out[at + i] = v;
    });
  }
  // Day of year per position, scaled to 365 days for the solar geometry so
  // 360-day model years cover the whole sun cycle.
  const days = new Uint16Array(length);
  for (let year = firstYear; year <= lastYear; year++) {
    const at = calendarOrdinal(model.calendar, year, 1, 1)! - origin;
    const size = calendarYearLength(model.calendar, year);
    for (let i = 0; i < size; i++)
      days[at + i] = size === 360 ? Math.round((i * 365) / 360) + 1 : i + 1;
  }
  return {
    series: values,
    ...(series.some((s) => s.variable === "pr")
      ? {
          water: {
            latitude,
            rain,
            dayOfYear: (position: number) => days[position]!,
          },
        }
      : {}),
    position: (date) => {
      const n = modelDayOrdinal(model.calendar, date);
      return n === null ? null : n - origin;
    },
    shift: (date, years) => {
      const shifted = `${String(Number(date.slice(0, 4)) + years).padStart(4, "0")}${date.slice(4)}`;
      return modelDayOrdinal(model.calendar, shifted) === null ? null : shifted;
    },
  };
}
// Validates the series one plan pinned and groups them into model worlds.
export function scenarioWorlds(
  input: unknown,
  policy: FutureClimatePolicy,
  cell: { latitude: number; longitude: number },
  allowSynthetic: boolean,
) {
  const parsed = scenarioSeriesSchema.array().max(4000).safeParse(input);
  if (!parsed.success)
    throw new ScenarioInputError("SCENARIO_EVIDENCE_INVALID");
  const experiments = new Set([
    policy.baseline.experiment,
    ...policy.futures.map((f) => f.experiment),
  ]);
  const seen = new Set<string>();
  const ids = new Set<string>();
  const groups = new Map<string, ScenarioSeries[]>();
  for (const s of parsed.data) {
    const model = policy.models.find((m) => m.id === s.model.id);
    const key = unitKey(s.model.id, s.experiment, s.variable, s.year);
    if (
      !model ||
      JSON.stringify(model) !== JSON.stringify(s.model) ||
      !experiments.has(s.experiment) ||
      s.cell.latitude !== cell.latitude ||
      s.cell.longitude !== cell.longitude ||
      s.values.length !== calendarYearLength(model.calendar, s.year) ||
      seen.has(key) ||
      ids.has(s.unitId)
    )
      throw new ScenarioInputError("SCENARIO_EVIDENCE_INVALID");
    if (s.synthetic && !allowSynthetic)
      throw new ScenarioInputError("SCENARIO_SYNTHETIC_REJECTED");
    seen.add(key);
    ids.add(s.unitId);
    const nearEnd = policy.nearTerm?.windows.find(
      (w) => w.experiment === s.experiment,
    )?.lastDataYear;
    const world = worldKey(
      s.model.id,
      s.experiment,
      nearEnd !== undefined && s.year <= nearEnd ? "near_term" : undefined,
    );
    groups.set(world, [...(groups.get(world) ?? []), s]);
  }
  const worlds = new Map<string, ClimateSource>();
  for (const [key, series] of groups) {
    const model = policy.models.find((m) => m.id === series[0]!.model.id)!;
    worlds.set(key, source(model, series, cell.latitude));
  }
  return {
    worlds,
    present: seen,
    unitIds: parsed.data.map((s) => s.unitId).sort(compare),
    synthetic: parsed.data.some((s) => s.synthetic),
  };
}
