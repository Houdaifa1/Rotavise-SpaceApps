import {
  ECOSTRESS_POLICY,
  ECOSTRESS_POLICY_V1,
  type EcostressPixel,
  type EcostressPolicyVersion,
} from "@rotavise/domain";
import { ObservationError } from "../appeears/appeears.client.js";
import { parseCsv } from "../normalization.js";

// AppEEARS point CSV files for NASADEM and ECOSTRESS. Column names follow the
// layout recorded for HLS and SMAP: the product with its dot turned into an
// underscore, then the layer name. Values equal to a layer's fill value, NaN
// or outside the physical range are dropped, never repaired.
export const invalid = () =>
  new ObservationError("OBSERVATION_UPSTREAM_INVALID");
const decode = (raw: Uint8Array) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(raw);
  } catch {
    throw invalid();
  }
};
export function table(raw: Uint8Array, required: string[]) {
  const rows = parseCsv(decode(raw));
  const header = rows[0];
  if (!header || required.some((h) => !header.includes(h))) throw invalid();
  const at = Object.fromEntries(required.map((h) => [h, header.indexOf(h)]));
  return rows.slice(1).map((r) => {
    if (r.length !== header.length) throw invalid();
    return (h: string) => r[at[h]!]!;
  });
}
// "", "NaN" and "nan" mean no value; anything else must be a plain number.
export function optionalNumber(v: string) {
  if (v === "" || /^nan$/i.test(v)) return null;
  if (!/^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(v)) throw invalid();
  return Number(v);
}
export const moment =
  /^(\d{4}-\d{2}-\d{2})(?: (\d{2}:\d{2}:\d{2})(?:\.\d+)?(?: UTC)?)?$/;
export const NASADEM_FILL = -32768;
export function normalizeNasadem(raw: Uint8Array, pointIds: Set<string>) {
  const column = "NASADEM_NC_001_NASADEM_HGT";
  const out = new Map<string, number | null>();
  for (const get of table(raw, ["ID", column])) {
    const id = get("ID");
    if (!pointIds.has(id)) throw invalid();
    const value = optionalNumber(get(column));
    const clean =
      value === null || value === NASADEM_FILL || value < -500 || value > 9000
        ? null
        : value;
    if (out.has(id) && out.get(id) !== clean) throw invalid();
    out.set(id, clean);
  }
  return out;
}
type Layers = { prefix: string; value: string; min: number; max: number };
const ECOSTRESS: Record<"lst" | "esi", Layers> = {
  lst: { prefix: "ECO_L2T_LSTE_002_", value: "LST", min: 200, max: 380 },
  esi: { prefix: "ECO_L4T_ESI_002_", value: "ESI", min: 0, max: 1 },
};
// One ECO_L2T_LSTE.002 or ECO_L4T_ESI.002 results file. A pixel counts only
// when the cloud and water masks are 0; the mask fill value (255) and missing
// values drop the row. The real LSTE file (recorded 2026-11-09) also carries
// the QC layer's "Mandatory QA flags" column: when present, only 0b00 (pixel
// produced) is kept, because 0b01 pixels include degraded ones. Policy 2 also
// requires raw QC and admits only its documented good/excellent LST accuracy
// classes. Policy 1 retains the previous optional decoded-QA behavior for replay.
export function normalizeEcostress(
  raw: Uint8Array,
  product: "lst" | "esi",
  pointIds: Set<string>,
  policyVersion: EcostressPolicyVersion = ECOSTRESS_POLICY.version,
): EcostressPixel[] {
  if (
    policyVersion !== ECOSTRESS_POLICY.version &&
    policyVersion !== ECOSTRESS_POLICY_V1.version
  )
    throw invalid();
  const { prefix, value, min, max } = ECOSTRESS[product];
  const quality =
    product === "lst" && policyVersion === ECOSTRESS_POLICY.version
      ? ECOSTRESS_POLICY.lstQuality
      : null;
  const qcColumn = prefix + "QC";
  const qa = prefix + "QC_Mandatory_QA_flags";
  const hasQa =
    product === "lst" &&
    decode(raw).split(/\r?\n/, 1)[0]!.split(",").includes(qa);
  const rows = table(raw, [
    "ID",
    "Date",
    prefix + value,
    prefix + "cloud",
    prefix + "water",
    ...(hasQa ? [qa] : []),
    ...(quality ? [qcColumn] : []),
  ]);
  const out: EcostressPixel[] = [];
  for (const get of rows) {
    const id = get("ID");
    const when = moment.exec(get("Date"));
    if (!pointIds.has(id) || !when) throw invalid();
    const cloud = optionalNumber(get(prefix + "cloud")),
      water = optionalNumber(get(prefix + "water"));
    if (cloud !== 0 || water !== 0) continue;
    if (hasQa && get(qa) !== "0b00") continue;
    if (quality) {
      const qc = optionalNumber(get(qcColumn));
      if (qc === null) continue;
      if (!Number.isInteger(qc) || qc < 0 || qc > quality.maximumEncodedQc)
        throw invalid();
      if (
        (qc & quality.mandatoryMask) !== quality.acceptedMandatory ||
        !quality.acceptedAccuracy.includes(
          (qc >> quality.accuracyShift) & quality.accuracyMask,
        )
      )
        continue;
    }
    const v = optionalNumber(get(prefix + value));
    if (v === null || v < min || v > max) continue;
    out.push({
      pointId: id,
      date: when[1]!,
      time: when[2] ?? null,
      lstK: product === "lst" ? v : null,
      esi: product === "esi" ? v : null,
    });
  }
  return out;
}
