import type {
  RainResult,
  RainSeries,
  VegetationAnalysis,
  VegetationAnalysisPolicy,
  VegetationPeriod,
  VegetationResult,
} from "@rotavise/contracts";
import { daysBetween, plusDays } from "../rotation/days.js";
import { compare } from "../constraints/reasons.js";

// Declared product heuristics for explaining a field's own greenness history.
// They are not crop thresholds: green seasons come from the stored result's
// amplitude rule, and everything else is relative to the field's other years.
export const vegetationAnalysisPolicy: VegetationAnalysisPolicy = {
  version: "vegetation-analysis-1",
  typicalShare: 0.5,
  minimumTypicalYears: 3,
  completeYearMinObservations: 12,
  longGapDays: 45,
  minimumWindowDays: 14,
  anomalyWindowDays: 15,
  minimumReferenceYears: 3,
  anomalyRobustZ: 2,
  noiseFloor: 0.02,
  staleDays: 30,
  recentDays: 400,
  provenance:
    "Declared product heuristics, not taken from a crop source. Seasons use the TIMESAT amplitude rule (Jönsson and Eklundh 2004) already stored in the result; the comparison uses the median and MAD of the field's other years.",
};

export const VEGETATION_GLOSSARY = {
  ndvi: "NDVI (normalised difference vegetation index) measures how green a field looks from space, from -1 to 1. Bare soil is low, dense healthy crops are high.",
  green_season:
    "A green season is a stretch of dates when the field's greenness stayed well above its own usual low level. The satellite cannot tell which crop it was; the farmer says that.",
  bare_field_period:
    "A low-greenness period is a stretch between green seasons. It is often bare soil or stubble, but the satellite cannot tell. Confirm what was on the field.",
  vegetation_stress:
    "Vegetation stress means the crop looks less green than expected, for example from drought, heat, pests or late sowing. A low reading is a prompt to look at the field, not a diagnosis.",
  field_history_anomaly:
    "The comparison looks at the same time of year in the field's other years. Below usual means clearly greener or less green than its own typical value; a different crop or sowing date also changes it.",
  cloud_gap:
    "Clouds and haze hide some dates. Long gaps between usable dates mean the exact start or end of a period is uncertain.",
} as const;
export type VegetationGlossaryKey = keyof typeof VEGETATION_GLOSSARY;

const round = (v: number, digits = 4) => Number(v.toFixed(digits));
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const mad = (v: number[]) => {
  const m = median(v);
  return median(v.map((x) => Math.abs(x - m)));
};
const yearOf = (date: string) => Number(date.slice(0, 4));
// Day of a non-leap reference year, so the same month and day always share a
// slot; 29 February shares 28 February.
const slotOf = (date: string) => {
  const md = date.slice(5) === "02-29" ? "02-28" : date.slice(5);
  return daysBetween("2001-01-01", `2001-${md}`);
};
const slotDistance = (a: number, b: number) => {
  const d = Math.abs(a - b);
  return Math.min(d, 365 - d);
};
const monthDayOfSlot = (slot: number) => plusDays("2001-01-01", slot).slice(5);

// HLS granule ids from the AppEEARS granule list of a task (one URL per band
// file). The acquisition day is the year and day-of-year in the id.
export function hlsGranulesFromList(
  list: string,
  usable: { date: string; sensors: ("landsat" | "sentinel-2")[] }[],
) {
  const wanted = new Map(usable.map((o) => [o.date, new Set(o.sensors)]));
  const seen = new Set<string>();
  const out: {
    date: string;
    sensor: "landsat" | "sentinel-2";
    granule: string;
  }[] = [];
  const pattern =
    /HLS\.([LS])30\.(T[0-9A-Z]{5})\.(\d{4})(\d{3})T(\d{6})\.v2\.0/g;
  for (const match of list.matchAll(pattern)) {
    const granule = match[0];
    if (seen.has(granule)) continue;
    seen.add(granule);
    const doy = Number(match[4]);
    if (doy < 1 || doy > 366) continue;
    const date = plusDays(`${match[3]}-01-01`, doy - 1);
    const sensor = match[1] === "L" ? "landsat" : "sentinel-2";
    if (!wanted.get(date)?.has(sensor)) continue;
    out.push({ date, sensor, granule });
  }
  return out.sort(
    (a, b) => compare(a.date, b.date) || compare(a.granule, b.granule),
  );
}

