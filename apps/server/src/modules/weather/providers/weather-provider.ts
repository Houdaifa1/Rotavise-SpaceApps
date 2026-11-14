import type { WeatherRequest, WeatherSnapshot } from "@rotavise/contracts";
export type WeatherErrorCode =
  | "INVALID_WEATHER_REQUEST"
  | "WEATHER_BUSY"
  | "WEATHER_TIMEOUT"
  | "WEATHER_CANCELLED"
  | "WEATHER_UPSTREAM_UNAVAILABLE"
  | "WEATHER_UPSTREAM_INVALID"
  | "WEATHER_STORAGE_UNAVAILABLE";
export class WeatherError extends Error {
  constructor(public readonly code: WeatherErrorCode) {
    super(code);
  }
}
export interface WeatherProvider {
  fetch(
    request: WeatherRequest,
    signal: AbortSignal,
  ): Promise<{ raw: string; snapshot: WeatherSnapshot }>;
}
