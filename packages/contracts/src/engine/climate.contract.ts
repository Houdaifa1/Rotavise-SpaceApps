import { z } from "zod";
import {
  calendarDateSchema,
  weatherSnapshotSchema,
  climateWeatherVariables,
  validCalendarDate,
} from "../weather/weather.contract.js";
import {
  catalogShaSchema,
  citationsSchema,
  citationSchema,
} from "../catalog/source.contract.js";
import { sequenceResultSchema } from "./sequence.contract.js";

const finite = z.number().finite();
const fraction = finite.min(0).max(1);
const count = z.number().int().nonnegative();
const year = z.number().int().min(1981).max(2099);
const ids = z.array(z.string().min(1).max(250)).max(5000);
const snapshotIds = z.array(z.uuid()).max(128);
export const historicalPolicySchema = z
  .strictObject({
    version: z.literal("historical-policy-1"),
    firstAnchorYear: year,
    lastAnchorYear: year,
    splitAfterYear: year,
    minimumCompleteAnalogs: z.number().int().min(2).max(40),
    minimumPeriodAnalogs: z.number().int().min(2).max(20),
  })
  .superRefine((v, ctx) => {
    const years = v.lastAnchorYear - v.firstAnchorYear + 1;
    if (
      years < 4 ||
      years > 40 ||
      v.splitAfterYear < v.firstAnchorYear ||
      v.splitAfterYear >= v.lastAnchorYear ||
      v.minimumCompleteAnalogs > years ||
      v.minimumPeriodAnalogs > v.splitAfterYear - v.firstAnchorYear + 1 ||
      v.minimumPeriodAnalogs > v.lastAnchorYear - v.splitAfterYear
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid historical baseline policy",
      });
  });
export type HistoricalPolicy = z.infer<typeof historicalPolicySchema>;
export const historicalWeatherEvidenceSchema = z
  .array(
    z.strictObject({
      snapshotId: z.uuid(),
      normalizedSha256: catalogShaSchema,
      synthetic: z.boolean(),
      snapshot: weatherSnapshotSchema,
    }),
  )
  .max(128);
export type HistoricalWeatherEvidence = z.infer<
  typeof historicalWeatherEvidenceSchema
>;
export const weatherWindowRequestSchema = z.strictObject({
  location: z.strictObject({
    latitude: finite.min(-90).max(90),
    longitude: finite.min(-180).max(180),
  }),
  assessedOn: calendarDateSchema.refine(
    (d) => d >= "1981-01-01" && d <= "2100-12-31",
  ),
  startDate: calendarDateSchema,
  endDate: calendarDateSchema,
});
const summary = z.strictObject({
  min: finite,
  max: finite,
  mean: finite,
  unit: z.literal("degC"),
});
export const weatherWindowSchema = z
  .strictObject({
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
    expectedDays: count.min(1).max(732),
    coverage: z
      .array(
        z.strictObject({
          variable: z.enum(climateWeatherVariables),
          observedDays: count.max(732),
          missingDates: z.array(calendarDateSchema).max(732),
          snapshotIds,
        }),
      )
      .length(4),
    metrics: z.strictObject({
      temperatureMin: summary.nullable(),
      temperatureMax: summary.nullable(),
      temperatureMean: summary.nullable(),
      precipitation: z
        .strictObject({
          totalMm: finite.nonnegative(),
          meanMmPerDay: finite.nonnegative(),
          dryDays: count.max(732),
          longestDrySpellDays: count.max(732),
        })
        .nullable(),
    }),
  })
  .superRefine((v, ctx) => {
    const issue = () =>
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent window coverage/metrics",
      });
    if (!validCalendarDate(v.startDate) || !validCalendarDate(v.endDate))
      return;
    if (
      (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000 + 1 !==
      v.expectedDays
    )
      issue();
    if (new Set(v.coverage.map((c) => c.variable)).size !== 4) issue();
    for (const variable of climateWeatherVariables) {
      const c = v.coverage.find((c) => c.variable === variable);
      if (
        !c ||
        c.observedDays + c.missingDates.length !== v.expectedDays ||
        new Set(c.missingDates).size !== c.missingDates.length ||
        new Set(c.snapshotIds).size !== c.snapshotIds.length ||
        c.missingDates.some((d) => d < v.startDate || d > v.endDate) ||
        (v.metrics[variable] === null) !== c.missingDates.length > 0
      )
        issue();
    }
  });
