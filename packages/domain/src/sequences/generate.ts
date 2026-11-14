import {
  sequenceResultSchema,
  type CatalogBundle,
  type ConstraintReason,
  type CropCycle,
  type SequencePair,
  type SequenceResult,
} from "@rotavise/contracts";
import {
  validateCatalogStructure,
  catalogContentHash,
} from "@rotavise/catalog";
import { calendarDays, addDays } from "../calendar/dates.js";
import { matchingWindows } from "../calendar/windows.js";
import { profileCalendar, type CycleSpec } from "../evidence/profile.js";
import { staticConstraints } from "../evidence/inventory.js";
import {
  reason,
  orderReasons,
  statusOf,
  bestStatus,
  compare,
} from "../constraints/reasons.js";
import { rotationConstraints } from "../constraints/rotation.js";
import { healthConstraints } from "../constraints/health.js";
import { prepareSequenceInput, EngineLimitError } from "./input.js";

export const sequenceLimits = Object.freeze({
  combinations: 250000,
  schedules: 5000,
  outputBytes: 2097152,
});
function cropCycle(spec: CycleSpec, sownOn: string): CropCycle {
  return {
    cropId: spec.profile.id,
    sownOn,
    harvestEarliest: addDays(sownOn, spec.min),
    harvestLatest: addDays(sownOn, spec.max),
    durationDays: { min: spec.min, max: spec.max },
    plantingRuleIds: matchingWindows(sownOn, spec.windows).map((r) => r.id),
    durationRuleIds: spec.durations.map((r) => r.id),
  };
}
// Internal core also handles labeled synthetic fixtures. Public production entry validates flags first.
export function evaluateSequenceCore(
  request: unknown,
  evidence: unknown,
  scope: unknown,
): SequenceResult {
  const { input, context } = prepareSequenceInput(request, scope);
  const catalog: CatalogBundle = validateCatalogStructure(evidence);
  const synthetic =
    catalog.synthetic ||
    catalog.profiles.some((p) => p.synthetic) ||
    catalog.sources.some((s) => s.synthetic);
  const considered = new Set(input.preferences.considered_next_crop_ids);
  const firstIds = [
    ...new Set(catalog.profiles.map((p) => p.id).concat([...considered])),
  ].sort(compare);
  const secondIds = catalog.profiles.map((p) => p.id).sort(compare);
  const firstDays = calendarDays(
    input.planning.earliest_start_date,
    input.planning.latest_start_date,
  );
  const allDays = calendarDays(
    input.planning.earliest_start_date,
    input.planning.search_end_date,
  );
  const prepared = new Map<string, ReturnType<typeof profileCalendar>>();
  const starts = new Map<string, string[]>();
  for (const id of firstIds) {
    const p = profileCalendar(catalog, id, context, 1);
    prepared.set(id, p);
    starts.set(
      id,
      p.spec
        ? allDays.filter((d) => matchingWindows(d, p.spec!.windows).length > 0)
        : [],
    );
  }
  const pairs: SequencePair[] = [];
  let combinations = 0,
    scheduleCount = 0;
  let plannedSchedules = 0,
    outputBytes = 0;
  const consume = (value: unknown) => {
    outputBytes +=
      new TextEncoder().encode(JSON.stringify(value)).byteLength + 1;
    if (outputBytes > sequenceLimits.outputBytes)
      throw new EngineLimitError(
        "ENGINE_OUTPUT_LIMIT",
        sequenceLimits.outputBytes,
      );
  };
  consume({
    input,
    context,
    catalog: { id: catalog.id, version: catalog.version },
  });
  const deferred = [
    reason("WEATHER_NOT_EVALUATED", "deferred"),
    reason("IRRIGATION_ADEQUACY_UNKNOWN", "deferred", null, null, [
      "input.water",
    ]),
    reason("RANKING_NOT_IMPLEMENTED", "deferred", null, null, [
      "input.preferences.priority",
    ]),
    reason(
      input.water.status === "unknown"
        ? "WATER_UNKNOWN"
        : "WATER_REPORTED_NOT_QUANTIFIED",
      "condition",
      null,
      null,
      ["input.water"],
      [],
      {
        availability:
          input.water.status === "reported" ? input.water.availability : null,
      },
    ),
  ];
  for (const firstId of firstIds)
    for (const secondId of secondIds) {
      const id = `${firstId}>${secondId}`;
      const first = prepared.get(firstId)!;
      const second = profileCalendar(catalog, secondId, context, 2);
      const reasons: ConstraintReason[] = [
        ...deferred,
        ...first.gaps,
        ...second.gaps,
      ];
      for (const [cropId, cycle] of [
        [firstId, 1],
        [secondId, 2],
      ] as const) {
        if (input.preferences.excluded_crop_ids.includes(cropId))
          reasons.push(
            reason("FARMER_EXCLUDED", "failure", cropId, cycle, [
              "input.preferences.excluded_crop_ids",
            ]),
          );
        const profile = catalog.profiles.find((p) => p.id === cropId);
        if (profile)
          reasons.push(...staticConstraints(profile, input, context, cycle));
      }
      const pair: SequencePair = {
        id,
        firstCropId: firstId,
        secondCropId: secondId,
        startsWithFarmerChoice: considered.has(firstId),
        status: statusOf(reasons),
        reasons: [],
        schedules: [],
        calendarRejections: {
          firstOutsideWindow: 0,
          firstBeyondHorizon: 0,
          secondOverlap: 0,
          secondBeyondHorizon: 0,
        },
      };
      if (
        first.spec &&
        second.spec &&
        !reasons.some((r) => r.effect === "failure")
      ) {
        const firstStarts = starts
          .get(firstId)!
          .filter((d) => d <= input.planning.latest_start_date);
        const secondStarts = starts.get(secondId)!;
        pair.calendarRejections.firstOutsideWindow =
          firstDays.length - firstStarts.length;
        // Bound exhaustive work before walking a potentially huge Cartesian product.
        if (
          combinations + firstStarts.length * secondStarts.length >
          sequenceLimits.combinations
        )
          throw new EngineLimitError(
            "ENGINE_WORK_LIMIT",
            sequenceLimits.combinations,
          );
        if (!firstStarts.length)
          reasons.push(
            reason(
              "CALENDAR_OUTSIDE_FIRST_RANGE",
              "failure",
              firstId,
              1,
              ["input.planning"],
              first.spec.windows,
            ),
          );
        const lastSecondSowing = addDays(
          input.planning.search_end_date,
          -second.spec.max,
        );
        const eligibleSecond = secondStarts.filter(
          (d) => d <= lastSecondSowing,
        );
        for (const date of firstStarts) {
          const lastHarvest = addDays(date, first.spec.max);
          plannedSchedules += eligibleSecond.filter(
            (d) => d > lastHarvest,
          ).length;
          if (plannedSchedules > sequenceLimits.schedules)
            throw new EngineLimitError(
              "ENGINE_SCHEDULE_LIMIT",
              sequenceLimits.schedules,
            );
        }
        for (const firstStart of firstStarts) {
          const firstCycle = cropCycle(first.spec, firstStart);
          if (firstCycle.harvestLatest >= input.planning.search_end_date) {
            pair.calendarRejections.firstBeyondHorizon++;
            continue;
          }
          for (const secondStart of secondStarts) {
            combinations++;
            if (secondStart <= firstCycle.harvestLatest) {
              pair.calendarRejections.secondOverlap++;
              continue;
            }
            const secondCycle = cropCycle(second.spec, secondStart);
            if (secondCycle.harvestLatest > input.planning.search_end_date) {
              pair.calendarRejections.secondBeyondHorizon++;
              continue;
            }
            if (++scheduleCount > sequenceLimits.schedules)
              throw new EngineLimitError(
                "ENGINE_SCHEDULE_LIMIT",
                sequenceLimits.schedules,
              );
            const dynamic: ConstraintReason[] = [
              reason(
                "NON_OVERLAPPING_CYCLES",
                "pass",
                secondId,
                2,
                ["first.harvestLatest", "second.sownOn"],
                [],
                {
                  firstLatestHarvest: firstCycle.harvestLatest,
                  secondSowing: secondStart,
                },
              ),
              reason(
                "DURATION_ENVELOPE",
                "pass",
                firstId,
                1,
                [],
                first.spec.durations,
                {
                  minDays: first.spec.min,
                  maxDays: first.spec.max,
                  harvestEarliest: firstCycle.harvestEarliest,
                  harvestLatest: firstCycle.harvestLatest,
                },
              ),
              reason(
                "DURATION_ENVELOPE",
                "pass",
                secondId,
                2,
                [],
                second.spec.durations,
                {
                  minDays: second.spec.min,
                  maxDays: second.spec.max,
                  harvestEarliest: secondCycle.harvestEarliest,
                  harvestLatest: secondCycle.harvestLatest,
                },
              ),
              ...rotationConstraints(
                first.spec.profile,
                catalog,
                input,
                context,
                firstCycle,
                1,
              ),
              ...rotationConstraints(
                second.spec.profile,
                catalog,
                input,
                context,
                secondCycle,
                2,
                firstCycle,
              ),
              ...healthConstraints(
                first.spec.profile,
                input,
                context,
                firstCycle,
                1,
              ),
              ...healthConstraints(
                second.spec.profile,
                input,
                context,
                secondCycle,
                2,
                firstCycle,
              ),
            ];
            const schedule = {
              id: `${id}@${firstStart}/${secondStart}`,
              first: firstCycle,
              second: secondCycle,
              status: statusOf([...reasons, ...dynamic]),
              reasons: orderReasons(dynamic),
            };
            consume(schedule);
            pair.schedules.push(schedule);
          }
        }
        if (!pair.schedules.length && firstStarts.length)
          reasons.push(
            reason(
              "SECOND_CALENDAR_UNAVAILABLE",
              "failure",
              secondId,
              2,
              ["input.planning"],
              second.spec.windows,
              {
                firstBeyondHorizon: pair.calendarRejections.firstBeyondHorizon,
                secondOverlap: pair.calendarRejections.secondOverlap,
                secondBeyondHorizon:
                  pair.calendarRejections.secondBeyondHorizon,
                searchEnd: input.planning.search_end_date,
              },
            ),
          );
      }
      pair.reasons = orderReasons(reasons);
      pair.status = pair.schedules.length
        ? bestStatus(pair.schedules.map((s) => s.status))
        : statusOf(pair.reasons);
      consume({ ...pair, schedules: [] });
      pairs.push(pair);
    }
  const result: SequenceResult = {
    kind: "calendar_constraint_assessment",
    scope: "calendars_and_constraints_only",
    engineVersion: "sequence-engine-2",
    policyVersion: "sequence-policy-2",
    synthetic,
    complete: true,
    recommendations: null,
    outcome: pairs.some((p) =>
      p.schedules.some(
        (s) => s.status === "eligible" || s.status === "conditional",
      ),
    )
      ? "sequences_generated"
      : pairs.some((p) => p.status === "insufficient_evidence")
        ? "insufficient_evidence"
        : "no_feasible_sequence",
    context,
    catalog: {
      id: catalog.id,
      version: catalog.version,
      sha256: catalogContentHash(catalog),
    },
    input,
    deferredChecks: [
      "weather",
      "water_balance",
      "ranking",
      "agronomic_validation",
    ],
    pairs,
    consideredChoices: [...considered].map((cropId) => {
      const matches = pairs.filter((p) => p.firstCropId === cropId);
      return {
        cropId,
        status: bestStatus(matches.map((p) => p.status)),
        pairIds: matches.map((p) => p.id),
      };
    }),
    counts: {
      pairs: pairs.length,
      schedules: scheduleCount,
      combinationsExamined: combinations,
    },
  };
  if (
    new TextEncoder().encode(JSON.stringify(result)).byteLength >
    sequenceLimits.outputBytes
  )
    throw new EngineLimitError(
      "ENGINE_OUTPUT_LIMIT",
      sequenceLimits.outputBytes,
    );
  return sequenceResultSchema.parse(result);
}
