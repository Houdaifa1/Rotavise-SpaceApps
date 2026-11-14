import type {
  CatalogBundle,
  ConstraintReason,
  CropProfile,
  PlanRequest,
  SequenceContext,
  CropCycle,
} from "@rotavise/contracts";
import { conservativeAnniversary } from "../calendar/dates.js";
import { ruleGaps } from "../evidence/profile.js";
import { reason } from "./reasons.js";

export function rotationConstraints(
  profile: CropProfile,
  catalog: CatalogBundle,
  input: PlanRequest,
  context: SequenceContext,
  cycle: CropCycle,
  cycleNumber: 1 | 2,
  first?: CropCycle,
): ConstraintReason[] {
  const output: ConstraintReason[] = [];
  const knowledge = profile.knowledge.rotationRestrictions;
  const entries = input.history.status === "known" ? input.history.entries : [];
  if (input.history.status === "unknown")
    output.push(
      reason("HISTORY_UNKNOWN", "condition", profile.id, cycleNumber, [
        "input.history",
      ]),
    );
  else if (input.history.completeness !== "complete")
    output.push(
      reason("HISTORY_PARTIAL", "condition", profile.id, cycleNumber, [
        "input.history.completeness",
      ]),
    );
  if (knowledge.status === "unknown")
    return [
      ...output,
      reason(
        "ROTATION_KNOWLEDGE_UNAVAILABLE",
        "gap",
        profile.id,
        cycleNumber,
        [],
        [],
        { detail: knowledge.reason },
      ),
    ];
  if (!knowledge.rules.some((r) => r.metric === "minimum_return_interval"))
    output.push(
      reason("RETURN_INTERVAL_UNESTABLISHED", "gap", profile.id, cycleNumber),
    );
  let predecessorId: string | null = first?.cropId ?? null;
  let historicalPredecessorCount = 0;
  if (
    !first &&
    input.history.status === "known" &&
    input.history.completeness === "complete" &&
    entries.length &&
    entries.every((e) => e.harvested_on !== null)
  ) {
    const latestHarvest = entries
      .map((e) => e.harvested_on!)
      .sort()
      .at(-1)!;
    const latestEntries = entries.filter(
      (e) => e.harvested_on === latestHarvest,
    );
    historicalPredecessorCount = latestEntries.length;
    // Unknown sowing dates may admit tied harvests. Never choose one arbitrarily.
    if (latestEntries.length === 1) predecessorId = latestEntries[0]!.crop_id;
  }
  const predecessor = catalog.profiles.find((p) => p.id === predecessorId);
  for (const rule of knowledge.rules) {
    const gaps = ruleGaps(rule, context, profile.id, cycleNumber);
    output.push(...gaps);
    if (gaps.length) continue;
    if (rule.metric === "minimum_return_interval") {
      const origins = entries
        .filter((e) => e.crop_id === rule.cropId)
        .map((e) => ({ date: e.planted_on, path: "input.history.entries" }));
      if (first?.cropId === rule.cropId)
        origins.push({ date: first.sownOn, path: "first.sownOn" });
      if (origins.some((e) => e.date === null))
        output.push(
          reason(
            "HISTORY_DATES_UNKNOWN",
            "condition",
            profile.id,
            cycleNumber,
            ["input.history.entries"],
            [rule],
          ),
        );
      for (const origin of origins)
        if (origin.date !== null) {
          const earliest = conservativeAnniversary(
            origin.date,
            rule.minimumYears,
          );
          const violated = cycle.sownOn < earliest;
          output.push(
            reason(
              violated
                ? "RETURN_INTERVAL_VIOLATION"
                : "RETURN_INTERVAL_SATISFIED",
              violated
                ? rule.severity === "hard"
                  ? "failure"
                  : "condition"
                : "pass",
              profile.id,
              cycleNumber,
              [origin.path],
              [rule],
              {
                previousSowing: origin.date,
                earliestReturn: earliest,
                proposedSowing: cycle.sownOn,
                minimumYears: rule.minimumYears,
                unit: "calendar_year",
              },
            ),
          );
        }
      const coverage = context.historyCoverageStart;
      if (
        input.history.status !== "known" ||
        input.history.completeness !== "complete" ||
        !coverage ||
        conservativeAnniversary(coverage, rule.minimumYears) > cycle.sownOn
      )
        output.push(
          reason(
            "HISTORY_COVERAGE_UNESTABLISHED",
            "condition",
            profile.id,
            cycleNumber,
            ["input.history", "context.historyCoverageStart"],
            [rule],
            { coverageStart: coverage, minimumYears: rule.minimumYears },
          ),
        );
    } else if (
      rule.metric === "prohibited_predecessor_family" ||
      rule.metric === "preferred_predecessor_family"
    ) {
      if (!predecessor) {
        output.push(
          reason(
            "PREVIOUS_CROP_UNRESOLVED",
            "condition",
            profile.id,
            cycleNumber,
            [first ? "first.cropId" : "input.history"],
            [rule],
            { previousCropId: predecessorId, historicalPredecessorCount },
          ),
        );
        continue;
      }
      const matches = predecessor.identity.family === rule.family;
      if (rule.metric === "preferred_predecessor_family") {
        if (!matches)
          output.push(
            reason(
              "PREDECESSOR_PREFERENCE_UNMET",
              "condition",
              profile.id,
              cycleNumber,
              [first ? "first.cropId" : "input.history"],
              [rule],
              {
                previousCropId: predecessor.id,
                actualFamily: predecessor.identity.family,
                preferredFamily: rule.family,
              },
            ),
          );
      } else
        output.push(
          reason(
            matches
              ? "PREDECESSOR_FAMILY_PROHIBITED"
              : "PREDECESSOR_FAMILY_ALLOWED",
            matches
              ? rule.severity === "hard"
                ? "failure"
                : "condition"
              : "pass",
            profile.id,
            cycleNumber,
            [first ? "first.cropId" : "input.history"],
            [rule],
            {
              previousCropId: predecessor.id,
              actualFamily: predecessor.identity.family,
              prohibitedFamily: rule.family,
            },
          ),
        );
    }
  }
  return output;
}
