import { z } from "zod";

// NEX-GDDP-CMIP6 v2.0 daily downscaled projections (0.25°), read through the
// NCCS THREDDS NetCDF Subset Service one 1° × 1° tile, model, experiment,
// variable and year at a time. No farmer position is sent or stored: requests
// name a tile and the engine reads the 0.25° cell that contains the field.
export const SCENARIO_DATASET = "NEX-GDDP-CMIP6";
export const SCENARIO_DATASET_VERSION = "2.0";
export const SCENARIO_ATTRIBUTION =
  "NASA Earth Exchange Global Daily Downscaled Projections (NEX-GDDP-CMIP6) v2.0, NASA Center for Climate Simulation; Thrasher et al. 2022, Scientific Data 9, 262; https://www.nccs.nasa.gov/services/data-collections/land-based-products/nex-gddp-cmip6";
export const scenarioCalendars = [
  "standard",
  "proleptic_gregorian",
  "365_day",
  "360_day",
] as const;
export const scenarioCalendarSchema = z.enum(scenarioCalendars);
export type ScenarioCalendar = z.infer<typeof scenarioCalendarSchema>;
export const scenarioExperiments = ["historical", "ssp245", "ssp585"] as const;
export const scenarioExperimentSchema = z.enum(scenarioExperiments);
export type ScenarioExperiment = z.infer<typeof scenarioExperimentSchema>;
// Daily near-surface air temperature in °C and precipitation in mm/day, after
// conversion.
export const scenarioVariables = ["tasmin", "tasmax", "tas", "pr"] as const;
export const scenarioVariableSchema = z.enum(scenarioVariables);
export type ScenarioVariable = z.infer<typeof scenarioVariableSchema>;
const name = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,39}$/);
export const scenarioModelSchema = z.strictObject({
  id: name,
  variant: z.string().regex(/^r\d+i\d+p\d+f\d+$/),
  grid: z.string().regex(/^g[a-z0-9]{1,6}$/),
  calendar: scenarioCalendarSchema,
});
export type ScenarioModel = z.infer<typeof scenarioModelSchema>;
// A tile is named by its south-west corner in whole degrees.
export const scenarioTileSchema = z.strictObject({
  latitude: z.number().int().min(-60).max(89),
  longitude: z.number().int().min(-180).max(179),
});
export type ScenarioTile = z.infer<typeof scenarioTileSchema>;
export const scenarioUnitIdentitySchema = z.strictObject({
  dataset: z.literal(SCENARIO_DATASET),
  datasetVersion: z.literal(SCENARIO_DATASET_VERSION),
  model: scenarioModelSchema,
  experiment: scenarioExperimentSchema,
  variable: scenarioVariableSchema,
  year: z.number().int().min(1950).max(2100),
  tile: scenarioTileSchema,
});
export type ScenarioUnitIdentity = z.infer<typeof scenarioUnitIdentitySchema>;
const centre = (n: number) => Number.isInteger((n - 0.125) / 0.25);
const cellSchema = z
  .strictObject({
    latitude: z.number().min(-60).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .refine((c) => centre(c.latitude) && centre(c.longitude), "Not a centre");
// The 0.25° cell (and its tile) containing a point.
export function scenarioCell(latitude: number, longitude: number) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -60 ||
    latitude > 90 ||
    Math.abs(longitude) > 180
  )
    throw new RangeError("SCENARIO_COORDINATE_INVALID");
  const lat = Math.min(Math.floor(latitude * 4), 359);
  const lon = longitude === 180 ? -720 : Math.floor(longitude * 4);
  return {
    cell: { latitude: lat / 4 + 0.125, longitude: lon / 4 + 0.125 },
    tile: { latitude: Math.floor(lat / 4), longitude: Math.floor(lon / 4) },
  };
}
export const scenarioUnitSchema = z
  .strictObject({
    schemaVersion: z.literal(1),
    identity: scenarioUnitIdentitySchema,
    // Cells are ordered by latitude, then longitude; values per cell per
    // calendar day of the model year; null marks the source fill value.
    cells: z.array(cellSchema).length(16),
    values: z
      .array(
        z.array(z.number().min(-90).max(5000).nullable()).min(360).max(366),
      )
      .length(16),
    provenance: z.strictObject({
      provider: z.literal("nccs-thredds-ncss"),
      adapterVersion: z.literal("1"),
      sourceFile: z.string().regex(/^[A-Za-z0-9_.-]{1,120}\.nc$/),
      retrievedAt: z.iso.datetime({ offset: false }),
      rawSha256: z.string().regex(/^[a-f0-9]{64}$/),
      sourceUnit: z.enum(["K", "kg m-2 s-1"]),
      unit: z.enum(["degC", "mm/day"]),
      licence: z.enum([
        "File metadata: CC-BY-SA 4.0 (cmip6_license); AWS registry: CC0 since 2022-09",
        "File metadata: CC-BY 4.0 (cmip6_license); AWS registry: CC0 since 2022-09",
      ]),
      attribution: z.literal(SCENARIO_ATTRIBUTION),
    }),
  })
  .superRefine((unit, ctx) => {
    const { model, year, tile } = unit.identity;
    const expected = calendarYearLength(model.calendar, year);
    const rain = unit.identity.variable === "pr";
    if (
      unit.provenance.unit !== (rain ? "mm/day" : "degC") ||
      unit.provenance.sourceUnit !== (rain ? "kg m-2 s-1" : "K") ||
      unit.values.some((series) =>
        series.some((v) => v !== null && (rain ? v < 0 : v > 70)),
      )
    )
      ctx.addIssue({ code: "custom", message: "Inconsistent scenario unit" });
    const keys = unit.cells.map((c) => `${c.latitude},${c.longitude}`);
    const want: string[] = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++)
        want.push(
          `${tile.latitude + 0.125 + i * 0.25},${tile.longitude + 0.125 + j * 0.25}`,
        );
    if (
      JSON.stringify(keys) !== JSON.stringify(want) ||
      unit.values.some((v) => v.length !== expected)
    )
      ctx.addIssue({ code: "custom", message: "Inconsistent scenario unit" });
  });
