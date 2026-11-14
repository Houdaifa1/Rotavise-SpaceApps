import { addDays, elapsedDays } from "../calendar/dates.js";

// Hot-path calendar arithmetic for the rotation search. Each distinct date is
// converted once through the Temporal boundary and cached as a day number, so
// results are identical to Temporal; the caches only avoid repeating work.
const EPOCH = "1900-01-01";
const numbers = new Map<string, number>();
const dates = new Map<number, string>();
export function dayNumber(date: string): number {
  let n = numbers.get(date);
  if (n === undefined) {
    n = elapsedDays(EPOCH, date);
    numbers.set(date, n);
    dates.set(n, date);
  }
  return n;
}
export function dateAt(n: number): string {
  let date = dates.get(n);
  if (date === undefined) {
    date = addDays(EPOCH, n);
    dates.set(n, date);
    numbers.set(date, n);
  }
  return date;
}
export const plusDays = (date: string, days: number) =>
  dateAt(dayNumber(date) + days);
export const daysBetween = (start: string, end: string) =>
  dayNumber(end) - dayNumber(start);
const leap = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
// Same month and day in another year; Feb 29 has no analog in common years.
export function shiftYears(date: string, years: number): string {
  const year = Number(date.slice(0, 4)) + years;
  const monthDay = date.slice(5);
  if (monthDay === "02-29" && !leap(year))
    throw new RangeError("CALENDAR_YEAR_OFFSET_INVALID");
  return `${String(year).padStart(4, "0")}-${monthDay}`;
}
// Return-interval anniversary that never shortens a break: Feb 29 moves to Mar 1.
export function anniversary(date: string, years: number): string {
  try {
    return shiftYears(date, years);
  } catch {
    return `${String(Number(date.slice(0, 4)) + years).padStart(4, "0")}-03-01`;
  }
}
