import type {
  CatalogBundleV2,
  PlanRequestV2,
  RotationContext,
  RotationPolicy,
  RotationReason,
} from "@rotavise/contracts";
import { anniversary, daysBetween, plusDays } from "./days.js";
import { compare } from "../constraints/reasons.js";
import { occurrences, type Occurrence } from "./calendar.js";
import type { CropSpec } from "./evidence.js";
import { rotationReason } from "./reasons.js";

export type SearchSlot = {
  spec: CropSpec;
  occurrence: Occurrence;
  sowEarliest: string;
  gapDays: number;
};
export type Estimate = {
  climateSum: number;
  climateDays: number;
  climateOk: boolean;
  waterSum: number;
  waterOk: boolean;
  // Transitions that cannot be checked: the crop has no sourced preference or
  // its predecessor is unknown. They are left out of the soil score.
  neutral: number;
  matched: number;
  transitions: number;
  health: number;
};
export type PartialRotation = {
  key: string;
  slots: SearchSlot[];
  warnings: RotationReason[];
  estimate: Estimate;
};
export type HistoryFacts = {
  predecessorFamily: string | null;
  predecessorReasons: RotationReason[];
  sowings: Map<string, (string | null)[]>;
  harvests: { cropId: string; harvestedOn: string | null }[];
};
export type SearchResult = {
  completed: PartialRotation[];
  expansions: number;
  pruned: number;
  truncated: boolean;
  rejections: Map<RotationReason["code"], number>;
  firstPlacements: Map<
    string,
    { count: number; rejections: Map<RotationReason["code"], number> }
  >;
};
type Views = Record<
  "climate" | "water" | "soil_health" | "crop_health",
  number
>[];

const classValue = { low: 0, moderate: 0.5, high: 1 } as const;
const meanDuration = (spec: CropSpec) =>
  (spec.duration.min + spec.duration.max) / 2;

export function historyFacts(
  input: PlanRequestV2,
  catalog: CatalogBundleV2,
): HistoryFacts {
  const sowings = new Map<string, (string | null)[]>();
  const harvests: HistoryFacts["harvests"] = [];
  const reasons: RotationReason[] = [];
  if (input.history.status === "unknown") {
    reasons.push(rotationReason("HISTORY_UNKNOWN", "condition"));
    return {
      predecessorFamily: null,
      predecessorReasons: reasons,
      sowings,
      harvests,
    };
  }
  if (input.history.completeness !== "complete")
    reasons.push(rotationReason("HISTORY_PARTIAL", "condition"));
  for (const entry of input.history.entries) {
    sowings.set(entry.crop_id, [
      ...(sowings.get(entry.crop_id) ?? []),
      entry.planted_on,
    ]);
    harvests.push({ cropId: entry.crop_id, harvestedOn: entry.harvested_on });
  }
  const dated = input.history.entries.filter((e) => e.harvested_on !== null);
  const latest = dated
    .map((e) => e.harvested_on!)
    .sort()
    .at(-1);
  const last = latest ? dated.filter((e) => e.harvested_on === latest) : [];
  const family =
    last.length === 1 && dated.length === input.history.entries.length
      ? (catalog.profiles.find((p) => p.id === last[0]!.crop_id)?.identity
          .family ?? null)
      : null;
  // Unknown or tied predecessors are never guessed.
  if (family === null)
    reasons.push(rotationReason("PREVIOUS_CROP_UNRESOLVED", "condition"));
  return {
    predecessorFamily: family,
    predecessorReasons: reasons,
    sowings,
    harvests,
  };
}

type Climate = {
  estimate(spec: CropSpec, sowDate: string): number | null;
  waterEstimate(spec: CropSpec, sowDate: string): number | null;
};
type Ctx = {
  input: PlanRequestV2;
  catalog: CatalogBundleV2;
  context: RotationContext;
  policy: RotationPolicy;
  history: HistoryFacts;
  climate: Climate;
  compareWater?: boolean;
  reject: (code: RotationReason["code"]) => void;
};
const confirmed = (o: { source: string; confirmation: string }) =>
  o.confirmation === "confirmed" && o.source !== "farmer_report";

// The first sowing window at or after `from`; rotations that share a ready
// date share the answer.
const nextWindows = new WeakMap<
  object,
  Map<string, Map<string, Occurrence | undefined>>
