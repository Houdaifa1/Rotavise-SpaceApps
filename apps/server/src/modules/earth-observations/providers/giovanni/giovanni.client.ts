import { ObservationError } from "../appeears/appeears.client.js";

// GES DISC Giovanni time-series service for GPM IMERG Final daily. An
// Earthdata user token (valid about 60 days) is obtained with the account's
// credentials and reused; neither is logged.
export const GIOVANNI_TIMESERIES =
  "https://api.giovanni.earthdata.nasa.gov/timeseries";
const TOKEN_URL =
  "https://urs.earthdata.nasa.gov/api/users/find_or_create_token";
export interface RainTransport {
  daily(
    latitude: number,
    longitude: number,
    start: string,
    end: string,
    signal: AbortSignal,
  ): Promise<Uint8Array>;
}
export class GiovanniClient implements RainTransport {
  private token: { value: string; until: number } | null = null;
  constructor(
    private readonly username: string | undefined,
    private readonly password: string | undefined,
    private readonly http: typeof fetch = fetch,
  ) {}
  private async bearer(signal: AbortSignal) {
    if (!this.username || !this.password)
      throw new ObservationError("OBSERVATIONS_NOT_CONFIGURED");
    if (this.token && this.token.until > Date.now()) return this.token.value;
    const response = await this.http(TOKEN_URL, {
      method: "POST",
      headers: {
        authorization:
          "Basic " +
          Buffer.from(`${this.username}:${this.password}`).toString("base64"),
      },
      redirect: "manual",
      signal: AbortSignal.any([signal, AbortSignal.timeout(60000)]),
    });
    if (response.status === 401 || response.status === 403)
      throw new ObservationError("OBSERVATION_AUTH_FAILED");
    if (!response.ok)
      throw new ObservationError("OBSERVATION_UPSTREAM_UNAVAILABLE");
    const body = (await response.json()) as { access_token?: unknown };
    if (
      typeof body.access_token !== "string" ||
      body.access_token.length > 4096
    )
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    // Reuse for a day; Earthdata user tokens last much longer.
    this.token = { value: body.access_token, until: Date.now() + 24 * 3600000 };
    return body.access_token;
  }
  async daily(
    latitude: number,
    longitude: number,
    start: string,
    end: string,
    signal: AbortSignal,
  ) {
    const url = new URL(GIOVANNI_TIMESERIES);
    url.searchParams.set("data", "GPM_3IMERGDF_07_precipitation");
    url.searchParams.set("location", `[${latitude},${longitude}]`);
    url.searchParams.set("time", `${start}T00:00:00/${end}T23:59:59`);
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.http(url, {
          headers: { authorization: `Bearer ${await this.bearer(signal)}` },
          redirect: "manual",
          signal: AbortSignal.any([signal, AbortSignal.timeout(300000)]),
        });
      } catch (error) {
        if (error instanceof ObservationError) throw error;
        if (signal.aborted) throw new ObservationError("OBSERVATION_CANCELLED");
        continue;
      }
      if (response.status === 401 || response.status === 403) {
        await response.body?.cancel();
        this.token = null;
        continue;
      }
      if (!response.ok) {
        await response.body?.cancel();
        if (response.status === 429 || response.status >= 500) continue;
        throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > 2 * 1048576)
        throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
      return bytes;
    }
    throw new ObservationError("OBSERVATION_UPSTREAM_UNAVAILABLE");
  }
}
