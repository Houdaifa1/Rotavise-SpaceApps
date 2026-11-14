import { z } from "zod";
import {
  pageCursorSchema,
  type FieldProfile,
  type CropHistoryEntry,
  accountSchema,
  authCapabilitiesSchema,
  fieldRecordSchema,
  historyRecordSchema,
  planListSchema,
} from "@rotavise/contracts";
import { api, apiEmpty } from "../../../app/http.js";

export { accountSchema };
export type Account = z.infer<typeof accountSchema>;
const capabilitiesSchema = authCapabilitiesSchema;
const statusSchema = z.object({ status: z.string().optional() });
const authResponse = z.object({ url: z.url(), redirect: z.boolean() });
const fieldSchema = fieldRecordSchema;
const historySchema = historyRecordSchema;
const page = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    items: z.array(item),
    nextCursor: pageCursorSchema.nullable(),
  });
const planItemSchema = planListSchema.shape.items.element;
export type SavedField = z.infer<typeof fieldSchema>;
export type SavedHistory = z.infer<typeof historySchema>;
export type SavedPlan = z.infer<typeof planItemSchema>;

export const authCapabilities = () =>
  api("/api/v1/auth/capabilities", capabilitiesSchema);
export const currentAccount = () => api("/api/v1/account", accountSchema);
export const signup = (name: string, email: string, password: string) =>
  api("/api/auth/sign-up/email", statusSchema, {
    method: "POST",
    body: {
      name,
      email,
      password,
      callbackURL: window.location.origin + "/?auth=verified",
    },
  });
export const login = (email: string, password: string) =>
  api(
    "/api/auth/sign-in/email",
    z.object({ user: z.object({ id: z.string() }) }),
    { method: "POST", body: { email, password } },
  );
export const logout = () =>
  apiEmpty("/api/auth/sign-out", { method: "POST", body: {} });
export const requestRecovery = (email: string) =>
  api(
    "/api/auth/request-password-reset",
    z.object({ status: z.boolean().optional() }),
    {
      method: "POST",
      body: { email, redirectTo: window.location.origin + "/?auth=reset" },
    },
  );
export const resetPassword = (token: string, newPassword: string) =>
  api(
    "/api/auth/reset-password",
    z.object({ status: z.boolean().optional() }),
    { method: "POST", body: { token, newPassword } },
  );
export const deleteAccount = () =>
  apiEmpty("/api/auth/delete-user", {
    method: "POST",
    body: { callbackURL: window.location.origin + "/?auth=deleted" },
  });
export const googleAuth = (link: boolean) =>
  api(`/api/auth/${link ? "link-social" : "sign-in/social"}`, authResponse, {
    method: "POST",
    body: {
      provider: "google",
      callbackURL: window.location.origin + "/?auth=google",
    },
  });
export const listFields = (cursor?: string) =>
  api(
    `/api/v1/fields?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    page(fieldSchema),
  );
export const saveField = (profile: FieldProfile) =>
  api("/api/v1/fields", fieldSchema, { method: "POST", body: profile });
export const saveFieldWithHistory = (
  profile: FieldProfile,
  history: CropHistoryEntry[],
) =>
  api("/api/v1/fields-with-history", fieldSchema, {
    method: "POST",
    body: { profile, history },
  });
export const listHistory = (fieldId: string, cursor?: string) =>
  api(
    `/api/v1/fields/${encodeURIComponent(fieldId)}/history?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    page(historySchema),
  );
export const saveHistory = (fieldId: string, entry: CropHistoryEntry) =>
  api(`/api/v1/fields/${encodeURIComponent(fieldId)}/history`, historySchema, {
    method: "POST",
    body: entry,
  });
export const listPlans = (cursor?: string) =>
  api(
    `/api/v1/plans?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
    page(planItemSchema),
  );
