import { createHash } from "node:crypto";
import {
  calendarOrdinal,
  calendarYearLength,
  SCENARIO_ATTRIBUTION,
  scenarioUnitSchema,
  type ScenarioUnit,
  type ScenarioUnitIdentity,
} from "@rotavise/contracts";
import {
  numberAttribute,
  readNetcdf,
  readNumbers,
  textAttribute,
} from "./netcdf3.js";
export const SCENARIO_ADAPTER_VERSION = "1";
export class ScenarioError extends Error {
  constructor(
    readonly code:
      | "SCENARIO_UPSTREAM_UNAVAILABLE"
      | "SCENARIO_UPSTREAM_INVALID"
      | "SCENARIO_TIMEOUT"
      | "SCENARIO_CANCELLED"
      | "SCENARIO_STORAGE_UNAVAILABLE",
  ) {
    super(code);
  }
}
export function scenarioFileName(identity: ScenarioUnitIdentity) {
  const { model, experiment, variable, year } = identity;
  return `${variable}_day_${model.id}_${experiment}_${model.variant}_${model.grid}_${year}_v2.0.nc`;
}
const KELVIN = 273.15;
const SECONDS_PER_DAY = 86400;
// Validates a tile response against the requested unit and converts it to
// °C per cell and model-calendar day. Any mismatch is invalid evidence.
export function normalizeScenario(
  raw: Uint8Array,
  identity: ScenarioUnitIdentity,
  retrievedAt: string,
  // Test fixtures mark themselves synthetic; production refuses them.
  allowSynthetic = false,
): { unit: ScenarioUnit; synthetic: boolean } {
  try {
    const file = readNetcdf(raw);
    const synthetic = /synthetic/i.test(
      textAttribute(file.attributes, "comment") ?? "",
    );
    if (synthetic && !allowSynthetic) throw new Error("synthetic");
    const { model, experiment, variable, year, tile } = identity;
    const days = calendarYearLength(model.calendar, year);
    const global = (key: string) => textAttribute(file.attributes, key);
    if (
      global("activity") !== "NEX-GDDP-CMIP6" ||
      global("version") !== "2.0" ||
      global("frequency") !== "day" ||
      global("cmip6_source_id") !== model.id ||
      global("variant_label") !== model.variant ||
      global("scenario") !== experiment ||
      // NASA's rain files declare CC-BY 4.0, its temperature files CC-BY-SA 4.0.
      global("cmip6_license") !==
        (variable === "pr" ? "CC-BY 4.0" : "CC-BY-SA 4.0")
    )
      throw new Error("metadata");
    if (
      file.dimensions.size !== 3 ||
      file.dimensions.get("lat") !== 4 ||
      file.dimensions.get("lon") !== 4 ||
      file.dimensions.get("time") !== days ||
      file.variables.size !== 4
    )
      throw new Error("shape");
    const lat = readNumbers(file, "lat");
    const lon = readNumbers(file, "lon");
    const time = readNumbers(file, "time");
    for (let i = 0; i < 4; i++) {
      // Longitudes are published east of Greenwich, 0–360°.
      const east = lon[i]! > 180 ? lon[i]! - 360 : lon[i]!;
      if (
        lat[i] !== tile.latitude + 0.125 + i * 0.25 ||
        east !== tile.longitude + 0.125 + i * 0.25
      )
        throw new Error("grid");
    }
    // Files count days from different origins (1850 or 2015 observed), in
    // the model calendar, written "1850-01-01" or "1850-1-1" (both CF);
    // each day is stamped at noon.
    const timeVariable = file.variables.get("time")!;
    const units = /^days since (\d{4})-(\d{1,2})-(\d{1,2})( 00:00:00)?$/.exec(
      textAttribute(timeVariable.attributes, "units") ?? "",
    );
    const epoch = units
      ? calendarOrdinal(
          model.calendar,
          Number(units[1]),
          Number(units[2]),
          Number(units[3]),
        )
      : null;
    const first = calendarOrdinal(model.calendar, year, 1, 1);
    if (
      textAttribute(timeVariable.attributes, "calendar") !== model.calendar ||
      epoch === null ||
      first === null
    )
      throw new Error("time");
    for (let k = 0; k < days; k++)
      if (time[k] !== first - epoch + k + 0.5) throw new Error("time");
    const data = file.variables.get(variable);
    if (
      !data ||
      JSON.stringify(data.dimensions) !== '["time","lat","lon"]' ||
      textAttribute(data.attributes, "units") !==
        (variable === "pr" ? "kg m-2 s-1" : "K")
    )
      throw new Error("variable");
    const fill = numberAttribute(data.attributes, "_FillValue");
    const missing = numberAttribute(data.attributes, "missing_value");
    const numbers = readNumbers(file, variable);
    const cells: ScenarioUnit["cells"] = [];
    const values: ScenarioUnit["values"] = [];
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        cells.push({
          latitude: tile.latitude + 0.125 + i * 0.25,
          longitude: tile.longitude + 0.125 + j * 0.25,
        });
        const series: (number | null)[] = [];
        for (let k = 0; k < days; k++) {
          const v = numbers[k * 16 + i * 4 + j]!;
          if (v === fill || v === missing || Number.isNaN(v)) series.push(null);
          else
            series.push(
              variable === "pr"
                ? Math.max(0, Number((v * SECONDS_PER_DAY).toFixed(3)))
                : Number((v - KELVIN).toFixed(3)),
            );
        }
        values.push(series);
      }
    const unit = scenarioUnitSchema.parse({
      schemaVersion: 1,
      identity,
      cells,
      values,
      provenance: {
        provider: "nccs-thredds-ncss",
        adapterVersion: SCENARIO_ADAPTER_VERSION,
        sourceFile: scenarioFileName(identity),
        retrievedAt,
        rawSha256: createHash("sha256").update(raw).digest("hex"),
        sourceUnit: variable === "pr" ? "kg m-2 s-1" : "K",
        unit: variable === "pr" ? "mm/day" : "degC",
        licence:
          variable === "pr"
            ? "File metadata: CC-BY 4.0 (cmip6_license); AWS registry: CC0 since 2022-09"
            : "File metadata: CC-BY-SA 4.0 (cmip6_license); AWS registry: CC0 since 2022-09",
        attribution: SCENARIO_ATTRIBUTION,
      },
    });
    return { unit, synthetic };
  } catch {
    throw new ScenarioError("SCENARIO_UPSTREAM_INVALID");
  }
}
