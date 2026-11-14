import {
  SCENARIO_ATTRIBUTION,
  type FutureClimatePolicy,
  type NearTermBlock,
  type RotationAssessmentV4,
  type RotationCandidate,
  type ScenarioExperiment,
} from "@rotavise/contracts";
import { compare } from "../constraints/reasons.js";
import {
  ClimateModel,
  fillUncheckedClimate,
  type ClimateSettings,
  type ClimateSlot,
  type ClimateSource,
  type RotationClimate,
  type RotationWater,
  type RotationExtremes,
} from "./climate.js";
import { worldKey } from "./scenario.js";

type Weights = {
  climate: number;
  water: number;
  soil_health: number;
  crop_health: number;
};
export type FutureCandidate = {
  id: string;
  timed: ClimateSlot[];
  water: number | null;
  soil: number | null;
  health: number;
};
type Block = RotationAssessmentV4["futureClimate"];
type CandidateFuture = NonNullable<RotationCandidate["future"]>;
const quantize = (v: number) => Math.min(1, Math.max(0, Number(v.toFixed(12))));
const signed = (v: number) => Math.min(1, Math.max(-1, Number(v.toFixed(12))));
const loss = (
  c: FutureCandidate,
  w: Weights,
  climate: number,
  water: number | null,
) =>
  quantize(
    w.climate * climate +
      w.water * (water ?? c.water ?? 0) +
      w.soil_health * (c.soil ?? 0) +
      w.crop_health * c.health,
  );
