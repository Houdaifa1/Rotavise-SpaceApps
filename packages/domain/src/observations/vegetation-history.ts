import type {
  ModisResult,
  VegetationAnalysis,
  VegetationHistory,
  VegetationHistoryPolicy,
} from "@rotavise/contracts";
import { daysBetween, plusDays } from "../rotation/days.js";

// Declared product heuristics for reading a field's own 25-year greenness
// history. None is a crop threshold. Greenness is always compared with the
// same field's own yearly range, so a different soil, crop or sensor offset
// does not change what "low" means for that field.
export const vegetationHistoryPolicy: VegetationHistoryPolicy = {
  version: "vegetation-history-1",
  binDays: 16,
  minimumBinsPerYear: 16,
  minimumAmplitude: 0.15,
  lowFraction: 0.25,
  greenFraction: 0.5,
  usualShare: 0.6,
  minimumYears: 5,
  minimumTrendYears: 8,
  trendConsistency: 0.7,
  trendNoisePerDecade: 0.02,
  heterogeneityModerate: 0.05,
  heterogeneityHigh: 0.1,
  minimumAgreementBins: 12,
  provenance:
    "Declared product heuristics, not taken from a source. A year counts when it has enough 16-day dates and a clear seasonal range; low and green are fractions of that year's own range; a window is 'usual' when most years agree. The trend is a Theil-Sen slope (Sen 1968) of yearly peaks.",
};

export const VEGETATION_HISTORY_GLOSSARY = {
  "modis.ndvi_history":
    "This is the same greenness index as the finer satellite timeline (NDVI), but measured every 16 days since 2000, so it shows what is usual for this field across many years, not just the last few.",
  "modis.usually_low":
    "A window is usually low when, in most years, the field was in the lowest part of its own yearly range at that time. It often means bare soil or stubble, but the satellite cannot tell; confirm what was on the field.",
  "modis.pixel_size":
    "Each reading covers a square about 250 m wide, roughly 6 hectares. A small field shares that square with whatever is around it, so check the neighbour comparison before trusting a window.",
  "modis.peak_trend":
    "The yearly peak is the greenest reading of each year. A slow rise or fall over many years can reflect climate, crop choice, irrigation or a change in the surroundings; the trend does not say which.",
  "modis.hls_agreement":
    "The older, coarser record and the newer, finer one should tell the same story in the years they share. Agreement raises confidence; disagreement is a reason to look at the field.",
} as const;

const round = (v: number, digits = 4) => Number(v.toFixed(digits));
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
function quantile(values: number[], q: number) {
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos),
    hi = Math.ceil(pos);
  return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo);
}
const yearOf = (date: string) => Number(date.slice(0, 4));
const monthDayOfSlot = (slot: number) => plusDays("2001-01-01", slot).slice(5);
const slotOfMonthDay = (md: string) => daysBetween("2001-01-01", `2001-${md}`);

type BinTable = Map<number, Map<number, number>>; // year -> bin -> median
// MODIS composites follow fixed day-of-year periods, so a reading's bin comes
// from its day of the year, not its calendar date: in a leap year the periods
// after February start a day earlier on the calendar. The month-day labels of
// the bins use a non-leap year.
const dayOfYearSlot = (date: string) =>
  daysBetween(`${date.slice(0, 4)}-01-01`, date);
