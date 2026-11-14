import type { PixelObservation } from "@rotavise/domain";
import { ObservationError } from "./appeears/appeears.client.js";

// Strict RFC 4180 reader: quoted fields, doubled quotes, CRLF or LF. Rows must
// all have the header's width.
export function parseCsv(text: string, maxRows = 200000): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    i = 0;
  const end = () => {
    row.push(field);
    field = "";
  };
  while (i < text.length) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
      } else field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") quoted = true;
    else if (c === ",") end();
    else if (c === "\n" || c === "\r") {
      end();
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (rows.length > maxRows)
        throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    } else field += c;
    i++;
  }
  if (quoted) throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
  if (field !== "" || row.length) {
    end();
    if (row.some((v) => v !== "")) rows.push(row);
  }
  return rows;
}
const decode = (raw: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
  }
};
const date = /^\d{4}-\d{2}-\d{2}$/;
function table(raw: Uint8Array, required: string[]) {
  const rows = parseCsv(decode(raw));
  const header = rows[0];
  if (!header || required.some((h) => !header.includes(h)))
    throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
  const at = Object.fromEntries(required.map((h) => [h, header.indexOf(h)]));
  return rows.slice(1).map((r) => {
    if (r.length !== header.length)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    return (h: string) => r[at[h]!]!;
  });
}
const number = (v: string) => {
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(v))
    throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
  return Number(v);
};
// One AppEEARS HLS results file (HLSS30.020 with B8A or HLSL30.020 with B05).
// Reflectance arrives scaled; the fill value (-9999 before scaling) and
// out-of-range values are dropped, never repaired.
export function normalizeHls(
  raw: Uint8Array,
  product: "HLSS30.020" | "HLSL30.020",
  pointIds: Set<string>,
): PixelObservation[] {
  const p = product === "HLSS30.020" ? "HLSS30_020_" : "HLSL30_020_";
  const nirBand = product === "HLSS30.020" ? "B8A" : "B05";
  const rows = table(raw, ["ID", "Date", p + "B04", p + nirBand, p + "Fmask"]);
  const out: PixelObservation[] = [];
  for (const get of rows) {
    const id = get("ID"),
      day = get("Date");
    if (!pointIds.has(id) || !date.test(day))
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const fmaskText = get(p + "Fmask");
    if (fmaskText === "") continue;
    const fmask = number(fmaskText);
    if (!Number.isInteger(fmask) || fmask < 0 || fmask > 255)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    if (fmask === 255) continue;
    const red = number(get(p + "B04")),
      nir = number(get(p + nirBand));
    if (red < -0.2 || red > 1.6 || nir < -0.2 || nir > 1.6) continue;
    out.push({
      pointId: id,
      date: day,
      sensor: product === "HLSS30.020" ? "sentinel-2" : "landsat",
      red,
      nir,
      fmask,
    });
  }
  return out;
}
// AppEEARS SPL4SMGP.008 (3-hourly) to daily means for the single 9 km cell.
export function normalizeSmap(raw: Uint8Array) {
  const p = "SPL4SMGP_008_";
  const rows = table(raw, [
    "Date",
    p + "Line_Y_9.00805km",
    p + "Sample_X_9.00805km",
    p + "Geophysical_Data_sm_rootzone",
    p + "Geophysical_Data_sm_rootzone_pctl",
  ]);
  const days = new Map<string, { pct: number[]; vol: number[] }>();
  // The fill value (-9999) marks an undefined value; it stays missing.
  let cell: { line: number; sample: number } | null = null;
  for (const get of rows) {
    const stamp = get("Date");
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(stamp))
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const line = number(get(p + "Line_Y_9.00805km")),
      sample = number(get(p + "Sample_X_9.00805km"));
    if (!cell) cell = { line, sample };
    else if (cell.line !== line || cell.sample !== sample)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const pct = number(get(p + "Geophysical_Data_sm_rootzone_pctl")),
      vol = number(get(p + "Geophysical_Data_sm_rootzone"));
    if (vol < 0 || vol > 0.9) continue;
    const day = days.get(stamp.slice(0, 10)) ?? { pct: [], vol: [] };
    if (pct >= 0 && pct <= 100) day.pct.push(pct);
    day.vol.push(vol);
    days.set(stamp.slice(0, 10), day);
  }
  if (!cell) throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  return {
    cell,
    days: [...days.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([day, v]) => ({
        date: day,
        percentile: v.pct.length ? Number(mean(v.pct).toFixed(2)) : null,
        volumetric: Number(mean(v.vol).toFixed(4)),
      })),
  };
}
// Giovanni time-series CSV: metadata lines, then "Timestamp (UTC),Data".
export function normalizeGiovanni(raw: Uint8Array) {
  const rows = parseCsv(decode(raw));
  const meta = new Map<string, string>();
  let i = 0;
  for (; i < rows.length && rows[i]![0] !== "Timestamp (UTC)"; i++)
    meta.set(rows[i]![0]!, rows[i]![1] ?? "");
  if (
    meta.get("prod_name") !== "GPM_3IMERGDF.07" ||
    meta.get("param_short_name") !== "precipitation" ||
    meta.get("unit") !== "mm/day" ||
    rows[i]?.[1] !== "Data"
  )
    throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
  const undef = number(meta.get("undef") ?? "");
  const cell = {
    latitude: Number(number(meta.get("lat") ?? "").toFixed(4)),
    longitude: Number(number(meta.get("lon") ?? "").toFixed(4)),
  };
  const days = rows.slice(i + 1).map((r) => {
    if (r.length !== 2 || !/^\d{4}-\d{2}-\d{2} 00:00$/.test(r[0]!))
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const v = number(r[1]!);
    if (v !== undef && v < 0)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    return { date: r[0]!.slice(0, 10), mm: v === undef ? null : v };
  });
  return { cell, days };
}