// Each model's future is compared with that model's own historical baseline,
// and each future world ranks the same candidates with the farmer's weights
// and its own climate losses. POWER and model data never meet in one number.
export function assessFutures(args: {
  candidates: FutureCandidate[];
  weights: Weights;
  baseTop: string[];
  policy: FutureClimatePolicy;
  settings: ClimateSettings;
  // Complete evidence for every needed unit, or why there is none. The
  // near-term worlds, when the policy has them, sit in the same map.
  worlds: Map<string, ClimateSource> | "not_prepared" | "incomplete";
  // Whether the near-term units were all present; ignored without a
  // near-term policy.
  nearTerm?: "available" | "not_prepared" | "incomplete" | undefined;
  unitIds: string[];
  cell: { latitude: number; longitude: number } | null;
  climateCompared: boolean;
}): { block: Block; perCandidate: Map<string, CandidateFuture> } {
  const { candidates, weights, policy, settings, worlds } = args;
  const perCandidate = new Map<string, CandidateFuture>();
  // Without a near-term policy no key is added, so those results are the
  // bytes they always were.
  const nearBlock = (
    reason: NonNullable<NearTermBlock["reason"]> | null,
    compared?: {
      worlds: Block["worlds"];
      topStable: boolean | null;
    },
  ): { nearTerm: NearTermBlock } | Record<string, never> =>
    policy.nearTerm
      ? {
          nearTerm: {
            status: compared && !reason ? "compared" : "unavailable",
            reason,
            notAForecast: true,
            windows: policy.nearTerm.windows,
            minimumCompleteAnalogs: policy.nearTerm.minimumCompleteAnalogs,
            worlds: compared?.worlds ?? [],
            topStableAcrossFutures: compared?.topStable ?? null,
          },
        }
      : {};
  const empty = (reason: NonNullable<Block["reason"]>): Block => ({
    status: "unavailable",
    reason,
    cell: args.cell,
    unitIds: args.unitIds,
    worlds: [],
    topStableAcrossFutures: null,
    attribution: SCENARIO_ATTRIBUTION,
    ...nearBlock(reason),
  });
  if (!args.climateCompared || !candidates.length)
    return { block: empty("CLIMATE_NOT_COMPARED"), perCandidate };
  if (worlds === "not_prepared")
    return { block: empty("SCENARIO_TILE_NOT_PREPARED"), perCandidate };
  if (worlds === "incomplete")
    return { block: empty("SCENARIO_DATA_INCOMPLETE"), perCandidate };
  const run = (
    model: string,
    window: FutureClimatePolicy["baseline"],
    period?: "near_term",
    minimumCompleteAnalogs = policy.minimumCompleteAnalogs,
  ):
    | {
        climate: RotationClimate;
        water: RotationWater;
        extremes: RotationExtremes;
      }[]
    | null => {
    const source = worlds.get(worldKey(model, window.experiment, period));
    if (!source) return null;
    const climate = new ClimateModel(source, {
      firstAnchorYear: window.firstAnchorYear,
      lastAnchorYear: window.lastAnchorYear,
      minimumCompleteAnalogs,
      representativeStepDays: settings.representativeStepDays,
      maxClimateDayVisits: settings.maxClimateDayVisits,
    });
    const losses = fillUncheckedClimate(
      candidates.map((c) => climate.rotation(c.timed)),
    );
    const results = candidates.map((c, i) => ({
      climate: losses[i]!,
      water: climate.rotationWater(c.timed),
      extremes: climate.rotationExtremes(c.timed),
    }));
    return results.some((r) => r.climate === null) || climate.exhausted
      ? null
      : results;
  };
  // Each model's baseline is the same for every period, so it runs once.
  const baselines = new Map<string, ReturnType<typeof run>>();
  const baselineOf = (model: string) => {
    if (!baselines.has(model))
      baselines.set(model, run(model, policy.baseline));
    return baselines.get(model)!;
  };
  // Compares each model's windows with that model's own baseline.
  const compareWindows = (
    windows: FutureClimatePolicy["futures"],
    period?: "near_term",
    minimumCompleteAnalogs = policy.minimumCompleteAnalogs,
  ) => {
    const worldList: Block["worlds"] = [];
    const scenarios = new Map<
      string,
      Map<ScenarioExperiment, CandidateFuture["scenarios"][number]["models"]>
    >(candidates.map((c) => [c.id, new Map()]));
    const futureTops: string[][] = [];
    for (const model of policy.models) {
      const baseline = baselineOf(model.id);
      for (const window of windows) {
        const future = baseline
          ? run(model.id, window, period, minimumCompleteAnalogs)
          : null;
        if (!baseline || !future) {
          worldList.push({
            model: model.id,
            experiment: window.experiment,
            status: "not_compared",
            topCandidateIds: [],
          });
          continue;
        }
        const losses = candidates
          .map((c, i) => ({
            c,
            i,
            l: loss(
              c,
              weights,
              future[i]!.climate!.meanLoss,
              future[i]!.water?.meanLoss ?? null,
            ),
          }))
          .sort((a, b) => a.l - b.l || compare(a.c.id, b.c.id));
        const best = losses[0]!.l;
        const tops = losses
          .filter((x) => x.l === best)
          .map((x) => x.c.id)
          .sort(compare);
        futureTops.push(tops);
        worldList.push({
          model: model.id,
          experiment: window.experiment,
          status: "compared",
          topCandidateIds: tops.slice(0, 500),
        });
        for (const x of losses) {
          const rank = losses.findIndex((y) => y.l === x.l) + 1;
          const b = baseline[x.i]!.climate!,
            f = future[x.i]!.climate!;
          const bw = baseline[x.i]!.water,
            fw = future[x.i]!.water;
          const byExperiment = scenarios.get(x.c.id)!;
          byExperiment.set(window.experiment, [
            ...(byExperiment.get(window.experiment) ?? []),
            {
              model: model.id,
              baselineMeanLoss: b.meanLoss,
              futureMeanLoss: f.meanLoss,
              change: signed(f.meanLoss - b.meanLoss),
              futureWorstDecileLoss: f.worstDecileLoss,
              baselineWaterLoss: bw?.meanLoss ?? null,
              futureWaterLoss: fw?.meanLoss ?? null,
              waterChange: bw && fw ? signed(fw.meanLoss - bw.meanLoss) : null,
              futureRainMm: fw?.meanRainMm ?? null,
              ...(baseline[x.i]!.extremes && future[x.i]!.extremes
                ? {
                    hottestDayChangeC: Number(
                      (
                        future[x.i]!.extremes!.meanHottestDayC -
                        baseline[x.i]!.extremes!.meanHottestDayC
                      ).toFixed(1),
                    ),
                    drySpellChangeDays: Number(
                      (
                        future[x.i]!.extremes!.meanLongestDrySpellDays -
                        baseline[x.i]!.extremes!.meanLongestDrySpellDays
                      ).toFixed(1),
                    ),
                    futureDroughtSeasonShare:
                      future[x.i]!.extremes!.droughtSeasonShare,
                  }
                : {}),
              baselineRainMm: bw?.meanRainMm ?? null,
              weightedRank: rank,
            },
          ]);
        }
      }
    }
    return { worldList, scenarios, futureTops };
  };
  type Compared = ReturnType<typeof compareWindows>;
  const summarize = (
    c: FutureCandidate,
    windows: FutureClimatePolicy["futures"],
    compared: Compared,
  ) => {
    const byExperiment = compared.scenarios.get(c.id)!;
    return windows.map((window) => {
      const models = byExperiment.get(window.experiment) ?? [];
      const changes = models.map((m) => m.change);
      const waterChanges = models.flatMap((m) =>
        m.waterChange === null || m.waterChange === undefined
          ? []
          : [m.waterChange],
      );
      return {
        experiment: window.experiment,
        models,
        meanChange: changes.length
          ? signed(changes.reduce((a, b) => a + b, 0) / changes.length)
          : null,
        minChange: changes.length ? Math.min(...changes) : null,
        maxChange: changes.length ? Math.max(...changes) : null,
        meanWaterChange: waterChanges.length
          ? signed(
              waterChanges.reduce((a, b) => a + b, 0) / waterChanges.length,
            )
          : null,
      };
    });
  };
  const base = JSON.stringify(args.baseTop);
  const stable = (tops: string[][]) =>
    tops.every((t) => JSON.stringify(t) === base);
  const mid = compareWindows(policy.futures);
  // The near-term period is compared only when the policy has one and its
  // own units were all present; otherwise it says why it is missing.
  const nearReason: NearTermBlock["reason"] | undefined = !policy.nearTerm
    ? undefined
    : args.nearTerm === "available"
      ? null
      : args.nearTerm === "incomplete"
        ? "NEAR_TERM_DATA_INCOMPLETE"
        : "NEAR_TERM_TILE_NOT_PREPARED";
  const near =
    policy.nearTerm && nearReason === null
      ? compareWindows(
          policy.nearTerm.windows,
          "near_term",
          policy.nearTerm.minimumCompleteAnalogs,
        )
      : null;
  const nearUsable = near !== null && near.futureTops.length > 0;
  const nearPart = !policy.nearTerm
    ? {}
    : nearUsable
      ? nearBlock(null, {
          worlds: near.worldList,
          topStable: stable(near.futureTops),
        })
      : nearBlock(nearReason ?? "NEAR_TERM_ANALOGS_INSUFFICIENT", {
          worlds: near?.worldList ?? [],
          topStable: null,
        });
  if (!mid.futureTops.length) {
    // Rotations keep their near-term comparison even when mid-century failed.
    if (nearUsable)
      for (const c of candidates)
        perCandidate.set(c.id, {
          scenarios: [],
          nearTerm: summarize(c, policy.nearTerm!.windows, near),
        });
    return {
      block: {
        ...empty("FUTURE_ANALOGS_INSUFFICIENT"),
        worlds: mid.worldList,
        ...nearPart,
      },
      perCandidate,
    };
  }
  for (const c of candidates)
    perCandidate.set(c.id, {
      scenarios: summarize(c, policy.futures, mid),
      ...(nearUsable
        ? { nearTerm: summarize(c, policy.nearTerm!.windows, near) }
        : {}),
    });
  return {
    block: {
      status: "compared",
      reason: null,
      cell: args.cell,
      unitIds: args.unitIds,
      worlds: mid.worldList,
      topStableAcrossFutures: stable(mid.futureTops),
      attribution: SCENARIO_ATTRIBUTION,
      ...nearPart,
    },
    perCandidate,
  };
}
