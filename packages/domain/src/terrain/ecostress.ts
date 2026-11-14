// Field-level summary of ECOSTRESS acquisitions (70 m, irregular ISS overpasses).
// Rows are already cloud- and water-filtered pixel values for the field's
// sample points. Acquisitions are averaged over the clear points, then months
// over their acquisitions. Nothing is interpolated, and the sampling is uneven
// in time and time of day, so a month's mean is a sample, not a full record.
export type EcostressPixel = {
  pointId: string;
  date: string;
  time: string | null;
  lstK: number | null;
  esi: number | null;
};
// Preserve the policy used by requests saved before the accuracy filter.
export const ECOSTRESS_POLICY_V1 = Object.freeze({
  version: "ecostress-policy-1",
  minimumClearPoints: 1,
  maximumAcquisitions: 4000,
});
export const ECOSTRESS_POLICY = Object.freeze({
  ...ECOSTRESS_POLICY_V1,
  version: "ecostress-policy-2",
  lstQuality: Object.freeze({
    // QC is uint16; bits 1:0 are mandatory QA, bits 15:14 LST accuracy.
    maximumEncodedQc: 65535,
    mandatoryMask: 0b11,
    acceptedMandatory: 0b00,
    accuracyShift: 14,
    accuracyMask: 0b11,
    acceptedAccuracy: Object.freeze([0b10, 0b11]),
    reference:
      "Hulley & Freepartner, ECOSTRESS Level 2 Product User Guide v002, 19 August 2024, Table 3 p.13 and Table 6 pp.17-18; https://lpdaac.usgs.gov/documents/1574/ECOL2_User_Guide_V2.pdf",
    citationText:
      "10 = 1 - 1.5 K (Good performance); 11 = <1 K (Excellent performance)",
    basis:
      "Rotavise selects the documented good/excellent LST accuracy classes. This is a quality admission policy, not a NASA plausibility guarantee or a temperature ceiling.",
  }),
});
export type EcostressPolicyVersion =
  typeof ECOSTRESS_POLICY_V1.version | typeof ECOSTRESS_POLICY.version;
const round = (v: number, n: number) => Number(v.toFixed(n));
const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
export function summarizeEcostress(pixels: EcostressPixel[]) {
  const groups = new Map<
    string,
    {
      date: string;
      time: string | null;
      lst: number[];
      esi: number[];
      pts: Set<string>;
    }
  >();
  for (const p of pixels) {
    const key = `${p.date}T${p.time ?? ""}`;
    const g = groups.get(key) ?? {
      date: p.date,
      time: p.time,
      lst: [],
      esi: [],
      pts: new Set<string>(),
    };
    if (p.lstK !== null) g.lst.push(p.lstK);
    if (p.esi !== null) g.esi.push(p.esi);
    g.pts.add(p.pointId);
    groups.set(key, g);
  }
  const acquisitions = [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(0, ECOSTRESS_POLICY.maximumAcquisitions)
    .map(([, g]) => ({
      date: g.date,
      time: g.time,
      clearPoints: g.pts.size,
      lstMeanC: g.lst.length ? round(mean(g.lst) - 273.15, 2) : null,
      esiMean: g.esi.length ? round(mean(g.esi), 3) : null,
    }));
  const byMonth = new Map<string, typeof acquisitions>();
  for (const a of acquisitions) {
    const m = a.date.slice(0, 7);
    byMonth.set(m, [...(byMonth.get(m) ?? []), a]);
  }
  const months = [...byMonth.entries()].map(([month, list]) => {
    const lst = list.flatMap((a) => (a.lstMeanC === null ? [] : [a.lstMeanC]));
    const esi = list.flatMap((a) => (a.esiMean === null ? [] : [a.esiMean]));
    return {
      month,
      acquisitions: list.length,
      lstMeanC: lst.length ? round(mean(lst), 2) : null,
      lstMaxC: lst.length ? Math.max(...lst) : null,
      esiMean: esi.length ? round(mean(esi), 3) : null,
      esiMin: esi.length ? Math.min(...esi) : null,
    };
  });
  return { acquisitions, months };
}
