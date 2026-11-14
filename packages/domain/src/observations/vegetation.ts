import type { VegetationPolicy, VegetationResult } from "@rotavise/contracts";
import { daysBetween } from "../rotation/days.js";
import { compare } from "../constraints/reasons.js";

export type PixelObservation = {
  pointId: string;
  date: string;
  sensor: "landsat" | "sentinel-2";
  red: number;
  nir: number;
  fmask: number;
};
// HLS v2.0 Fmask bits 1–5: cloud, adjacent to cloud/shadow, cloud shadow,
// snow/ice, water; bits 6–7: aerosol level, 3 = high (decoded by AppEEARS,
// docs/evidence/earth-observations/2026-10-17/fmask-decode-*.json).
export function clearPixel(fmask: number) {
  return (fmask & 0b111110) === 0 && ((fmask >> 6) & 3) !== 3;
}
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const percentile = (v: number[], p: number) => {
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};
const round = (v: number) => Number(v.toFixed(4));
export const VEGETATION_LIMITATIONS = [
  "NDVI from 30 m HLS pixels sampled inside the saved outline; clouds, haze and gaps hide some dates.",
  "Green seasons are suggestions from greenness alone: the farmer says which crop, if any, it was.",
  "Season limits are declared product heuristics, not crop thresholds.",
];
// Field greenness per date (median NDVI of clear sample points) and green
// seasons by an amplitude-fraction rule on a running median.
export function vegetationHistory(
  pixels: PixelObservation[],
  samplePoints: number,
  period: { start: string; end: string },
  policy: VegetationPolicy,
): Omit<VegetationResult, "kind" | "product" | "policy" | "limitations"> {
  const byDate = new Map<string, { values: number[]; sensors: Set<string> }>();
  const seen = new Set<string>();
  for (const p of pixels) {
    seen.add(p.date);
    if (!clearPixel(p.fmask) || p.red < 0 || p.nir <= 0 || p.red + p.nir <= 0)
      continue;
    const entry = byDate.get(p.date) ?? { values: [], sensors: new Set() };
    entry.values.push((p.nir - p.red) / (p.nir + p.red));
    entry.sensors.add(p.sensor);
    byDate.set(p.date, entry);
  }
  const needed = Math.max(
    1,
    Math.ceil(policy.minimumClearShare * samplePoints),
  );
  const observations = [...byDate.entries()]
    .filter(([, e]) => e.values.length >= needed)
    .sort(([a], [b]) => compare(a, b))
    .map(([date, e]) => ({
      date,
      ndvi: round(Math.max(-1, Math.min(1, median(e.values)))),
      clearPoints: Math.min(100, e.values.length),
      sensors: [...e.sensors].sort(compare) as ("landsat" | "sentinel-2")[],
    }));
  const empty = {
    samplePoints,
    period,
    observations,
    datesSeen: seen.size,
    datesUsable: observations.length,
    seasons: [],
  };
  if (observations.length < policy.smoothingObservations * 2)
    return {
      ...empty,
      signal: { baseline: 0, peak: 0, noise: 0, distinct: false },
    };
  const half = (policy.smoothingObservations - 1) / 2;
  const values = observations.map((o) => o.ndvi);
  const smooth = values.map((_, i) =>
    median(values.slice(Math.max(0, i - half), i + half + 1)),
  );
  const baseline = percentile(smooth, 0.1);
  const peak = percentile(smooth, 0.9);
  const steps = smooth.slice(1).map((v, i) => Math.abs(v - smooth[i]!));
  const noise = 1.4826 * median(steps);
  const amplitude = peak - baseline;
  const distinct =
    amplitude > policy.minimumSignalToNoise * noise && amplitude > 0;
  const signal = {
    baseline: round(baseline),
    peak: round(peak),
    noise: round(noise),
    distinct,
  };
  if (!distinct) return { ...empty, signal };
  const level = baseline + policy.seasonLevelFraction * amplitude;
  const peakLevel = baseline + policy.seasonPeakFraction * amplitude;
  const runs: number[][] = [];
  for (let i = 0; i < smooth.length; i++) {
    if (smooth[i]! < level) continue;
    const run = runs.at(-1);
    if (
      run &&
      daysBetween(observations[run.at(-1)!]!.date, observations[i]!.date) <=
        policy.mergeGapDays
    )
      run.push(i);
    else runs.push([i]);
  }
  const seasons = runs.flatMap((run) => {
    const first = observations[run[0]!]!,
      last = observations[run.at(-1)!]!;
    const top = run.reduce((a, b) => (smooth[b]! > smooth[a]! ? b : a));
    if (
      daysBetween(first.date, last.date) < policy.minimumSeasonDays ||
      smooth[top]! < peakLevel
    )
      return [];
    let gap = 0;
    for (let k = 1; k < run.length; k++)
      gap = Math.max(
        gap,
        daysBetween(
          observations[run[k - 1]!]!.date,
          observations[run[k]!]!.date,
        ),
      );
    return [
      {
        start: first.date,
        end: last.date,
        peakDate: observations[top]!.date,
        peakNdvi: round(smooth[top]!),
        observations: run.length,
        largestGapDays: gap,
        openAtStart: run[0] === 0,
        openAtEnd: run.at(-1) === observations.length - 1,
      },
    ];
  });
  return { ...empty, seasons, signal };
}
// Monthly totals from daily mm values; a month is complete only when every
// day of it has a value.
export function monthlyTotals(days: { date: string; mm: number | null }[]) {
  const months = new Map<
    string,
    { sum: number; days: number; missing: boolean }
  >();
  for (const d of days) {
    const key = d.date.slice(0, 7);
    const m = months.get(key) ?? { sum: 0, days: 0, missing: false };
    if (d.mm === null) m.missing = true;
    else {
      m.sum += d.mm;
      m.days++;
    }
    months.set(key, m);
  }
  return months;
}