>();
function nextOccurrence(
  windows: Parameters<typeof occurrences>[0],
  from: string,
  horizonEnd: string,
) {
  let byHorizon = nextWindows.get(windows);
  if (!byHorizon) {
    byHorizon = new Map();
    nextWindows.set(windows, byHorizon);
  }
  let byDate = byHorizon.get(horizonEnd);
  if (!byDate) {
    // Bounded so a long-running worker does not grow it without limit.
    if (byHorizon.size > 50) byHorizon.clear();
    byDate = new Map();
    byHorizon.set(horizonEnd, byDate);
  }
  if (byDate.has(from)) return byDate.get(from);
  const next = occurrences(windows, from, horizonEnd)[0];
  byDate.set(from, next);
  return next;
}
// Earliest sowing for `spec` in this partial, after hard rules, or null.
function place(
  ctx: Ctx,
  partial: PartialRotation | null,
  spec: CropSpec,
): { slot: SearchSlot; warnings: RotationReason[] }[] {
  const { input, context, policy } = ctx;
  const slots = partial?.slots ?? [];
  const previous = slots.at(-1);
  const gapDays = Math.max(policy.preparationGapDays, spec.preparationGapDays);
  const cropId = spec.profile.id;
  const slotNo = slots.length + 1;
  let candidates: { occurrence: Occurrence; earliest: string }[];
  if (!previous) {
    const { earliest_start_date: first, latest_start_date: last } =
      input.planning;
    candidates = occurrences(spec.windows, first, last)
      .map((occurrence) => ({
        occurrence,
        earliest: occurrence.start > first ? occurrence.start : first,
      }))
      .filter(
        (c) =>
          c.earliest <= (c.occurrence.end < last ? c.occurrence.end : last),
      );
    if (!candidates.length) {
      ctx.reject("FIRST_WINDOW_OUTSIDE_RANGE");
      return [];
    }
  } else {
    const ready = plusDays(
      previous.sowEarliest,
      previous.spec.duration.max + gapDays,
    );
    const next = nextOccurrence(spec.windows, ready, context.horizonEnd);
    if (!next) {
      ctx.reject("NO_WINDOW_BEFORE_HORIZON");
      return [];
    }
    candidates = [
      { occurrence: next, earliest: next.start > ready ? next.start : ready },
    ];
  }
  const placed: { slot: SearchSlot; warnings: RotationReason[] }[] = [];
  for (const candidate of candidates) {
    let earliest = candidate.earliest;
    const end = candidate.occurrence.end;
    const warnings: RotationReason[] = [];
    let rejected = false;
    // Same-crop return interval. Earlier rotation sowings are bounded by their
    // window end, never by an optimistic earlier date.
    const rule = spec.returnInterval;
    if (rule) {
      const previousSowings = [
        ...(ctx.history.sowings.get(cropId) ?? []),
        ...slots
          .filter((s) => s.spec.profile.id === cropId)
          .map((s) => s.occurrence.end),
      ];
      // For a fixed return interval, the latest known sowing gives the most
      // restrictive return date. Keep one unknown-date warning as well. Earlier
      // soft warnings add no constraint and used to multiply per slot.
      const recent =
        "comparison" in policy && policy.comparison
          ? [
              ...(previousSowings.includes(null) ? [null] : []),
              ...previousSowings
                .filter((d): d is string => d !== null)
                .sort()
                .slice(-1),
            ]
          : previousSowings;
      for (const sown of recent) {
        if (sown === null) {
          warnings.push(
            rotationReason("HISTORY_DATES_UNKNOWN", "condition", {
              cropId,
              slot: slotNo,
              rules: [rule],
            }),
          );
          continue;
        }
        const allowed = anniversary(sown, rule.years);
        if (earliest >= allowed) continue;
        if (rule.severity === "hard") {
          if (allowed <= end) earliest = allowed;
          else rejected = true;
        } else
          warnings.push(
            rotationReason("RETURN_INTERVAL_VIOLATION", "condition", {
              cropId,
              slot: slotNo,
              rules: [rule],
              facts: { previousSowing: sown, earliestReturn: allowed },
            }),
          );
      }
      if (rejected) {
        ctx.reject("RETURN_INTERVAL_VIOLATION");
        continue;
      }
    }
    const family = previous
      ? previous.spec.profile.identity.family
      : ctx.history.predecessorFamily;
    for (const p of spec.prohibited)
      if (family === p.family) {
        if (p.severity === "hard") rejected = true;
        else
          warnings.push(
            rotationReason("PREDECESSOR_FAMILY_PROHIBITED", "condition", {
              cropId,
              slot: slotNo,
              rules: [p],
            }),
          );
      }
    if (rejected) {
      ctx.reject("PREDECESSOR_FAMILY_PROHIBITED");
      continue;
    }
    // Health breaks apply when the issue was reported; confirmed reports make
    // hard rules binding, other reports become warnings.
    const observations =
      input.crop_health.status === "reported"
        ? input.crop_health.observations
        : [];
    for (const breakRule of spec.healthBreaks) {
      const reports = observations.filter(
        (o) => "issue_id" in o.issue && o.issue.issue_id === breakRule.issueId,
      );
      if (!reports.length) continue;
      const hosts =
        ctx.catalog.issues.find((i) => i.id === breakRule.issueId)
          ?.hostCropIds ?? [];
      const harvests = [
        ...ctx.history.harvests
          .filter((h) => hosts.includes(h.cropId))
          .map((h) => h.harvestedOn),
        ...slots
          .filter((s) => hosts.includes(s.spec.profile.id))
          .map((s) => plusDays(s.occurrence.end, s.spec.duration.max)),
      ];
      if (harvests.some((h) => h === null))
        warnings.push(
          rotationReason("HISTORY_DATES_UNKNOWN", "condition", {
            cropId,
            slot: slotNo,
            rules: [breakRule],
          }),
        );
      const last = harvests
        .filter((h): h is string => h !== null)
        .sort()
        .at(-1);
      if (!last) continue;
      const allowed = plusDays(last, breakRule.minimumBreakDays);
      if (earliest >= allowed) continue;
      if (breakRule.severity === "hard" && reports.some(confirmed)) {
        if (allowed <= end) earliest = allowed;
        else rejected = true;
      } else
        warnings.push(
          rotationReason("HEALTH_BREAK_VIOLATION", "condition", {
            cropId,
            slot: slotNo,
            rules: [breakRule],
            facts: { lastHostHarvest: last, earliestSafeSowing: allowed },
          }),
        );
    }
    if (rejected) {
      ctx.reject("HEALTH_BREAK_VIOLATION");
      continue;
    }
    if (plusDays(earliest, spec.duration.max) > context.horizonEnd) {
      ctx.reject("NO_WINDOW_BEFORE_HORIZON");
      continue;
    }
    placed.push({
      slot: {
        spec,
        occurrence: candidate.occurrence,
        sowEarliest: earliest,
        gapDays,
      },
      warnings,
    });
  }
  return placed;
}
// Share of checkable transitions whose sourced preference is not met: 0 when
// every one is met, 1 when none is, null when none can be checked. Unchecked
// transitions are left out, so a data gap neither helps nor harms a crop.
export const soilLoss = (e: {
  matched: number;
  neutral: number;
  transitions: number;
}): number | null => {
  const checked = e.transitions - e.neutral;
  return checked > 0 ? 1 - e.matched / checked : null;
};
function extend(
  ctx: Ctx,
  partial: PartialRotation | null,
  placed: { slot: SearchSlot; warnings: RotationReason[] },
): PartialRotation {
  const { slot } = placed;
  const spec = slot.spec;
  const base: Estimate = partial?.estimate ?? {
    climateSum: 0,
    climateDays: 0,
    climateOk: true,
    waterSum: 0,
    waterOk: true,
    neutral: 0,
    matched: 0,
    transitions: 0,
    health: 0,
  };
  const days = meanDuration(spec);
  const climate = ctx.climate.estimate(spec, slot.sowEarliest);
  const balance =
    spec.waterCurve && ctx.compareWater !== false
      ? ctx.climate.waterEstimate(spec, slot.sowEarliest)
      : null;
  const predecessor = partial
    ? partial.slots.at(-1)!.spec.profile.identity.family
    : ctx.history.predecessorFamily;
  const checkable = predecessor !== null && spec.preferences.length > 0;
  const matched =
    checkable && spec.preferences.some((p) => p.family === predecessor);
  const estimate: Estimate = {
    // A crop with no sourced temperature limit is left out, not failed.
    climateSum:
      base.climateSum + (spec.temperature.length ? (climate ?? 0) * days : 0),
    climateDays: base.climateDays + (spec.temperature.length ? days : 0),
    climateOk: base.climateOk && (climate !== null || !spec.temperature.length),
    waterSum:
      base.waterSum +
      (balance !== null
        ? balance * days
        : spec.waterClass
          ? classValue[spec.waterClass.value] * days
          : 0),
    waterOk: base.waterOk && (balance !== null || spec.waterClass !== null),
    matched: base.matched + (matched ? 1 : 0),
    neutral: base.neutral + (checkable ? 0 : 1),
    transitions: base.transitions + 1,
    health:
      base.health +
      placed.warnings.filter((w) => w.code === "HEALTH_BREAK_VIOLATION").length,
  };
  const slots = [...(partial?.slots ?? []), slot];
  return {
    key: slots.map((s) => `${s.spec.profile.id}@${s.sowEarliest}`).join(">"),
    slots,
    warnings: [...(partial?.warnings ?? []), ...placed.warnings],
    estimate,
  };
}
// Partial losses per available dimension, normalized by what is known so far.
// The components do not depend on the weights, so each partial computes them
// once and every view only weighs them.
type ScoreParts = {
  health: number;
  soil: number | null;
  climate: number | null;
  water: number | null;
};
function scoreParts(ctx: Ctx, p: PartialRotation): ScoreParts {
  const e = p.estimate;
  const start = ctx.input.planning.earliest_start_date;
  const last = p.slots.at(-1)!;
  const elapsed = Math.max(
    1,
    daysBetween(start, plusDays(last.sowEarliest, last.spec.duration.max)),
  );
  return {
    health: Math.min(1, e.health / p.slots.length),
    soil: soilLoss(e),
    climate:
      e.climateOk && e.climateDays > 0 ? e.climateSum / e.climateDays : null,
    water: e.waterOk ? Math.min(1, e.waterSum / elapsed) : null,
  };
}
// Same terms, same order and same arithmetic as summing a list of
// [weight, loss] pairs, without building one.
function weigh(c: ScoreParts, weights: Views[number]) {
  let total = weights.crop_health;
  let sum = 0 + weights.crop_health * c.health;
  if (c.soil !== null) {
    total += weights.soil_health;
    sum += weights.soil_health * c.soil;
  }
  if (c.climate !== null) {
    total += weights.climate;
    sum += weights.climate * c.climate;
  }
  if (c.water !== null) {
    total += weights.water;
    sum += weights.water * c.water;
  }
  return total > 0 ? sum / total : 0;
}
// The `width` lowest-scoring items, ties broken by key.
function best(
  items: PartialRotation[],
  scores: Float64Array,
  width: number,
  among?: number[],
) {
  const order = among ?? items.map((_, i) => i);
  order.sort(
    (a, b) => scores[a]! - scores[b]! || compare(items[a]!.key, items[b]!.key),
  );
  return order.slice(0, width);
}
// Keep the best partials under every view plus a quota per first crop, so a
// farmer's considered crop is never crowded out by other crops.
function prune(
  ctx: Ctx,
  items: PartialRotation[],
  views: Views,
  width: number,
) {
  const parts = items.map((p) => scoreParts(ctx, p));
  if (
    "comparison" in ctx.policy &&
    ctx.policy.comparison === "regional-comparison-1"
  ) {
    // Search uses one set of checks/weights. Missing components take the
    // frontier mean, matching final neutral imputation, never a free zero.
    for (const dimension of ["climate", "water", "soil"] as const) {
      const known = parts.flatMap((p) =>
        p[dimension] === null ? [] : [p[dimension]!],
      );
      const mean = known.length
        ? known.reduce((a, b) => a + b, 0) / known.length
        : null;
      for (const p of parts) p[dimension] ??= mean;
    }
  }
  const keep = new Map<string, PartialRotation>();
  for (const view of views) {
    const scores = Float64Array.from(parts, (c) => weigh(c, view));
    for (const i of best(items, scores, width)) {
      const p = items[i]!;
      keep.set(p.key, p);
    }
  }
  const byFirst = new Map<string, number[]>();
  items.forEach((p, i) => {
    const id = p.slots[0]!.spec.profile.id;
    const group = byFirst.get(id);
    if (group) group.push(i);
    else byFirst.set(id, [i]);
  });
  const first = Float64Array.from(parts, (c) => weigh(c, views[0]!));
  for (const group of byFirst.values())
    for (const i of best(items, first, ctx.policy.perFirstCropWidth, group)) {
      const p = items[i]!;
      keep.set(p.key, p);
    }
  const kept = [...keep.values()].sort((a, b) => compare(a.key, b.key));
  return { kept, pruned: items.length - kept.length };
}
export function searchRotations(
  input: PlanRequestV2,
  catalog: CatalogBundleV2,
  context: RotationContext,
  policy: RotationPolicy,
  specs: CropSpec[],
  history: HistoryFacts,
  climate: Climate,
  views: Views,
): SearchResult {
  const rejections = new Map<RotationReason["code"], number>();
  const firstPlacements: SearchResult["firstPlacements"] = new Map();
  let firstCrop: string | null = null;
  const ctx: Ctx = {
    input,
    catalog,
    context,
    policy,
    history,
    climate,
    compareWater:
      !("comparison" in policy && policy.comparison) ||
      views.some((view) => view.water > 0),
    reject: (code) => {
      rejections.set(code, (rejections.get(code) ?? 0) + 1);
      if (firstCrop) {
        const r = firstPlacements.get(firstCrop)!.rejections;
        r.set(code, (r.get(code) ?? 0) + 1);
      }
    },
  };
  let expansions = 0,
    pruned = 0,
    truncated = false;
  const completed: PartialRotation[] = [];
  let frontier: PartialRotation[] = [];
  for (const spec of specs) {
    firstCrop = spec.profile.id;
    const first = {
      count: 0,
      rejections: new Map<RotationReason["code"], number>(),
    };
    firstPlacements.set(firstCrop, first);
    for (const placed of place(ctx, null, spec)) {
      first.count++;
      expansions++;
      frontier.push(extend(ctx, null, placed));
    }
  }
  firstCrop = null;
  ({ kept: frontier, pruned } = prune(ctx, frontier, views, policy.beamWidth));
  for (let depth = 1; frontier.length && !truncated; depth++) {
    if (depth >= policy.maxSlots) {
      completed.push(...frontier);
      break;
    }
    const next: PartialRotation[] = [];
    for (const partial of frontier) {
      if (truncated) {
        completed.push(partial);
        continue;
      }
      let children = 0;
      for (const spec of specs) {
        for (const placed of place(ctx, partial, spec)) {
          next.push(extend(ctx, partial, placed));
          children++;
        }
        expansions++;
        if (expansions >= policy.maxExpansions) truncated = true;
        if (truncated) break;
      }
      // A rotation is complete when no further crop fits before the horizon.
      if (!children) completed.push(partial);
    }
    const result = prune(ctx, next, views, policy.beamWidth);
    pruned += result.pruned;
    frontier = result.kept;
    if (truncated) completed.push(...frontier);
  }
  const finals = prune(ctx, completed, views, policy.beamWidth);
  return {
    completed: finals.kept,
    expansions,
    pruned: pruned + finals.pruned,
    truncated,
    rejections,
    firstPlacements,
  };
}

