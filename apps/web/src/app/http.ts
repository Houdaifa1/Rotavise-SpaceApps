import type { z } from "zod";
import { errorBodySchema } from "@rotavise/contracts";
import { takeBootRead, releaseBootRead } from "./boot-transport.js";

export class ApiFailure extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}
export type HttpOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal | undefined;
  credentials?: "omit" | "same-origin";
  acceptStatuses?: number[];
  conditional?: boolean;
  emptyStatuses?: number[];
};
type Cached = { etag: string; body: unknown };
const etags = new Map<string, Cached>();
const listeners = new Set<(available: boolean) => void>();
let failures = 0;
export function networkFailureCount() {
  return failures;
}
export function observeNetwork(listener: (available: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function clearHttpCache() {
  etags.clear();
}
export function retryAfter(value: string | null, now = Date.now()) {
  if (!value) return undefined;
  const seconds = /^\d+$/.test(value)
    ? Number(value)
    : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : undefined;
}
async function request(path: string, options: HttpOptions): Promise<Response> {
  if (!path.startsWith("/api/") || path.startsWith("//"))
    throw new TypeError("Same-origin API path required");
  let response: Response;
  try {
    const preload =
      (options.method ?? "GET") === "GET" &&
      !Object.keys(options.headers ?? {}).length
        ? takeBootRead(path, options.signal)
        : undefined;
    response = await (preload ??
      fetch(path, {
        method: options.method ?? "GET",
        credentials:
          options.credentials ??
          (options.headers?.Authorization ? "omit" : "same-origin"),
        cache: "no-store",
        ...(options.signal ? { signal: options.signal } : {}),
        headers: {
          ...(options.body !== undefined
            ? { "Content-Type": "application/json" }
            : {}),
          ...options.headers,
        },
        ...(options.body !== undefined
          ? { body: JSON.stringify(options.body) }
          : {}),
      }));
  } catch (error) {
    if (options.signal?.aborted) throw error;
    failures++;
    for (const listener of listeners) listener(false);
    throw new ApiFailure(0, "NETWORK_UNAVAILABLE");
  }
  failures = 0;
  for (const listener of listeners) listener(true);
  if (
    !response.ok &&
    response.status !== 304 &&
    !options.acceptStatuses?.includes(response.status)
  ) {
    const body: unknown = await response.json().catch(() => null);
    releaseBootRead(response);
    const parsed = errorBodySchema.safeParse(body);
    const code = parsed.success ? parsed.data.code : "REQUEST_FAILED";
    throw new ApiFailure(
      response.status,
      code,
      retryAfter(response.headers.get("Retry-After")),
    );
  }
  return response;
}
export async function api<T>(
  path: string,
  schema: z.ZodType<T>,
  options: HttpOptions = {},
): Promise<T> {
  const previous = options.conditional ? etags.get(path) : undefined;
  const response = await request(path, {
    ...options,
    headers: {
      ...options.headers,
      ...(previous ? { "If-None-Match": previous.etag } : {}),
    },
  });
  const body: unknown =
    response.status === 304
      ? previous?.body
      : await response.json().catch(() => null);
  releaseBootRead(response);
  if (options.signal?.aborted) throw options.signal.reason;
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new ApiFailure(response.status, "INVALID_SERVER_RESPONSE");
  if (options.conditional && response.status !== 304) {
    const etag = response.headers.get("ETag");
    if (etag) etags.set(path, { etag, body: parsed.data });
  }
  return parsed.data;
}
export async function apiEmpty(path: string, options: HttpOptions) {
  const response = await request(path, options);
  releaseBootRead(response);
  if (!(options.emptyStatuses ?? [204, 200]).includes(response.status))
    throw new ApiFailure(response.status, "INVALID_SERVER_RESPONSE");
}
// Retained Step 08 screens use this until their slices replace them.
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "CATALOG_EVIDENCE_MISMATCH")
    return "The saved catalog checksum does not match. This result cannot be safely displayed.";
  if (error instanceof ApiFailure) {
    if (error.status === 401)
      return "Your session is missing or expired. Sign in again or start a new guest session.";
    if (error.status === 404) return "This item is unavailable or has expired.";
    if (error.status === 429)
      return "Too many requests. Wait before trying again.";
    if (error.code === "NETWORK_UNAVAILABLE")
      return "Cannot reach the server. Check your connection and retry.";
    if (error.code === "INVALID_SERVER_RESPONSE")
      return "The server returned data this app cannot safely display.";
  }
  return "The service is temporarily unavailable. Try again later.";
}