function binTable(
  points: { date: string; ndvi: number }[],
  binDays: number,
  binCount: number,
): BinTable {
  const raw = new Map<number, Map<number, number[]>>();
  for (const p of points) {
    const year = yearOf(p.date);
    const bin = Math.min(
      Math.floor(dayOfYearSlot(p.date) / binDays),
      binCount - 1,
    );
    const byBin = raw.get(year) ?? new Map<number, number[]>();
    byBin.set(bin, [...(byBin.get(bin) ?? []), p.ndvi]);
    raw.set(year, byBin);
  }
  const out: BinTable = new Map();
  for (const [year, byBin] of raw)
    out.set(
      year,
      new Map([...byBin].map(([bin, v]) => [bin, median(v)] as const)),
    );
  return out;
}
function pearson(x: number[], y: number[]) {
  const n = x.length;
  const mx = x.reduce((a, b) => a + b, 0) / n,
    my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0,
    sxx = 0,
    syy = 0;
  for (let i = 0; i < n; i++) {
    sxy += (x[i]! - mx) * (y[i]! - my);
    sxx += (x[i]! - mx) ** 2;
    syy += (y[i]! - my) ** 2;
  }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
// Circular runs of true values over the year's bins, as bin index ranges.
function runs(flags: boolean[]) {
  const n = flags.length;
  if (!flags.some(Boolean)) return [];
  if (flags.every(Boolean)) return [{ first: 0, length: n }];
  const startAt = flags.findIndex((f, i) => f && !flags[(i + n - 1) % n]);
  const out: { first: number; length: number }[] = [];
  let i = 0;
  while (i < n) {
    const idx = (startAt + i) % n;
    if (flags[idx]) {
      let length = 0;
      while (i + length < n && flags[(startAt + i + length) % n]) length++;
      out.push({ first: idx, length });
      i += length;
    } else i++;
  }
  return out;
}

// The field's greenness over the whole MODIS record, with the finer HLS
// timeline beside it when there is one. `asOf` is the caller's today.
export function analyzeVegetationHistory(
  modis: ModisResult,
  hls: VegetationAnalysis | null,
  asOf: string,
  policy: VegetationHistoryPolicy = vegetationHistoryPolicy,
): VegetationHistory {
  const binDays = policy.binDays;
  const binCount = Math.ceil(365 / binDays);
  const binStart = (b: number) => b * binDays;
  const binEnd = (b: number) => Math.min(b * binDays + binDays - 1, 364);
  const table = binTable(modis.observations, binDays, binCount);

  // Which years can say something about "usual".
  const allYears: number[] = [];
  const first = Number(modis.period.start.slice(0, 4)),
    last = Number(modis.period.end.slice(0, 4));
  for (let y = first; y <= last; y++) allYears.push(y);
  const excluded: VegetationHistory["years"]["excluded"] = [];
  const used: {
    year: number;
    floor: number;
    amp: number;
    bins: Map<number, number>;
  }[] = [];
  for (const year of allYears) {
    const bins = table.get(year);
    if (!bins || !bins.size) {
      excluded.push({ year, reason: "no_data" });
      continue;
    }
    if (bins.size < policy.minimumBinsPerYear) {
      excluded.push({ year, reason: "too_few_dates" });
      continue;
    }
    const values = [...bins.values()];
    const floor = quantile(values, 0.05),
      amp = quantile(values, 0.95) - floor;
    if (amp < policy.minimumAmplitude) {
      excluded.push({ year, reason: "no_distinct_season" });
      continue;
    }
    used.push({ year, floor, amp, bins });
  }

  // Per bin: how often it sat in the field's own low or green range.
  const lowCount = new Array<number>(binCount).fill(0);
  const greenCount = new Array<number>(binCount).fill(0);
  const withData = new Array<number>(binCount).fill(0);
  for (const y of used)
    for (const [bin, v] of y.bins) {
      withData[bin]!++;
      if (v <= y.floor + policy.lowFraction * y.amp) lowCount[bin]!++;
      if (v >= y.floor + policy.greenFraction * y.amp) greenCount[bin]!++;
    }
  const enough = used.length >= policy.minimumYears;
  const shareOf = (count: number, n: number) =>
    enough && n >= policy.minimumYears ? round(count / n, 3) : null;
  const bins = Array.from({ length: binCount }, (_, b) => ({
    start: monthDayOfSlot(binStart(b)),
    end: monthDayOfSlot(binEnd(b)),
    yearsWithData: withData[b]!,
    lowShare: shareOf(lowCount[b]!, withData[b]!),
    greenShare: shareOf(greenCount[b]!, withData[b]!),
  }));
  const windowsOf = (counts: number[]): VegetationHistory["usuallyLow"] => {
    if (!enough) return { status: "insufficient_history", windows: [] };
    const usual = counts.map(
      (c, b) =>
        withData[b]! >= policy.minimumYears &&
        c / withData[b]! >= policy.usualShare,
    );
    return {
      status: "available",
      windows: runs(usual)
        .slice(0, 12)
        .map((r) => {
          const idx = Array.from(
            { length: r.length },
            (_, k) => (r.first + k) % binCount,
          );
          const days = idx.reduce(
            (s, b) => s + (binEnd(b) - binStart(b) + 1),
            0,
          );
          return {
            start: monthDayOfSlot(binStart(r.first)),
            end: monthDayOfSlot(binEnd(idx.at(-1)!)),
            days,
            yearsMin: Math.min(...idx.map((b) => counts[b]!)),
          };
        }),
    };
  };
  const usuallyLow = windowsOf(lowCount);
  const usuallyGreen = windowsOf(greenCount);

  // The greenest reading of each used year, and its slow trend.
  const annualPeaks = used.map((y) => ({
    year: y.year,
    peakNdvi: round(Math.max(...y.bins.values())),
  }));
  let peakTrend: VegetationHistory["peakTrend"] = {
    status: "insufficient_history",
    years: annualPeaks.length,
    slopePerDecade: null,
    direction: "not_computed",
    consistency: null,
  };
  if (annualPeaks.length >= policy.minimumTrendYears) {
    const slopes: number[] = [];
    for (let i = 0; i < annualPeaks.length; i++)
      for (let j = i + 1; j < annualPeaks.length; j++)
        slopes.push(
          (annualPeaks[j]!.peakNdvi - annualPeaks[i]!.peakNdvi) /
            (annualPeaks[j]!.year - annualPeaks[i]!.year),
        );
    const positive = slopes.filter((s) => s > 0).length,
      negative = slopes.filter((s) => s < 0).length;
    const consistency = Math.max(positive, negative) / slopes.length;
    const slopePerDecade = round(median(slopes) * 10);
    const clear =
      Math.abs(slopePerDecade) >= policy.trendNoisePerDecade &&
      consistency >= policy.trendConsistency;
    peakTrend = {
      status: "ok",
      years: annualPeaks.length,
      slopePerDecade,
      direction: !clear
        ? "no_clear_trend"
        : slopePerDecade > 0
          ? "rising"
          : "falling",
      consistency: round(consistency, 3),
    };
  }

  // Does the centre pixel look like its neighbours?
  const diffs = modis.observations
    .filter((o) => o.neighbourMean !== null && o.neighbours >= 1)
    .map((o) => Math.abs(o.ndvi - o.neighbourMean!));
  const medianDiff = diffs.length ? round(median(diffs)) : null;
  const heterogeneity: VegetationHistory["heterogeneity"] =
    diffs.length < 12 || medianDiff === null
      ? {
          status: "not_measured",
          medianAbsDifference: medianDiff,
          observations: diffs.length,
        }
      : {
          status:
            medianDiff < policy.heterogeneityModerate
              ? "similar"
              : medianDiff < policy.heterogeneityHigh
                ? "moderate"
                : "differs",
          medianAbsDifference: medianDiff,
          observations: diffs.length,
        };

  // The finer HLS record against MODIS in the years they share.
  let hlsAgreement: VegetationHistory["hlsAgreement"] = null;
  if (hls && hls.years.some((y) => y.timeline.length)) {
    const hlsTable = binTable(
      hls.years.flatMap((y) =>
        y.timeline.map((t) => ({ date: t.date, ndvi: t.ndvi })),
      ),
      binDays,
      binCount,
    );
    const a: number[] = [],
      b: number[] = [];
    for (const [year, hlsBins] of hlsTable)
      for (const [bin, h] of hlsBins) {
        const m = table.get(year)?.get(bin);
        if (m !== undefined) {
          a.push(h);
          b.push(m);
        }
      }
    const slotsOf = (windows: { start: string; end: string }[]) => {
      const set = new Set<number>();
      for (const w of windows) {
        let s = slotOfMonthDay(w.start);
        const e = slotOfMonthDay(w.end);
        for (let k = 0; k < 365; k++) {
          set.add(s);
          if (s === e) break;
          s = (s + 1) % 365;
        }
      }
      return set;
    };
    const hlsLow = slotsOf(hls.typicalLowGreenness?.windows ?? []);
    const modisLow = slotsOf(usuallyLow.windows);
    const both = [...hlsLow].filter((s) => modisLow.has(s)).length;
    const overlap = a.length;
    const r = overlap >= policy.minimumAgreementBins ? pearson(a, b) : null;
    hlsAgreement = {
      status:
        overlap < policy.minimumAgreementBins
          ? "insufficient_overlap"
          : r !== null && r >= 0.8
            ? "close"
            : r !== null && r >= 0.5
              ? "partial"
              : "weak",
      overlapYearBins: overlap,
      correlation: r === null ? null : round(r, 3),
      meanDifferenceHlsMinusModis:
        overlap >= policy.minimumAgreementBins
          ? round(a.reduce((s, v, i) => s + (v - b[i]!), 0) / overlap)
          : null,
      hlsLowDaysAlsoLowInModis: hlsLow.size
        ? round(both / hlsLow.size, 3)
        : null,
      modisLowDaysAlsoLowInHls: modisLow.size
        ? round(both / modisLow.size, 3)
        : null,
    };
  }

  const explanations: VegetationHistory["explanations"] = [
    {
      key: "modis.ndvi_history",
      text: VEGETATION_HISTORY_GLOSSARY["modis.ndvi_history"],
    },
    {
      key: "modis.pixel_size",
      text: VEGETATION_HISTORY_GLOSSARY["modis.pixel_size"],
    },
  ];
  if (usuallyLow.windows.length)
    explanations.push({
      key: "modis.usually_low",
      text: VEGETATION_HISTORY_GLOSSARY["modis.usually_low"],
    });
  if (peakTrend.status === "ok")
    explanations.push({
      key: "modis.peak_trend",
      text: VEGETATION_HISTORY_GLOSSARY["modis.peak_trend"],
    });
  if (hlsAgreement)
    explanations.push({
      key: "modis.hls_agreement",
      text: VEGETATION_HISTORY_GLOSSARY["modis.hls_agreement"],
    });

  return {
    version: "vegetation-history-1",
    policy,
    asOf,
    period: modis.period,
    source: {
      product: "MOD13Q1.061 (Terra MODIS vegetation indices, 16 day)",
      resolutionMeters: 250,
      pixelAreaHa: 6.25,
      note: "Each value covers about 6 hectares around the field centre. NASA's data alert of 2 May 2025 says the Terra and Aqua platforms that carry MODIS begin shutting down in late 2026 or early 2027 and MODIS data will no longer be collected, so this record will stop growing; VIIRS is NASA's named successor.",
    },
    years: { used: used.length, excluded: excluded.slice(0, 60) },
    bins,
    usuallyLow,
    usuallyGreen,
    annualPeaks,
    peakTrend,
    heterogeneity,
    hlsAgreement,
    uncertainty: {
      datesSeen: modis.datesSeen,
      datesUsable: modis.datesUsable,
      usableShare: modis.datesSeen
        ? round(modis.datesUsable / modis.datesSeen, 3)
        : 0,
      yearsUsed: used.length,
      yearsExcluded: excluded.length,
    },
    explanations,
    limitations: [
      ...modis.limitations,
      "Low greenness is not proof of bare soil, and a green window is not proof of a crop: the farmer confirms what grew.",
      "Windows come from the field's own years only; a change of crop, irrigation or sowing date moves them, so they describe what was usual, not what will happen.",
      "Years with too few clear dates or no clear seasonal range are left out instead of being filled in.",
    ].slice(0, 12),
  };
}
