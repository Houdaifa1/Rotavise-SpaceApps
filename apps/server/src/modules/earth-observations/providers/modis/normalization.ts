import {
  invalid,
  moment,
  optionalNumber,
  table,
} from "../terrain/normalization.js";
import { MODIS_PRODUCT } from "./modis-request.js";

// AppEEARS point CSV for MOD13Q1.061. Column names follow the layout recorded
// for HLS and SMAP: the product with its dot turned into an underscore, then
// the layer name. They are unproven for this product until the first real run.
const PREFIX = MODIS_PRODUCT.replace(".", "_") + "_";
const NDVI = PREFIX + "_250m_16_days_NDVI";
const RELIABILITY = PREFIX + "_250m_16_days_pixel_reliability";
const COMPOSITE_DAY = PREFIX + "_250m_16_days_composite_day_of_the_year";
const DAY_MS = 86400000;
const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;
const plusDays = (date: string, days: number) =>
  new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) =>
  dayNumber(to) - dayNumber(from);
// MOD13Q1 pixel reliability: 0 good data, 1 marginal, 2 snow or ice, 3 cloudy.
// Only 0 is used; marginal pixels are dropped rather than repaired.
const GOOD = 0;

export type ModisReading = {
  date: string;
  ndvi: number;
  neighbourMean: number | null;
  neighbours: number;
};

// One reading per composite date at the centre point, with the mean of the
// neighbouring points that were also good that date. Fill values, NaN and
// anything outside the layer's valid range (-0.2 to 1) drop the row.
export function normalizeModis(
  raw: Uint8Array,
  centreId: string,
  pointIds: Set<string>,
): { datesSeen: number; readings: ModisReading[] } {
  const rows = table(raw, ["ID", "Date", NDVI, RELIABILITY, COMPOSITE_DAY]);
  // Keyed by the 16-day composite the row belongs to: each pixel reports its
  // own best day inside it, so the neighbours are matched by composite, not by
  // that day.
  const centre = new Map<string, { date: string; ndvi: number }>();
  const neighbours = new Map<string, number[]>();
  const seen = new Set<string>();
  for (const get of rows) {
    const id = get("ID");
    const when = moment.exec(get("Date"));
    if (!pointIds.has(id) || !when) throw invalid();
    const composite = when[1]!;
    if (id === centreId) seen.add(composite);
    const reliability = optionalNumber(get(RELIABILITY));
    const ndvi = optionalNumber(get(NDVI));
    const day = optionalNumber(get(COMPOSITE_DAY));
    if (reliability !== GOOD || ndvi === null || ndvi < -0.2 || ndvi > 1)
      continue;
    // The pixel's own acquisition day: the composite's year plus the day of
    // the year the layer reports, which must lie inside the 16-day composite.
    if (day === null || !Number.isInteger(day) || day < 1 || day > 366)
      continue;
    const date = plusDays(`${composite.slice(0, 4)}-01-01`, day - 1);
    const offset = daysBetween(composite, date);
    if (offset < 0 || offset > 16 || date.slice(0, 4) !== composite.slice(0, 4))
      continue;
    if (id === centreId) {
      const known = centre.get(composite);
      if (known && (known.date !== date || known.ndvi !== ndvi))
        throw invalid();
      centre.set(composite, { date, ndvi });
    } else
      neighbours.set(composite, [...(neighbours.get(composite) ?? []), ndvi]);
  }
  const readings = [...centre]
    .sort((a, b) => (a[1].date < b[1].date ? -1 : 1))
    .map(([composite, { date, ndvi }]) => {
      const near = neighbours.get(composite) ?? [];
      return {
        date,
        ndvi: Number(ndvi.toFixed(4)),
        neighbourMean: near.length
          ? Number((near.reduce((s, v) => s + v, 0) / near.length).toFixed(4))
          : null,
        neighbours: near.length,
      };
    });
  return { datesSeen: seen.size, readings };
}