export type FixedRotation = {
  partial: PartialRotation | null;
  // The first hard rule that stopped the cycle: the rotation as declared
  // cannot continue under it. A cycle that simply reaches the horizon has none.
  stoppedBy: { code: RotationReason["code"]; cropId: string } | null;
};
// The farmer's own rotation: its crops in order, repeated, each placed at its
// earliest sowing under the same hard rules and scored by the same estimate as
// every searched rotation.
export function fixedRotation(
  input: PlanRequestV2,
  catalog: CatalogBundleV2,
  context: RotationContext,
  policy: RotationPolicy,
  specs: CropSpec[],
  history: HistoryFacts,
  climate: Climate,
  cropIds: string[],
  compareWater = true,
): FixedRotation {
  let last: RotationReason["code"] | null = null;
  const ctx: Ctx = {
    input,
    catalog,
    context,
    policy,
    history,
    climate,
    compareWater,
    reject: (code) => {
      last = code;
    },
  };
  let partial: PartialRotation | null = null;
  for (let i = 0; i < policy.maxSlots; i++) {
    const cropId = cropIds[i % cropIds.length]!;
    const spec = specs.find((s) => s.profile.id === cropId);
    if (!spec) return { partial, stoppedBy: null };
    last = null;
    const placed = place(ctx, partial, spec)[0];
    if (!placed) {
      const code: RotationReason["code"] = last ?? "NO_WINDOW_BEFORE_HORIZON";
      const horizon =
        code === "NO_WINDOW_BEFORE_HORIZON" ||
        code === "FIRST_WINDOW_OUTSIDE_RANGE";
      return {
        partial,
        stoppedBy: horizon && partial ? null : { code, cropId },
      };
    }
    partial = extend(ctx, partial, placed);
  }
  return { partial, stoppedBy: null };
}
