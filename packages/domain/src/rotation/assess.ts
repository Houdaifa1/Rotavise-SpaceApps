import { syncBenefitStrategies } from "./benefits.js";
import {
  rotationResources,
  rankResearchCandidates,
  researchCoverage,
  syncResearchStrategies,
} from "./research.js";
import {
  normalizePlanRequestV2,
  planRequestV2Schema,
  rotationAssessmentSchema,
  rotationDimensions,
  rotationPolicySchema,
  type CatalogBundleV2,
  type CatalogRuleV2,
  type PlanRequestV2,
  type RotationAssessment,
  type RotationCandidate,
  type RotationAssessmentV5,
  type RotationAssessmentV6,
  soilEstimateSchema,
  rotationAnalysisContextSchema,
  rainReferenceSchema,
  type RotationPolicyV2,
  type RotationReason,
} from "@rotavise/contracts";
import {
  catalogV2ContentHash,
  validateCatalogV2Structure,
  validateProductionCatalogV2,
} from "@rotavise/catalog";
import { rotationOutputs } from "./outputs.js";
import { daysBetween as elapsedDays, plusDays as addDays } from "./days.js";
import { compare } from "../constraints/reasons.js";
import { indexWeather } from "../climate/weather.js";
import {
  ClimateModel,
  weatherSource,
  type ClimateSlot,
  type RotationClimate,
  type RotationWater,
  type RotationExtremes,
  rainCorrection,
  fillUncheckedClimate,
} from "./climate.js";
import { assessFutures } from "./future.js";
import {
  applyWhatIfToSource,
  shiftPlanning,
  whatIfActive,
  whatIfBlock,
} from "./what-if.js";
import { yieldWeather } from "./yields.js";
import { legumeYieldFallback, soilCarbonFor } from "./soil-carbon.js";
import {
  nearTermUnits,
  scenarioUnits,
  scenarioVariablesFor,
  scenarioWorlds,
  unitKey,
} from "./scenario.js";
import {
  assessCrop,
  resolveContext,
  type CropAssessment,
  type CropSpec,
} from "./evidence.js";
import { rotationReason, orderedReasons } from "./reasons.js";
import {
  fixedRotation,
  historyFacts,
  soilLoss,
  searchRotations,
  type PartialRotation,
} from "./search.js";
import {
  buildStrategies,
  pickAlternativeIds,
  type RuleCounts,
  type StrategyBaseline,
} from "./strategies.js";

export class RotationInputError extends Error {
  constructor(
    public readonly code: "ROTATION_INPUT_INVALID" | "ROTATION_POLICY_INVALID",
  ) {
    super(code);
  }
}
type Dimension = (typeof rotationDimensions)[number];
// The kind of a temperature check, not its limit or its sensitive stage: the
// variable, the medium and the limited side. Wheat's 35 °C flowering maximum
// and maize's 40 °C whole-cycle maximum are both heat checks; faba bean's
// frost limit is a cold check.
const checkKind = (r: CropSpec["temperature"][number]) =>
  `${r.basis}|${r.medium}|${r.lowerDegC === null ? "" : "lower"}|${r.upperDegC === null ? "" : "upper"}`;
// Kinds every schedulable crop has. Crops are compared on climate only on
// these, so a crop is never favoured because it was checked less.
const sharedKinds = (specs: CropSpec[]) =>
  specs.reduce<Set<string> | null>((shared, s) => {
    const own = new Set(s.temperature.map(checkKind));
    return shared === null
      ? own
      : new Set([...shared].filter((k) => own.has(k)));
  }, null) ?? new Set<string>();
type Weights = Record<Dimension, number>;
const classValue = { low: 0, moderate: 0.5, high: 1 } as const;
const quantize = (v: number) => Math.min(1, Math.max(0, Number(v.toFixed(12))));
const OUTPUT_BYTES = 2097152;
const LIMITATIONS = [
  "Historical UTC grid weather, not field measurements, forecasts or success probabilities.",
  "Each slot's earliest sowing assumes the previous crop was sown at its earliest date; sow the next crop no earlier than the previous sowing plus its longest duration and preparation gap.",
  "Water compares the share of each crop's FAO-56 water use not covered by rain in its own season. Rain is NASA POWER corrected month by month to GPM IMERG (2001–2020) where available: Hargreaves reference evapotranspiration (temperature only, not locally verified) with general FAO crop coefficients. All rain counts as usable; soil storage, runoff and stored winter water are not modelled. Irrigation supply and its adequacy are unknown.",
  "Soil health counts sourced preferred-predecessor transitions; a change into a crop with no sourced preference, or from an unknown predecessor, is left out. No measured soil improvement is claimed.",
  "Search keeps the best partial rotations under several priority views and a quota per first crop; counts of pruned rotations are reported.",
  "Weights are declared product heuristics, not calibrated utilities; sensitivity views show how the order would change.",
  "Future climate uses five NEX-GDDP-CMIP6 models (the ISIMIP3b primary set) under SSP2-4.5 and SSP5-8.5: rotations starting 2041–2060 against the same model's rotations starting 1985–2004. These are scenarios, not forecasts; five models do not span every possible future.",
  "Extremes use standard indices at each slot's middle sowing date; drought seasons are below half the slot's mean rain, a declared definition.",
  "Yields are AquaCrop with default parameters, for comparing crops and years, not farm forecasts. Half of the final order comes from each rotation's share of its unstressed yield; crops with no crop model take the field's mean. Soil carbon is RothC from those yields, assuming today's soil is balanced under the top rotation; it shows direction, not a measured change.",
  "Crops with no sourced temperature limit are not checked for climate; they count neither for nor against a rotation, and the result lists them.",
  "Soil values are SoilGrids 2.0 model estimates at about 250 m for a 1 km cell, not a soil test; they only ever warn, and a farmer's test takes precedence. Soil storage is not yet in the water balance.",
  "Rules come from cited sources; results stay 'not yet expert-reviewed' until a specialist review is recorded.",
];

const WHAT_IF_LIMITATION =
  "This result is a what-if test: it applies the rain, temperature and sowing changes the request names on top of the historical record and each model's future, and nothing here is a forecast of what will happen.";
