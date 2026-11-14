import { z } from "zod";
import { isPowerCellCentre } from "./power-grid.js";

const DAY = 86_400_000;
export const MAX_WEATHER_DAYS = 366;
// Product policy: stay outside NASA's documented 2–3 month NRT revision window.
// This does not guarantee that older observations will never be revised.
export const WEATHER_HISTORY_LAG_DAYS = 120;
export function validCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return (
    Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
  );
}
export const calendarDateSchema = z
  .string()
  .refine(validCalendarDate, "Invalid calendar date");
export function datesBetween(start: string, end: string) {
  const count = (Date.parse(end) - Date.parse(start)) / DAY + 1;
  if (
    !validCalendarDate(start) ||
    !validCalendarDate(end) ||
    count < 1 ||
    count > MAX_WEATHER_DAYS
  )
    throw new RangeError("WEATHER_DATE_RANGE_INVALID");
  const dates: string[] = [];
  for (
    let time = Date.parse(`${start}T00:00:00Z`);
    time <= Date.parse(`${end}T00:00:00Z`);
    time += DAY
  )
    dates.push(new Date(time).toISOString().slice(0, 10));
  return dates;
}
export function latestWeatherDate(now = new Date()) {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
      WEATHER_HISTORY_LAG_DAYS * DAY,
  )
    .toISOString()
    .slice(0, 10);
}
// Only these variables currently have implemented calculation methods in the engine.
export const climateWeatherVariables = [
  "temperatureMin",
  "temperatureMax",
  "temperatureMean",
  "precipitation",
] as const;
export const weatherVariables = [
  ...climateWeatherVariables,
  "relativeHumidity",
  "windSpeed",
  "solarRadiation",
] as const;
export const weatherVariableSchema = z.enum(weatherVariables);
export type WeatherVariable = z.infer<typeof weatherVariableSchema>;
export const weatherVariableDefinitions = {
  temperatureMin: {
    parameter: "T2M_MIN",
    sourceUnit: "C",
    unit: "degC",
    definition: "Daily minimum of hourly 2 m air temperature",
  },
  temperatureMax: {
    parameter: "T2M_MAX",
    sourceUnit: "C",
    unit: "degC",
    definition: "Daily maximum of hourly 2 m air temperature",
  },
  temperatureMean: {
    parameter: "T2M",
    sourceUnit: "C",
    unit: "degC",
    definition: "Daily mean 2 m air temperature",
  },
  precipitation: {
    parameter: "PRECTOTCORR",
    sourceUnit: "mm/day",
    unit: "mm",
    definition:
      "Corrected daily mean precipitation rate integrated over one UTC day",
  },
  relativeHumidity: {
    parameter: "RH2M",
    sourceUnit: "%",
    unit: "%",
    definition: "Daily mean 2 m relative humidity",
  },
  windSpeed: {
    parameter: "WS2M",
    sourceUnit: "m/s",
    unit: "m/s",
    definition: "Daily mean 2 m wind speed",
  },
  solarRadiation: {
    parameter: "ALLSKY_SFC_SW_DWN",
    sourceUnit: "MJ/m^2/day",
    unit: "MJ/m2/day",
    definition:
      "Daily all-sky surface shortwave downward solar energy per area",
  },
} as const;
export const weatherVariableAvailability = Object.fromEntries(
  weatherVariables.map((variable) => [
    variable,
    variable === "solarRadiation"
      ? {
          earliestDate: "2001-01-01",
          source: "SYN1DEG",
          latitudeDegrees: 1,
          longitudeDegrees: 1,
        }
      : {
          earliestDate: "1981-01-01",
          source: "MERRA2",
          latitudeDegrees: 0.5,
          longitudeDegrees: 0.625,
        },
  ]),
) as Record<
  WeatherVariable,
  {
    earliestDate: string;
    source: "MERRA2" | "SYN1DEG";
    latitudeDegrees: number;
    longitudeDegrees: number;
  }
>;
export const WEATHER_ATTRIBUTION =
  "NASA Langley Research Center POWER Project; source datasets listed in provenance.sources; https://power.larc.nasa.gov/";
const legacyAttribution =
  "NASA Langley Research Center POWER Project; MERRA-2; https://power.larc.nasa.gov/";
