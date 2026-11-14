import {
  planRequestSchema,
  sequenceContextSchema,
  type PlanRequest,
  type SequenceContext,
} from "@rotavise/contracts";
import { compare } from "../constraints/reasons.js";
import { elapsedDays } from "../calendar/dates.js";

export class EngineInputError extends Error {
  constructor(
    public readonly code:
      | "ENGINE_INPUT_INVALID"
      | "ENGINE_CONTEXT_INVALID"
      | "CONTEXT_LOCATION_MISMATCH"
      | "CONTEXT_OBSERVATION_INVALID"
      | "CONTEXT_HISTORY_INVALID",
  ) {
    super(code);
  }
}
export class EngineLimitError extends Error {
  constructor(
    public readonly code:
      "ENGINE_WORK_LIMIT" | "ENGINE_SCHEDULE_LIMIT" | "ENGINE_OUTPUT_LIMIT",
    public readonly limit: number,
  ) {
    super(code);
  }
}
const identity = (v: unknown) => JSON.stringify(v);
export function prepareSequenceInput(
  request: unknown,
  scope: unknown,
): { input: PlanRequest; context: SequenceContext } {
  const parsed = planRequestSchema.safeParse(request);
  if (!parsed.success) throw new EngineInputError("ENGINE_INPUT_INVALID");
  const contextual = sequenceContextSchema.safeParse(scope);
  if (!contextual.success) throw new EngineInputError("ENGINE_CONTEXT_INVALID");
  const input = parsed.data,
    context = contextual.data;
  if (
    input.location.latitude !== context.location.latitude ||
    input.location.longitude !== context.location.longitude
  )
    throw new EngineInputError("CONTEXT_LOCATION_MISMATCH");
  if (input.planning.earliest_start_date < context.assessedOn)
    throw new EngineInputError("ENGINE_CONTEXT_INVALID");
  if (elapsedDays(context.assessedOn, input.planning.latest_start_date) > 366)
    throw new EngineInputError("ENGINE_CONTEXT_INVALID");
  input.preferences.considered_next_crop_ids.sort(compare);
  input.preferences.excluded_crop_ids.sort(compare);
  if (input.history.status === "known")
    input.history.entries.sort((a, b) => compare(identity(a), identity(b)));
  if (input.soil.status === "known")
    input.soil.observations.sort((a, b) => compare(a.metric, b.metric));
  if (input.crop_health.status === "reported")
    input.crop_health.observations.sort((a, b) =>
      compare(identity(a), identity(b)),
    );
  context.cultivars.sort((a, b) => compare(a.cropId, b.cropId));
  context.verifiedHealthObservations.sort((a, b) =>
    compare(identity(a), identity(b)),
  );
  if (
    input.crop_health.status === "reported" &&
    input.crop_health.observations.some(
      (o) => o.observed_on > context.assessedOn,
    )
  )
    throw new EngineInputError("CONTEXT_OBSERVATION_INVALID");
  if (
    input.soil.status === "known" &&
    input.soil.observations.some(
      (o) => o.measured_on !== null && o.measured_on > context.assessedOn,
    )
  )
    throw new EngineInputError("CONTEXT_OBSERVATION_INVALID");
  if (
    input.history.status === "known" &&
    input.history.entries.some(
      (o) =>
        (o.planted_on !== null && o.planted_on > context.assessedOn) ||
        (o.harvested_on !== null && o.harvested_on > context.assessedOn),
    )
  )
    throw new EngineInputError("CONTEXT_HISTORY_INVALID");
  if (
    context.historyCoverageStart !== null &&
    (context.historyCoverageStart > context.assessedOn ||
      input.history.status !== "known" ||
      input.history.completeness !== "complete" ||
      input.history.entries.some(
        (e) =>
          e.planted_on !== null && e.planted_on < context.historyCoverageStart!,
      ))
  )
    throw new EngineInputError("CONTEXT_HISTORY_INVALID");
  for (const verified of context.verifiedHealthObservations) {
    const found =
      input.crop_health.status === "reported" &&
      input.crop_health.observations.some(
        (o) =>
          o.crop_id === verified.cropId &&
          o.kind === verified.kind &&
          o.name === verified.name &&
          o.observed_on === verified.observedOn &&
          o.confirmation === "confirmed" &&
          o.source !== "farmer_report",
      );
    if (!found) throw new EngineInputError("CONTEXT_OBSERVATION_INVALID");
  }
  return { input, context };
}