type Piece = VegetationPeriod;
function clip(p: Piece, from: string, to: string): Piece | null {
  const start = p.start > from ? p.start : from;
  const end = p.end < to ? p.end : to;
  if (start > end) return null;
  const peakInside =
    p.peakDate !== null && p.peakDate >= start && p.peakDate <= end;
  return {
    ...p,
    start,
    end,
    peakDate: peakInside ? p.peakDate : null,
    peakNdvi: peakInside ? p.peakNdvi : null,
    openAtStart: p.openAtStart && start === p.start,
    openAtEnd: p.openAtEnd && end === p.end,
  };
}

// The field's own history: per-year timeline with granule ids, green and
// low-greenness periods, the windows that are usually low, and the latest
// readings against the field's other years. `asOf` is the caller's today.
export function analyzeVegetation(
  result: VegetationResult,
  asOf: string,
  policy: VegetationAnalysisPolicy = vegetationAnalysisPolicy,
): VegetationAnalysis {
  const obs = [...result.observations].sort((a, b) => compare(a.date, b.date));
  const granuleByDate = new Map<string, string[]>();
  for (const g of result.granules ?? []) {
    const o = obs.find((x) => x.date === g.date);
    if (!o || !o.sensors.includes(g.sensor)) continue;
    granuleByDate.set(g.date, [
      ...(granuleByDate.get(g.date) ?? []),
      g.granule,
    ]);
  }
  // Gaps between usable dates.
  const gaps: { start: string; end: string; days: number }[] = [];
  let largestGap = 0;
  for (let i = 1; i < obs.length; i++) {
    const days = daysBetween(obs[i - 1]!.date, obs[i]!.date);
    largestGap = Math.max(largestGap, days);
    if (days >= policy.longGapDays)
      gaps.push({ start: obs[i - 1]!.date, end: obs[i]!.date, days });
  }
  const gapWithin = (from: string, to: string) => {
    const inside = obs.filter((o) => o.date >= from && o.date <= to);
    let g = 0;
    for (let i = 1; i < inside.length; i++)
      g = Math.max(g, daysBetween(inside[i - 1]!.date, inside[i]!.date));
    return g;
  };
  let reason: VegetationAnalysis["undeterminedReason"] = null;
  if (obs.length < result.policy.smoothingObservations * 2)
    reason = "too_few_observations";
  else if (!result.signal.distinct || result.seasons.length === 0)
    reason = "no_distinct_seasonal_signal";

  // Periods across the whole series, then split by calendar year.
  const periods: Piece[] = [];
  if (!reason) {
    const first = obs[0]!.date,
      last = obs.at(-1)!.date;
    const seasons = [...result.seasons].sort((a, b) =>
      compare(a.start, b.start),
    );
    for (const s of seasons)
      periods.push({
        kind: "green",
        start: s.start,
        end: s.end,
        source: "detected_season",
        peakDate: s.peakDate,
        peakNdvi: s.peakNdvi,
        openAtStart: s.openAtStart,
        openAtEnd: s.openAtEnd,
        largestGapDays: s.largestGapDays,
        confidence: s.largestGapDays >= policy.longGapDays ? "low" : "normal",
      });
    const low = (
      from: string,
      to: string,
      atStart: boolean,
      atEnd: boolean,
    ) => {
      if (from > to) return;
      const g = gapWithin(from, to);
      periods.push({
        kind: "low_greenness",
        start: from,
        end: to,
        source: "between_seasons",
        peakDate: null,
        peakNdvi: null,
        openAtStart: atStart,
        openAtEnd: atEnd,
        largestGapDays: g,
        confidence: g >= policy.longGapDays ? "low" : "normal",
      });
    };
    const firstSeason = seasons[0]!;
    if (!firstSeason.openAtStart && first < firstSeason.start)
      low(first, plusDays(firstSeason.start, -1), true, false);
    for (let i = 1; i < seasons.length; i++)
      low(
        plusDays(seasons[i - 1]!.end, 1),
        plusDays(seasons[i]!.start, -1),
        false,
        false,
      );
    const lastSeason = seasons.at(-1)!;
    if (!lastSeason.openAtEnd && lastSeason.end < last)
      low(plusDays(lastSeason.end, 1), last, false, true);
    periods.sort((a, b) => compare(a.start, b.start));
  }

  // Years.
  const firstYear = yearOf(result.period.start),
    lastYear = yearOf(result.period.end);
  const years: VegetationAnalysis["years"] = [];
  for (let year = firstYear; year <= lastYear; year++) {
    const from = `${year}-01-01`,
      to = `${year}-12-31`;
    const inYear = obs.filter((o) => yearOf(o.date) === year);
    const covered = result.period.start <= from && result.period.end >= to;
    years.push({
      year,
      status: !inYear.length
        ? "no_data"
        : covered && inYear.length >= policy.completeYearMinObservations
          ? "complete"
          : "partial",
      usableObservations: inYear.length,
      largestGapDays: gapWithin(from, to),
      timeline: inYear.map((o) => ({
        date: o.date,
        ndvi: o.ndvi,
        clearPoints: o.clearPoints,
        sensors: o.sensors,
        granules: (granuleByDate.get(o.date) ?? []).slice(0, 4),
      })),
      periods: periods
        .map((p) => clip(p, from, to))
        .filter((p): p is Piece => p !== null)
        .slice(0, 20),
    });
  }

  // Windows that are usually low, from complete years only. Low-confidence
  // periods are left out so a cloud gap never creates a "usually bare" claim.
  let typical: VegetationAnalysis["typicalLowGreenness"] = null;
  if (!reason) {
    const complete = years.filter((y) => y.status === "complete");
    const counts = new Array<number>(365).fill(0);
    for (const y of complete)
      for (const p of y.periods)
        if (p.kind === "low_greenness" && p.confidence === "normal")
          for (let d = p.start; d <= p.end; d = plusDays(d, 1))
            if (d.slice(5) !== "02-29") counts[slotOf(d)]!++;
    const need = Math.ceil(policy.typicalShare * complete.length);
    const usual = counts.map(
      (c) => complete.length >= policy.minimumTypicalYears && c >= need,
    );
    const windows: { start: number; length: number }[] = [];
    // Circular runs, so a window may cross 31 December.
    const startAt = usual.every(Boolean)
      ? 0
      : usual.findIndex((u, i) => u && !usual[(i + 364) % 365]);
    if (startAt >= 0 && usual.some(Boolean)) {
      let i = 0;
      while (i < 365) {
        const slot = (startAt + i) % 365;
        if (usual[slot]) {
          let length = 0;
          while (i + length < 365 && usual[(startAt + i + length) % 365])
            length++;
          windows.push({ start: slot, length });
          i += length;
        } else i++;
      }
    }
    typical = {
      completeYears: complete.length,
      windows: windows
        .filter((w) => w.length >= policy.minimumWindowDays)
        .slice(0, 12)
        .map((w) => ({
          start: monthDayOfSlot(w.start),
          end: monthDayOfSlot((w.start + w.length - 1) % 365),
          yearsLowMin: Math.min(
            ...Array.from(
              { length: w.length },
              (_, k) => counts[(w.start + k) % 365]!,
            ),
          ),
        })),
    };
  }

  // The latest readings against the field's other years at the same time of
  // year: median of one value per other year inside plus or minus the window.
  const yearsWithData = years.filter((y) => y.usableObservations > 0);
  const referenceYears = Math.max(0, yearsWithData.length - 1);
  const lastDate = obs.at(-1)?.date ?? result.period.end;
  const recentFrom = plusDays(lastDate, -policy.recentDays);
  const spreadFloor = Math.max(result.signal.noise, policy.noiseFloor);
  const points: VegetationAnalysis["anomalies"]["points"] = [];
  if (referenceYears >= policy.minimumReferenceYears)
    for (const o of obs) {
      if (o.date < recentFrom) continue;
      const slot = slotOf(o.date),
        year = yearOf(o.date);
      const refs: number[] = [];
      for (const y of yearsWithData) {
        if (y.year === year) continue;
        const near = y.timeline.filter(
          (t) => slotDistance(slotOf(t.date), slot) <= policy.anomalyWindowDays,
        );
        if (near.length) refs.push(median(near.map((t) => t.ndvi)));
      }
      if (refs.length < policy.minimumReferenceYears) continue;
      const ref = median(refs);
      const spread = Math.max(1.4826 * mad(refs), spreadFloor);
      const z = (o.ndvi - ref) / spread;
      points.push({
        date: o.date,
        ndvi: o.ndvi,
        referenceMedian: round(ref),
        referenceYears: refs.length,
        spread: round(spread),
        anomaly: round(o.ndvi - ref),
        robustZ: round(z, 2),
        flag:
          z <= -policy.anomalyRobustZ
            ? "below_usual"
            : z >= policy.anomalyRobustZ
              ? "above_usual"
              : "usual",
      });
    }
  const shown = points.slice(-400);
  const latestObs = [...obs].reverse().find((o) => o.date <= asOf);
  const latestPoint = latestObs
    ? shown.find((p) => p.date === latestObs.date)
    : undefined;
  const latest = latestObs
    ? {
        date: latestObs.date,
        ndvi: latestObs.ndvi,
        daysOld: Math.max(0, daysBetween(latestObs.date, asOf)),
        stale: daysBetween(latestObs.date, asOf) > policy.staleDays,
        flag: latestPoint?.flag ?? ("not_compared" as const),
      }
    : null;

  const explanations: VegetationAnalysis["explanations"] = [
    { key: "ndvi", text: VEGETATION_GLOSSARY.ndvi },
  ];
  if (!reason) {
    explanations.push(
      { key: "green_season", text: VEGETATION_GLOSSARY.green_season },
      { key: "bare_field_period", text: VEGETATION_GLOSSARY.bare_field_period },
    );
  }
  if (shown.length)
    explanations.push(
      { key: "vegetation_stress", text: VEGETATION_GLOSSARY.vegetation_stress },
      {
        key: "field_history_anomaly",
        text: VEGETATION_GLOSSARY.field_history_anomaly,
      },
    );
  if (gaps.length)
    explanations.push({
      key: "cloud_gap",
      text: VEGETATION_GLOSSARY.cloud_gap,
    });

  return {
    version: "vegetation-analysis-1",
    policy,
    asOf,
    period: result.period,
    samplePoints: result.samplePoints,
    periodsStatus: reason ? "undetermined" : "available",
    undeterminedReason: reason,
    years,
    typicalLowGreenness: typical,
    anomalies: {
      status: shown.length ? "ok" : "insufficient_history",
      referenceYears,
      points: shown,
      below: shown.filter((p) => p.flag === "below_usual").length,
      above: shown.filter((p) => p.flag === "above_usual").length,
      latest,
    },
    uncertainty: {
      datesSeen: result.datesSeen,
      datesUsable: result.datesUsable,
      usableShare: result.datesSeen
        ? round(result.datesUsable / result.datesSeen, 3)
        : 0,
      largestGapDays: largestGap,
      gapsOverLimit: gaps.slice(0, 60),
      granulesAvailable: (result.granules?.length ?? 0) > 0,
    },
    explanations,
    limitations: [
      ...result.limitations,
      "Low greenness is not proof of bare soil: a dry crop, stubble or weeds can look the same. The farmer confirms what was on the field.",
      "The comparison uses the field's own other years; a different crop or sowing date also changes greenness, so a flag is a prompt to look, not a diagnosis.",
      "Dates hidden by cloud are not filled in; periods that contain a long gap are marked low confidence and left out of the usually-low windows.",
    ].slice(0, 12),
  };
}

