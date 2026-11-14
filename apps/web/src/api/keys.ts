// Private keys include an opaque owner scope, never a bearer token or location.
export const keys = {
  capabilities: ["capabilities"] as const,
  health: ["health"] as const,
  account: ["account"] as const,
  catalog: (id = "current", version = "current") =>
    ["catalog", id, version] as const,
  cropDetail: (catalog: string, version: string, id: string) =>
    ["crop-detail", catalog, version, id] as const,
  glossary: (language: "fr" | "en") => ["glossary", language] as const,
  fields: (scope: number, cursor = "") =>
    ["private", scope, "fields", cursor] as const,
  fieldPages: (scope: number) => ["private", scope, "field-pages"] as const,
  fieldPlans: (scope: number, id: string) =>
    ["private", scope, "field-plans", id] as const,
  nasaJobs: (scope: number, id: string, family: string) =>
    ["private", scope, "nasa-jobs", id, family] as const,
  latestFieldPlans: (scope: number) =>
    ["private", scope, "latest-field-plans"] as const,
  field: (scope: number, id: string) =>
    ["private", scope, "field", id] as const,
  history: (scope: number, id: string, cursor = "") =>
    ["private", scope, "history", id, cursor] as const,
  boundary: (scope: number, id: string) =>
    ["private", scope, "boundary", id] as const,
  plans: (scope: number, cursor = "") =>
    ["private", scope, "plans", cursor] as const,
  plan: (scope: number, id: string) => ["private", scope, "plan", id] as const,
  observation: (scope: number, field: string, id: string) =>
    ["private", scope, "observation", field, id] as const,
  extraction: (scope: number, field: string, id: string) =>
    ["private", scope, "extraction", field, id] as const,
  analysis: (scope: number, field: string, kind: string) =>
    ["private", scope, "analysis", field, kind] as const,
};
export const stale = {
  catalog: 86_400_000,
  cropDetail: (catalog: string, version: string, id: string) =>
    ["crop-detail", catalog, version, id] as const,
  glossary: 86_400_000,
  field: 30_000,
  history: 30_000,
  analysis: 60_000,
  completedPlan: Infinity,
} as const;
export function planInterval(
  status: string | undefined,
  createdAt: string | undefined,
  now = Date.now(),
) {
  if (status === "completed" || status === "failed") return false;
  return createdAt && now - Date.parse(createdAt) >= 30_000 ? 5000 : 2000;
}
export function nasaInterval(
  status: string | undefined,
  createdAt: string | undefined,
  now = Date.now(),
) {
  if (status === "completed" || status === "failed") return false;
  return createdAt && now - Date.parse(createdAt) >= 600_000 ? 120_000 : 30_000;
}
