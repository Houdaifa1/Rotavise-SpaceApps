import { daysBetween, shiftYears, plusDays } from "./days.js";
import type { RainReference, VulnerabilitySeason } from "@rotavise/contracts";
import type { WeatherIndex } from "../climate/weather.js";
import { representativeDates } from "./calendar.js";
import type { CropSpec } from "./evidence.js";
import { cropCoefficient, referenceEvapotranspirationMm } from "./water.js";

const variables = {
  daily_minimum: "temperatureMin",
  daily_maximum: "temperatureMax",
  daily_mean: "temperatureMean",
} as const;
export type ClimateSlot = {
  spec: CropSpec;
  sowEarliest: string;
  sowLatest: string;
};
export type RotationWater = {
  // Share of crop water use not covered by rain in the crop's own season.
  meanLoss: number;
  worstDecileLoss: number;
  completeAnalogs: number;
  meanCropWaterUseMm: number;
  meanRainMm: number;
  meanShortfallMm: number;
  meanAnnualRainMm: number;
} | null;
type SeasonWater = { use: number; rain: number; shortfall: number };
// Worst and typical weather inside the crop seasons. Standard index definitions
// (ETCCDI: TXx, TNn, CDD with 1 mm, Rx1day); a drought season is declared here as
// less than half of that slot's mean season rain.
export type RotationExtremes = {
  meanHottestDayC: number;
  hottestDayC: number;
  meanColdestNightC: number;
  coldestNightC: number;
  meanLongestDrySpellDays: number;
  longestDrySpellDays: number;
  meanWettestDayMm: number;
  wettestDayMm: number;
  droughtSeasonShare: number;
} | null;
export type RotationClimate = {
  meanLoss: number;
  worstDecileLoss: number;
  completeAnalogs: number;
} | null;

// Daily values by position from the source's first day; NaN marks a missing day.
export type Series = Record<
  (typeof variables)[keyof typeof variables],
  Float64Array
