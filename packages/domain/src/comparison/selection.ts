import {
  historicalAssessmentSchema,
  planningResultSchema,
} from "@rotavise/contracts";
export function selectPlanningComparisons(input: unknown) {
  const assessment = historicalAssessmentSchema.parse(input);
  const pairs = new Map(
    assessment.candidates.map((c) => [c.scheduleId, c.pairId]),
  );
  const comparisons = assessment.ranking.groups.map((group) => {
    const mainScheduleIds = group.entries
      .filter((e) => e.rank === 1)
      .map((e) => e.scheduleId)
      .sort();
    const seen = new Set(mainScheduleIds.map((id) => pairs.get(id)));
    const alternativeScheduleIds: string[] = [];
    for (const entry of [...group.entries].sort(
      (a, b) =>
        a.rank - b.rank ||
        (a.scheduleId < b.scheduleId
          ? -1
          : a.scheduleId > b.scheduleId
            ? 1
            : 0),
    )) {
      const pair = pairs.get(entry.scheduleId);
      if (
        entry.rank > 1 &&
        !seen.has(pair) &&
        alternativeScheduleIds.length < 2
      ) {
        seen.add(pair);
        alternativeScheduleIds.push(entry.scheduleId);
      }
    }
    return {
      groupId: group.id,
      mainScheduleIds,
      alternativeScheduleIds,
      sensitive: group.sensitive,
      topSensitive: group.topSensitive,
    };
  });
  return planningResultSchema.parse({
    kind: "planning_assessment",
    synthetic: assessment.synthetic,
    assessment,
    comparisons,
    selectionVersion: "group-selection-1",
    recommendationScope: "within_comparable_groups_only",
    processing: {
      calendar: "evaluated",
      weather: assessment.evidence.length ? "evaluated" : "not_needed",
      ranking: comparisons.length ? "available" : "insufficient_evidence",
      irrigationAdequacy: "unknown",
      agronomicValidation: "pending",
    },
  });
}
