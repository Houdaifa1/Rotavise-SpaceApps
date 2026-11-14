import type { Language } from "./messages.js";
export function number(
  value: number,
  language: Language,
  maximumFractionDigits = 2,
) {
  if (!Number.isFinite(value))
    throw new RangeError("Expected a finite display value");
  return new Intl.NumberFormat(language, {
    maximumFractionDigits,
    numberingSystem: "latn",
  }).format(value);
}
export function calendarDate(value: string, language: Language) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new RangeError("Expected a calendar date");
  const date = new Date(`${value}T12:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  )
    throw new RangeError("Invalid calendar date");
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export type Unit =
  "ha" | "mm" | "°C" | "%" | "t/ha" | "Mg/ha" | "cm" | "m" | "km";
export function quantity(
  value: number,
  unit: Unit,
  language: Language,
  digits = 2,
) {
  return `${number(value, language, digits)}\u00a0${unit}`;
}
export function timestamp(
  value: string,
  language: Language,
  timeZone?: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))
    throw new RangeError("Expected an instant");
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr", {
    dateStyle: "long",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
    numberingSystem: "latn",
  }).format(new Date(value));
}
export function monthDay(value: string, language: Language) {
  // Leap year is only a formatting anchor; no growing-season date is inferred.
  const full = `2000-${value}`;
  calendarDate(full, language);
  return new Intl.DateTimeFormat(language === "en" ? "en-GB" : "fr", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${full}T12:00:00Z`));
}
export function lossPoints(value: number, language: Language) {
  if (value < 0 || value > 1)
    throw new RangeError("Expected a loss from zero to one");
  return number(Math.round(value * 100), language, 0);
}
