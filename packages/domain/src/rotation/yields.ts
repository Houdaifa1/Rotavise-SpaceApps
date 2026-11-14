import {
  aquaCropParameterSets,
  type RotationCandidate,
  type RotationYields,
} from "@rotavise/contracts";
import { addDays } from "../calendar/dates.js";
import { representativeDates } from "./calendar.js";
import { daysBetween } from "./days.js";
import type { ClimateSource } from "./climate.js";
import { referenceEvapotranspirationMm } from "./water.js";

// Which seasons a plan's top rotations need from the crop model: each crop at
// each slot's middle sowing date, once per historical anchor year.
export function yieldSimulations(
  candidates: RotationCandidate[],
  firstAnchorYear: number,
  lastAnchorYear: number,
  stepDays: number,
) {
  const wanted = new Map<
    string,
    { cropId: string; monthDay: string; days: number }
  >();
  for (const c of candidates)
    for (const s of c.slots) {
      if (!aquaCropParameterSets[s.cropId]) continue;
      const dates = representativeDates(s.sowEarliest, s.sowLatest, stepDays);
      const monthDay = dates[dates.length >> 1]!.slice(5);
      // A season may run past the crop's longest sourced duration in the model.
      const days = Math.round(s.durationDays.max * 1.25);
      wanted.set(`${s.cropId}|${monthDay}`, {
        cropId: s.cropId,
        monthDay,
        days,
      });
    }
  const simulations: {
    key: string;
    crop: string;
    sown: string;
    end: string;
  }[] = [];
  for (const [key, w] of wanted)
    for (let year = firstAnchorYear; year <= lastAnchorYear; year++) {
      if (w.monthDay === "02-29") continue;
      const sown = `${year}-${w.monthDay}`;
      // The model starts 80 days before sowing; the record starts on 1 January.
      if (year === firstAnchorYear && w.monthDay < "03-22") continue;
      simulations.push({
        key,
        crop: aquaCropParameterSets[w.cropId]!,
        sown,
        end: addDays(sown, w.days),
      });
    }
  return simulations;
}
// The field's weather for the crop model: the rain the plan already uses and
// the same reference evapotranspiration as the water balance.
export function yieldWeather(
  source: ClimateSource,
  start: string,
  end: string,
) {
  const water = source.water;
  const from = source.position(start);
  if (!water || from === null || from < 0) return null;
  const days = daysBetween(start, end) + 1;
  const out = {
    start,
    minTemp: [] as number[],
    maxTemp: [] as number[],
    rain: [] as number[],
    referenceEt: [] as number[],
  };
  for (let i = from; i < from + days; i++) {
    const x = source.series.temperatureMax[i];
    const n = source.series.temperatureMin[i];
    const r = water.rain[i];
    if (
      x === undefined ||
      n === undefined ||
      r === undefined ||
      Number.isNaN(x) ||
      Number.isNaN(n) ||
      Number.isNaN(r)
    )
      return null;
    out.maxTemp.push(x);
    out.minTemp.push(n);
    out.rain.push(Number(r.toFixed(2)));
    out.referenceEt.push(
      Number(
        Math.max(
          0.1,
          referenceEvapotranspirationMm(
            x,
            n,
            water.latitude,
            water.dayOfYear(i),
          ),
        ).toFixed(2),
      ),
    );
  }
  return out;
}
// USDA texture class from sand, silt and clay percentages (the standard triangle).
export function textureClass(clay: number, sand: number, silt: number) {
  if (silt + 1.5 * clay < 15) return "Sand";
  if (silt + 2 * clay < 30) return "LoamySand";
  if (clay >= 40 && sand <= 45 && silt < 40) return "Clay";
  if (clay >= 40 && silt >= 40) return "SiltClay";
  if (clay >= 35 && sand > 45) return "SandyClay";
  if (clay >= 27 && clay < 40 && sand > 20 && sand <= 45) return "ClayLoam";
  if (clay >= 27 && clay < 40 && sand <= 20) return "SiltClayLoam";
  if (clay >= 20 && clay < 35 && silt < 28 && sand > 45) return "SandyClayLoam";
  if (clay >= 7 && clay < 27 && silt >= 28 && silt < 50 && sand <= 52)
    return "Loam";
  if (silt >= 80 && clay < 12) return "Silt";
  if (
    (silt >= 50 && clay >= 12 && clay < 27) ||
    (silt >= 50 && silt < 80 && clay < 12)
  )
    return "SiltLoam";
  return "SandyLoam";
}
// Means and the worst tenth of years per slot, for the candidates simulated.
export function attachYields(
  candidates: RotationCandidate[],
  simulations: { key: string }[],
  results: ({
    yieldTPerHa: number;
    potentialTPerHa: number;
    irrigationMm: number;
  } | null)[],
  stepDays: number,
  meta: Pick<
    RotationYields,
    | "model"
    | "modelVersion"
    | "serviceVersion"
    | "soilClass"
    | "soilAssumed"
    | "irrigated"
  >,
): RotationYields {
  const byKey = new Map<string, NonNullable<(typeof results)[number]>[]>();
  simulations.forEach((s, i) => {
    const r = results[i];
    if (r) byKey.set(s.key, [...(byKey.get(s.key) ?? []), r]);
  });
  const round = (v: number) => Number(v.toFixed(2));
  return {
    ...meta,
    calibration: "uncalibrated_default_parameters",
    candidates: candidates.map((c) => ({
      id: c.id,
      slots: c.slots.map((s) => {
        const dates = representativeDates(s.sowEarliest, s.sowLatest, stepDays);
        const monthDay = dates[dates.length >> 1]!.slice(5);
        const runs = byKey.get(`${s.cropId}|${monthDay}`);
        if (!runs || runs.length < 20)
          return {
            cropId: s.cropId,
            status: aquaCropParameterSets[s.cropId]
              ? ("incomplete" as const)
              : ("no_crop_model" as const),
            seasons: runs?.length ?? 0,
            meanYieldTPerHa: null,
            worstDecileYieldTPerHa: null,
            meanIrrigationMm: null,
          };
        const yields = runs.map((r) => r.yieldTPerHa).sort((a, b) => a - b);
        return {
          cropId: s.cropId,
          status: "estimated" as const,
          seasons: runs.length,
          meanYieldTPerHa: round(
            yields.reduce((a, b) => a + b, 0) / yields.length,
          ),
          worstDecileYieldTPerHa: round(
            yields[Math.floor(0.1 * yields.length)]!,
          ),
          meanIrrigationMm: round(
            runs.reduce((a, r) => a + r.irrigationMm, 0) / runs.length,
          ),
          attainment: round(
            runs.reduce(
              (a, r) =>
                a +
                (r.potentialTPerHa > 0
                  ? Math.min(1, r.yieldTPerHa / r.potentialTPerHa)
                  : 0),
              0,
            ) / runs.length,
          ),
        };
      }),
    })),
  };
}
// Declared: half of the final order comes from the farmer-weighted comparison,
// half from how much of its unstressed yield each rotation reaches here. A crop
// with no crop model takes the field's mean attainment, so a gap neither helps
// nor harms it. Different crops' tonnes are never compared.
export const YIELD_RANKING_WEIGHT = 0.5;
export function rankWithYields<
  C extends {
    id: string;
    weightedLoss: number;
    rank: number;
    tiedWith: string[];
  },
