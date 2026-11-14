// Catalog release 0.6.0: release 0.5.0 plus soil limits. pH limits come from the
// Moroccan guides. Salinity thresholds (ECe at which yield starts to fall) come
// from the FAO table in the AquaCrop annex and apply to a farmer's soil test.
import { releaseData as release050 } from "./release-0.5.0.data.mjs";

const CHECKED = {
  status: "double_checked",
  checkedOn: "2026-11-01",
  method: "quote_match_and_second_reading",
};
const scope = {
  regionIds: ["morocco-general"],
  farmingSystems: "unspecified",
  cultivarIds: "unspecified",
};
const ph = (
  id,
  sourceId,
  page,
  quote,
  min,
  max,
  conditions,
  severity = "soft",
) => ({
  id: `${id}-soil-ph`,
  citations: [
    {
      sourceId,
      page,
      quote,
      locator: `PDF page ${page}`,
      interpretation: "direct",
      note: "pH range as written; the guide does not state the measurement method.",
    },
  ],
  scope,
  severity,
  verification: severity === "soft" ? CHECKED : { status: "extracted" },
  conditions,
  metric: "soil_ph",
  method: "unspecified",
  min,
  max,
});
const salinity = (id, page, quote, limit) => ({
  id: `${id}-soil-salinity`,
  citations: [
    {
      sourceId: "fao-aquacrop-annex-i",
      page,
      quote,
      locator: `PDF page ${page}, Annex III Table III-1`,
      interpretation: "normalized",
      note: `ECe ${limit} dS/m is the threshold where yield starts to fall; the following columns are the slope and rating.`,
    },
  ],
  scope,
  severity: "soft",
  verification: CHECKED,
  conditions:
    "Yield starts to fall above this saturated-paste salinity; checked only against a farmer's soil test.",
  metric: "soil_salinity",
  method: "saturated_paste_ece",
  maxDsPerM: limit,
});
const RULES = {
  "sugar-beet": [
    ph(
      "beet",
      "onca-sugar-beet",
      6,
      "Le pH dépend du type de sol et doit être compris entre 6,5 et 7,5",
      6.5,
      7.5,
      "Regional sheet; sugar beet is very sensitive to soil pH.",
    ),
    salinity("beet", 80, "Sugar beet 7.0 24.0 5.9", 7),
  ],
  "faba-bean": [
    ph(
      "faba",
      "onca-legumes-reference",
      28,
      "un pH favorable allant de 5 à 8",
      5,
      8,
      "National legume reference for faba bean and field bean.",
    ),
  ],
  chickpea: [
    ph(
      "chickpea",
      "onca-legumes-reference",
      29,
      "la culture tolère des pH allant de 6 à 9",
      6,
      9,
      "Recorded as reference; chickpea is not schedulable yet.",
      "reference",
    ),
  ],
  "durum-wheat": [
    salinity("durum", 80, "Wheat, durum (Triticum turgidum) 5.8 28.0 4.7", 5.8),
  ],
  "bread-wheat": [
    salinity("bread", 79, "Wheat (Triticum aestivum) 6.0 20.1 7.1", 6),
  ],
  barley: [salinity("barley", 80, "Barley 8.0 28.0 5.0", 8)],
};
export async function releaseData(snapshots) {
  const base = await release050(snapshots);
  return {
    ...base,
    manifest: { ...base.manifest, version: "0.6.0" },
    profiles: base.profiles.map((p) => ({
      ...p,
      version: "0.6.0",
      rules: [...p.rules, ...(RULES[p.id] ?? [])],
    })),
  };
}