export function validWeatherValue(
  variable: WeatherVariable,
  value: number | null,
) {
  if (value === null) return true;
  if (!Number.isFinite(value)) return false;
  if (variable === "relativeHumidity") return value >= 0 && value <= 100;
  if (["precipitation", "windSpeed", "solarRadiation"].includes(variable))
    return value >= 0;
  return true;
}
export const weatherRequestSchema = z
  .strictObject({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    startDate: calendarDateSchema,
    endDate: calendarDateSchema,
    variables: z
      .array(weatherVariableSchema)
      .min(1)
      .max(weatherVariables.length),
  })
  .superRefine((value, ctx) => {
    if (new Set(value.variables).size !== value.variables.length)
      ctx.addIssue({
        code: "custom",
        path: ["variables"],
        message: "Duplicate variables",
      });
    if (
      !validCalendarDate(value.startDate) ||
      !validCalendarDate(value.endDate)
    )
      return;
    const days =
      (Date.parse(value.endDate) - Date.parse(value.startDate)) / DAY + 1;
    if (days < 1 || days > MAX_WEATHER_DAYS || value.startDate < "1981-01-01")
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Unsupported date range",
      });
    if (
      value.variables.some(
        (v) => value.startDate < weatherVariableAvailability[v].earliestDate,
      )
    )
      ctx.addIssue({
        code: "custom",
        path: ["startDate"],
        message: "Date range precedes selected variable availability",
      });
  });
export type WeatherRequest = z.infer<typeof weatherRequestSchema>;
const nullableValue = z.number().finite().nullable();
export const weatherSnapshotSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    request: weatherRequestSchema,
    days: z
      .array(
        z.strictObject({
          date: calendarDateSchema,
          values: z.partialRecord(weatherVariableSchema, nullableValue),
        }),
      )
      .min(1)
      .max(MAX_WEATHER_DAYS),
    coverage: z
      .array(
        z.strictObject({
          variable: weatherVariableSchema,
          expectedDays: z.number().int().positive().max(MAX_WEATHER_DAYS),
          missingDates: z.array(calendarDateSchema).max(MAX_WEATHER_DAYS),
        }),
      )
      .min(1)
      .max(weatherVariables.length),
    complete: z.boolean(),
    provenance: z.strictObject({
      provider: z.literal("nasa-power"),
      // Adapter 3 requests the source-cell centre, never the farmer position.
      adapterVersion: z.enum(["1", "2", "3"]),
      apiVersion: z.string().min(1).max(40),
      sources: z.array(z.string().min(1).max(40)).min(1).max(8),
      timeStandard: z.literal("UTC"),
      retrievedAt: z.iso.datetime({ offset: false }),
      rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
      responseCoordinates: z.tuple([
        z.number().min(-180).max(180),
        z.number().min(-90).max(90),
        z.number().finite(),
      ]),
      // The response coordinates echo the requested coordinates.
      spatialMeaning: z.literal("grid-estimate-not-field-measurement"),
      variables: z
        .array(
          z.strictObject({
            variable: weatherVariableSchema,
            parameter: z.string(),
            sourceUnit: z.string(),
            unit: z.enum(["degC", "mm", "%", "m/s", "MJ/m2/day"]),
            definition: z.string(),
          }),
        )
        .min(1)
        .max(weatherVariables.length),
      attribution: z.enum([legacyAttribution, WEATHER_ATTRIBUTION]),
    }),
  })
  .superRefine((snapshot, ctx) => {
    if (!weatherRequestSchema.safeParse(snapshot.request).success) {
      ctx.addIssue({ code: "custom", message: "Invalid snapshot request" });
      return;
    }
    const expectedDates = datesBetween(
      snapshot.request.startDate,
      snapshot.request.endDate,
    );
    const variables = snapshot.request.variables;
    const problem = () =>
      ctx.addIssue({
        code: "custom",
        message: "Inconsistent weather evidence",
      });
    if (snapshot.provenance.adapterVersion === "1") {
      if (
        snapshot.provenance.attribution !== legacyAttribution ||
        variables.some(
          (v) => !(climateWeatherVariables as readonly string[]).includes(v),
        )
      )
        problem();
    } else {
      const sources = snapshot.provenance.sources;
      const required = new Set(
        variables.map((v) => weatherVariableAvailability[v].source),
      );
      if (
        snapshot.provenance.attribution !== WEATHER_ATTRIBUTION ||
        new Set(sources).size !== sources.length ||
        sources.some(
          (s) => s !== "POWER" && !required.has(s as "MERRA2" | "SYN1DEG"),
        ) ||
        [...required].some((s) => !sources.includes(s))
      )
        problem();
      if (
        snapshot.provenance.adapterVersion === "3" &&
        !isPowerCellCentre(
          snapshot.request.latitude,
          snapshot.request.longitude,
        )
      )
        problem();
    }
    if (
      snapshot.days.length !== expectedDates.length ||
      snapshot.coverage.length !== variables.length ||
      snapshot.provenance.variables.length !== variables.length
    ) {
      problem();
      return;
    }
    for (const [index, day] of snapshot.days.entries()) {
      if (
        day.date !== expectedDates[index] ||
        Object.keys(day.values).length !== variables.length ||
        variables.some((v) => !(v in day.values))
      )
        problem();
      if (variables.some((v) => !validWeatherValue(v, day.values[v] ?? null)))
        problem();
    }
    if (
      new Set(snapshot.coverage.map((c) => c.variable)).size !==
        variables.length ||
      new Set(snapshot.provenance.variables.map((v) => v.variable)).size !==
        variables.length
    )
      problem();
    for (const variable of variables) {
      const coverage = snapshot.coverage.find((c) => c.variable === variable);
      const provenance = snapshot.provenance.variables.find(
        (v) => v.variable === variable,
      );
      const missing = snapshot.days
        .filter((day) => day.values[variable] === null)
        .map((day) => day.date);
      if (
        !coverage ||
        coverage.expectedDays !== expectedDates.length ||
        JSON.stringify(coverage.missingDates) !== JSON.stringify(missing) ||
        provenance?.unit !== weatherVariableDefinitions[variable].unit
      )
        problem();
      if (
        snapshot.provenance.adapterVersion !== "1" &&
        (!provenance ||
          provenance.parameter !==
            weatherVariableDefinitions[variable].parameter ||
          provenance.sourceUnit !==
            weatherVariableDefinitions[variable].sourceUnit ||
          provenance.definition !==
            weatherVariableDefinitions[variable].definition)
      )
        problem();
    }
    if (
      snapshot.complete !==
      snapshot.coverage.every((c) => c.missingDates.length === 0)
    )
      problem();
  });