export type WeatherWindow = z.infer<typeof weatherWindowSchema>;
export const historicalReasonCodes = [
  "TEMPERATURE_RULE_UNAVAILABLE",
  "TEMPERATURE_RULE_UNSUPPORTED",
  "TEMPERATURE_RULE_UNREVIEWED",
  "TEMPERATURE_RULE_AMBIGUOUS",
  "TEMPERATURE_EXPOSURE",
  "WEATHER_COVERAGE_INCOMPLETE",
  "LEAP_BOUNDARY_UNAVAILABLE",
  "INSUFFICIENT_COMPLETE_ANALOGS",
  "INSUFFICIENT_PERIOD_ANALOGS",
  "WATER_CLASS_UNAVAILABLE",
  "WATER_METHOD_INCOMPATIBLE",
  "WATER_CLASS_COMPARISON",
  "ROTATION_PROXY_UNAVAILABLE",
  "ROTATION_PROXY_COMPARISON",
  "IRRIGATION_ADEQUACY_UNKNOWN",
  "CONSTRAINTS_PREVENT_RANKING",
  "INSUFFICIENT_SHARED_ANALOGS",
  "RANKED_WITH_HEURISTIC_WEIGHTS",
  "HISTORICAL_COMPARISON_ONLY",
  "RANKING_SENSITIVE",
  "SINGLE_COMPARABLE_OPTION",
] as const;
export const historicalReasonSchema = z.strictObject({
  code: z.enum(historicalReasonCodes),
  effect: z.enum(["info", "condition", "gap"]),
  cropId: z.string().nullable(),
  cycle: z.union([z.literal(1), z.literal(2)]).nullable(),
  inputPaths: z.array(z.string().max(250)).max(20),
  ruleIds: ids.max(64),
  citations: z.array(citationSchema).max(128),
  snapshotIds,
  facts: z.record(
    z.string().max(100),
    z.union([finite, z.string().max(16000), z.boolean(), z.null()]),
  ),
});
export type HistoricalReason = z.infer<typeof historicalReasonSchema>;
const exposure = z
  .strictObject({
    ruleId: z.string(),
    stage: z.string(),
    variable: z.enum(["temperatureMin", "temperatureMax", "temperatureMean"]),
    severity: z.enum(["soft", "hard"]),
    horizon: z.enum(["earliest", "latest", "stage"]),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
    expectedDays: count.min(1).max(732),
    observedDays: count.max(732),
    lowerDegC: finite,
    upperDegC: finite,
    belowDays: count.nullable(),
    aboveDays: count.nullable(),
    outsideFraction: fraction.nullable(),
    snapshotIds,
    citations: citationsSchema,
  })
  .superRefine((v, ctx) => {
    const fail = () =>
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent temperature exposure",
      });
    if (
      v.lowerDegC > v.upperDegC ||
      v.observedDays > v.expectedDays ||
      (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000 + 1 !==
        v.expectedDays
    )
      fail();
    const complete = v.observedDays === v.expectedDays;
    if (complete) {
      if (
        v.belowDays === null ||
        v.aboveDays === null ||
        v.outsideFraction === null ||
        v.belowDays + v.aboveDays > v.expectedDays ||
        Math.abs(
          v.outsideFraction - (v.belowDays + v.aboveDays) / v.expectedDays,
        ) > 1e-12
      )
        fail();
    } else if (
      v.belowDays !== null ||
      v.aboveDays !== null ||
      v.outsideFraction !== null
    )
      fail();
  });
