import { createHash } from "node:crypto";
import { z } from "zod";
import {
  datesBetween,
  WEATHER_ATTRIBUTION,
  weatherVariableAvailability,
  validWeatherValue,
  weatherSnapshotSchema,
  type WeatherRequest,
  type WeatherVariable,
} from "@rotavise/contracts";
import { WeatherError } from "../weather-provider.js";
import { WEATHER_REGISTRY, WEATHER_ADAPTER_VERSION } from "./parameters.js";
const responseSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([
      z.number().finite(),
      z.number().finite(),
      z.number().finite(),
    ]),
  }),
  properties: z.object({
    parameter: z.record(z.string(), z.record(z.string(), z.number().finite())),
  }),
  header: z.object({
    api: z.object({
      version: z.string().min(1).max(40),
      name: z.literal("POWER Daily API"),
    }),
    sources: z
      .array(z.enum(["MERRA2", "SYN1DEG", "POWER"]))
      .min(1)
      .max(8),
    fill_value: z.literal(-999),
    time_standard: z.literal("UTC"),
    start: z.string(),
    end: z.string(),
  }),
  parameters: z.record(
    z.string(),
    z.object({ units: z.string(), longname: z.string() }),
  ),
  messages: z.array(z.string()).max(0),
});
export function normalizeNasa(
  raw: string,
  request: WeatherRequest,
  retrievedAt = new Date().toISOString(),
  // Stored adapter 2 evidence is re-verified with its own version.
  adapterVersion: "2" | "3" = WEATHER_ADAPTER_VERSION,
) {
  try {
    const data = responseSchema.parse(JSON.parse(raw));
    if (
      new Set(data.header.sources).size !== data.header.sources.length ||
      request.variables.some(
        (v) =>
          !data.header.sources.includes(weatherVariableAvailability[v].source),
      ) ||
      data.header.sources.some(
        (source) =>
          source !== "POWER" &&
          !request.variables.some(
            (v) => weatherVariableAvailability[v].source === source,
          ),
      ) ||
      data.header.start !== request.startDate.replaceAll("-", "") ||
      data.header.end !== request.endDate.replaceAll("-", "") ||
      Math.abs(data.geometry.coordinates[0] - request.longitude) > 0.001 ||
      Math.abs(data.geometry.coordinates[1] - request.latitude) > 0.001
    )
      throw new Error("metadata");
    const dates = datesBetween(request.startDate, request.endDate);
    const dateKeys = new Set(dates.map((date) => date.replaceAll("-", "")));
    const requested = new Set<string>(
      request.variables.map((v) => WEATHER_REGISTRY[v].parameter),
    );
    if (
      Object.keys(data.properties.parameter).some((key) => !requested.has(key))
    )
      throw new Error("parameters");
    for (const variable of request.variables) {
      const spec = WEATHER_REGISTRY[variable];
      const values = data.properties.parameter[spec.parameter];
      if (
        !values ||
        data.parameters[spec.parameter]?.units !== spec.sourceUnit ||
        Object.keys(values).some((date) => !dateKeys.has(date))
      )
        throw new Error("metadata");
    }
    const days = dates.map((date) => {
      const values: Partial<Record<WeatherVariable, number | null>> = {};
      for (const variable of request.variables) {
        const value =
          data.properties.parameter[WEATHER_REGISTRY[variable].parameter]?.[
            date.replaceAll("-", "")
          ];
        values[variable] = value === undefined || value === -999 ? null : value;
        if (!validWeatherValue(variable, values[variable]!))
          throw new Error("invalid physical value");
      }
      const {
        temperatureMin: min,
        temperatureMax: max,
        temperatureMean: mean,
      } = values;
      if (typeof min === "number" && typeof max === "number" && min > max)
        throw new Error("temperature order");
      if (
        typeof mean === "number" &&
        ((typeof min === "number" && mean < min - 0.01) ||
          (typeof max === "number" && mean > max + 0.01))
      )
        throw new Error("temperature mean");
      return { date, values };
    });
    const coverage = request.variables.map((variable) => ({
      variable,
      expectedDays: dates.length,
      missingDates: days
        .filter((day) => day.values[variable] === null)
        .map((day) => day.date),
    }));
    return weatherSnapshotSchema.parse({
      schemaVersion: 1,
      request,
      days,
      coverage,
      complete: coverage.every((c) => c.missingDates.length === 0),
      provenance: {
        provider: "nasa-power",
        adapterVersion,
        apiVersion: data.header.api.version,
        sources: data.header.sources,
        timeStandard: "UTC",
        retrievedAt,
        rawSha256: createHash("sha256").update(raw).digest("hex"),
        responseCoordinates: data.geometry.coordinates,
        spatialMeaning: "grid-estimate-not-field-measurement",
        variables: request.variables.map((variable) => ({
          variable,
          ...WEATHER_REGISTRY[variable],
        })),
        attribution: WEATHER_ATTRIBUTION,
      },
    });
  } catch {
    throw new WeatherError("WEATHER_UPSTREAM_INVALID");
  }
}
