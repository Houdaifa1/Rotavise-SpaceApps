import type {
  RotationCandidate,
  RotationSoilCarbon,
} from "@rotavise/contracts";
import type { ClimateSource } from "./climate.js";
import { referenceEvapotranspirationMm } from "./water.js";

// RothC (Coleman & Jenkinson 1996) on a monthly step, set up the way FAO's
// GSOCseq manual does: spin up to the mapped stock, inert carbon from Falloon
// et al. 1998, DPM/RPM 1.44, soil cover 0.6, forward 20 years on 2001–2020 climate.
const K = { dpm: 10, rpm: 0.3, bio: 0.66, hum: 0.02 };
const DPM_SHARE = 1.44 / 2.44;
const COVERED = 0.6;
const BARE = 1;
// IPCC 2019 Refinement Table 11.1A: above-ground residue per harvested dry matter,
// roots per above-ground dry matter, and dry matter share of the harvest.
const RESIDUES: Record<string, { rag: number; rs: number; dry: number }> = {
  "durum-wheat": { rag: 1.3, rs: 0.23, dry: 0.89 },
  "bread-wheat": { rag: 1.3, rs: 0.23, dry: 0.89 },
  barley: { rag: 1.2, rs: 0.22, dry: 0.89 },
  "faba-bean": { rag: 2.1, rs: 0.19, dry: 0.91 },
  "sugar-beet": { rag: 1, rs: 0.22, dry: 1 },
  potato: { rag: 0.4, rs: 0.2, dry: 1 },
  sunflower: { rag: 1, rs: 0.22, dry: 1 },
  tomato: { rag: 1, rs: 0.22, dry: 1 },
  // IPCC's generic row, or "Beans and Pulses" for legumes.
  lentil: { rag: 2.1, rs: 0.19, dry: 0.91 },
  pea: { rag: 2.1, rs: 0.19, dry: 0.91 },
  "green-bean": { rag: 2.1, rs: 0.19, dry: 0.91 },
  maize: { rag: 1, rs: 0.22, dry: 0.87 },
  groundnut: { rag: 1, rs: 0.22, dry: 0.94 },
};
// Declared: carbon share of plant dry matter.
const CARBON_SHARE = 0.45;
// ONCA legume reference, page 11: mean national legume yield 7.6 qx/ha, used for
// faba bean because the crop model has no faba bean parameters.
const LEGUME_YIELD = 0.76;
// ONCA legume reference, page 33: nearly 30% of residues kept under direct seeding.
export const KEPT_RESIDUE_SHARE = 0.3;
type Month = { temperature: number; rain: number; et: number };
export type Pools = { dpm: number; rpm: number; bio: number; hum: number };
const empty = (): Pools => ({ dpm: 0, rpm: 0, bio: 0, hum: 0 });
const total = (p: Pools) => p.dpm + p.rpm + p.bio + p.hum;
export function inertCarbon(soc: number) {
  return 0.049 * soc ** 1.139;
}
// One month: decomposition, then the fresh input. Returns the new deficit.
function step(
  pools: Pools,
  month: Month,
  clay: number,
  covered: boolean,
  input: number,
  deficit: number,
) {
  const a = 47.91 / (1 + Math.exp(106.06 / (month.temperature + 18.27)));
  const maximum = -(20 + 1.3 * clay - 0.01 * clay * clay) * (30 / 23);
  const limit = covered ? maximum : maximum / 1.8;
  const next = Math.max(limit, Math.min(0, deficit + month.rain - month.et));
  const b =
    next > 0.444 * maximum
      ? 1
      : 0.2 + 0.8 * ((maximum - next) / (maximum - 0.444 * maximum));
  const rate = a * b * (covered ? COVERED : BARE);
  const x = 1.67 * (1.85 + 1.6 * Math.exp(-0.0786 * clay));
  const kept = 1 / (x + 1);
  let formed = 0;
  for (const key of ["dpm", "rpm", "bio", "hum"] as const) {
    const lost = pools[key] * (1 - Math.exp((-rate * K[key]) / 12));
    pools[key] -= lost;
    formed += lost * kept;
  }
  pools.bio += formed * 0.46;
  pools.hum += formed * 0.54;
  pools.dpm += input * DPM_SHARE;
  pools.rpm += input * (1 - DPM_SHARE);
  return next;
}
// Mean climate per calendar month over 2001–2020, with the plan's rain.
export function monthlyClimate(source: ClimateSource): Month[] | null {
  const water = source.water;
  if (!water) return null;
  const months = Array.from({ length: 12 }, () => ({ t: 0, r: 0, e: 0, n: 0 }));
  const start = source.position("2001-01-01");
  const end = source.position("2020-12-31");
  if (start === null || end === null || start < 0) return null;
  let month = 0,
    day = 0,
    year = 2001;
  const lengths = (y: number) => [
    31,
    (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  for (let i = start; i <= end; i++) {
    const x = source.series.temperatureMax[i]!;
    const n = source.series.temperatureMin[i]!;
    const r = water.rain[i]!;
    if (Number.isNaN(x) || Number.isNaN(n) || Number.isNaN(r)) return null;
    const m = months[month]!;
    m.t += (x + n) / 2;
    m.r += r;
    m.e += referenceEvapotranspirationMm(
      x,
      n,
      water.latitude,
      water.dayOfYear(i),
    );
    m.n++;
    if (++day >= lengths(year)[month]!) {
      day = 0;
      if (++month === 12) {
        month = 0;
        year++;
      }
    }
  }
  return months.map((m) => ({
    temperature: m.t / m.n,
    rain: m.r / 20,
    et: m.e / 20,
  }));
}
// Input and cover per month over the rotation's length.
export function rotationSchedule(
  candidate: RotationCandidate,
  yields: Map<string, number>,
  keptShare: number,
) {
  const first = Number(candidate.slots[0]!.sowEarliest.slice(0, 4));
  const last = Number(candidate.slots.at(-1)!.harvestLatest.slice(0, 4));
  const length = (last - first + 1) * 12;
  const inputs = new Array<number>(length).fill(0);
  const covered = new Array<boolean>(length).fill(false);
  for (const slot of candidate.slots) {
    const residue = RESIDUES[slot.cropId];
    const harvest = yields.get(slot.cropId);
    if (!residue || harvest === undefined) return null;
    const dry = harvest * residue.dry;
    const above = dry * residue.rag;
    const roots = (dry + above) * residue.rs;
    const days = Math.round(
      (slot.durationDays.min + slot.durationDays.max) / 2,
    );
    const sown = slot.sowEarliest;
    const from =
      (Number(sown.slice(0, 4)) - first) * 12 + Number(sown.slice(5, 7)) - 1;
    const months = Math.max(1, Math.round(days / 30.4));
    for (let i = 0; i < months && from + i < length; i++) {
      covered[from + i] = true;
      inputs[from + i]! += (roots * CARBON_SHARE) / months;
    }
    const end = Math.min(length - 1, from + months - 1);
    inputs[end]! += above * keptShare * CARBON_SHARE;
  }
  return { inputs, covered };
}
function run(
  pools: Pools,
  climate: Month[],
  clay: number,
  schedule: { inputs: number[]; covered: boolean[] },
  years: number,
) {
  let deficit = 0;
  const length = schedule.inputs.length;
  for (let m = 0; m < years * 12; m++) {
    deficit = step(
      pools,
      climate[m % 12]!,
      clay,
      schedule.covered[m % length]!,
      schedule.inputs[m % length]!,
      deficit,
    );
  }
  return pools;
}
// Pools at equilibrium with the mapped stock. Crop residues alone cannot hold a
// mapped stock (weeds and root exudates are not counted), so an even background
// input makes up the difference. A long run is linear in its inputs, so two runs
// give the background exactly (the idea of GSOCseq eq. 3).
const withBackground = (
  pattern: { inputs: number[]; covered: boolean[] },
  background: number,
) => ({
  covered: pattern.covered,
  inputs: pattern.inputs.map((v) => v + background / 12),
});
export function spinUp(
  climate: Month[],
  clay: number,
  socStart: number,
  pattern: { inputs: number[]; covered: boolean[] },
) {
  const inert = inertCarbon(socStart);
  // Whole rotation cycles, so the forward run starts at the same point.
  const cycle = pattern.inputs.length / 12;
  const years = Math.ceil(1000 / cycle) * cycle;
  const long = (background: number) =>
    run(empty(), climate, clay, withBackground(pattern, background), years);
  const without = total(long(0));
  const unit = total(long(1)) - without;
  const background = Math.max(0, (socStart - inert - without) / unit);
  return { inert, background, pools: long(background) };
}
export function soilCarbonFor(
  candidates: RotationCandidate[],
  yieldsByCandidate: Map<string, number>[],
  source: ClimateSource,
  clay: number,
  organicCarbonGPerKg: number,
  bulkDensity: number,
): RotationSoilCarbon | null {
  const climate = monthlyClimate(source);
  if (!climate) return null;
  // g/kg ÷ 10 = percent; percent × g/cm³ × 30 cm = t C/ha.
  const socStart = (organicCarbonGPerKg / 10) * bulkDensity * 30;
  const round = (v: number) => Number(v.toFixed(2));
  const results = candidates.map((candidate, i) => {
    const grazed = rotationSchedule(candidate, yieldsByCandidate[i]!, 0);
    const kept = rotationSchedule(
      candidate,
      yieldsByCandidate[i]!,
      KEPT_RESIDUE_SHARE,
    );
    if (!grazed || !kept)
      return { id: candidate.id, status: "no_residue_data" as const };
    return {
      id: candidate.id,
      status: "estimated" as const,
      annualInputGrazedTPerHa: round(
        (grazed.inputs.reduce((a, b) => a + b, 0) / grazed.inputs.length) * 12,
      ),
      annualInputKeptTPerHa: round(
        (kept.inputs.reduce((a, b) => a + b, 0) / kept.inputs.length) * 12,
      ),
      _grazed: grazed,
      _kept: kept,
    };
  });
  // Today's soil is taken as balanced under the top rotation with residues
  // grazed, so every rotation is judged from the same starting pools.
  const base = results.find((r) => r.status === "estimated");
  if (!base || base.status !== "estimated") return null;
  const start = spinUp(climate, clay, socStart, {
    covered: base._grazed.covered,
    inputs: base._grazed.inputs,
  });
  const finish = (schedule: { inputs: number[]; covered: boolean[] }) =>
    round(
      total(
        run(
          { ...start.pools },
          climate,
          clay,
          withBackground(schedule, start.background),
          20,
        ),
      ) + start.inert,
    );
  return {
    model: "RothC (GSOCseq set-up)",
    calibration: "uncalibrated",
    depth: "0-30cm",
    years: 20,
    startTCPerHa: round(socStart),
    keptResidueShare: KEPT_RESIDUE_SHARE,
    candidates: results.map((r) =>
      r.status === "estimated"
        ? {
            id: r.id,
            status: r.status,
            annualInputGrazedTCPerHa: r.annualInputGrazedTPerHa,
            annualInputKeptTCPerHa: r.annualInputKeptTPerHa,
            after20YearsGrazedTCPerHa: finish(r._grazed),
            after20YearsKeptTCPerHa: finish(r._kept),
          }
        : {
            id: r.id,
            status: r.status,
            annualInputGrazedTCPerHa: null,
            annualInputKeptTCPerHa: null,
            after20YearsGrazedTCPerHa: null,
            after20YearsKeptTCPerHa: null,
          },
    ),
  };
}
export const legumeYieldFallback = LEGUME_YIELD;