>;
// A daily climate source in its own calendar: where a date falls in the
// series, and the same month and day in another year (null when absent).
export type WaterSeries = {
  latitude: number;
  rain: Float64Array;
  dayOfYear(position: number): number;
};
export type ClimateSource = {
  series: Series;
  // Only sources with daily rain can run the water balance.
  water?: WaterSeries;
  position(date: string): number | null;
  shift(date: string, years: number): string | null;
};
export type ClimateSettings = {
  firstAnchorYear: number;
  lastAnchorYear: number;
  minimumCompleteAnalogs: number;
  representativeStepDays: number;
  maxClimateDayVisits: number;
  comparison?: "regional-comparison-1" | undefined;
};
export const makeSeries = (length: number): Series => {
  const make = () => new Float64Array(length).fill(Number.NaN);
  return {
    temperatureMin: make(),
    temperatureMax: make(),
    temperatureMean: make(),
  };
};
// Historical POWER evidence on the Gregorian calendar.
export function weatherSource(
  index: WeatherIndex | null,
  latitude: number | null = null,
  rainFactors: readonly number[] | null = null,
): ClimateSource | null {
  if (!index || !index.days.size) return null;
  const dates = [...index.days.keys()].sort();
  const first = dates[0]!;
  const length = daysBetween(first, dates.at(-1)!) + 1;
  const series = makeSeries(length);
  const rain = new Float64Array(length).fill(Number.NaN);
  // Day of year per position, by plain Gregorian arithmetic.
  const days = new Uint16Array(length);
  let year = Number(first.slice(0, 4));
  let dayOfYear = daysBetween(`${year}-01-01`, first) + 1;
  for (let at = 0; at < length; at++) {
    days[at] = dayOfYear;
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (dayOfYear === (leap ? 366 : 365)) {
      year++;
      dayOfYear = 1;
    } else dayOfYear++;
  }
  for (const date of dates) {
    const at = daysBetween(first, date);
    const day = index.days.get(date)!;
    for (const variable of Object.keys(series) as (keyof Series)[]) {
      const value = day[variable]?.value;
      if (typeof value === "number") series[variable][at] = value;
    }
    const rainfall = day.precipitation?.value;
    if (typeof rainfall === "number")
      rain[at] = rainFactors
        ? rainfall * rainFactors[Number(date.slice(5, 7)) - 1]!
        : rainfall;
  }
  return {
    series,
    ...(latitude === null
      ? {}
      : {
          water: {
            latitude,
            rain,
            dayOfYear: (position: number) => days[position]!,
          },
        }),
    position: (date) => daysBetween(first, date),
    shift: (date, years) => {
      try {
        return shiftYears(date, years);
      } catch (error) {
        // Feb 29 has no analog in common years; that analog stays incomplete.
        if (error instanceof RangeError) return null;
        throw error;
      }
    },
  };
}
// Derived per-series caches. They hold exactly the values the day-by-day loops
// would compute again for every crop and sowing date, so results are identical.
type WaterDerived = {
  et0: Float64Array;
  // Running count of days lacking a maximum, minimum or rain value.
  incomplete: Int32Array;
  length: number;
};
const waterCache = new WeakMap<WaterSeries, WaterDerived>();
const coefficientCache = new WeakMap<object, Map<number, Float64Array>>();
type RuleCounts = { missing: Int32Array; outside: Map<string, Int32Array> };
const countCache = new WeakMap<Float64Array, RuleCounts>();
const derivedWater = (source: ClimateSource, water: WaterSeries) => {
  const tx = source.series.temperatureMax;
  const tn = source.series.temperatureMin;
  const length = Math.min(tx.length, tn.length, water.rain.length);
  let derived = waterCache.get(water);
  if (!derived || derived.length !== length) {
    const et0 = new Float64Array(length).fill(Number.NaN);
    const incomplete = new Int32Array(length + 1);
    for (let p = 0; p < length; p++) {
      const x = tx[p]!,
        n = tn[p]!,
        r = water.rain[p]!;
      const missing = x !== x || n !== n || r !== r;
      incomplete[p + 1] = incomplete[p]! + (missing ? 1 : 0);
      if (!missing)
        et0[p] = referenceEvapotranspirationMm(
          x,
          n,
          water.latitude,
          water.dayOfYear(p),
        );
    }
    derived = { et0, incomplete, length };
    waterCache.set(water, derived);
  }
  return derived;
};
const coefficients = (
  curve: NonNullable<CropSpec["waterCurve"]>,
  days: number,
) => {
  let byDays = coefficientCache.get(curve);
  if (!byDays) {
    byDays = new Map();
    coefficientCache.set(curve, byDays);
  }
  let values = byDays.get(days);
  if (!values) {
    values = new Float64Array(days);
    for (let d = 0; d < days; d++)
      values[d] = cropCoefficient(curve, (d + 0.5) / days);
    byDays.set(days, values);
  }
  return values;
};
// Running counts of missing days and of days outside [lower, upper], so the
// share outside over any day range is two subtractions.
const prefixCounts = (
  values: Float64Array,
  lower: number | null,
  upper: number | null,
) => {
  let counts = countCache.get(values);
  if (!counts) {
    const missing = new Int32Array(values.length + 1);
    for (let i = 0; i < values.length; i++)
      missing[i + 1] = missing[i]! + (values[i]! !== values[i]! ? 1 : 0);
    counts = { missing, outside: new Map() };
    countCache.set(values, counts);
  }
  const key = `${lower}|${upper}`;
  let outside = counts.outside.get(key);
  if (!outside) {
    outside = new Int32Array(values.length + 1);
    for (let i = 0; i < values.length; i++) {
      const v = values[i]!;
      outside[i + 1] =
        outside[i]! +
        ((lower !== null && v < lower) || (upper !== null && v > upper)
          ? 1
          : 0);
    }
    counts.outside.set(key, outside);
  }
  return { missing: counts.missing, outside };
};
// Temperature exposure of one crop sown on one date: for each evaluable rule,
// the share of days in its stage window outside the sourced bounds; the mean
// over rules. Incomplete weather gives null, never a partial fraction.
const sowingDates = new Map<string, string[]>();
const sowingDatesFor = (start: string, end: string, step: number) => {
  const range = `${start}|${end}|${step}`;
  let dates = sowingDates.get(range);
  if (!dates) {
    dates = representativeDates(start, end, step);
    // Bounded so a long-running worker does not grow it without limit.
    if (sowingDates.size > 50000) sowingDates.clear();
    sowingDates.set(range, dates);
  }
  return dates;
};
// Rotations share slots, so the mean exposure of one slot timing under one
// analog offset is computed once per climate source.
export class ClimateModel {
  private readonly memo = new Map<string, number | null>();
  private readonly slotMemo = new Map<string, number | null>();
  private readonly seasonMemo = new Map<
    string,
    Map<string, SeasonWater | null>
  >();
  // Search estimates repeat for every rotation that shares a slot timing. Once
  // the day budget is exhausted nothing is stored, so budget accounting is
  // exactly that of an uncached run.
  private readonly estimateMemo = new Map<string, number | null>();
  private readonly waterEstimateMemo = new Map<string, number | null>();
  private readonly slotWaterMemo = new Map<
    string,
    { use: number; rain: number; shortfall: number }[] | null
  >();
  private visits = 0;
  exhausted = false;
  constructor(
    private readonly source: ClimateSource | null,
    private readonly policy: ClimateSettings,
  ) {}
  get dayVisits() {
    return this.visits;
  }
  private readonly positions = new Map<string, number | null>();
  private readonly shifts = new Map<string, string | null>();
  // Calendar lookups are pure for this immutable source. Reuse them across
  // crops and reporting phases, without changing visit accounting or results.
  private position(date: string): number | null {
    if (!this.source) return null;
    if (!this.policy.comparison) return this.source.position(date);
    if (this.positions.has(date)) return this.positions.get(date)!;
    const value = this.source.position(date);
    this.positions.set(date, value);
    return value;
  }
  private shiftDate(date: string, years: number): string | null {
    if (!this.source) return null;
    if (!this.policy.comparison) return this.source.shift(date, years);
    const key = `${date}|${years}`;
    if (this.shifts.has(key)) return this.shifts.get(key)!;
    const value = this.source.shift(date, years);
    this.shifts.set(key, value);
    return value;
  }
  private consume(days: number) {
    if (
      this.policy.comparison &&
      this.visits + days > this.policy.maxClimateDayVisits
    ) {
      this.exhausted = true;
      return false;
    }
    this.visits += days;
    if (this.visits > this.policy.maxClimateDayVisits) {
      this.exhausted = true;
      return false;
    }
    return true;
  }
  exposure(spec: CropSpec, sown: string): number | null {
    if (!this.source || !spec.temperature.length) return null;
    const key = `${spec.profile.id}|${sown}${this.policy.comparison ? "|" + spec.temperature.map((r) => r.id).join(",") : ""}`;
    if (this.memo.has(key)) return this.memo.get(key)!;
    const origin = this.position(sown);
    if (origin === null) {
      this.memo.set(key, null);
      return null;
    }
    let total = 0;
    for (const rule of spec.temperature) {
      const range = this.stageDays(rule, spec, origin);
      if (range === null) {
        this.memo.set(key, null);
        return null;
      }
      const [from, to] = range;
      if (!this.consume(to - from + 1)) return null;
      const values =
        this.source.series[variables[rule.basis as keyof typeof variables]];
      let outside = 0;
      if (to >= from) {
        const lo = origin + from,
          hi = origin + to;
        // A day outside the series or a missing day leaves the exposure unknown.
        if (lo < 0 || hi >= values.length) {
          this.memo.set(key, null);
          return null;
        }
        const counts = prefixCounts(values, rule.lowerDegC, rule.upperDegC);
        if (counts.missing[hi + 1]! - counts.missing[lo]! > 0) {
          this.memo.set(key, null);
          return null;
        }
        outside = counts.outside[hi + 1]! - counts.outside[lo]!;
      }
      total += outside / (to - from + 1);
    }
    const loss = total / spec.temperature.length;
    this.memo.set(key, loss);
    return loss;
  }
  // Reporting only, after ranking. Uses the same rule windows, bounds, analogs,
  // representative sowings, ET0 and Kc arrays as the score; never a forecast.
  vulnerability(
    slot: ClimateSlot,
    ordinal: number,
    firstYear = Number(slot.sowEarliest.slice(0, 4)),
  ): VulnerabilitySeason {
    const { spec } = slot;
    const dates = sowingDatesFor(
      slot.sowEarliest,
      slot.sowLatest,
      this.policy.representativeStepDays,
    );
    const periods: VulnerabilitySeason["periods"] = [];
    const year = firstYear;
    for (const rule of spec.temperature) {
      for (const side of ["upper", "lower"] as const) {
        const limit = side === "upper" ? rule.upperDegC : rule.lowerDegC;
        if (limit === null) continue;
        let samples = 0,
          missing = 0,
          days = 0,
          outside = 0;
        let first = Infinity,
          last = -Infinity;
        for (const sown of dates)
          for (const anchor of this.anchors()) {
            const target = this.shiftDate(sown, anchor - year) ?? null;
            const origin = target === null ? null : this.position(target);
            const range =
              origin === null ? null : this.stageDays(rule, spec, origin);
            const values =
              this.source?.series[
                variables[rule.basis as keyof typeof variables]
              ];
            if (!range || origin === null || !values) {
              missing++;
              continue;
            }
            const [from, to] = range;
            if (this.policy.comparison && !this.consume(to - from + 1)) {
              missing++;
              continue;
            }
            const lo = origin + from,
              hi = origin + to;
            const counts = prefixCounts(
              values,
              side === "lower" ? limit : null,
              side === "upper" ? limit : null,
            );
            if (
              lo < 0 ||
              hi >= values.length ||
              counts.missing[hi + 1]! !== counts.missing[lo]!
            ) {
              missing++;
              continue;
            }
            samples++;
            days += to - from + 1;
            outside += counts.outside[hi + 1]! - counts.outside[lo]!;
            const offset = daysBetween(slot.sowEarliest, sown);
            first = Math.min(first, offset + from);
            last = Math.max(last, offset + to);
          }
        periods.push({
          code: samples
            ? side === "upper"
              ? "EXPOSURE_HEAT"
              : "EXPOSURE_COLD"
            : "EXPOSURE_UNAVAILABLE",
          stage: rule.stage,
          start: samples ? plusDays(slot.sowEarliest, first) : null,
          end: samples ? plusDays(slot.sowEarliest, last) : null,
          ruleIds: [rule.id],
          citations: rule.citations,
          verification: rule.verification,
          basis: `${rule.basis}; ${side} bound; historical analog stage envelope`,
          numbers: {
            limitDegC: limit,
            firstAnchorYear: this.policy.firstAnchorYear,
            lastAnchorYear: this.policy.lastAnchorYear,
            completeSamples: samples,
            missingSamples: missing,
            checkedDays: days,
            exposedDays: outside,
            exposedDayShare: days ? outside / days : null,
            ...(rule.stageWindow?.basis === "elapsed_days_from_sowing"
              ? {
                  startDay: rule.stageWindow.startDay,
                  endDay: rule.stageWindow.endDay,
                }
              : {}),
            ...(rule.stageWindow?.basis === "growing_degree_days_from_sowing"
              ? {
                  startGdd: rule.stageWindow.startGdd,
                  endGdd: rule.stageWindow.endGdd,
                  baseDegC: rule.stageWindow.baseDegC,
                  upperDegC: rule.stageWindow.upperDegC,
                }
              : {}),
          },
        });
      }
    }
    const curve = spec.waterCurve,
      water = this.source?.water;
    if (curve && water) {
      const duration = Math.round((spec.duration.min + spec.duration.max) / 2);
      const total = curve.stageLengths.reduce((a, b) => a + b, 0);
      const kc = coefficients(curve, duration);
      const derived = derivedWater(this.source!, water);
      let cumulative = 0;
      for (const [stageIndex, stage] of [
        "initial",
        "development",
        "mid_season",
        "late_season",
      ].entries()) {
        const from = Math.ceil((cumulative / total) * duration - 0.5);
        cumulative += curve.stageLengths[stageIndex]!;
        const end = Math.min(
          duration,
          Math.ceil((cumulative / total) * duration - 0.5),
        );
        if (end <= from) continue;
        let samples = 0,
          missing = 0,
          use = 0,
          rain = 0,
          deficit = 0;
        for (const sown of dates)
          for (const anchor of this.anchors()) {
            const target = this.shiftDate(sown, anchor - year);
            const origin = target === null ? null : this.position(target);
            if (
              origin === null ||
              origin < 0 ||
              origin + end > derived.length ||
              (this.policy.comparison && !this.consume(end - from)) ||
              derived.incomplete[origin + end] !==
                derived.incomplete[origin + from]
            ) {
              missing++;
              continue;
            }
            let u = 0,
              r = 0;
            for (let d = from; d < end; d++) {
              u += derived.et0[origin + d]! * kc[d]!;
              r += water.rain[origin + d]!;
            }
            samples++;
            use += u;
            rain += r;
            deficit += Math.max(0, u - r);
          }
        periods.push({
          code: samples ? "EXPOSURE_RAIN_DEFICIT" : "EXPOSURE_UNAVAILABLE",
          stage,
          start: plusDays(slot.sowEarliest, from),
          end: plusDays(slot.sowLatest, end - 1),
          ruleIds: [curve.id],
          citations: curve.citations,
          verification: curve.verification,
          basis:
            "FAO-56 stage rain shortfall; no soil storage, runoff or irrigation supply; not plant stress",
          numbers: {
            durationDays: duration,
            startDay: from,
            endDay: end - 1,
            kcIni: curve.kcIni,
            kcMid: curve.kcMid,
            kcEnd: curve.kcEnd,
            stageLengthDays: curve.stageLengths[stageIndex]!,
            firstAnchorYear: this.policy.firstAnchorYear,
            lastAnchorYear: this.policy.lastAnchorYear,
            completeSamples: samples,
            missingSamples: missing,
            meanCropWaterUseMm: samples ? use / samples : null,
            meanRainMm: samples ? rain / samples : null,
            meanShortfallMm: samples ? deficit / samples : null,
          },
        });
      }
    } else
      periods.push({
        code: "EXPOSURE_UNAVAILABLE",
        stage: "whole_cycle",
        start: null,
        end: null,
        ruleIds: [],
        citations: [],
        verification: null,
        basis: "Water curve or daily weather not found",
        numbers: {},
      });
    if (!spec.temperature.length)
      periods.push({
        code: "EXPOSURE_UNAVAILABLE",
        stage: "whole_cycle",
        start: null,
        end: null,
        ruleIds: [],
        citations: [],
        verification: null,
        basis: "Evaluable temperature rule not found",
        numbers: {},
      });
    return {
      slot: ordinal,
      cropId: spec.profile.id,
      notAForecast: true,
      sowingDates: dates,
      periods,
    };
  }

