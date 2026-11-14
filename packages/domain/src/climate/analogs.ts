import type {
  HistoricalAnalog,
  HistoricalPolicy,
  SequenceSchedule,
  CropCycle,
} from "@rotavise/contracts";
import { shiftCalendarYears, addDays } from "../calendar/dates.js";
import {
  cycleExposures,
  conservativeExposureLoss,
  type TemperatureRule,
} from "./temperature.js";
import { measureWindow, type WeatherIndex } from "./weather.js";

export function historicalAnalogs(
  schedule: SequenceSchedule,
  index: WeatherIndex,
  policy: HistoricalPolicy,
  rules: [TemperatureRule[], TemperatureRule[]],
): HistoricalAnalog[] {
  const result: HistoricalAnalog[] = [];
  for (
    let year = policy.firstAnchorYear;
    year <= policy.lastAnchorYear;
    year++
  ) {
    const offset = year - Number(schedule.first.sownOn.slice(0, 4));
    const shift = (d: string) => shiftCalendarYears(d, offset);
    // Resolve every boundary before spending work or creating a partial analog.
    try {
      for (const [i, c] of [schedule.first, schedule.second].entries()) {
        shift(c.sownOn);
        shift(c.harvestEarliest);
        shift(c.harvestLatest);
        for (const r of rules[i]!)
          if (r.stageWindow) {
            shift(addDays(c.sownOn, r.stageWindow.startDay));
            shift(addDays(c.sownOn, r.stageWindow.endDay));
          }
      }
      const measured = [schedule.first, schedule.second].map(
        (c: CropCycle, i) => ({
          cropId: c.cropId,
          earliest: measureWindow(
            index,
            shift(c.sownOn),
            shift(c.harvestEarliest),
          ),
          latest: measureWindow(index, shift(c.sownOn), shift(c.harvestLatest)),
          exposures: cycleExposures(index, rules[i]!, c, offset),
        }),
      ) as NonNullable<HistoricalAnalog["cycles"]>;
      const complete = measured.every(
        (c) =>
          [c.earliest, c.latest].every((w) =>
            w.coverage.every((v) => v.missingDates.length === 0),
          ) && c.exposures.every((e) => e.outsideFraction !== null),
      );
      const losses = measured.map((c) => conservativeExposureLoss(c.exposures));
      result.push({
        anchorYear: year,
        status: complete ? "complete" : "incomplete",
        cycles: measured,
        climateLoss:
          complete && losses.every((l) => l !== null)
            ? (losses[0]! + losses[1]!) / 2
            : null,
      });
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      result.push({
        anchorYear: year,
        status: "leap_boundary_unavailable",
        cycles: null,
        climateLoss: null,
      });
    }
  }
  return result;
}