export type TemperatureExposure = z.infer<typeof exposure>;
const cycle = z.strictObject({
  cropId: z.string(),
  earliest: weatherWindowSchema,
  latest: weatherWindowSchema,
  exposures: z.array(exposure).max(64),
});
export const historicalAnalogSchema = z.strictObject({
  anchorYear: year,
  status: z.enum(["complete", "incomplete", "leap_boundary_unavailable"]),
  cycles: z.tuple([cycle, cycle]).nullable(),
  climateLoss: fraction.nullable(),
});
export type HistoricalAnalog = z.infer<typeof historicalAnalogSchema>;
const stats = z.strictObject({
  count: count.min(1).max(40),
  min: finite,
  max: finite,
  mean: finite,
  populationStandardDeviation: finite.nonnegative(),
});
export type SampleStatistics = z.infer<typeof stats>;
const metricStats = z.strictObject({
  temperatureMeanDegC: stats.nullable(),
  rainfallMm: stats.nullable(),
  rainfallMmPerDay: stats.nullable(),
  longestDrySpellDays: stats.nullable(),
});
const periodMetric = z.strictObject({
  temperatureMeanDegC: finite.nullable(),
  rainfallMmPerDay: finite.nullable(),
  longestDrySpellDays: finite.nullable(),
});
const components = z.strictObject({
  climate: fraction,
  water: fraction,
  rotation: fraction,
});
export type ComparisonComponents = z.infer<typeof components>;
export const rankingPriorityWeights = Object.freeze({
  lower_water_demand: Object.freeze({
    climate: 0.4,
    water: 0.5,
    rotation: 0.1,
  }),
  soil_health: Object.freeze({ climate: 0.3, water: 0.2, rotation: 0.5 }),
});
const weights = components.superRefine((v, ctx) => {
  if (Math.abs(v.climate + v.water + v.rotation - 1) > 1e-12)
    ctx.addIssue({ code: "custom", message: "Weights must sum to one" });
});
export const historicalAssessmentSchema = z
  .strictObject({
    kind: z.literal("historical_sequence_comparison"),
    engineVersion: z.literal("historical-engine-1"),
    rankingVersion: z.literal("ranking-heuristics-1"),
    synthetic: z.boolean(),
    complete: z.literal(true),
    recommendations: z.null(),
    outcome: z.enum([
      "comparisons_available",
      "insufficient_comparable_evidence",
      "no_feasible_sequence",
      "insufficient_evidence",
    ]),
    policy: historicalPolicySchema,
    sequence: sequenceResultSchema,
    evidence: z
      .array(
        z.strictObject({
          snapshotId: z.uuid(),
          normalizedSha256: catalogShaSchema,
          rawSha256: catalogShaSchema,
          synthetic: z.boolean(),
          apiVersion: z.string(),
          adapterVersion: z.enum(["1", "2", "3"]),
          sources: z.array(z.string()),
          retrievedAt: z.iso.datetime(),
        }),
      )
      .max(128),
    candidates: z
      .array(
        z.strictObject({
          scheduleId: z.string(),
          pairId: z.string(),
          status: z.enum([
            "eligible",
            "conditional",
            "excluded",
            "insufficient_evidence",
          ]),
          completeAnchorYears: z.array(year).max(40),
          analogs: z.array(historicalAnalogSchema).max(40),
          variability: z.tuple([metricStats, metricStats]),
          periodComparison: z.strictObject({
            earlierAnchorYears: z.array(year).max(40),
            laterAnchorYears: z.array(year).max(40),
            status: z.enum(["available", "insufficient_evidence"]),
            laterMinusEarlier: z.tuple([periodMetric, periodMetric]),
          }),
          water: z.strictObject({
            classes: z
              .tuple([
                z.enum(["low", "moderate", "high"]),
                z.enum(["low", "moderate", "high"]),
              ])
              .nullable(),
            comparisonMethod: z.string().nullable(),
            sourceIds: ids.max(100),
            ordinalLoss: fraction.nullable(),
            irrigationAdequacy: z.literal("unknown"),
            reportedAvailability: z.string(),
            ruleIds: ids.max(64),
          }),
          rotation: z.strictObject({
            preferredTransitions: count.max(2).nullable(),
            ordinalLoss: fraction.nullable(),
            claim: z.literal("sourced_family_transition_proxy_only"),
            ruleIds: ids.max(64),
          }),
          reasons: z.array(historicalReasonSchema).max(2000),
        }),
      )
      .max(5000),
    ranking: z.strictObject({
      priority: z.enum(["soil_health", "lower_water_demand"]),
      weights,
      groups: z
        .array(
          z.strictObject({
            id: z.string(),
            climateMethodSignature: z.string().max(4000),
            waterMethod: z.string(),
            waterSourceIds: ids.max(100),
            sharedAnchorYears: z.array(year).max(40),
            entries: z
              .array(
                z.strictObject({
                  scheduleId: z.string(),
                  rank: count.min(1),
                  weightedLoss: fraction,
                  components,
                  contributions: components,
                  tiedWith: ids,
                }),
              )
              .max(5000),
            sensitive: z.boolean(),
            topSensitive: z.boolean(),
            sensitivity: z
              .array(
                z.strictObject({
                  weights,
                  topScheduleIds: ids,
                  ranks: z
                    .array(
                      z.strictObject({
                        scheduleId: z.string(),
                        rank: count.min(1),
                      }),
                    )
                    .max(5000),
                }),
              )
              .max(7),
            reasons: z.array(historicalReasonSchema).max(20),
          }),
        )
        .max(5000),
      unranked: z
        .array(
          z.strictObject({
            scheduleId: z.string(),
            reasonCodes: z.array(z.enum(historicalReasonCodes)).min(1).max(20),
          }),
        )
        .max(5000),
    }),
    limitations: z.array(z.string()).min(1).max(20),
  })
  .superRefine((v, ctx) => {
    const fail = (message: string) => ctx.addIssue({ code: "custom", message });
    const equivalent = (a: unknown, b: unknown) =>
      JSON.stringify(a) === JSON.stringify(b);
    const schedules = v.sequence.pairs.flatMap((p) =>
      p.schedules.map((s) => ({ pair: p, schedule: s })),
    );
    const candidates = new Map(v.candidates.map((c) => [c.scheduleId, c]));
    const weatherIds = new Set(v.evidence.map((e) => e.snapshotId));
    if (
      weatherIds.size !== v.evidence.length ||
      candidates.size !== v.candidates.length ||
      candidates.size !== schedules.length
    )
      fail("Duplicate or missing assessment identities");
    if (
      v.synthetic !==
      (v.sequence.synthetic || v.evidence.some((e) => e.synthetic))
    )
      fail("Synthetic assessment marker mismatch");
    const expectedYears = Array.from(
      { length: v.policy.lastAnchorYear - v.policy.firstAnchorYear + 1 },
      (_, i) => v.policy.firstAnchorYear + i,
    );
    for (const { pair, schedule } of schedules) {
      const c = candidates.get(schedule.id);
      if (!c || c.pairId !== pair.id || c.status !== schedule.status) {
        fail("Schedule assessment mismatch");
        continue;
      }
      const blocked =
        c.status === "excluded" || c.status === "insufficient_evidence";
      if (
        !equivalent(
          c.analogs.map((a) => a.anchorYear),
          blocked ? [] : expectedYears,
        )
      )
        fail("Incomplete analog enumeration");
      if (
        !equivalent(
          c.completeAnchorYears,
          c.analogs
            .filter((a) => a.status === "complete")
            .map((a) => a.anchorYear),
        )
      )
        fail("False complete analog count");
      for (const a of c.analogs) {
        if (a.status === "leap_boundary_unavailable") {
          if (a.cycles !== null || a.climateLoss !== null)
            fail("Invalid leap analog");
          continue;
        }
        if (a.cycles === null) {
          fail("Missing measured analog");
          continue;
        }
        const complete = a.cycles.every(
          (c) =>
            [c.earliest, c.latest].every((w) =>
              w.coverage.every((x) => x.missingDates.length === 0),
            ) && c.exposures.every((e) => e.outsideFraction !== null),
        );
        if (
          (a.status === "complete") !== complete ||
          (!complete && a.climateLoss !== null)
        )
          fail("False complete sequence");
        const cycleLosses = a.cycles.map((c) => {
          if (
            !c.exposures.length ||
            c.exposures.some((e) => e.outsideFraction === null)
          )
            return null;
          const byRule = new Map<string, number>();
          for (const e of c.exposures)
            byRule.set(
              e.ruleId,
              Math.max(byRule.get(e.ruleId) ?? 0, e.outsideFraction!),
            );
          return [...byRule.values()].reduce((n, l) => n + l, 0) / byRule.size;
        });
        const expectedLoss =
          complete && cycleLosses.every((l) => l !== null)
            ? (cycleLosses[0]! + cycleLosses[1]!) / 2
            : null;
        if (
          (a.climateLoss === null) !== (expectedLoss === null) ||
          (a.climateLoss !== null &&
            expectedLoss !== null &&
            Math.abs(a.climateLoss - expectedLoss) > 1e-12)
        )
          fail("False historical exposure loss");
        for (const [i, cycle] of a.cycles.entries()) {
          const original = [schedule.first, schedule.second][i]!;
          const shift = (date: string) =>
            `${Number(date.slice(0, 4)) + a.anchorYear - Number(schedule.first.sownOn.slice(0, 4))}${date.slice(4)}`;
          if (
            cycle.cropId !== original.cropId ||
            cycle.earliest.startDate !== shift(original.sownOn) ||
            cycle.latest.startDate !== shift(original.sownOn) ||
            cycle.earliest.endDate !== shift(original.harvestEarliest) ||
            cycle.latest.endDate !== shift(original.harvestLatest)
          )
            fail("Historical calendar pattern mismatch");
          const refs = [
            ...cycle.earliest.coverage.flatMap((c) => c.snapshotIds),
            ...cycle.latest.coverage.flatMap((c) => c.snapshotIds),
            ...cycle.exposures.flatMap((e) => e.snapshotIds),
          ];
          if (refs.some((id) => !weatherIds.has(id)))
            fail("Unknown weather evidence reference");
        }
      }
      if (
        c.reasons.some((r) => r.snapshotIds.some((id) => !weatherIds.has(id)))
      )
        fail("Unknown explanation evidence reference");
    }
    const ranked = new Set<string>();
    for (const g of v.ranking.groups) {
      if (
        g.sharedAnchorYears.length < v.policy.minimumCompleteAnalogs ||
        g.sharedAnchorYears.filter((y) => y <= v.policy.splitAfterYear).length <
          v.policy.minimumPeriodAnalogs ||
        g.sharedAnchorYears.filter((y) => y > v.policy.splitAfterYear).length <
          v.policy.minimumPeriodAnalogs ||
        new Set(g.sharedAnchorYears).size !== g.sharedAnchorYears.length
      )
        fail("Insufficient shared comparison evidence");
      for (const [i, e] of g.entries.entries()) {
        const c = candidates.get(e.scheduleId);
        if (
          !c ||
          ranked.has(e.scheduleId) ||
          c.status === "excluded" ||
          c.status === "insufficient_evidence" ||
          c.reasons.some((r) => r.effect === "gap")
        ) {
          fail("Invalid or duplicate ranked candidate");
          continue;
        }
        ranked.add(e.scheduleId);
        const years = g.sharedAnchorYears.map((y) =>
          c.analogs.find((a) => a.anchorYear === y),
        );
        if (
          years.some(
            (a) => !a || a.status !== "complete" || a.climateLoss === null,
          )
        )
          fail("Unequal comparison years");
        else if (
          Math.abs(
            e.components.climate -
              years.reduce((n, a) => n + a!.climateLoss!, 0) / years.length,
          ) > 1e-12
        )
          fail("False climate ranking component");
        if (
          e.components.water !== c.water.ordinalLoss ||
          e.components.rotation !== c.rotation.ordinalLoss ||
          g.waterMethod !== c.water.comparisonMethod ||
          !equivalent(g.waterSourceIds, c.water.sourceIds)
        )
          fail("Incompatible resource comparison");
        for (const key of ["climate", "water", "rotation"] as const)
          if (
            Math.abs(
              e.contributions[key] - e.components[key] * v.ranking.weights[key],
            ) > 1e-12
          )
            fail("False ranking contribution");
        const loss =
          e.contributions.climate +
          e.contributions.water +
          e.contributions.rotation;
        if (
          Math.abs(e.weightedLoss - loss) > 1e-12 ||
          e.rank !==
            g.entries.findIndex((x) => x.weightedLoss === e.weightedLoss) + 1 ||
          !equivalent(
            e.tiedWith,
            g.entries
              .filter(
                (x) =>
                  x.weightedLoss === e.weightedLoss &&
                  x.scheduleId !== e.scheduleId,
              )
              .map((x) => x.scheduleId),
          )
        )
          fail("False score/rank/tie");
        const previous = g.entries[i - 1];
        if (
          previous &&
          (previous.weightedLoss > e.weightedLoss ||
            (previous.weightedLoss === e.weightedLoss &&
              previous.scheduleId > e.scheduleId))
        )
          fail("Unstable ranking order");
      }
      if (!g.entries.length || !g.sensitivity.length)
        fail("Empty comparison group");
      for (const s of g.sensitivity) {
        const scored = g.entries
          .map((e) => ({
            scheduleId: e.scheduleId,
            loss: Number(
              (
                e.components.climate * s.weights.climate +
                e.components.water * s.weights.water +
                e.components.rotation * s.weights.rotation
              ).toFixed(12),
            ),
          }))
          .sort(
            (a, b) =>
              a.loss - b.loss ||
              (a.scheduleId < b.scheduleId
                ? -1
                : a.scheduleId > b.scheduleId
                  ? 1
                  : 0),
          );
        const best = scored[0]?.loss;
        const ids = scored
          .filter((e) => e.loss === best)
          .map((e) => e.scheduleId)
          .sort();
        if (!equivalent(s.topScheduleIds, ids))
          fail("False sensitivity result");
        const ranks = scored.map((e) => ({
          scheduleId: e.scheduleId,
          rank: scored.findIndex((x) => x.loss === e.loss) + 1,
        }));
        if (!equivalent(s.ranks, ranks)) fail("False sensitivity order/ties");
      }
      if (
        g.sensitive !==
          g.sensitivity.some(
            (s) => !equivalent(s.ranks, g.sensitivity[0]!.ranks),
          ) ||
        g.topSensitive !==
          g.sensitivity.some(
            (s) =>
              !equivalent(s.topScheduleIds, g.sensitivity[0]!.topScheduleIds),
          )
      )
        fail("False sensitivity flag");
    }
    const unranked = v.ranking.unranked.map((c) => c.scheduleId);
    if (
      new Set(unranked).size !== unranked.length ||
      unranked.some((id) => ranked.has(id) || !candidates.has(id)) ||
      ranked.size + unranked.length !== candidates.size
    )
      fail("Missing ranking disposition");
    const outcome = v.ranking.groups.length
      ? "comparisons_available"
      : !v.candidates.length && v.sequence.outcome !== "sequences_generated"
        ? v.sequence.outcome
        : "insufficient_comparable_evidence";
    if (
      v.outcome !== outcome ||
      v.ranking.priority !== v.sequence.input.preferences.priority
    )
      fail("Assessment outcome/priority mismatch");
    if (
      !equivalent(v.ranking.weights, rankingPriorityWeights[v.ranking.priority])
    )
      fail("Ranking policy weight mismatch");
  });
export type HistoricalAssessment = z.infer<typeof historicalAssessmentSchema>;
export type HistoricalCandidate = HistoricalAssessment["candidates"][number];