export type WeatherSnapshot = z.infer<typeof weatherSnapshotSchema>;
export const weatherResponseSchema = z.strictObject({
  snapshotId: z.uuid(),
  cache: z.enum(["hit", "miss"]),
  expiresAt: z.iso.datetime({ offset: false }),
  snapshot: weatherSnapshotSchema,
});
export type WeatherResponse = z.infer<typeof weatherResponseSchema>;
export const weatherCapabilitiesSchema = z.strictObject({
  provider: z.literal("nasa-power"),
  adapterVersion: z.literal("3"),
  location: z.literal("source-cell-centre-not-farm-position"),
  temporalResolution: z.literal("daily"),
  timeStandard: z.literal("UTC"),
  earliestDate: calendarDateSchema,
  latestAllowedDate: calendarDateSchema,
  dateAvailability: z.literal("policy-bound-not-a-guarantee-of-complete-data"),
  maxDays: z.literal(MAX_WEATHER_DAYS),
  variables: z
    .array(
      z.strictObject({
        id: weatherVariableSchema,
        parameter: z.string(),
        sourceUnit: z.string(),
        unit: z.enum(["degC", "mm", "%", "m/s", "MJ/m2/day"]),
        definition: z.string(),
        earliestDate: calendarDateSchema,
        source: z.enum(["MERRA2", "SYN1DEG"]),
        sourceResolution: z.strictObject({
          latitudeDegrees: z.number().positive(),
          longitudeDegrees: z.number().positive(),
          basis: z.literal("documented-source-grid-not-field-resolution"),
        }),
      }),
    )
    .length(weatherVariables.length),
  warning: z.string(),
});
export type WeatherCapabilities = z.infer<typeof weatherCapabilitiesSchema>;
