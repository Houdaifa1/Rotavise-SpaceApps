import type { CatalogRuleV2 } from "@rotavise/contracts";
import { daysBetween, plusDays } from "./days.js";

export type WindowRule = Extract<CatalogRuleV2, { metric: "planting_window" }>;
export type Occurrence = { start: string; end: string; ruleIds: string[] };
const leap = (year: number) =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
// Feb 29 boundaries in common years: a start moves to Mar 1, an end to Feb 28,
// so a window never grows.
function at(year: number, monthDay: string, edge: "start" | "end") {
  if (monthDay === "02-29" && !leap(year))
    return `${String(year).padStart(4, "0")}-${edge === "start" ? "03-01" : "02-28"}`;
  return `${String(year).padStart(4, "0")}-${monthDay}`;
}
// Concrete sowing windows overlapping [from, to], earliest first. Windows that
// cross the year end belong to the year in which they start.
export function occurrences(
  rules: WindowRule[],
  from: string,
  to: string,
): Occurrence[] {
  const first = Number(from.slice(0, 4)) - 1,
    last = Number(to.slice(0, 4));
  const found = new Map<string, Occurrence>();
  for (const rule of rules)
    for (let year = first; year <= last; year++) {
      const start = at(year, rule.start, "start");
      const end = at(rule.start <= rule.end ? year : year + 1, rule.end, "end");
      if (end < from || start > to || start > end) continue;
      const key = `${start}/${end}`;
      const existing = found.get(key);
      if (existing)
        existing.ruleIds = [...new Set([...existing.ruleIds, rule.id])].sort();
      else found.set(key, { start, end, ruleIds: [rule.id] });
    }
  return [...found.values()].sort((a, b) =>
    a.start < b.start
      ? -1
      : a.start > b.start
        ? 1
        : a.end < b.end
          ? -1
          : a.end > b.end
            ? 1
            : 0,
  );
}
// Weekly representative sowing dates inside [start, end], always including both ends.
export function representativeDates(start: string, end: string, step: number) {
  const dates = new Set<string>([start, end]);
  const span = daysBetween(start, end);
  for (let d = step; d < span; d += step) dates.add(plusDays(start, d));
  return [...dates].sort();
}
