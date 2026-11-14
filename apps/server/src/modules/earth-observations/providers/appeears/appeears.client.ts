import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

// AppEEARS API (https://appeears.earthdatacloud.nasa.gov/api/). Earthdata
// username and password are exchanged for a bearer token (about 48 hours);
// neither is ever logged. Tasks are deleted remotely once downloaded.
export const APPEEARS_API = "https://appeears.earthdatacloud.nasa.gov/api";
const MAX_FILE_BYTES = 20 * 1048576;
export class ObservationError extends Error {
  constructor(
    readonly code:
      | "OBSERVATIONS_NOT_CONFIGURED"
      | "OBSERVATION_UPSTREAM_UNAVAILABLE"
      | "OBSERVATION_UPSTREAM_INVALID"
      | "OBSERVATION_AUTH_FAILED"
      | "OBSERVATION_CANCELLED",
  ) {
    super(code);
  }
}
export type AppeearsTask = {
  task_type: "point";
  task_name: string;
  params: {
    dates: { startDate: string; endDate: string }[];
    layers: { product: string; layer: string }[];
    coordinates: {
      id: string;
      category: string;
      latitude: number;
      longitude: number;
    }[];
  };
};
export type BundleFile = {
  fileId: string;
  name: string;
  size: number;
  sha256: string | null;
};
export interface AppeearsTransport {
  submit(task: AppeearsTask, signal: AbortSignal): Promise<string>;
  status(
    taskId: string,
    signal: AbortSignal,
  ): Promise<"pending" | "processing" | "queued" | "done" | "error">;
  bundle(taskId: string, signal: AbortSignal): Promise<BundleFile[]>;
  download(
    taskId: string,
    file: BundleFile,
    signal: AbortSignal,
  ): Promise<Uint8Array>;
  remove(taskId: string, signal: AbortSignal): Promise<void>;
}
const id = /^[A-Za-z0-9-]{1,64}$/;
export class AppeearsClient implements AppeearsTransport {
  private token: { value: string; until: number } | null = null;
  constructor(
    private readonly username: string | undefined,
    private readonly password: string | undefined,
    private readonly http: typeof fetch = fetch,
  ) {}
  private async bearer(signal: AbortSignal, renew = false) {
    if (!this.username || !this.password)
      throw new ObservationError("OBSERVATIONS_NOT_CONFIGURED");
    if (!renew && this.token && this.token.until > Date.now())
      return this.token.value;
    const response = await this.http(`${APPEEARS_API}/login`, {
      method: "POST",
      headers: {
        authorization:
          "Basic " +
          Buffer.from(`${this.username}:${this.password}`).toString("base64"),
        "content-length": "0",
      },
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    });
    if (response.status === 401 || response.status === 403)
      throw new ObservationError("OBSERVATION_AUTH_FAILED");
    if (!response.ok)
      throw new ObservationError("OBSERVATION_UPSTREAM_UNAVAILABLE");
    const body = (await response.json()) as { token?: unknown };
    if (typeof body.token !== "string" || body.token.length > 4096)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    // Renew well before the documented 48-hour expiry.
    this.token = { value: body.token, until: Date.now() + 24 * 3600000 };
    return body.token;
  }
  // One retry with a fresh token on 401/403; bounded retries on 429/5xx.
  private async request(
    path: string,
    init: RequestInit,
    signal: AbortSignal,
  ): Promise<Response> {
    let renew = false;
    for (let attempt = 0; attempt < 4; attempt++) {
      const token = await this.bearer(signal, renew);
      let response: Response;
      try {
        response = await this.http(`${APPEEARS_API}${path}`, {
          ...init,
          headers: { ...init.headers, authorization: `Bearer ${token}` },
          redirect: "manual",
          signal: AbortSignal.any([signal, AbortSignal.timeout(120000)]),
        });
      } catch {
        if (signal.aborted) throw new ObservationError("OBSERVATION_CANCELLED");
        await delay(2000 * 2 ** attempt, undefined, { signal });
        continue;
      }
      if ((response.status === 401 || response.status === 403) && !renew) {
        await response.body?.cancel();
        renew = true;
        continue;
      }
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        await delay(2000 * 2 ** attempt, undefined, { signal });
        continue;
      }
      return response;
    }
    throw new ObservationError("OBSERVATION_UPSTREAM_UNAVAILABLE");
  }
  async submit(task: AppeearsTask, signal: AbortSignal) {
    const response = await this.request(
      "/task",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(task),
      },
      signal,
    );
    if (response.status !== 202)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const body = (await response.json()) as { task_id?: unknown };
    if (typeof body.task_id !== "string" || !id.test(body.task_id))
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    return body.task_id;
  }
  async status(taskId: string, signal: AbortSignal) {
    const response = await this.request(
      `/task/${taskId}`,
      { method: "GET" },
      signal,
    );
    if (!response.ok)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const body = (await response.json()) as { status?: unknown };
    if (
      !["pending", "processing", "queued", "done", "error"].includes(
        String(body.status),
      )
    )
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    return body.status as
      "pending" | "processing" | "queued" | "done" | "error";
  }
  async bundle(taskId: string, signal: AbortSignal) {
    const response = await this.request(
      `/bundle/${taskId}`,
      { method: "GET" },
      signal,
    );
    if (!response.ok)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const body = (await response.json()) as {
      files?: {
        file_id?: unknown;
        file_name?: unknown;
        file_size?: unknown;
        sha256?: unknown;
      }[];
    };
    if (!Array.isArray(body.files) || body.files.length > 200)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    return body.files.map((f) => {
      if (
        typeof f.file_id !== "string" ||
        !id.test(f.file_id) ||
        typeof f.file_name !== "string" ||
        f.file_name.length > 300 ||
        typeof f.file_size !== "number" ||
        (f.sha256 !== undefined &&
          f.sha256 !== null &&
          typeof f.sha256 !== "string")
      )
        throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
      return {
        fileId: f.file_id,
        name: f.file_name,
        size: f.file_size,
        sha256: (f.sha256 as string | null | undefined) ?? null,
      };
    });
  }
  // The bundle endpoint redirects to a short-lived signed storage URL; the
  // bearer token is not forwarded there, and the URL is never stored.
  async download(taskId: string, file: BundleFile, signal: AbortSignal) {
    if (file.size > MAX_FILE_BYTES)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const response = await this.request(
      `/bundle/${taskId}/${file.fileId}`,
      { method: "GET" },
      signal,
    );
    let target = response;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || !location.startsWith("https://"))
        throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
      target = await this.http(location, {
        redirect: "manual",
        signal: AbortSignal.any([signal, AbortSignal.timeout(300000)]),
      });
    }
    if (!target.ok)
      throw new ObservationError("OBSERVATION_UPSTREAM_UNAVAILABLE");
    const bytes = new Uint8Array(await target.arrayBuffer());
    if (
      bytes.byteLength > MAX_FILE_BYTES ||
      (file.sha256 !== null &&
        createHash("sha256").update(bytes).digest("hex") !== file.sha256)
    )
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    return bytes;
  }
  async remove(taskId: string, signal: AbortSignal) {
    const response = await this.request(
      `/task/${taskId}`,
      { method: "DELETE" },
      signal,
    );
    await response.body?.cancel();
    if (response.status !== 204 && response.status !== 404)
      throw new ObservationError("OBSERVATION_UPSTREAM_UNAVAILABLE");
  }
}
