import type { CatalogRule } from "@rotavise/contracts";
type WindowRule = Extract<CatalogRule, { metric: "planting_window" }>;

// Internal fast path: dates come from calendarDays and rules from strict catalog
// validation. Avoid reparsing every date and boundary inside the Cartesian search.
export function matchingWindows(
  date: string,
  rules: WindowRule[],
): WindowRule[] {
  const monthDay = date.slice(5);
  return rules.filter((r) =>
    r.start <= r.end
      ? monthDay >= r.start && monthDay <= r.end
      : monthDay >= r.start || monthDay <= r.end,
  );
}
