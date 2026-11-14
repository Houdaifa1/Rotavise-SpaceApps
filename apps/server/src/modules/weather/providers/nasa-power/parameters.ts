import { weatherVariableDefinitions } from "@rotavise/contracts";
export const NASA_ENDPOINT =
  "https://power.larc.nasa.gov/api/temporal/daily/point";
// Adapter 3 sends the source-cell centre instead of the requested position.
export const WEATHER_ADAPTER_VERSION = "3";
export const WEATHER_REGISTRY = weatherVariableDefinitions;
