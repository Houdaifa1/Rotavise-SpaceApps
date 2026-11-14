import { createHash } from "node:crypto";
import {
  latestWeatherDate,
  powerCell,
  weatherRequestSchema,
  type WeatherRequest,
} from "@rotavise/contracts";
import { WEATHER_ADAPTER_VERSION } from "../providers/nasa-power/parameters.js";
import { WeatherError } from "../providers/weather-provider.js";
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export function canonicalWeatherRequest(
  input: unknown,
  now = new Date(),
): WeatherRequest {
  const parsed = weatherRequestSchema.safeParse(input);
  if (!parsed.success || parsed.data.endDate > latestWeatherDate(now))
    throw new WeatherError("INVALID_WEATHER_REQUEST");
  // POWER values are constant inside a source cell, so only its centre is
  // sent, cached and stored.
  const cell = powerCell(parsed.data.latitude, parsed.data.longitude);
  return {
    latitude: cell.latitude,
    longitude: cell.longitude,
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    variables: [...parsed.data.variables].sort(),
  };
}
export function weatherRequestKey(input: unknown) {
  return sha256(
    JSON.stringify({
      provider: "nasa-power",
      adapterVersion: WEATHER_ADAPTER_VERSION,
      timeStandard: "UTC",
      request: canonicalWeatherRequest(input),
    }),
  );
}
