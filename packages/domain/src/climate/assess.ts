import {
  historicalPolicySchema,
  historicalAssessmentSchema,
  weatherWindowRequestSchema,
  type HistoricalAssessment,
  type HistoricalCandidate,
  type HistoricalReason,
} from "@rotavise/contracts";
import { validateCatalogStructure } from "@rotavise/catalog";
import { evaluateSequenceCore } from "../sequences/generate.js";
import { temperatureRules, conservativeExposureLoss } from "./temperature.js";
import { historicalAnalogs } from "./analogs.js";
import { summarizeAnalogs } from "./statistics.js";
import { climateReason, orderedClimateReasons } from "./reasons.js";
import {
  indexWeather,
  measureWindow,
  HistoricalInputError,
  HistoricalLimitError,
  historicalLimits,
} from "./weather.js";
import { resourceComparisons } from "../comparison/resources.js";
import { rankComparisons } from "../comparison/ranking.js";
import { addDays, elapsedDays } from "../calendar/dates.js";

export function measureHistoricalWindow(input: unknown, evidence: unknown) {
  const parsed = weatherWindowRequestSchema.safeParse(input);
  if (!parsed.success) throw new HistoricalInputError("CLIMATE_WINDOW_INVALID");
  const v = parsed.data;
  if (
    v.startDate < "1981-01-01" ||
    v.endDate > addDays(v.assessedOn, -120) ||
    elapsedDays(v.startDate, v.endDate) < 0 ||
    elapsedDays(v.startDate, v.endDate) > 730
  )
    throw new HistoricalInputError("CLIMATE_WINDOW_INVALID");
  return measureWindow(
    indexWeather(evidence, v.location, v.assessedOn),
    v.startDate,
    v.endDate,
  );
}
// Internal only: tests/tooling may use explicitly labeled synthetic evidence.
export function assessHistoricalCore(
  request: unknown,
  evidenceCatalog: unknown,
  scope: unknown,
  weather: unknown,
  configuration: unknown,
  allowSynthetic = true,
): HistoricalAssessment {
  const policyResult = historicalPolicySchema.safeParse(configuration);
  if (!policyResult.success)
    throw new HistoricalInputError("CLIMATE_POLICY_INVALID");
  const policy = policyResult.data;
  const catalog = validateCatalogStructure(evidenceCatalog);
  const sequence = evaluateSequenceCore(request, catalog, scope);
  const index = indexWeather(
    weather,
    sequence.context.location,
    sequence.context.assessedOn,
    allowSynthetic,
  );
  const candidates: HistoricalCandidate[] = [],
    members: { candidate: HistoricalCandidate; signature: string | null }[] =
      [];
  index.budget.consume(sequence);
  for (const pair of sequence.pairs)
    for (const schedule of pair.schedules) {
      const rules = [schedule.first, schedule.second].map((cycle, i) =>
        temperatureRules(
          catalog.profiles.find((p) => p.id === cycle.cropId)!,
          sequence.context,
          cycle,
          (i + 1) as 1 | 2,
        ),
      );
      const resources = resourceComparisons(sequence, catalog, schedule);
      const blocked =
        schedule.status === "excluded" ||
        schedule.status === "insufficient_evidence";
      const analogs = blocked
        ? []
        : historicalAnalogs(schedule, index, policy, [
            rules[0]!.rules,
            rules[1]!.rules,
          ]);
      const summary = summarizeAnalogs(analogs, policy);
      const reasons: HistoricalReason[] = [
        ...rules.flatMap((r) => r.reasons),
        ...resources.reasons,
        climateReason(
          "HISTORICAL_COMPARISON_ONLY",
          "condition",
          null,
          null,
          [],
          {
            basis:
              "Matching calendar windows; not a forecast, yield/damage probability or climate attribution",
          },
        ),
      ];
      if (blocked)
        reasons.push(
          climateReason(
            "CONSTRAINTS_PREVENT_RANKING",
            "gap",
            null,
            null,
            [],
            { status: schedule.status },
            [`sequence.pairs.${pair.id}`, `sequence.schedules.${schedule.id}`],
          ),
        );
      for (const analog of analogs) {
        if (analog.status !== "complete")
          reasons.push(
            climateReason(
              analog.status === "leap_boundary_unavailable"
                ? "LEAP_BOUNDARY_UNAVAILABLE"
                : "WEATHER_COVERAGE_INCOMPLETE",
              "condition",
              null,
              null,
              [],
              { anchorYear: analog.anchorYear },
            ),
          );
      }
      if (summary.completeAnchorYears.length < policy.minimumCompleteAnalogs)
        reasons.push(
          climateReason(
            "INSUFFICIENT_COMPLETE_ANALOGS",
            "gap",
            null,
            null,
            [],
            {
              completeCount: summary.completeAnchorYears.length,
              minimum: policy.minimumCompleteAnalogs,
            },
          ),
        );
      if (summary.periodComparison.status !== "available")
        reasons.push(
          climateReason("INSUFFICIENT_PERIOD_ANALOGS", "gap", null, null, [], {
            earlierCount: summary.periodComparison.earlierAnchorYears.length,
            laterCount: summary.periodComparison.laterAnchorYears.length,
            minimum: policy.minimumPeriodAnalogs,
          }),
        );
      for (const [i, selection] of rules.entries())
        for (const rule of selection.rules) {
          const complete = analogs.filter((a) => a.status === "complete");
          const exposures = complete.flatMap((a) =>
            a.cycles![i]!.exposures.filter((e) => e.ruleId === rule.id),
          );
          if (exposures.length)
            reasons.push(
              climateReason(
                "TEMPERATURE_EXPOSURE",
                "info",
                [schedule.first, schedule.second][i]!.cropId,
                (i + 1) as 1 | 2,
                [rule],
                {
                  variable: exposures[0]!.variable,
                  lowerDegC: rule.min,
                  upperDegC: rule.max,
                  measuredWindows: exposures.length,
                  completeAnalogCount: complete.length,
                  meanConservativeOutsideFraction:
                    complete.reduce(
                      (n, a) =>
                        n +
                        conservativeExposureLoss(
                          a.cycles![i]!.exposures.filter(
                            (e) => e.ruleId === rule.id,
                          ),
                        )!,
                      0,
                    ) / complete.length,
                },
                [],
                exposures.flatMap((e) => e.snapshotIds),
              ),
            );
        }
      const candidate: HistoricalCandidate = {
        scheduleId: schedule.id,
        pairId: pair.id,
        status: schedule.status,
        analogs,
        ...summary,
        water: resources.water,
        rotation: resources.rotation,
        reasons: orderedClimateReasons(reasons),
      };
      index.budget.consume(candidate);
      candidates.push(candidate);
      members.push({
        candidate,
        signature: rules.every((r) => r.signature !== null)
          ? JSON.stringify(rules.map((r) => r.signature))
          : null,
      });
    }
  const ranking = rankComparisons(
    members,
    sequence.input.preferences.priority,
    policy,
    index.budget,
  );
  const result: HistoricalAssessment = {
    kind: "historical_sequence_comparison",
    engineVersion: "historical-engine-1",
    rankingVersion: "ranking-heuristics-1",
    synthetic: sequence.synthetic || index.evidence.some((e) => e.synthetic),
    complete: true,
    recommendations: null,
    policy,
    sequence,
    evidence: index.evidence.map((e) => ({
      snapshotId: e.snapshotId,
      normalizedSha256: e.normalizedSha256,
      rawSha256: e.snapshot.provenance.rawSha256,
      synthetic: e.synthetic,
      apiVersion: e.snapshot.provenance.apiVersion,
      adapterVersion: e.snapshot.provenance.adapterVersion,
      sources: e.snapshot.provenance.sources,
      retrievedAt: e.snapshot.provenance.retrievedAt,
    })),
    candidates,
    ranking,
    outcome: ranking.groups.length
      ? "comparisons_available"
      : !candidates.length && sequence.outcome !== "sequences_generated"
        ? sequence.outcome
        : "insufficient_comparable_evidence",
    limitations: [
      "Historical UTC grid estimates, not field measurements, forecasts or success probabilities.",
      "Calendar analogs preserve month/day windows; weather does not predict actual phenology or harvest dates.",
      "Rainfall/dry spells describe weather; irrigation adequacy is unknown without a defensible water balance.",
      "Water classes, family transitions and ranking weights are documented heuristics; no measured soil improvement or water savings.",
      "Period differences and population variation are descriptive; no significance, climate attribution or future guarantee.",
      "Rankings apply within comparable groups and shared complete years; no overall recommendation or global winner.",
      "Local agricultural evidence, specialist validation, planning API orchestration and farmer UI remain separate gates.",
    ],
  };
  // Final serialized limit includes punctuation/metadata, beyond incremental guards.
  if (
    new TextEncoder().encode(JSON.stringify(result)).byteLength >
    historicalLimits.outputBytes
  )
    throw new HistoricalLimitError(
      "CLIMATE_OUTPUT_LIMIT",
      historicalLimits.outputBytes,
    );
  return historicalAssessmentSchema.parse(result);
}