>(candidates: C[], yields: RotationYields) {
  const known = yields.candidates.flatMap((c) =>
    c.slots.flatMap((s) => (s.attainment == null ? [] : [s.attainment])),
  );
  if (!known.length) return { candidates, yields };
  const fieldMean = known.reduce((a, b) => a + b, 0) / known.length;
  const round = (v: number) => Number(v.toFixed(12));
  const rows = yields.candidates.map((c) => ({
    ...c,
    attainment: Number(
      (
        c.slots.reduce((a, s) => a + (s.attainment ?? fieldMean), 0) /
        c.slots.length
      ).toFixed(3),
    ),
  }));
  const attainment = new Map(rows.map((r) => [r.id, r.attainment]));
  const final = (c: C) =>
    round(
      (1 - YIELD_RANKING_WEIGHT) * c.weightedLoss +
        YIELD_RANKING_WEIGHT * (1 - (attainment.get(c.id) ?? fieldMean)),
    );
  const scored = candidates
    .map((c) => ({ c, loss: final(c) }))
    .sort((a, b) => a.loss - b.loss || (a.c.id < b.c.id ? -1 : 1));
  return {
    yields: {
      ...yields,
      rankingWeight: YIELD_RANKING_WEIGHT,
      candidates: rows,
    },
    candidates: scored.map(({ c, loss }) => ({
      ...c,
      weightedLoss: loss,
      rank: scored.findIndex((x) => x.loss === loss) + 1,
      tiedWith: scored
        .filter((x) => x.loss === loss && x.c !== c)
        .map((x) => x.c.id)
        .slice(0, 500),
    })),
  };
}