// POWER and GPM IMERG monthly rain for the field's cell, compared only where
// both months are complete.
export function rainSeries(result: RainResult): RainSeries {
  const months = result.months.map((m) => {
    const both = m.imergMm !== null && m.powerMm !== null;
    return {
      month: m.month,
      imergMm: m.imergMm,
      powerMm: m.powerMm,
      bothComplete: both,
      differenceMm: both ? round(m.imergMm! - m.powerMm!, 1) : null,
      ratio: both && m.powerMm! >= 1 ? round(m.imergMm! / m.powerMm!, 3) : null,
    };
  });
  const compared = months.filter((m) => m.bothComplete);
  const imerg = compared.reduce((s, m) => s + m.imergMm!, 0);
  const power = compared.reduce((s, m) => s + m.powerMm!, 0);
  return {
    version: "rain-series-1",
    unit: "mm per calendar month",
    period: result.period,
    months,
    summary: {
      monthsCompared: compared.length,
      imergTotalMm: round(imerg, 1),
      powerTotalMm: round(power, 1),
      ratio: power >= 1 ? round(imerg / power, 3) : null,
      imergWetterShare: compared.length
        ? round(
            compared.filter((m) => m.imergMm! > m.powerMm!).length /
              compared.length,
            3,
          )
        : null,
    },
    sources: {
      imerg: { product: result.product, cell: result.cell },
      power:
        "NASA POWER daily precipitation for the field's POWER cell, summed by month",
    },
    planning:
      "Plans correct POWER rain month by month to IMERG Final over 2001–2020 (factors limited to 0.2–3) and keep POWER's daily timing. This series is the field's own comparison, not the correction itself.",
    limitations: result.limitations,
  };
}