  // Days of a rule's stage after sowing. A thermal window counts the days
  // whose cumulative growing degrees (AquaCrop method 3: maximum clipped to
  // [Tbase, Tupper], minimum capped at Tupper, mean floored at Tbase) lie
  // inside it. A stage not reached within the crop's longest cycle, or a
  // missing temperature, leaves the exposure unknown.
  private stageDays(
    rule: CropSpec["temperature"][number],
    spec: CropSpec,
    origin: number,
  ): [number, number] | null {
    const w = rule.stageWindow;
    if (!w) return [0, spec.duration.max];
    if (w.basis === "elapsed_days_from_sowing") return [w.startDay, w.endDay];
    const tx = this.source!.series.temperatureMax;
    const tn = this.source!.series.temperatureMin;
    let gdd = 0;
    let from: number | null = null;
    for (let d = 0; d <= spec.duration.max; d++) {
      const x = tx[origin + d],
        n = tn[origin + d];
      if (this.policy.comparison) {
        if (!this.consume(1)) return null;
      } else this.visits++;
      if (
        x === undefined ||
        n === undefined ||
        Number.isNaN(x) ||
        Number.isNaN(n)
      )
        return null;
      const xs = Math.min(Math.max(x, w.baseDegC), w.upperDegC);
      const ns = Math.min(n, w.upperDegC);
      gdd += Math.max((xs + ns) / 2, w.baseDegC) - w.baseDegC;
      if (from === null && gdd >= w.startGdd) from = d;
      // A day that crosses the whole window at once still counts once.
      if (gdd > w.endGdd)
        return from === null ? null : [from, Math.max(from, d - 1)];
    }
    return from === null ? null : [from, spec.duration.max];
  }
  // FAO-56 crop water use and rain over one crop cycle sown on one date.
  private season(spec: CropSpec, sown: string): SeasonWater | null {
    const water = this.source?.water;
    const curve = spec.waterCurve;
    if (!water || !curve) return null;
    let seasons = this.seasonMemo.get(spec.profile.id);
    if (!seasons) {
      seasons = new Map();
      this.seasonMemo.set(spec.profile.id, seasons);
    }
    const known = seasons.get(sown);
    if (known !== undefined) return known;
    const origin = this.position(sown);
    let result: SeasonWater | null = null;
    if (origin !== null && origin >= 0) {
      const days = Math.round((spec.duration.min + spec.duration.max) / 2);
      const { et0, incomplete, length } = derivedWater(this.source!, water);
      const kc = coefficients(curve, days);
      let use = 0,
        rain = 0;
      // A cycle past the series end or over a missing day is incomplete.
      const complete =
        origin + days <= length &&
        incomplete[origin + days]! === incomplete[origin]!;
      if (this.policy.comparison && !this.consume(days)) return null;
      if (complete)
        for (let d = 0; d < days; d++) {
          use += et0[origin + d]! * kc[d]!;
          rain += water.rain[origin + d]!;
        }
      if (!this.policy.comparison) this.visits += days;
      if (complete && use > 0)
        result = { use, rain, shortfall: Math.max(0, use - rain) };
    }
    seasons.set(sown, result);
    return result;
  }
  // Search estimate: mean uncovered share for this sowing day over anchor years.
  waterEstimate(spec: CropSpec, sown: string): number | null {
    // The analog dates are the anchor years' own month-day, so the result does
    // not depend on the sowing year.
    const key = `${spec.profile.id}|${sown.slice(5)}`;
    if (this.waterEstimateMemo.has(key))
      return this.waterEstimateMemo.get(key)!;
    const result = this.computeWaterEstimate(spec, sown);
    if (!this.exhausted) this.waterEstimateMemo.set(key, result);
    return result;
  }
  private computeWaterEstimate(spec: CropSpec, sown: string): number | null {
    const year = Number(sown.slice(0, 4));
    const values: number[] = [];
    for (const anchor of this.anchors()) {
      const target = this.shiftDate(sown, anchor - year) ?? null;
      const season = target === null ? null : this.season(spec, target);
      if (season) values.push(season.shortfall / season.use);
    }
    if (values.length < this.policy.minimumCompleteAnalogs) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  // Each representative sowing date's share of one slot's season water in one
  // analog offset, or null when any of its seasons is incomplete. The terms are
  // kept apart, not summed, so adding them to a rotation's running totals stays
  // the same sequence of additions.
  private slotWaterTerms(slot: ClimateSlot, offset: number, step: number) {
    const key = `${slot.spec.profile.id}|${slot.sowEarliest}|${slot.sowLatest}|${offset}${this.policy.comparison ? "|" + slot.spec.temperature.map((r) => r.id).join(",") : ""}`;
    const known = this.slotWaterMemo.get(key);
    if (known !== undefined) return known;
    const dates = sowingDatesFor(slot.sowEarliest, slot.sowLatest, step);
    const seasons = dates.map((d) => {
      const target = this.shiftDate(d, offset);
      return target === null ? null : this.season(slot.spec, target);
    });
    const terms = seasons.some((s) => s === null)
      ? null
      : (seasons as SeasonWater[]).map((s) => ({
          use: s.use / seasons.length,
          rain: s.rain / seasons.length,
          shortfall: s.shortfall / seasons.length,
        }));
    this.slotWaterMemo.set(key, terms);
    return terms;
  }
  // Consecutive-year analogs of the whole rotation, as for temperature.
  rotationWater(slots: ClimateSlot[]): RotationWater {
    const water = this.source?.water;
    if (!water || slots.some((s) => !s.spec.waterCurve)) return null;
    const firstYear = Number(slots[0]!.sowEarliest.slice(0, 4));
    const step = this.policy.representativeStepDays;
    const analogs: SeasonWater[] = [];
    for (const anchor of this.anchors()) {
      const offset = anchor - firstYear;
      const sum = { use: 0, rain: 0, shortfall: 0 };
      let complete = true;
      for (const slot of slots) {
        const terms = this.slotWaterTerms(slot, offset, step);
        if (terms === null) {
          complete = false;
          break;
        }
        for (const t of terms) {
          sum.use += t.use;
          sum.rain += t.rain;
          sum.shortfall += t.shortfall;
        }
      }
      if (complete && sum.use > 0) analogs.push(sum);
    }
    if (analogs.length < this.policy.minimumCompleteAnalogs) return null;
    const mean = (f: (s: SeasonWater) => number) =>
      analogs.reduce((n, s) => n + f(s), 0) / analogs.length;
    const losses = analogs
      .map((s) => s.shortfall / s.use)
      .sort((a, b) => a - b);
    const q = (v: number) => Math.min(1, Math.max(0, Number(v.toFixed(12))));
    const mm = (v: number) => Number(v.toFixed(1));
    return {
      meanLoss: q(losses.reduce((a, b) => a + b, 0) / losses.length),
      worstDecileLoss: q(losses[Math.ceil(0.9 * losses.length) - 1]!),
      completeAnalogs: analogs.length,
      meanCropWaterUseMm: mm(mean((s) => s.use)),
      meanRainMm: mm(mean((s) => s.rain)),
      meanShortfallMm: mm(mean((s) => s.shortfall)),
      meanAnnualRainMm: this.meanAnnualRainMm() ?? 0,
    };
  }
  // Extremes across all slots, at each slot's middle sowing date, per analog.
  rotationExtremes(slots: ClimateSlot[]): RotationExtremes {
    const water = this.source?.water;
    if (!water) return null;
    const firstYear = Number(slots[0]!.sowEarliest.slice(0, 4));
    const hottest: number[] = [],
      coldest: number[] = [],
      dry: number[] = [],
      wettest: number[] = [];
    const seasons = new Map<number, number[]>();
    // Loop invariants, hoisted: the same sowing date and length per slot in
    // every analog year, and the series read on every day.
    const source = this.source!;
    const tx = source.series.temperatureMax;
    const tn = source.series.temperatureMin;
    const rain = water.rain;
    const limit = Math.min(tx.length, tn.length, rain.length);
    const plan = slots.map((slot) => {
      const dates = sowingDatesFor(
        slot.sowEarliest,
        slot.sowLatest,
        this.policy.representativeStepDays,
      );
      return {
        sown: dates[dates.length >> 1]!,
        days: Math.round((slot.spec.duration.min + slot.spec.duration.max) / 2),
      };
    });
    for (const anchor of this.anchors()) {
      const offset = anchor - firstYear;
      let hot = -Infinity,
        cold = Infinity,
        longest = 0,
        wet = 0,
        complete = true;
      const totals: number[] = [];
      for (const { sown, days } of plan) {
        const target = this.shiftDate(sown, offset);
        const origin = target === null ? null : this.position(target);
        if (origin === null || origin < 0) {
          complete = false;
          break;
        }
        if (this.policy.comparison && !this.consume(days)) return null;
        // A cycle that runs past the series end is incomplete, as a missing
        // day is. Plain comparisons keep this hot loop optimizable.
        if (origin + days > limit) {
          if (!this.policy.comparison) this.visits += days;
          complete = false;
          break;
        }
        let run = 0,
          total = 0;
        for (let i = origin, end = origin + days; i < end; i++) {
          const x = tx[i]!;
          const n = tn[i]!;
          const r = rain[i]!;
          if (x !== x || n !== n || r !== r) {
            complete = false;
            break;
          }
          if (x > hot) hot = x;
          if (n < cold) cold = n;
          if (r > wet) wet = r;
          run = r < 1 ? run + 1 : 0;
          if (run > longest) longest = run;
          total += r;
        }
        if (!this.policy.comparison) this.visits += days;
        if (!complete) break;
        totals.push(total);
      }
      if (!complete) continue;
      hottest.push(hot);
      coldest.push(cold);
      dry.push(longest);
      wettest.push(wet);
      totals.forEach((t, i) => seasons.set(i, [...(seasons.get(i) ?? []), t]));
    }
    if (hottest.length < this.policy.minimumCompleteAnalogs) return null;
    const mean = (v: number[]) =>
      Number((v.reduce((a, b) => a + b, 0) / v.length).toFixed(1));
    const round = (v: number) => Number(v.toFixed(1));
    let droughts = 0,
      total = 0;
    for (const values of seasons.values()) {
      const m = values.reduce((a, b) => a + b, 0) / values.length;
      droughts += values.filter((v) => v < m / 2).length;
      total += values.length;
    }
    return {
      meanHottestDayC: mean(hottest),
      hottestDayC: round(Math.max(...hottest)),
      meanColdestNightC: mean(coldest),
      coldestNightC: round(Math.min(...coldest)),
      meanLongestDrySpellDays: mean(dry),
      longestDrySpellDays: Math.max(...dry),
      meanWettestDayMm: mean(wettest),
      wettestDayMm: round(Math.max(...wettest)),
      droughtSeasonShare: Number((droughts / total).toFixed(3)),
    };
  }
  // Mean rain per calendar year over the anchor years; incomplete years are skipped.
  meanAnnualRainMm(): number | null {
    const water = this.source?.water;
    if (!water) return null;
    const totals: number[] = [];
    for (const anchor of this.anchors()) {
      const start = this.position(`${anchor}-01-01`);
      const end = this.position(`${anchor}-12-31`);
      if (start === null || end === null || start < 0) continue;
      let sum = 0,
        complete = true;
      for (let d = start; d <= end; d++) {
        const r = water.rain[d];
        if (r === undefined || Number.isNaN(r)) {
          complete = false;
          break;
        }
        sum += r;
      }
      if (complete) totals.push(sum);
    }
    return totals.length
      ? Number((totals.reduce((a, b) => a + b, 0) / totals.length).toFixed(1))
      : null;
  }
  private shifted(spec: CropSpec, date: string, years: number) {
    const target = this.shiftDate(date, years) ?? null;
    return target === null ? null : this.exposure(spec, target);
  }
  private anchors() {
    const years: number[] = [];
    for (
      let y = this.policy.firstAnchorYear;
      y <= this.policy.lastAnchorYear;
      y++
    )
      years.push(y);
    return years;
  }
  // Search estimate: mean exposure for this sowing month-day over anchor years.
  estimate(spec: CropSpec, sown: string): number | null {
    // The temperature rules differ between a spec and its ranked copy that
    // keeps only the shared checks, so the key names the rules too.
    // The result does not depend on the sowing year: analogs are the anchor
    // years' own month-day.
    const key = `${spec.profile.id}|${sown.slice(5)}|${spec.temperature.map((r) => r.id).join(",")}`;
    if (this.estimateMemo.has(key)) return this.estimateMemo.get(key)!;
    const result = this.computeEstimate(spec, sown);
    if (!this.exhausted) this.estimateMemo.set(key, result);
    return result;
  }
  private computeEstimate(spec: CropSpec, sown: string): number | null {
    const year = Number(sown.slice(0, 4));
    const values = this.anchors()
      .map((anchor) => this.shifted(spec, sown, anchor - year))
      .filter((v): v is number => v !== null);
    if (values.length < this.policy.minimumCompleteAnalogs) return null;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  private slotMean(slot: ClimateSlot, offset: number, step: number) {
    const key = `${slot.spec.profile.id}|${slot.sowEarliest}|${slot.sowLatest}|${offset}${this.policy.comparison ? "|" + slot.spec.temperature.map((r) => r.id).join(",") : ""}`;
    const known = this.slotMemo.get(key);
    if (known !== undefined) return known;
    const dates = sowingDatesFor(slot.sowEarliest, slot.sowLatest, step);
    const values = dates.map((d) => this.shifted(slot.spec, d, offset));
    const mean = values.some((v) => v === null)
      ? null
      : (values as number[]).reduce((a, b) => a + b, 0) / values.length;
    this.slotMemo.set(key, mean);
    return mean;
  }
  // Consecutive-year analogs for a whole rotation: every slot shifts by the
  // same number of years, so analog sequences keep their real year order.
  rotation(slots: ClimateSlot[]): RotationClimate {
    // Crops with no sourced temperature limit are left out of the score and
    // reported; a rotation of only such crops has none and takes the mean later.
    const checked = slots.filter((s) => s.spec.temperature.length);
    if (!checked.length || !this.source) return null;
    const firstYear = Number(slots[0]!.sowEarliest.slice(0, 4));
    const step = this.policy.representativeStepDays;
    const losses: number[] = [];
    for (const anchor of this.anchors()) {
      const offset = anchor - firstYear;
      let weighted = 0,
        days = 0,
        complete = true;
      for (const slot of checked) {
        const mean = this.slotMean(slot, offset, step);
        if (mean === null) {
          complete = false;
          break;
        }
        const duration = (slot.spec.duration.min + slot.spec.duration.max) / 2;
        weighted += mean * duration;
        days += duration;
      }
      if (complete && days > 0) losses.push(weighted / days);
    }
    if (losses.length < this.policy.minimumCompleteAnalogs) return null;
    const sorted = [...losses].sort((a, b) => a - b);
    const quantize = (v: number) =>
      Math.min(1, Math.max(0, Number(v.toFixed(12))));
    return {
      meanLoss: quantize(losses.reduce((a, b) => a + b, 0) / losses.length),
      worstDecileLoss: quantize(sorted[Math.ceil(0.9 * sorted.length) - 1]!),
      completeAnalogs: losses.length,
    };
  }
}
// Monthly factors that bring POWER rain to a reference climatology over the
// reference's own years, limited to a declared range so a dry month's small
// totals cannot produce an extreme factor.
export const RAIN_FACTOR_RANGE = [0.2, 3] as const;
export function rainCorrection(
  index: WeatherIndex | null,
  reference: RainReference,
) {
  if (!index) return null;
  const totals = Array.from({ length: 12 }, () => 0);
  const counts = Array.from({ length: 12 }, () => 0);
  for (const [date, day] of index.days) {
    const year = Number(date.slice(0, 4));
    if (year < reference.firstYear || year > reference.lastYear) continue;
    const value = day.precipitation?.value;
    if (typeof value !== "number") continue;
    const month = Number(date.slice(5, 7)) - 1;
    totals[month]! += value;
    counts[month]!++;
  }
  // Every month must be covered nearly completely, across all reference years.
  const years = reference.lastYear - reference.firstYear + 1;
  if (counts.some((c) => c < years * 27)) return null;
  const powerMonthly = totals.map((t) => t / years);
  const factors = powerMonthly.map((power, month) => {
    const target = reference.monthlyMeanMm[month]!;
    if (power <= 0) return 1;
    return Number(
      Math.min(
        RAIN_FACTOR_RANGE[1],
        Math.max(RAIN_FACTOR_RANGE[0], target / power),
      ).toFixed(4),
    );
  });
  const sum = (v: number[]) => Number(v.reduce((a, b) => a + b, 0).toFixed(1));
  return {
    factors,
    powerAnnualMm: sum(powerMonthly),
    referenceAnnualMm: sum(reference.monthlyMeanMm),
  };
}
// A rotation with no checked crop takes the mean of the others, so a data gap
// neither helps nor harms it. All unchecked leaves the dimension uncompared.
export function fillUncheckedClimate(results: RotationClimate[]) {
  const known = results.filter(
    (r) => r !== null,
  ) as NonNullable<RotationClimate>[];
  if (!known.length) return results;
  const mean = (f: (r: NonNullable<RotationClimate>) => number) =>
    Math.min(
      1,
      Math.max(
        0,
        Number(
          (known.reduce((a, r) => a + f(r), 0) / known.length).toFixed(12),
        ),
      ),
    );
  const filler = {
    meanLoss: mean((r) => r.meanLoss),
    worstDecileLoss: mean((r) => r.worstDecileLoss),
    completeAnalogs: Math.min(...known.map((r) => r.completeAnalogs)),
  };
  return results.map((r) => r ?? filler);
}
