import type { WhatIf, WhatIfResult } from "@rotavise/contracts";
import { addDays } from "../calendar/dates.js";
import type { ClimateSource, Series } from "./climate.js";

export const WHAT_IF_LABEL =
  "What-if test with your own assumptions. It is not a forecast.";
export function whatIfActive(whatIf: WhatIf | undefined): whatIf is WhatIf {
  return (
    whatIf !== undefined &&
    (whatIf.rainfall_change_percent !== 0 ||
      whatIf.temperature_change_c !== 0 ||
      whatIf.sowing_shift_days !== 0)
  );
}
// A climate source with the what-if's rain and temperature changes applied to
// its daily values. Rain scales by a factor and temperature shifts by a
// constant, so missing days (NaN) stay missing and every run gives the same
// numbers. The input source is never modified.
export function applyWhatIfToSource(
  source: ClimateSource,
  whatIf: WhatIf,
): ClimateSource {
  const delta = whatIf.temperature_change_c;
  const factor = 1 + whatIf.rainfall_change_percent / 100;
  const series = {} as Series;
  for (const key of Object.keys(source.series) as (keyof Series)[]) {
    const from = source.series[key];
    series[key] = delta === 0 ? from : from.map((v) => v + delta);
  }
  return {
    ...source,
    series,
    ...(source.water
      ? {
          water: {
            ...source.water,
            rain:
              factor === 1
                ? source.water.rain
                : source.water.rain.map((v) => v * factor),
          },
        }
      : {}),
  };
}
// The first-sowing range moved by the what-if's days.
export function shiftPlanning(
  planning: { earliest_start_date: string; latest_start_date: string },
  whatIf: WhatIf,
) {
  const days = whatIf.sowing_shift_days;
  return days === 0
    ? planning
    : {
        earliest_start_date: addDays(planning.earliest_start_date, days),
        latest_start_date: addDays(planning.latest_start_date, days),
      };
}
// The block that labels a result as a what-if test.
export function whatIfBlock(
  whatIf: WhatIf,
  requested: { earliest_start_date: string; latest_start_date: string },
  futureModelWorlds: WhatIfResult["appliedTo"]["futureModelWorlds"],
): WhatIfResult {
  const effective = shiftPlanning(requested, whatIf);
  return {
    kind: "what_if",
    notAForecast: true,
    label: WHAT_IF_LABEL,
    rainfallChangePercent: whatIf.rainfall_change_percent,
    temperatureChangeC: whatIf.temperature_change_c,
    sowingShiftDays: whatIf.sowing_shift_days,
    appliedTo: { historicalWeather: true, futureModelWorlds },
    planning: {
      requestedEarliestStartDate: requested.earliest_start_date,
      requestedLatestStartDate: requested.latest_start_date,
      effectiveEarliestStartDate: effective.earliest_start_date,
      effectiveLatestStartDate: effective.latest_start_date,
    },
  };
}
