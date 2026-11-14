import { createHash } from "node:crypto";
import {
  normalizePlanRequestV2,
  planRequestSchema,
  planRequestV2Schema,
  type PlanRequest,
  type PlanRequestV2,
} from "@rotavise/contracts";
import { stableJson } from "../../../common/serialization/stable-json.js";
export const SESSION_SECONDS = 7 * 86400;
export const REQUEST_SECONDS = 86400;
export const MAX_PLAN_BODY_BYTES = 32768;
function compare(a: string, b: string) {
  return a < b ? -1 : a > b ? 1 : 0;
}
export function tokenHash(token: string) {
  return createHash("sha256")
    .update("rotavise-owner-v1:" + token)
    .digest("hex");
}
// Format 2 requests share the engine's canonical order, so the stored input
// and the assessed input are byte-identical.
export function requestIdentityV2(raw: unknown) {
  const input = normalizePlanRequestV2(planRequestV2Schema.parse(raw));
  const canonical = stableJson(input);
  return {
    input,
    hash: createHash("sha256").update(canonical).digest("hex"),
    canonical,
  };
}
export const isFormat2 = (raw: unknown) =>
  typeof raw === "object" &&
  raw !== null &&
  "schema_version" in raw &&
  raw.schema_version === "2";
export function anyRequestIdentity(raw: unknown) {
  return isFormat2(raw)
    ? { format: "2" as const, ...requestIdentityV2(raw) }
    : { format: "1" as const, ...requestIdentity(raw) };
}
export function requestIdentity(raw: unknown) {
  const input = planRequestSchema.parse(raw);
  input.preferences.considered_next_crop_ids.sort();
  input.preferences.excluded_crop_ids.sort();
  if (input.history.status === "known")
    input.history.entries.sort((a, b) => compare(stableJson(a), stableJson(b)));
  if (input.crop_health.status === "reported")
    input.crop_health.observations.sort((a, b) =>
      compare(stableJson(a), stableJson(b)),
    );
  if (input.soil.status === "known")
    input.soil.observations.sort((a, b) => compare(a.metric, b.metric));
  const canonical = stableJson(input);
  return {
    input,
    hash: createHash("sha256").update(canonical).digest("hex"),
    canonical,
  };
}
export function validateIntakeDates(
  input: PlanRequest | PlanRequestV2,
  today: string,
) {
  const limit = new Date(Date.parse(today) + 366 * 86400000)
    .toISOString()
    .slice(0, 10);
  if (
    input.planning.earliest_start_date < today ||
    input.planning.latest_start_date > limit
  )
    return false;
  if (
    input.history.status === "known" &&
    input.history.entries.some(
      (e) =>
        (e.planted_on && e.planted_on > today) ||
        (e.harvested_on && e.harvested_on > today),
    )
  )
    return false;
  if (
    input.crop_health.status === "reported" &&
    input.crop_health.observations.some((o) => o.observed_on > today)
  )
    return false;
  if (
    input.soil.status === "known" &&
    input.soil.observations.some((o) => o.measured_on && o.measured_on > today)
  )
    return false;
  return true;
}
export class PlanError extends Error {
  constructor(
    readonly code:
      | "UNAUTHORIZED"
      | "NOT_FOUND"
      | "INVALID_INPUT"
      | "IDEMPOTENCY_CONFLICT"
      | "RATE_LIMITED"
      | "CATALOG_UNAVAILABLE"
      | "STORED_REQUEST_INVALID",
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}
