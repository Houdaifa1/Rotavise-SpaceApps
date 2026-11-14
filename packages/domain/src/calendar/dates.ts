import { Temporal } from "@js-temporal/polyfill";

function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new RangeError("CALENDAR_DATE_INVALID");
  return Temporal.PlainDate.from(value, { overflow: "reject" });
}
export function addDays(value: string, days: number): string {
  if (!Number.isSafeInteger(days))
    throw new RangeError("CALENDAR_DAY_COUNT_INVALID");
  return date(value).add({ days }).toString();
}
export function elapsedDays(start: string, end: string): number {
  return date(start).until(date(end), { largestUnit: "day" }).days;
}
// Historical analogs keep month/day boundaries. An invalid leap boundary is rejected.
export function shiftCalendarYears(value: string, years: number): string {
  if (!Number.isSafeInteger(years) || Math.abs(years) > 300)
    throw new RangeError("CALENDAR_YEAR_OFFSET_INVALID");
  return date(value).add({ years }, { overflow: "reject" }).toString();
}
export function calendarDays(start: string, end: string): string[] {
  const count = elapsedDays(start, end) + 1;
  if (count < 1 || count > 1097) throw new RangeError("CALENDAR_RANGE_INVALID");
  let current = date(start);
  return Array.from({ length: count }, () => {
    const value = current.toString();
    current = current.add({ days: 1 });
    return value;
  });
}
export function inRecurringWindow(
  value: string,
  start: string,
  end: string,
): boolean {
  date(value);
  for (const boundary of [start, end]) date(`2000-${boundary}`);
  const md = value.slice(5);
  return start <= end ? md >= start && md <= end : md >= start || md <= end;
}
export function conservativeAnniversary(value: string, years: number): string {
  if (!Number.isInteger(years) || years < 1 || years > 20)
    throw new RangeError("RETURN_YEARS_INVALID");
  const original = date(value);
  try {
    return original.add({ years }, { overflow: "reject" }).toString();
  } catch (error) {
    if (
      !(error instanceof RangeError) ||
      original.month !== 2 ||
      original.day !== 29
    )
      throw error;
    // Never shorten the break by silently clamping a leap anniversary to Feb 28.
    return Temporal.PlainDate.from(
      { year: original.year + years, month: 3, day: 1 },
      { overflow: "reject" },
    ).toString();
  }
}
// Calendar years forward; Feb 29 becomes Feb 28, the earlier and so shorter horizon.
export function addYearsConstrained(value: string, years: number): string {
  if (!Number.isSafeInteger(years) || Math.abs(years) > 300)
    throw new RangeError("CALENDAR_YEAR_OFFSET_INVALID");
  return date(value).add({ years }, { overflow: "constrain" }).toString();
}
