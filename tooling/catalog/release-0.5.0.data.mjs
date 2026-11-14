// Catalog release 0.5.0: release 0.4.0 plus FAO-56 crop water curves and the
// rainfall warning for rainfed cereals in arid regions.
import { releaseData as release040 } from "./release-0.4.0.data.mjs";

const CHECKED = {
  status: "double_checked",
  checkedOn: "2026-11-01",
  method: "quote_match_and_second_reading",
};
const fao = (quote, locator, note) => ({
  sourceId: "fao-56-chapter-6",
  page: null,
  quote,
  locator,
  interpretation: "normalized",
  note,
});
const scope = {
  regionIds: ["morocco-general"],
  farmingSystems: "unspecified",
  cultivarIds: "unspecified",
};
const curve = (id, kc, stages, citations, conditions) => ({
  id: `${id}-water-curve`,
  citations,
  scope,
  severity: "soft",
  verification: CHECKED,
  conditions,
  metric: "crop_water_coefficient",
  kcIni: kc[0],
  kcMid: kc[1],
  kcEnd: kc[2],
  stageLengths: stages,
});
const GENERAL =
  "General FAO values for subhumid climates, not adjusted for local wind and humidity or calibrated in Morocco.";
const WHEAT_KC = fao(
  "- with non-frozen soils 0.7 1.15 0.25-0.4",
  "Table 12, Winter Wheat",
  "Kc ini 0.7, mid 1.15; the lower end 0.25 is used for a crop harvested dry.",
);
const WHEAT_STAGES = fao(
  "30 140 40 30 240 November Mediterranean",
  "Table 11, Winter Wheat",
  "Stage lengths 30, 140, 40, 30 days; their shares are scaled to the crop's duration.",
);
const CURVES = {
  "durum-wheat": curve(
    "durum",
    [0.7, 1.15, 0.25],
    [30, 140, 40, 30],
    [WHEAT_KC, WHEAT_STAGES],
    GENERAL,
  ),
  "bread-wheat": curve(
    "bread",
    [0.7, 1.15, 0.25],
    [30, 140, 40, 30],
    [WHEAT_KC, WHEAT_STAGES],
    GENERAL,
  ),
  barley: curve(
    "barley",
    [0.3, 1.15, 0.25],
    [40, 60, 60, 40],
    [
      fao(
        "i. Cereals 0.3 1.15 0.4 Barley 1.15 0.25",
        "Table 12, Cereals and Barley",
        "Kc ini 0.3 from the cereal group; mid 1.15, end 0.25 for barley.",
      ),
      fao(
        "40 60 60 40 200 Nov",
        "Table 11, Barley/Oats/Wheat",
        "Stage shares from the November row, which names no region.",
      ),
    ],
    GENERAL,
  ),
  "faba-bean": curve(
    "faba",
    [0.5, 1.15, 0.3],
    [90, 45, 40, 60],
    [
      fao(
        "- Dry/Seed 0.5 1.15 2 0.30 0.8",
        "Table 12, Fababean, Dry/Seed",
        "Kc ini 0.5, mid 1.15, end 0.30.",
      ),
      fao(
        "dry 90 45 40 60 235 Nov Europe",
        "Table 11, Faba bean",
        "Stage shares from the European autumn row, the only one.",
      ),
    ],
    GENERAL,
  ),
  "sugar-beet": curve(
    "beet",
    [0.35, 1.2, 0.7],
    [45, 75, 80, 30],
    [
      fao(
        "Sugar Beet 0.35 1.20 0.70",
        "Table 12, Sugar Beet",
        "Kc ini 0.35, mid 1.20, end 0.70.",
      ),
      fao(
        "45 75 80 30 230 November Mediterranean",
        "Table 11, Sugarbeet",
        "Stage shares from the November Mediterranean row.",
      ),
    ],
    GENERAL,
  ),
};
const arid = (id) => ({
  id: `${id}-arid-rainfall`,
  citations: [
    {
      sourceId: "onca-cereals",
      page: 24,
      quote: "Les régions arides, à pluviométrie comprise entre 150 et 200 mm",
      locator: "PDF page 24, section 3.3",
      interpretation: "normalized",
      note: "The guide adds that grain production there comes about one year in two or three. Encoded as a warning for rainfed fields at or below 200 mm a year.",
    },
    {
      sourceId: "onca-cereals",
      page: 24,
      quote: "la production de grain est très aléatoire",
      locator: "PDF page 24, section 3.3",
      interpretation: "direct",
      note: "Consequence stated by the guide.",
    },
  ],
  scope: { ...scope, farmingSystems: ["rainfed"] },
  severity: "reference",
  verification: CHECKED,
  conditions:
    "A warning for rainfed cereals where mean annual rain is at or below 200 mm; written for barley systems and applied to the cereal group.",
  metric: "water_reference",
  basis: "annual_rainfall",
  minMm: 150,
  minInclusive: true,
  maxMm: 200,
});
const CEREALS = {
  "durum-wheat": "durum",
  "bread-wheat": "bread",
  barley: "barley",
};

export async function releaseData(snapshots) {
  const base = await release040(snapshots);
  return {
    ...base,
    manifest: { ...base.manifest, version: "0.5.0" },
    profiles: base.profiles.map((p) => ({
      ...p,
      version: "0.5.0",
      rules: [
        ...p.rules,
        ...(CURVES[p.id] ? [CURVES[p.id]] : []),
        ...(CEREALS[p.id] ? [arid(CEREALS[p.id])] : []),
      ],
      gaps: p.gaps.filter((g) => !(CURVES[p.id] && g.topic === "water_demand")),
    })),
  };
}