function validateDates(input: PlanRequestV2, assessedOn: string) {
  const { earliest_start_date: first, latest_start_date: last } =
    input.planning;
  const after = (d: string | null) => d !== null && d > assessedOn;
  if (
    first < assessedOn ||
    elapsedDays(assessedOn, last) > 366 ||
    (input.history.status === "known" &&
      input.history.entries.some(
        (e) => after(e.planted_on) || after(e.harvested_on),
      )) ||
    (input.crop_health.status === "reported" &&
      input.crop_health.observations.some((o) => o.observed_on > assessedOn)) ||
    (input.soil.status === "known" &&
      input.soil.observations.some((o) => after(o.measured_on)))
  )
    throw new RotationInputError("ROTATION_INPUT_INVALID");
}
function prepare(request: unknown, policyInput: unknown, assessedOn: string) {
  const parsed = planRequestV2Schema.safeParse(request);
  if (!parsed.success) throw new RotationInputError("ROTATION_INPUT_INVALID");
  // Engine 4 needs a policy that names its future-climate ensemble.
  const policy = rotationPolicySchema.safeParse(policyInput);
  if (!policy.success || policy.data.version !== "rotation-policy-2")
    throw new RotationInputError("ROTATION_POLICY_INVALID");
  const submitted = normalizePlanRequestV2(parsed.data);
  if (
    !policy.data.outputs &&
    (submitted.field_id ||
      submitted.preferences.equipment_limits ||
      submitted.preferences.market_access !== undefined ||
      submitted.preferences.income_weight !== undefined)
  )
    throw new RotationInputError("ROTATION_POLICY_INVALID");
  validateDates(submitted, assessedOn);
  // A what-if may move the first-sowing range; everything below works on the
  // moved range, while the result keeps the request as it was submitted.
  let input = submitted;
  if (whatIfActive(submitted.what_if) && submitted.what_if.sowing_shift_days) {
    const moved = {
      ...submitted,
      planning: {
        ...submitted.planning,
        ...shiftPlanning(submitted.planning, submitted.what_if),
      },
    };
    if (!planRequestV2Schema.safeParse(moved).success)
      throw new RotationInputError("ROTATION_INPUT_INVALID");
    validateDates(moved, assessedOn);
    input = moved;
  }
  return { input, submitted, policy: policy.data as RotationPolicyV2 };
}
// Years a rotation spans after its first sowing year, so late anchors finish.
const spanYears = (input: PlanRequestV2, horizonEnd: string) =>
  Number(horizonEnd.slice(0, 4)) -
  Number(input.planning.earliest_start_date.slice(0, 4));
function namedCrops(input: PlanRequestV2, catalog: CatalogBundleV2) {
  const ids = new Set(catalog.profiles.map((p) => p.id));
  for (const id of [
    ...input.preferences.considered_crop_ids,
    ...input.preferences.excluded_crop_ids,
    ...(input.history.status === "known"
      ? input.history.entries.map((e) => e.crop_id)
      : []),
    ...(input.current_rotation?.crop_ids ?? []),
  ])
    ids.add(id);
  return [...ids].sort(compare);
}
// The cycle the farmer would continue: declared, or else the last crops they
// recorded in date order. Never guessed beyond that.
function currentCycle(input: PlanRequestV2): {
  source: StrategyBaseline["source"];
  cropIds: string[];
} {
  if (input.current_rotation)
    return {
      source: "farmer_declared",
      cropIds: input.current_rotation.crop_ids,
    };
  if (input.history.status === "known") {
    const dated = input.history.entries
      .filter((e) => e.planted_on !== null)
      .sort(
        (a, b) =>
          compare(a.planted_on!, b.planted_on!) ||
          compare(a.crop_id, b.crop_id),
      )
      .map((e) => e.crop_id)
      .filter((id, i, all) => i === 0 || id !== all[i - 1]);
    if (dated.length)
      return { source: "inferred_from_history", cropIds: dated.slice(-4) };
  }
  return { source: "none", cropIds: [] };
}

// Weather the assessment needs: none when no schedulable crop has an evaluable
// temperature rule, otherwise every day from the first analog year to the
// latest allowed historical date, in requests of at most 366 days.
export function rotationWeatherNeedsCore(
  request: unknown,
  catalog: CatalogBundleV2,
  policyInput: unknown,
  assessedOn: string,
) {
  const { input, policy } = prepare(request, policyInput, assessedOn);
  const context = resolveContext(input, catalog, assessedOn);
  const crops = namedCrops(input, catalog).map((id) =>
    assessCrop(id, catalog, input, context),
  );
  if (!crops.some((c) => c.spec)) return [];
  const latest = addDays(assessedOn, -120);
  const span = Math.max(
    ...crops.filter((c) => c.spec).map((c) => c.spec!.duration.max),
  );
  const wanted = addDays(
    `${policy.lastAnchorYear + input.planning.horizon_years + 1}-12-31`,
    span,
  );
  const end = wanted < latest ? wanted : latest;
  const start = `${policy.firstAnchorYear}-01-01`;
  const ranges: { start: string; end: string }[] = [];
  for (let from = start; from <= end;) {
    const to = addDays(from, 365) < end ? addDays(from, 365) : end;
    ranges.push({ start: from, end: to });
    from = addDays(to, 1);
  }
  return ranges;
}

