// Development-only visual specimens. These describe interface geometry, never
// weather, crop performance, income or a recommendation. Not in production.
import type { ChartSeries } from "../../../../apps/web/src/design/primitives/SeriesChart.js";
export const verificationWidths = [390, 768, 1024, 1440];
export function widthSeries(
  label: string,
  trend: string,
  partial = false,
): ChartSeries[] {
  return [
    {
      id: "widths",
      label,
      kind: "water",
      points: verificationWidths.map((value, i) => ({
        x: i,
        value: partial && i === 1 ? null : value,
        label: `${value} px`,
        low: value - 20,
        high: value + 20,
        end: i + 0.65,
      })),
      summary: { min: 390, max: 1440, latest: 1440, trend },
    },
  ];
}
export const referenceDates = ["2026-11-10", "2026-11-11"];
