import { z } from "zod";
import {
  catalogOptionsSchema,
  ownerSessionSchema,
  planningStatusSchema,
  planStatusSchema,
  type PlanRequest,
} from "@rotavise/contracts";
import { api } from "../../../app/http.js";
import { getApiClient } from "../../../api/client.js";
import {
  submitPlan as sendPlan,
  getPlan,
  claimPlan as movePlan,
} from "../../../api/plans.js";
import { getOwner } from "../../session/index.js";

export const anyPlanSchema = z.union([planningStatusSchema, planStatusSchema]);
export type AnyPlan = z.infer<typeof anyPlanSchema>;
export type GuestSession = z.infer<typeof ownerSessionSchema>;

export const catalogOptions = (signal?: AbortSignal) =>
  api("/api/v1/catalog/options", catalogOptionsSchema, { signal });
export const catalogOptionsFor = (
  id: string,
  version: string,
  signal?: AbortSignal,
) =>
  api(
    `/api/v1/catalog/options/${encodeURIComponent(id)}/${encodeURIComponent(version)}`,
    catalogOptionsSchema,
    { signal },
  );
export const createGuestSession = () =>
  getOwner().ensureGuest(() =>
    api("/api/v1/plan-sessions", ownerSessionSchema, {
      method: "POST",
      body: {},
      credentials: "omit",
    }),
  );
export const submitPlan = (
  input: PlanRequest,
  key: string,
  _token?: string,
) => {
  void _token;
  return sendPlan(getApiClient(), { body: input, idempotencyKey: key });
};
export const readPlan = async (
  id: string,
  _token?: string,
  signal?: AbortSignal,
) =>
  anyPlanSchema.parse(
    await getPlan(getApiClient(), {
      params: { id },
      ...(signal ? { signal } : {}),
    }),
  );
export const claimPlan = (id: string, _token: string) => {
  void _token;
  return movePlan(getApiClient(), { params: { id }, body: { confirm: true } });
};

const activeKey = "rotavise.active-plan.v1";
export type ActivePlan = {
  id: string;
  guestToken?: string | undefined;
  expiresAt: string;
};
export function loadGuest(): GuestSession | null {
  return getOwner().snapshot().guest;
}
export function saveGuest(session: GuestSession) {
  getOwner().saveGuest(session);
}
export function clearGuest() {
  getOwner().saveGuest(null);
}
export function loadActive(): ActivePlan | null {
  try {
    const raw = sessionStorage.getItem(activeKey);
    const parsed =
      raw &&
      z
        .strictObject({
          id: z.uuid(),
          guestToken: z.string().optional(),
          expiresAt: z.iso.datetime(),
        })
        .safeParse(JSON.parse(raw));
    return parsed &&
      parsed.success &&
      Date.parse(parsed.data.expiresAt) > Date.now()
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}
export function saveActive(value: ActivePlan) {
  try {
    sessionStorage.setItem(activeKey, JSON.stringify(value));
  } catch {
    /* The current screen retains its state. */
  }
}
export function clearActive() {
  try {
    sessionStorage.removeItem(activeKey);
  } catch {
    /* Storage may be blocked. */
  }
}