function scenarioNeedsFor(
  request: unknown,
  catalog: CatalogBundleV2,
  policyInput: unknown,
  assessedOn: string,
  units: typeof scenarioUnits | typeof nearTermUnits,
) {
  const { input, policy } = prepare(request, policyInput, assessedOn);
  const context = resolveContext(input, catalog, assessedOn);
  const specs = namedCrops(input, catalog).flatMap((id) => {
    const spec = assessCrop(id, catalog, input, context).spec;
    return spec ? [spec] : [];
  });
  const variables = scenarioVariablesFor(specs);
  if (!variables.length) return null;
  return units(
    policy.futureClimate,
    variables,
    context.location,
    spanYears(input, context.horizonEnd),
  );
}
// Future-climate units a plan needs: none without evaluable temperature rules.
export function rotationScenarioNeedsCore(
  request: unknown,
  catalog: CatalogBundleV2,
  policyInput: unknown,
  assessedOn: string,
) {
  return scenarioNeedsFor(
    request,
    catalog,
    policyInput,
    assessedOn,
    scenarioUnits,
  );
}
// The extra units of the near-term period: null without evaluable temperature
// rules or when the pinned policy has no near-term period. Kept apart from
// rotationScenarioNeedsCore so the mid-century need is exactly what it was.
export function rotationNearTermNeedsCore(
  request: unknown,
  catalog: CatalogBundleV2,
  policyInput: unknown,
  assessedOn: string,
) {
  return scenarioNeedsFor(
    request,
    catalog,
    policyInput,
    assessedOn,
    nearTermUnits,
  );
}
type Final = {
  partial: PartialRotation;
  timed: ClimateSlot[];
  slots: RotationCandidate["slots"];
  climate: RotationClimate;
  water: number | null;
  balance: RotationWater;
  extremes: RotationExtremes;
  soil: number | null;
  health: number;
  reasons: RotationReason[];
  considered: boolean;
};
function finalize(
  partial: PartialRotation,
  input: PlanRequestV2,
  horizonEnd: string,
  climate: ClimateModel,
  crops: Map<string, CropAssessment>,
): Final {
  const slots = partial.slots;
  const latest: string[] = [];
  for (let i = slots.length - 1; i >= 0; i--) {
    const slot = slots[i]!;
    const bounds = [
      slot.occurrence.end,
      addDays(horizonEnd, -slot.spec.duration.max),
    ];
    if (i === 0) bounds.push(input.planning.latest_start_date);
    const next = slots[i + 1];
    if (next)
      bounds.push(
        addDays(latest[i + 1]!, -(slot.spec.duration.max + next.gapDays)),
      );
    latest[i] = bounds.sort()[0]!;
    if (latest[i]! < slot.sowEarliest)
      throw new Error("ROTATION_SCHEDULE_INCONSISTENT");
  }
  const horizonDays = Math.max(
    1,
    elapsedDays(input.planning.earliest_start_date, horizonEnd),
  );
  const timed = slots.map((s, i) => ({
    spec: s.spec,
    sowEarliest: s.sowEarliest,
    sowLatest: latest[i]!,
  }));
  const balance = climate.rotationWater(timed);
  const water = balance
    ? balance.meanLoss
    : slots.every((s) => s.spec.waterClass)
      ? quantize(
          slots.reduce(
            (n, s) =>
              n +
              classValue[s.spec.waterClass!.value] *
                ((s.spec.duration.min + s.spec.duration.max) / 2),
            0,
          ) / horizonDays,
        )
      : null;
  const e = partial.estimate;
  const conditions = slots.flatMap((s, i) =>
    (crops.get(s.spec.profile.id)?.spec?.conditions ?? []).map((r) => ({
      ...r,
      slot: i + 1,
    })),
  );
  return {
    partial,
    timed,
    slots: slots.map((s, i) => ({
      cropId: s.spec.profile.id,
      sowEarliest: s.sowEarliest,
      sowLatest: latest[i]!,
      harvestEarliest: addDays(s.sowEarliest, s.spec.duration.min),
      harvestLatest: addDays(latest[i]!, s.spec.duration.max),
      durationDays: { min: s.spec.duration.min, max: s.spec.duration.max },
      windowRuleIds: s.occurrence.ruleIds,
      durationRuleIds: s.spec.duration.rules.map((r) => r.id),
    })),
    climate: climate.rotation(timed),
    water,
    balance,
    extremes: climate.rotationExtremes(timed),
    soil: soilOf(e),
    health: quantize(Math.min(1, e.health / slots.length)),
    reasons: orderedReasons([...partial.warnings, ...conditions]),
    considered: input.preferences.considered_crop_ids.includes(
      slots[0]!.spec.profile.id,
    ),
  };
}
const soilOf = (e: PartialRotation["estimate"]) => {
  const loss = soilLoss(e);
  return loss === null ? null : quantize(loss);
};
function weighted(f: Final, w: Weights) {
  return quantize(
    w.climate * (f.climate?.meanLoss ?? 0) +
      w.water * (f.water ?? 0) +
      w.soil_health * (f.soil ?? 0) +
      w.crop_health * f.health,
  );
}
function top(finals: Final[], w: Weights) {
  const losses = finals.map((f) => ({
    id: f.partial.key,
    loss: weighted(f, w),
  }));
  const best = Math.min(...losses.map((l) => l.loss));
  return losses
    .filter((l) => l.loss === best)
    .map((l) => l.id)
    .sort(compare);
}
export function assessRotationsCore(
  request: unknown,
  catalogInput: unknown,
  weather: unknown,
  policyInput: unknown,
  assessedOn: string,
  allowSynthetic = false,
  // Future-climate series for the field's cell, or null when the tile is
  // not prepared yet.
  scenarios: unknown = null,
  soilInput: unknown = null,
  rainInput: unknown = null,
  engineVersion:
    "rotation-engine-6" | "rotation-engine-7" = "rotation-engine-6",
  analysisContext: unknown = null,
  diagnostics?: (stage: string, data: unknown) => void,
): RotationAssessment {
  const soilEstimate =
    soilInput === null ? null : soilEstimateSchema.parse(soilInput);
  const catalog = allowSynthetic
    ? validateCatalogV2Structure(catalogInput)
    : validateProductionCatalogV2(catalogInput);
  const { input, submitted, policy } = prepare(
    request,
    policyInput,
    assessedOn,
  );
  const regional = policy.comparison === "regional-comparison-1";
  const whatIf = whatIfActive(input.what_if) ? input.what_if : null;
  const synthetic =
    catalog.synthetic ||
    catalog.profiles.some((p) => p.synthetic) ||
    catalog.sources.some((s) => s.synthetic) ||
    catalog.issues.some((i) => i.synthetic);
  const context = resolveContext(input, catalog, assessedOn);
  const assessments = namedCrops(input, catalog).map((id) =>
    assessCrop(id, catalog, input, context, soilEstimate),
  );
  const crops = new Map(assessments.map((a) => [a.cropId, a]));
  const specs = assessments.flatMap((a) => (a.spec ? [a.spec] : []));
  diagnostics?.("specs", specs);
  const needsWeather = specs.length > 0;
  const index = needsWeather
    ? indexWeather(weather, context.location, assessedOn, allowSynthetic)
    : null;
  const rainReference =
    rainInput === null ? null : rainReferenceSchema.parse(rainInput);
  const correction = rainReference
    ? rainCorrection(index, rainReference)
    : null;
  const baseSource = weatherSource(
    index,
    input.location.latitude,
    correction?.factors ?? null,
  );
  const climate = new ClimateModel(
    baseSource && whatIf ? applyWhatIfToSource(baseSource, whatIf) : baseSource,
    policy,
  );
  const history = historyFacts(input, catalog);
  const requested = input.preferences.priorities;
  // Climate compares crops only on the kinds of temperature check they all
  // have; other checks are left out and listed. With no shared kind climate
  // is reported but not ranked. Soil leaves unchecked transitions out instead
  // (see soilLoss).
  const shared = sharedKinds(specs);
  const climateEven = shared.size > 0;
  const leftOutChecks = climateEven
    ? specs.flatMap((s) =>
        s.temperature.filter((r) => !shared.has(checkKind(r))).map((r) => r.id),
      )
    : [];
  const rankedSpecs = climateEven
    ? specs.map((s) => ({
        ...s,
        temperature: s.temperature.filter((r) => shared.has(checkKind(r))),
      }))
    : specs;
  const waterEven =
    specs.every((s) => s.waterCurve !== null) ||
    (specs.every((s) => s.waterCurve === null && s.waterClass !== null) &&
      new Set(specs.map((s) => s.waterClass?.method)).size === 1);
  const even: Record<Dimension, boolean> = {
    climate: climateEven,
    water: regional ? waterEven : true,
    soil_health: true,
    crop_health: true,
  };
  const searched = rotationDimensions.filter((d) => even[d]);
  const sum = searched.reduce((n, d) => n + requested[d], 0);
  const base = Object.fromEntries(
    rotationDimensions.map((d) => [
      d,
      !even[d] ? 0 : sum > 0 ? requested[d] / sum : 1 / searched.length,
    ]),
  ) as Weights;
  const single = (d: Dimension) =>
    Object.fromEntries(
      rotationDimensions.map((x) => [x, x === d ? 1 : 0]),
    ) as Weights;
  const search = searchRotations(
    input,
    catalog,
    context,
    policy,
    rankedSpecs,
    history,
    climate,
    [base, ...searched.map(single)],
  );
  diagnostics?.("searchWork", {
    dayVisits: climate.dayVisits,
    exhausted: climate.exhausted,
  });
  // Engine 7: the farmer's current rotation joins the pool, scored by the same
  // estimate as every other rotation, so it can be compared on equal terms.
  const strategic = engineVersion === "rotation-engine-7";
  const cycle = strategic ? currentCycle(input) : null;
  const baseline: StrategyBaseline = {
    status: "not_provided",
    source: "none",
    cropIds: [],
    notes: [],
    candidateId: null,
  };
  if (cycle && cycle.cropIds.length) {
    baseline.source = cycle.source;
    baseline.cropIds = cycle.cropIds;
    baseline.status = "not_evaluable";
    const unavailable = cycle.cropIds.filter(
      (id) => !rankedSpecs.some((s) => s.profile.id === id),
    );
    if (unavailable.length) {
      for (const id of [...new Set(unavailable)])
        baseline.notes.push({
          kind: "gap",
          code: "BASELINE_CROP_NOT_SCHEDULABLE",
          text: `Your current rotation includes ${id}, which cannot be scheduled with the catalog evidence for this field, so the rotation cannot be scored.`,
          facts: {
            cropId: id,
            status: crops.get(id)?.status ?? "not_in_catalog",
          },
        });
    } else {
      const fixed = fixedRotation(
        input,
        catalog,
        context,
        policy,
        rankedSpecs,
        history,
        climate,
        cycle.cropIds,
        !regional || waterEven,
      );
      if (fixed.partial) {
        baseline.status = "scored";
        baseline.candidateId = fixed.partial.key;
        if (!search.completed.some((p) => p.key === fixed.partial!.key))
          search.completed.push(fixed.partial);
      } else
        baseline.notes.push({
          kind: "gap",
          code: "BASELINE_NO_FEASIBLE_SCHEDULE",
          text: `Your current rotation cannot be scheduled from ${input.planning.earliest_start_date} to ${context.horizonEnd} under the catalog rules.`,
          facts: { code: fixed.stoppedBy?.code ?? "NO_WINDOW_BEFORE_HORIZON" },
        });
      if (fixed.stoppedBy)
        baseline.notes.push({
          kind: "risk",
          code: "BASELINE_STOPPED_BY_RULE",
          text: `Your current rotation breaks a hard rule for ${fixed.stoppedBy.cropId} (${fixed.stoppedBy.code}), so it is scored only up to that point.`,
          facts: { ...fixed.stoppedBy },
        });
    }
    if (cycle.source === "inferred_from_history")
      baseline.notes.push({
        kind: "gap",
        code: "BASELINE_INFERRED_FROM_HISTORY",
        text: "You did not say which rotation you will continue, so your recorded crops were repeated in date order as the current rotation. Tell the tool your rotation to replace this guess.",
        facts: { crops: cycle.cropIds.join(",") },
      });
  } else if (strategic)
    baseline.notes.push({
      kind: "gap",
      code: "BASELINE_NOT_PROVIDED",
      text: "No current rotation was given and no dated crop history could stand in for it, so the alternatives are shown without a comparison to your current rotation.",
      facts: {},
    });
  const finals = search.completed.map((p) =>
    finalize(p, input, context.horizonEnd, climate, crops),
  );
  const filled = fillUncheckedClimate(finals.map((f) => f.climate));
  finals.forEach((f, i) => {
    f.climate = filled[i]!;
  });
  // A rotation with no checkable transition takes the mean of the others, so
  // the gap neither helps nor harms it; none checkable leaves soil uncompared.
  const knownSoil = finals.flatMap((f) => (f.soil === null ? [] : [f.soil]));
  const soilCompared = knownSoil.length > 0;
  if (soilCompared) {
    const mean = quantize(
      knownSoil.reduce((a, b) => a + b, 0) / knownSoil.length,
    );
    for (const f of finals) f.soil ??= mean;
  }
  // A dimension is compared only when every candidate has it, so missing
  // evidence can never create an advantage.
  const climateAvailable =
    finals.length > 0 && finals.every((f) => f.climate !== null);
  const climateCompared = climateAvailable && climateEven;
  const waterMissing = finals.some((f) => f.water === null);
  const methods = new Set(
    finals.flatMap((f) =>
      f.partial.slots.flatMap((s) =>
        s.spec.waterClass ? [s.spec.waterClass.method] : [],
      ),
    ),
  );
  // The FAO balance is one method; crops without it cannot be mixed with it.
  const balanced = finals.filter((f) => f.balance !== null).length;
  const waterCompared =
    finals.length > 0 &&
    !waterMissing &&
    (!regional || waterEven) &&
    (balanced === finals.length || (balanced === 0 && methods.size === 1));
  const compared: Record<Dimension, boolean> = {
    climate: climateCompared,
    water: waterCompared,
    soil_health: soilCompared,
    crop_health: true,
  };
  const active = rotationDimensions.filter((d) => compared[d]);
  const activeSum = active.reduce((n, d) => n + requested[d], 0);
  const weights = Object.fromEntries(
    rotationDimensions.map((d) => [
      d,
      !compared[d]
        ? 0
        : activeSum > 0
          ? requested[d] / activeSum
          : 1 / active.length,
    ]),
  ) as Weights;
  const ordered = finals
    .map((f) => ({ f, loss: weighted(f, weights) }))
    .sort(
      (a, b) => a.loss - b.loss || compare(a.f.partial.key, b.f.partial.key),
    );
  const values = (f: Final): number[] =>
    active.map((d) =>
      d === "climate"
        ? f.climate!.meanLoss
        : d === "water"
          ? f.water!
          : d === "soil_health"
            ? f.soil!
            : f.health,
    );
  const pareto = new Set(
    finals
      .filter((f) => {
        const v = values(f);
        return !finals.some((g) => {
          const u = values(g);
          return u.every((x, i) => x <= v[i]!) && u.some((x, i) => x < v[i]!);
        });
      })
      .map((f) => f.partial.key),
  );
  let ranked: Omit<RotationCandidate, "future">[] = ordered.map(
    ({ f, loss }) => {
      const status: RotationCandidate["status"] = f.reasons.some(
        (r) => r.effect === "condition",
      )
        ? "conditional"
        : "eligible";
      return {
        id: f.partial.key,
        slots: f.slots,
        status,
        startsWithConsidered: f.considered,
        ...(regional ? { cropConditions: "assessment_crops" as const } : {}),
        reasons: (regional
          ? orderedReasons(f.partial.warnings)
          : f.reasons
        ).slice(0, 200),
        scores: {
          climate: f.climate,
          water: f.water,
          soil_health: f.soil,
          crop_health: f.health,
        },
        weightedLoss: loss,
        rank: ordered.findIndex((o) => o.loss === loss) + 1,
        tiedWith: ordered
          .filter((o) => o.loss === loss && o.f !== f)
          .map((o) => o.f.partial.key)
          .slice(0, regional ? 10 : 500),
        pareto: pareto.has(f.partial.key),
        waterBalance: f.balance,
        extremes: f.extremes,
      };
    },
  );
  diagnostics?.("ranking", {
    search,
    ranked,
    shared: [...shared],
    climateAvailable,
    climateCompared,
    waterCompared,
    soilCompared,
    dayVisits: climate.dayVisits,
  });
  const researchEnabled =
    policy.research !== undefined && catalog.profiles.some((p) => p.research);
  const benefitsV2 =
    policy.research === "benefits-2" &&
    catalog.profiles.some((p) => p.research?.benefits.version === "benefits-2");
  const researchProfiles = new Map(catalog.profiles.map((p) => [p.id, p]));
  if (researchEnabled) {
    const terrain =
      analysisContext === null
        ? null
        : rotationAnalysisContextSchema.parse(analysisContext);
    ranked = rankResearchCandidates(
      ranked.map((c) => ({
        ...c,
        resources: rotationResources(
          c.slots,
          researchProfiles,
          terrain,
          benefitsV2,
        ),
      })),
      input,
    );
  }
  const views: RotationAssessment["ranking"]["sensitivity"] = finals.length
    ? [
        {
          view: "farmer_priorities",
          weights,
          topCandidateIds: top(finals, weights).slice(0, 500),
        },
      ]
    : [];
  if (finals.length) {
    for (const d of active)
      views.push({
        view: `only_${d}`,
        weights: single(d),
        topCandidateIds: top(finals, single(d)).slice(0, 500),
      });
    for (const from of active)
      for (const to of active) {
        if (from === to || weights[from] < 0.1 || weights[to] > 0.9) continue;
        const w = {
          ...weights,
          [from]: quantize(weights[from] - 0.1),
          [to]: quantize(weights[to] + 0.1),
        };
        views.push({
          view: `shift_${from}_to_${to}`,
          weights: w,
          topCandidateIds: top(finals, w).slice(0, 500),
        });
      }
  }
  const needs = scenarioVariablesFor(specs).length
    ? scenarioUnits(
        policy.futureClimate,
        scenarioVariablesFor(specs),
        context.location,
        spanYears(input, context.horizonEnd),
      )
    : null;
  let worlds: Parameters<typeof assessFutures>[0]["worlds"] = "not_prepared";
  let nearTerm: Parameters<typeof assessFutures>[0]["nearTerm"];
  let unitIds: string[] = [];
  if (needs && scenarios !== null) {
    const evidence = scenarioWorlds(
      scenarios,
      policy.futureClimate,
      needs.cell,
      allowSynthetic,
    );
    unitIds = evidence.unitIds;
    worlds =
      regional ||
      needs.units.every((u) =>
        evidence.present.has(
          unitKey(u.model.id, u.experiment, u.variable, u.year),
        ),
      )
        ? evidence.worlds
        : "incomplete";
    // The near-term period has its own units: all there, none there (the tile
    // has not been extended yet), or only some.
    const near = nearTermUnits(
      policy.futureClimate,
      scenarioVariablesFor(specs),
      context.location,
      spanYears(input, context.horizonEnd),
    );
    if (near) {
      const have = near.units.filter((u) =>
        evidence.present.has(
          unitKey(u.model.id, u.experiment, u.variable, u.year),
        ),
      ).length;
      nearTerm =
        have === near.units.length || (regional && have > 0)
          ? "available"
          : have === 0
            ? "not_prepared"
            : "incomplete";
    }
    // The what-if's changes sit on top of each model's future; the model's own
    // baseline years stay as they are, so the future comparison shows them.
    if (whatIf && worlds instanceof Map)
      worlds = new Map(
        [...worlds].map(([key, source]) => [
          key,
          key.split("|")[1] === policy.futureClimate.baseline.experiment
            ? source
            : applyWhatIfToSource(source, whatIf),
        ]),
      );
  }
  const futures = assessFutures({
    candidates: finals.map((f) => ({
      id: f.partial.key,
      timed: f.timed,
      water: f.water,
      soil: f.soil,
      health: f.health,
    })),
    weights,
    baseTop: views[0]?.topCandidateIds ?? [],
    policy: policy.futureClimate,
    settings: policy,
    worlds,
    nearTerm,
    unitIds,
    cell: needs?.cell ?? null,
    // Future worlds still run when climate is reported but not ranked; each
    // rotation's change is then compared only with its own baseline.
    climateCompared: climateAvailable,
    perRotation: regional,
    diagnostics: diagnostics
      ? (row) => diagnostics("futureWork", row)
      : undefined,
  });
  const baseTop = JSON.stringify(views[0]?.topCandidateIds ?? []);
  const topStable = views
    .filter((v) => v.view.startsWith("shift_"))
    .every((v) => JSON.stringify(v.topCandidateIds) === baseTop);
  const bestFor = (cropId: string) =>
    ranked.find((c) => c.slots[0]!.cropId === cropId) ?? null;
  const shownIds = new Set(
    ranked.slice(0, policy.outputCandidates).map((c) => c.id),
  );
  for (const id of input.preferences.considered_crop_ids) {
    const best = bestFor(id);
    if (best) shownIds.add(best.id);
  }
  if (regional)
    for (const spec of specs) {
      const best = bestFor(spec.profile.id);
      if (best) shownIds.add(best.id);
    }
  for (const c of ranked)
    if (c.pareto && shownIds.size < 500) shownIds.add(c.id);
  const alternativeIds = strategic
    ? pickAlternativeIds(ranked, baseline.candidateId)
    : [];
  const pinnedIds = new Set([
    ...(regional
      ? specs.flatMap((s) => {
          const c = bestFor(s.profile.id);
          return c ? [c.id] : [];
        })
      : []),
    ...(baseline.candidateId ? [baseline.candidateId] : []),
    ...alternativeIds,
  ]);
  for (const id of pinnedIds) shownIds.add(id);
  let shown: RotationCandidate[] = ranked
    .filter((c) => shownIds.has(c.id))
    .slice(0, 500)
    .map((c) => ({ ...c, future: futures.perCandidate.get(c.id) ?? null }));
  const choices: RotationAssessment["choices"] = [
    ...input.preferences.considered_crop_ids.map((cropId) => {
      const crop = crops.get(cropId)!;
      const best = bestFor(cropId);
      return {
        cropId,
        role: "considered" as const,
        outcome:
          crop.status === "not_in_catalog"
            ? ("not_in_catalog" as const)
            : crop.status !== "schedulable"
              ? ("not_schedulable" as const)
              : best
                ? ("ranked" as const)
                : ("no_feasible_rotation" as const),
        bestCandidateId: best?.id ?? null,
        bestRank: best?.rank ?? null,
      };
    }),
    ...input.preferences.excluded_crop_ids.map((cropId) => ({
      cropId,
      role: "excluded" as const,
      outcome:
        crops.get(cropId)!.status === "not_in_catalog"
          ? ("not_in_catalog" as const)
          : ("excluded_as_requested" as const),
      bestCandidateId: null,
      bestRank: null,
    })),
    ...[
      ...new Set(
        input.history.status === "known"
          ? input.history.entries.map((e) => e.crop_id)
          : [],
      ),
    ]
      .sort(compare)
      .map((cropId) => ({
        cropId,
        role: "history" as const,
        outcome:
          crops.get(cropId)!.status === "not_in_catalog"
            ? ("not_in_catalog" as const)
            : ("recorded" as const),
        bestCandidateId: null,
        bestRank: null,
      })),
  ];
  const usedRules = new Map(
    specs.flatMap((s) => s.usedRules).map((r) => [r.id, r]),
  );
  const tiers = { double_checked: 0, expert_reviewed: 0 };
  const recalled: CatalogRuleV2[] = [];
  for (const rule of usedRules.values()) {
    if (rule.verification.status === "model_recall") recalled.push(rule);
    else if (rule.verification.status !== "extracted")
      tiers[rule.verification.status]++;
  }
  const reasons: RotationReason[] = [...history.predecessorReasons];
  if (input.water.status === "unknown")
    reasons.push(rotationReason("WATER_UNKNOWN", "condition"));
  reasons.push(rotationReason("IRRIGATION_ADEQUACY_UNKNOWN", "condition"));
  if (input.soil.status === "unknown" && !soilEstimate && specs.length)
    reasons.push(rotationReason("SOIL_ESTIMATE_UNAVAILABLE", "info"));
  // Rainfed cereals where guides say grain is very uncertain.
  const annualRain = climate.meanAnnualRainMm();
  if (context.farmingSystem === "rainfed" && annualRain !== null)
    for (const spec of specs)
      for (const rule of spec.aridRainfall)
        if (rule.maxMm !== null && annualRain <= rule.maxMm)
          reasons.push(
            rotationReason("RAINFED_ARID_RISK", "condition", {
              cropId: spec.profile.id,
              rules: [rule],
              facts: { meanAnnualRainMm: annualRain, limitMm: rule.maxMm },
            }),
          );
  if (tiers.double_checked > 0 || tiers.expert_reviewed === 0)
    reasons.push(
      rotationReason("NOT_EXPERT_REVIEWED", "info", {
        facts: { doubleChecked: tiers.double_checked },
      }),
    );
  if (input.crop_health.status === "reported") {
    for (const o of input.crop_health.observations) {
      if ("other_name" in o.issue)
        reasons.push(
          rotationReason("HEALTH_ISSUE_NOT_IN_CATALOG", "condition", {
            cropId: null,
            facts: { name: o.issue.other_name },
          }),
        );
      else if (
        !catalog.issues.some(
          (i) => "issue_id" in o.issue && i.id === o.issue.issue_id,
        )
      )
        reasons.push(
          rotationReason("HEALTH_ISSUE_NOT_IN_CATALOG", "condition", {
            facts: { issueId: o.issue.issue_id },
          }),
        );
      else if (!(
        o.confirmation === "confirmed" && o.source !== "farmer_report"
      ))
        reasons.push(
          rotationReason("HEALTH_REPORT_UNCONFIRMED", "condition", {
            facts: { issueId: o.issue.issue_id },
          }),
        );
    }
  }
  if (
    finals.length &&
    climateAvailable &&
    (!climateEven || leftOutChecks.length)
  )
    reasons.push(
      rotationReason("CLIMATE_CHECKS_DIFFER", "info", {
        facts: {
          comparedChecks: [...shared].sort(compare).join(";"),
          leftOutRules: leftOutChecks.sort(compare).join(",").slice(0, 300),
          uncheckedCrops: specs
            .filter((s) => !s.temperature.length)
            .map((s) => s.profile.id)
            .sort(compare)
            .join(",")
            .slice(0, 300),
        },
      }),
    );
  if (finals.length && specs.some((s) => !s.preferences.length))
    reasons.push(
      rotationReason("SOIL_PREFERENCES_UNEVEN", "info", {
        facts: {
          cropsWithoutPreference: specs
            .filter((s) => !s.preferences.length)
            .map((s) => s.profile.id)
            .sort(compare)
            .join(",")
            .slice(0, 300),
        },
      }),
    );
  if (finals.length && !climateAvailable)
    reasons.push(
      rotationReason("CLIMATE_ANALOGS_INSUFFICIENT", "info", {
        facts: { budgetExhausted: climate.exhausted },
      }),
    );
  if (finals.length && futures.block.status === "unavailable")
    reasons.push(
      rotationReason("FUTURE_CLIMATE_UNAVAILABLE", "info", {
        facts: { reason: futures.block.reason },
      }),
    );
  if (search.pruned)
    reasons.push(
      rotationReason("SEARCH_PRUNED", "info", {
        facts: { pruned: search.pruned },
      }),
    );
  if (search.truncated)
    reasons.push(
      rotationReason("SEARCH_TRUNCATED", "condition", {
        facts: { expansions: search.expansions },
      }),
    );
  const dimensionReason = (d: Dimension): string | null => {
    if (compared[d]) return null;
    if (!finals.length) return "No feasible rotation to compare.";
    if (d === "climate" && climateAvailable)
      return "No kind of temperature check is shared by every schedulable crop; climate losses are shown but not ranked against each other.";
    if (d === "soil_health")
      return "No crop change here can be checked against a sourced preferred predecessor.";
    if (d === "climate")
      return climate.exhausted
        ? "Climate work budget exhausted; not compared."
        : "Some candidates lack evaluable temperature rules or enough complete historical analogs.";
    return waterMissing
      ? "Some crops have no sourced water coefficient or demand class."
      : "Water demand classes use different comparison methods.";
  };
  const dimensions = rotationDimensions.map((d) => ({
    id: d,
    status: compared[d] ? ("compared" as const) : ("not_compared" as const),
    requestedWeight: requested[d],
    appliedWeight: weights[d],
    reason: dimensionReason(d),
  }));
  const rejectionCodes = [...search.rejections.entries()].sort(([a], [b]) =>
    compare(a, b),
  );
  for (const a of assessments)
    if (a.status === "rejected") rejectionCodes.push(["SOIL_LIMIT_FAILED", 1]);
  const merged = new Map<RotationReason["code"], number>();
  for (const [code, count] of rejectionCodes)
    merged.set(code, (merged.get(code) ?? 0) + count);
  const rulesByCrop = new Map<string, RuleCounts>(
    specs.map((s) => {
      const counts: RuleCounts = {
        extracted: 0,
        double_checked: 0,
        expert_reviewed: 0,
        model_recall: 0,
      };
      for (const rule of new Map(s.usedRules.map((r) => [r.id, r])).values())
        counts[rule.verification.status]++;
      return [s.profile.id, counts];
    }),
  );
  const strategies = strategic
    ? buildStrategies({
        input,
        catalog,
        candidates: shown,
        baseline,
        alternativeIds,
        applied: weights,
        dimensions,
        rulesByCrop,
        reasons,
        rainSource: correction ? "power_corrected_to_gpm" : "power_only",
        weatherSnapshots: index ? index.evidence.length : 0,
        futureStatus: futures.block.status,
        horizonEnd: context.horizonEnd,
        comparedCount: ranked.length,
      })
    : null;
  const outputs = policy.outputs
    ? rotationOutputs(
        submitted,
        catalog,
        analysisContext,
        index ? index.evidence.map((e) => e.snapshotId).sort(compare) : [],
        index
          ? [
              ...new Map(
                index.evidence.map((e) => [
                  JSON.stringify({
                    latitude: e.snapshot.request.latitude,
                    longitude: e.snapshot.request.longitude,
                  }),
                  {
                    latitude: e.snapshot.request.latitude,
                    longitude: e.snapshot.request.longitude,
                  },
                ]),
              ).values(),
            ]
          : [],
        rainReference,
        correction !== null,
        futures.block,
        benefitsV2,
      )
    : null;
  if (researchEnabled && strategies) syncResearchStrategies(strategies, shown);
  if (benefitsV2 && strategies)
    syncBenefitStrategies(strategies, researchProfiles);
  if (outputs) {
    const memo = new Map<string, ReturnType<ClimateModel["vulnerability"]>>();
    shown = shown.map((c) => ({
      ...c,
      terrainContext: {
        fieldId: outputs.analysisContext.fieldId,
        rankingApplied: false as const,
        code: "TERRAIN_CONTEXT_UNRANKED" as const,
        missingErosionFactors: outputs.terrain.erosion.missingFactors.filter(
          (f) =>
            f !== "C" ||
            c.slots.some(
              (s) =>
                outputs.terrain.erosion.cropCover.find(
                  (p) => p.cropId === s.cropId,
                )?.status !== "sourced",
            ),
        ),
      },
      vulnerabilitySeasons: c.slots.map((slot, i) => {
        const key = `${c.slots[0]!.sowEarliest.slice(0, 4)}|${slot.cropId}|${slot.sowEarliest}|${slot.sowLatest}`;
        let season = memo.get(key);
        if (!season) {
          season = climate.vulnerability(
            {
              spec: crops.get(slot.cropId)!.spec!,
              sowEarliest: slot.sowEarliest,
              sowLatest: slot.sowLatest,
            },
            1,
            Number(c.slots[0]!.sowEarliest.slice(0, 4)),
          );
          memo.set(key, season);
        }
        return { ...season, slot: i + 1 };
      }),
    }));
    if (strategies)
      for (const strategy of strategies.items)
        strategy.notes = strategy.notes.filter(
          (n) => n.code !== "GAP_EROSION_NOT_ASSESSED",
        );
  }
  if (researchEnabled && outputs)
    outputs.priorities = outputs.priorities.filter(
      (p) => p.id !== "income_weight",
    );
  // The final parse below checks the engine 6 or engine 7 shape.
  const compactReason = (r: RotationReason) =>
    regional && r.ruleIds.length ? { ...r, citations: [] } : r;
  if (regional)
    shown = shown.map((c) => ({
      ...c,
      reasons: c.reasons.map(compactReason),
      ...(c.vulnerabilitySeasons
        ? {
            vulnerabilitySeasons: c.vulnerabilitySeasons.map((season) => ({
              ...season,
              periods: season.periods.map((p) =>
                p.ruleIds.length
                  ? {
                      ...p,
                      citations: [],
                      verificationStatus: p.verification?.status,
                      verification: null,
                    }
                  : p,
              ),
            })),
          }
        : {}),
    }));
  const build = (candidates: RotationCandidate[]) => ({
    kind: "rotation_assessment" as const,
    engineVersion,
    synthetic,
    outcome: ranked.length
      ? "comparisons_available"
      : specs.length
        ? "no_feasible_rotation"
        : "insufficient_evidence",
    catalog: {
      id: catalog.id,
      version: catalog.version,
      sha256: catalogV2ContentHash(catalog),
    },
    policy,
    context,
    input: submitted,
    evidence: {
      ...(regional ? { ruleDetails: "pinned_catalog" as const } : {}),
      weatherSnapshotIds: index
        ? index.evidence.map((e) => e.snapshotId).sort(compare)
        : [],
      rulesUsed: recalled.length
        ? { ...tiers, model_recall: recalled.length }
        : tiers,
      expertReviewed: tiers.expert_reviewed > 0 && tiers.double_checked === 0,
    },
    crops: assessments.map((a) => ({
      cropId: a.cropId,
      status: a.status,
      reasons: orderedReasons(a.reasons).slice(0, 200).map(compactReason),
    })),
    choices,
    dimensions,
    candidates,
    ranking: { weights, sensitivity: views.slice(0, 40), topStable },
    accounting: {
      schedulableCrops: specs.length,
      expansions: search.expansions,
      completed: search.completed.length,
      compared: ranked.length,
      shown: candidates.length,
      pruned: search.pruned,
      truncated: search.truncated,
      rejections: [...merged.entries()]
        .sort(([a], [b]) => compare(a, b))
        .map(([code, count]) => ({ code, count })),
    },
    reasons: orderedReasons(reasons).slice(0, 200),
    limitations: whatIf ? [...LIMITATIONS, WHAT_IF_LIMITATION] : LIMITATIONS,
    futureClimate: futures.block,
    soilEstimate,
    rain: correction
      ? {
          source: "power_corrected_to_gpm" as const,
          reference: rainReference!.dataset,
          firstYear: rainReference!.firstYear,
          lastYear: rainReference!.lastYear,
          powerAnnualMm: correction.powerAnnualMm,
          referenceAnnualMm: correction.referenceAnnualMm,
          monthlyFactors: correction.factors,
        }
      : {
          source: "power_only" as const,
          reference: null,
          firstYear: null,
          lastYear: null,
          powerAnnualMm: null,
          referenceAnnualMm: null,
          monthlyFactors: null,
        },
    ...(strategies ? { strategies } : {}),
    ...(outputs ? { outputs } : {}),
    ...(researchEnabled
      ? {
          catalogResearch: researchCoverage(
            ranked.map((c) => ({ ...c, future: null })),
            researchProfiles,
            input,
            benefitsV2,
            regional,
          ),
        }
      : {}),
    ...(whatIf
      ? {
          whatIf: whatIfBlock(
            whatIf,
            submitted.planning,
            worlds instanceof Map
              ? ("applied" as const)
              : worlds === "incomplete"
                ? ("incomplete" as const)
                : needs
                  ? ("not_prepared" as const)
                  : ("not_needed" as const),
          ),
        }
      : {}),
  });
  let result = build(shown);
  // Size never fails the plan: fewer candidates are shown and the count says so.
  // The strategies' rotations always stay.
  while (
    new TextEncoder().encode(JSON.stringify(result)).byteLength >
      (regional ? 7 * 1024 * 1024 : OUTPUT_BYTES) &&
    shown.length > Math.max(1, pinnedIds.size)
  ) {
    const rest = shown.filter((c) => !pinnedIds.has(c.id));
    const keep = new Set(
      rest.slice(0, Math.max(1, Math.floor(rest.length / 2))).map((c) => c.id),
    );
    shown = pinnedIds.size
      ? shown.filter((c) => pinnedIds.has(c.id) || keep.has(c.id))
      : shown.slice(0, Math.max(1, Math.floor(shown.length / 2)));
    if (pinnedIds.size && shown.length === rest.length + pinnedIds.size) break;
    result = build(shown);
  }
  diagnostics?.("work", {
    dayVisits: climate.dayVisits,
    exhausted: climate.exhausted,
  });
  return rotationAssessmentSchema.parse(result);
}
// Production entry points refuse synthetic catalogs and weather.
export function assessRotations(
  request: unknown,
  catalog: unknown,
  weather: unknown,
  policy: unknown,
  assessedOn: string,
  scenarios: unknown = null,
  soil: unknown = null,
  rain: unknown = null,
  engineVersion:
    "rotation-engine-6" | "rotation-engine-7" = "rotation-engine-6",
  analysisContext: unknown = null,
) {
  return assessRotationsCore(
    request,
    catalog,
    weather,
    policy,
    assessedOn,
    false,
    scenarios,
    soil,
    rain,
    engineVersion,
    analysisContext,
  );
}
export function rotationScenarioNeeds(
  request: unknown,
  catalog: unknown,
  policy: unknown,
  assessedOn: string,
) {
  return rotationScenarioNeedsCore(
    request,
    validateProductionCatalogV2(catalog),
    policy,
    assessedOn,
  );
}
export function rotationNearTermNeeds(
  request: unknown,
  catalog: unknown,
  policy: unknown,
  assessedOn: string,
) {
  return rotationNearTermNeedsCore(
    request,
    validateProductionCatalogV2(catalog),
    policy,
    assessedOn,
  );
}
export function rotationWeatherNeeds(
  request: unknown,
  catalog: unknown,
  policy: unknown,
  assessedOn: string,
) {
  return rotationWeatherNeedsCore(
    request,
    validateProductionCatalogV2(catalog),
    policy,
    assessedOn,
  );
}
export type { CatalogBundleV2, RotationPolicyV2 };
// The weather a plan used, for the crop model: POWER with the same rain
// correction, covering every simulated season.
export function yieldRequestWeather(
  weather: unknown,
  input: PlanRequestV2,
  result: {
    context: { assessedOn: string };
    rain: { monthlyFactors: number[] | null };
  },
  simulations: { sown: string; end: string }[],
) {
  const index = indexWeather(
    weather,
    { latitude: input.location.latitude, longitude: input.location.longitude },
    result.context.assessedOn,
    false,
  );
  const plain = weatherSource(
    index,
    input.location.latitude,
    result.rain.monthlyFactors,
  );
  if (!plain) return null;
  // The crop model sees the same what-if climate as the ranking did.
  const source = whatIfActive(input.what_if)
    ? applyWhatIfToSource(plain, input.what_if)
    : plain;
  const start = simulations.map((s) => s.sown).sort()[0]!;
  const end = simulations
    .map((s) => s.end)
    .sort()
    .at(-1)!;
  // The crop model starts 75 days before sowing to let the soil take up rain.
  return yieldWeather(source, addDays(start, -80), end);
}
// RothC for the rotations with yields: crop-model yields, and the cited national
// legume mean for faba bean, which has no crop model.
export function addSoilCarbon(
  result: RotationAssessmentV5 | RotationAssessmentV6,
  weather: unknown,
  input: PlanRequestV2,
) {
  const soil = result.soilEstimate;
  if (
    !result.yields ||
    soil?.clayPercent == null ||
    soil.organicCarbonGPerKg == null ||
    soil.bulkDensityGPerCm3 == null
  )
    return;
  const index = indexWeather(
    weather,
    { latitude: input.location.latitude, longitude: input.location.longitude },
    result.context.assessedOn,
    false,
  );
  const plain = weatherSource(
    index,
    input.location.latitude,
    result.rain.monthlyFactors,
  );
  if (!plain) return;
  const source = whatIfActive(input.what_if)
    ? applyWhatIfToSource(plain, input.what_if)
    : plain;
  const top = result.candidates.slice(0, result.yields.candidates.length);
  const yields = top.map((c, i) => {
    const map = new Map<string, number>();
    for (const slot of result.yields!.candidates[i]!.slots) {
      if (slot.meanYieldTPerHa !== null)
        map.set(slot.cropId, slot.meanYieldTPerHa);
      else if (slot.cropId === "faba-bean")
        map.set(slot.cropId, legumeYieldFallback);
    }
    return map;
  });
  result.soilCarbon = soilCarbonFor(
    top,
    yields,
    source,
    soil.clayPercent,
    soil.organicCarbonGPerKg,
    soil.bulkDensityGPerCm3,
  );
}
