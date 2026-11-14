// Synthetic transport/session fixtures; never imported by a browser entrypoint.
export const guest = {
  accessToken: "a".repeat(43),
  expiresAt: "2099-01-01T00:00:00.000Z",
};
export const renewedGuest = { ...guest, accessToken: "b".repeat(43) };
export const health = {
  service: "rotavise-api",
  status: "ready",
  checkedAt: "2026-11-11T00:00:00.000Z",
  dependenciesReady: true,
  dataCompleteness: {
    ok: true,
    checkedAt: "2026-11-11T00:00:00.000Z",
    incomplete: [] as string[],
    datasets: [] as { dataset: string; ok: boolean; detail: string }[],
  },
};
export const account = {
  id: "c6d741a0-80a5-4e3f-8350-1b572eb316bf",
  name: "Synthetic test owner",
  email: "owner@example.invalid",
  emailVerified: true as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  sessionExpiresAt: "2099-01-01T00:00:00.000Z",
};
export function response(
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: {
      get: (key: string) =>
        Object.entries(headers).find(
          ([name]) => name.toLowerCase() === key.toLowerCase(),
        )?.[1] ?? null,
    },
  } as Response;
}