export type ScenarioUnit = z.infer<typeof scenarioUnitSchema>;
export function calendarYearLength(calendar: ScenarioCalendar, year: number) {
  if (calendar === "360_day") return 360;
  if (calendar === "365_day") return 365;
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
}
// One plan's view of a unit: the field cell's series, with the unit hash so
// the engine output can be traced to stored evidence.
export const scenarioSeriesSchema = z.strictObject({
  unitId: z.uuid(),
  normalizedSha256: z.string().regex(/^[a-f0-9]{64}$/),
  synthetic: z.boolean(),
  model: scenarioModelSchema,
  experiment: scenarioExperimentSchema,
  variable: scenarioVariableSchema,
  year: z.number().int().min(1950).max(2100),
  cell: cellSchema,
  values: z.array(z.number().min(-90).max(5000).nullable()).min(360).max(366),
});
export type ScenarioSeries = z.infer<typeof scenarioSeriesSchema>;
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
// Days since 1850-01-01 in a model calendar, or null when the date does not
// exist there (29 February in a 365-day year; day 31 in a 360-day year).
export function calendarOrdinal(
  calendar: ScenarioCalendar,
  year: number,
  month: number,
  day: number,
): number | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1
  )
    return null;
  if (calendar === "360_day")
    return day > 30 ? null : (year - 1850) * 360 + (month - 1) * 30 + day - 1;
  if (calendar === "365_day") {
    if (day > MONTH_DAYS[month - 1]!) return null;
    let days = (year - 1850) * 365 + day - 1;
    for (let m = 1; m < month; m++) days += MONTH_DAYS[m - 1]!;
    return days;
  }
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day)
    return null;
  return (time - Date.UTC(1850, 0, 1)) / 86400000;
}
// Where a real calendar date falls in a model calendar. A 360-day calendar
// has no day 31, so the 31st maps to the 30th; other missing dates stay null.
export function modelDayOrdinal(calendar: ScenarioCalendar, date: string) {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return calendarOrdinal(
    calendar,
    y,
    m,
    calendar === "360_day" ? Math.min(d, 30) : d,
  );
}
