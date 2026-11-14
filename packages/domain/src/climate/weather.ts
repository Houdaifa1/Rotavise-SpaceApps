import {
  historicalWeatherEvidenceSchema,
  powerCell,
  climateWeatherVariables,
  weatherWindowSchema,
  type HistoricalWeatherEvidence,
  type WeatherVariable,
  type WeatherWindow,
} from "@rotavise/contracts";
import { addDays, calendarDays } from "../calendar/dates.js";
import { normalizedWeatherHash } from "../evidence/identity.js";
import { compare } from "../constraints/reasons.js";

export const historicalLimits = Object.freeze({
  snapshotDays: 20000,
  variableDayVisits: 2000000,
  outputBytes: 8388608,
});
export class HistoricalInputError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}
export class HistoricalLimitError extends Error {
  constructor(
    public readonly code: string,
    public readonly limit: number,
  ) {
    super(code);
  }
}
export class AnalysisBudget {
  private visits = 0;
  private bytes = 0;
  visit(count: number) {
    this.visits += count;
    if (this.visits > historicalLimits.variableDayVisits)
      throw new HistoricalLimitError(
        "CLIMATE_WORK_LIMIT",
        historicalLimits.variableDayVisits,
      );
  }
  consume(value: unknown) {
    this.bytes += new TextEncoder().encode(JSON.stringify(value)).byteLength;
    if (this.bytes > historicalLimits.outputBytes)
      throw new HistoricalLimitError(
        "CLIMATE_OUTPUT_LIMIT",
        historicalLimits.outputBytes,
      );
  }
}
type Cell = { value: number | null; snapshotIds: string[] };
export type WeatherIndex = {
  days: Map<string, Partial<Record<WeatherVariable, Cell>>>;
  evidence: HistoricalWeatherEvidence;
  budget: AnalysisBudget;
};
type ClimateVariable = (typeof climateWeatherVariables)[number];
const parameters: Record<ClimateVariable, string> = {
  temperatureMin: "T2M_MIN",
  temperatureMax: "T2M_MAX",
  temperatureMean: "T2M",
  precipitation: "PRECTOTCORR",
};
export function indexWeather(
  input: unknown,
  location: { latitude: number; longitude: number },
  assessedOn: string,
  allowSynthetic = false,
  budget = new AnalysisBudget(),
): WeatherIndex {
  const parsed = historicalWeatherEvidenceSchema.safeParse(input);
  if (!parsed.success)
    throw new HistoricalInputError("CLIMATE_EVIDENCE_INVALID");
  const evidence = parsed.data.sort((a, b) =>
    compare(a.snapshotId, b.snapshotId),
  );
  if (!allowSynthetic && evidence.some((e) => e.synthetic))
    throw new HistoricalInputError("CLIMATE_SYNTHETIC_REJECTED");
  if (new Set(evidence.map((e) => e.snapshotId)).size !== evidence.length)
    throw new HistoricalInputError("CLIMATE_DUPLICATE_SNAPSHOT");
  if (
    evidence.reduce((n, e) => n + e.snapshot.days.length, 0) >
    historicalLimits.snapshotDays
  )
    throw new HistoricalLimitError(
      "CLIMATE_SNAPSHOT_DAY_LIMIT",
      historicalLimits.snapshotDays,
    );
  const latest = addDays(assessedOn, -120);
  // Adapter 3 evidence uses the POWER cell centre; older evidence used the
  // exact location. The provenance signature below keeps one adapter.
  const cell = powerCell(location.latitude, location.longitude);
  const days: WeatherIndex["days"] = new Map();
  let identity: string | null = null;
  const definitions = new Map<WeatherVariable, string>();
  for (const e of evidence) {
    const { request, provenance, days: rows } = e.snapshot;
    if (
      request.variables.some(
        (v) => !climateWeatherVariables.includes(v as ClimateVariable),
      )
    )
      throw new HistoricalInputError("CLIMATE_UNSUPPORTED_VARIABLE");
    if (normalizedWeatherHash(e.snapshot) !== e.normalizedSha256)
      throw new HistoricalInputError("CLIMATE_HASH_MISMATCH");
    const site = provenance.adapterVersion === "3" ? cell : location;
    if (
      request.latitude !== site.latitude ||
      request.longitude !== site.longitude
    )
      throw new HistoricalInputError("CLIMATE_LOCATION_MISMATCH");
    if (request.endDate > latest)
      throw new HistoricalInputError("CLIMATE_HISTORY_LAG_VIOLATION");
    if (provenance.retrievedAt.slice(0, 10) > assessedOn)
      throw new HistoricalInputError("CLIMATE_RETRIEVAL_DATE_INVALID");
    if (
      Math.abs(provenance.responseCoordinates[0] - site.longitude) > 0.001 ||
      Math.abs(provenance.responseCoordinates[1] - site.latitude) > 0.001 ||
      new Set(provenance.sources).size !== provenance.sources.length ||
      !provenance.sources.includes("MERRA2") ||
      provenance.sources.some((s) => s !== "MERRA2" && s !== "POWER")
    )
      throw new HistoricalInputError("CLIMATE_PROVENANCE_MISMATCH");
    const signature = JSON.stringify([
      provenance.provider,
      provenance.adapterVersion,
      provenance.apiVersion,
      provenance.timeStandard,
      [...provenance.sources].sort(compare),
      provenance.responseCoordinates,
    ]);
    if (identity !== null && identity !== signature)
      throw new HistoricalInputError("CLIMATE_PROVENANCE_MISMATCH");
    identity = signature;
    for (const definition of provenance.variables) {
      if (
        !climateWeatherVariables.includes(
          definition.variable as ClimateVariable,
        ) ||
        definition.parameter !==
          parameters[definition.variable as ClimateVariable] ||
        definition.sourceUnit !==
          (definition.variable === "precipitation" ? "mm/day" : "C")
      )
        throw new HistoricalInputError("CLIMATE_PARAMETER_MISMATCH");
      const key = JSON.stringify([
        definition.parameter,
        definition.sourceUnit,
        definition.unit,
        definition.definition,
      ]);
      if (
        definitions.has(definition.variable) &&
        definitions.get(definition.variable) !== key
      )
        throw new HistoricalInputError("CLIMATE_PROVENANCE_MISMATCH");
      definitions.set(definition.variable, key);
    }
    for (const row of rows) {
      const stored = days.get(row.date) ?? {};
      for (const v of request.variables) {
        const value = row.values[v]!;
        if (v === "precipitation" && value !== null && value < 0)
          throw new HistoricalInputError("CLIMATE_PHYSICAL_VALUE_INVALID");
        const old = stored[v];
        if (old && old.value !== value)
          throw new HistoricalInputError("CLIMATE_OVERLAP_CONFLICT");
        stored[v] = {
          value,
          snapshotIds: old
            ? [...old.snapshotIds, e.snapshotId]
            : [e.snapshotId],
        };
      }
      const min = stored.temperatureMin?.value,
        max = stored.temperatureMax?.value,
        mean = stored.temperatureMean?.value;
      if (
        (typeof min === "number" && typeof max === "number" && min > max) ||
        (typeof mean === "number" &&
          typeof min === "number" &&
          mean < min - 0.01) ||
        (typeof mean === "number" &&
          typeof max === "number" &&
          mean > max + 0.01)
      )
        throw new HistoricalInputError("CLIMATE_PHYSICAL_VALUE_INVALID");
      days.set(row.date, stored);
    }
  }
  return { days, evidence, budget };
}
export function measureWindow(
  index: WeatherIndex,
  startDate: string,
  endDate: string,
): WeatherWindow {
  const dates = calendarDays(startDate, endDate);
  if (dates.length > 732)
    throw new HistoricalInputError("CLIMATE_WINDOW_INVALID");
  index.budget.visit(dates.length * 4);
  const metrics: WeatherWindow["metrics"] = {
    temperatureMin: null,
    temperatureMax: null,
    temperatureMean: null,
    precipitation: null,
  };
  const coverage: WeatherWindow["coverage"] = [];
  for (const variable of climateWeatherVariables) {
    const values: number[] = [],
      missingDates: string[] = [],
      snapshotIds = new Set<string>();
    for (const date of dates) {
      const cell = index.days.get(date)?.[variable];
      if (cell) for (const id of cell.snapshotIds) snapshotIds.add(id);
      if (!cell || cell.value === null) missingDates.push(date);
      else values.push(cell.value);
    }
    coverage.push({
      variable,
      observedDays: values.length,
      missingDates,
      snapshotIds: [...snapshotIds].sort(compare),
    });
    // Partial totals/runs would falsely look low. Retain coverage, return null.
    if (missingDates.length) continue;
    const total = values.reduce((a, b) => a + b, 0);
    if (variable !== "precipitation")
      metrics[variable] = {
        min: Math.min(...values),
        max: Math.max(...values),
        mean: total / values.length,
        unit: "degC",
      };
    else {
      let dryDays = 0,
        run = 0,
        longest = 0;
      for (const value of values) {
        run = value < 1 ? run + 1 : 0;
        if (value < 1) dryDays++;
        longest = Math.max(longest, run);
      }
      metrics.precipitation = {
        totalMm: total,
        meanMmPerDay: total / values.length,
        dryDays,
        longestDrySpellDays: longest,
      };
    }
  }
  return weatherWindowSchema.parse({
    startDate,
    endDate,
    expectedDays: dates.length,
    coverage,
    metrics,
  });
}
