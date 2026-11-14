import {
  weatherCapabilitiesSchema,
  weatherRequestSchema,
  weatherResponseSchema,
  type WeatherRequest,
} from "@rotavise/contracts";
import { api } from "../../../app/http.js";
export const getWeatherCapabilities = (signal?: AbortSignal) =>
  api("/api/v1/weather/capabilities", weatherCapabilitiesSchema, { signal });
export const queryWeather = (request: WeatherRequest, signal?: AbortSignal) =>
  api("/api/v1/weather/query", weatherResponseSchema, {
    method: "POST",
    body: weatherRequestSchema.parse(request),
    signal,
  });
