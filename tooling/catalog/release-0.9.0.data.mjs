// Catalog release 0.9.0: release 0.8.0 plus eggplant, watermelon, carrot and
// maize, and fruit trees listed as orchards, which do not rotate and are never
// put in a rotation. Chickpea, garlic and sesame still lack a required fact.
import {
  crop,
  bulletin,
  gbifSource,
  releaseData as release080,
} from "./release-0.8.0.data.mjs";

const fao = (quote, note) => ({
  sourceId: "fao-56-chapter-6",
  page: null,
  quote,
  locator: "Table",
  interpretation: "normalized",
  note,
});
const cite = (sourceId, page, quote, note = "Quote checked by machine.") => ({
  sourceId,
  page,
  quote,
  locator: page ? `PDF page ${page}` : "Table",
  interpretation: "normalized",
  note,
});
const SOL = "Solanum Family (Solanaceae) 0.6 1.15 0.80";
const NOTE = "National bulletin; irrigated; check your local calendar.";
const ADDED = [
  {
    id: "eggplant",
    name: "Eggplant",
    fr: "Aubergine",
    sci: "Solanum melongena L.",
    family: "Solanaceae",
    product: "vegetable",
    gbifId: "gbif-eggplant",
    source: "pntta-solanums",
    frPage: 2,
    frQuote: "L'AUBERGINE",
    windows: [
      [
        "",
        "Culture de saison (plein champ): semis en Mars-Mai",
        3,
        "03-01",
        "05-31",
        "full_month",
      ],
    ],
    windowNote: "Open-field season crop.",
    durationCitations: [
      fao(
        "30 40 40 20 130",
        "FAO row of 130 days; the table's Mediterranean row prints an unusable total.",
      ),
    ],
    days: [130, 130],
    durationNote: "FAO arid-region row.",
    kc: [0.6, 1.05, 0.9],
    stages: [30, 40, 40, 20],
    kcQuote: "Egg Plant 1.05 0.90",
    groupQuote: SOL,
    stageQuote: "30 40 40 20 130",
    applyNote: NOTE,
  },
  {
    id: "watermelon",
    name: "Watermelon",
    fr: "Pastèque",
    sci: "Citrullus lanatus (Thunb.) Matsum. & Nakai",
    family: "Cucurbitaceae",
    product: "fruit",
    gbifId: "gbif-watermelon",
    source: "pntta-cucurbits",
    frPage: 2,
    frQuote: "LA PASTÈQUE",
    windows: [
      [
        "",
        "Le semis direct peut être effectué en Juin-Juillet",
        2,
        "06-01",
        "07-31",
        "full_month",
      ],
    ],
    windowNote: "The bulletin says watermelon sowing is the same as squash.",
    durationCitations: [
      fao("20 30 30 30 110 April Italy", "110 days."),
      fao("10 20 20 30 80", "80 days."),
    ],
    days: [80, 110],
    durationNote: "FAO rows.",
    kc: [0.4, 1, 0.75],
    stages: [20, 30, 30, 30],
    kcQuote: "Watermelon 0.4 1.00 0.75",
    groupQuote: "Cucumber Family (Cucurbitaceae) 0.5 1.00 0.80",
    stageQuote: "20 30 30 30 110 April Italy",
    applyNote: NOTE,
  },
  {
    id: "carrot",
    name: "Carrot",
    fr: "Carotte",
    sci: "Daucus carota L.",
    family: "Apiaceae",
    product: "root_tuber",
    gbifId: "gbif-carrot",
    source: "pntta-roots",
    frPage: 4,
    frQuote: "LA CAROTTE",
    windows: [
      [
        "",
        "30 40 60 20 150 Feb/Mar Mediterranean",
        null,
        "02-01",
        "03-31",
        "full_month",
        "fao-56-chapter-6",
      ],
    ],
    windowNote:
      "FAO Mediterranean planting month; the Moroccan bulletin gives no date.",
    durationCitations: [
      fao("30 40 60 20 150 Feb/Mar Mediterranean", "150 days."),
    ],
    days: [150, 150],
    durationNote: "FAO Mediterranean row.",
    kc: [0.7, 1.05, 0.95],
    stages: [30, 40, 60, 20],
    kcQuote: "Carrots 1.05 0.95",
    groupQuote: "Small Vegetables 0.7 1.05 0.95",
    stageQuote: "30 40 60 20 150 Feb/Mar Mediterranean",
    applyNote: NOTE,
    temps: [
      [
        "heat",
        "daily_maximum",
        null,
        30,
        "A une température supérieure à 30˚C",
        4,
        "Leaf growth slows and roots lose market value.",
      ],
    ],
  },
];
const MAIZE_RULES = {
  id: "maize",
  name: "Maize",
  fr: "Maïs",
  sci: "Zea mays L.",
  family: "Poaceae",
  product: "forage",
  gbifId: "gbif-maize",
  source: "pntta-silage-maize",
  frPage: 1,
  frQuote: "le cycle long a été semé début avril",
  windows: [
    [
      "",
      "le cycle long a été semé début avril",
      1,
      "04-01",
      "04-30",
      "full_month",
    ],
  ],
  windowNote:
    "Dates from Moroccan silage trials, not a recommendation; summer short-cycle sowing is not modelled.",
  durationCitations: [fao("30 40 50 30 150 April Spain", "150 days.")],
  days: [150, 150],
  durationNote: "FAO Mediterranean-climate row; silage is cut earlier.",
  kc: [0.3, 1.2, 0.6],
  stages: [30, 40, 50, 30],
  kcQuote: "Maize, Field (grain) (field corn) 1.20 0.60-0.35",
  groupQuote: "Cereals 0.3 1.15 0.4",
  stageQuote: "30 40 50 30 150 April Spain",
  applyNote: NOTE,
};
const TREES = [
  [
    "olive",
    "Olive",
    "Olea europaea L.",
    "Oleaceae",
    "gbif-olive",
    "olea-europaea",
    "Olivier",
  ],
  [
    "citrus",
    "Citrus (orange)",
    "Citrus sinensis (Mill.) Pers., 1806",
    "Rutaceae",
    "gbif-citrus",
    "citrus-sinensis",
    "Agrumes",
  ],
  [
    "pomegranate",
    "Pomegranate",
    "Punica granatum L.",
    "Lythraceae",
    "gbif-pomegranate",
    "punica-granatum",
    "Grenadier",
  ],
  [
    "fig",
    "Fig",
    "Ficus carica L.",
    "Moraceae",
    "gbif-fig",
    "ficus-carica",
    "Figuier",
  ],
  [
    "apricot",
    "Apricot",
    "Prunus armeniaca L.",
    "Rosaceae",
    "gbif-apricot",
    "prunus-armeniaca",
    "Abricotier",
  ],
  [
    "peach",
    "Peach and nectarine",
    "Prunus persica (L.) Stokes",
    "Rosaceae",
    "gbif-peach",
    "prunus-persica",
    "Pêcher-Nectarinier",
  ],
];
// Short French names alone are too brief to check, so quote their table context.
const TREE_QUOTES = {
  Olivier: "Olivier Agrumes Grenadier",
  Agrumes: "Olivier Agrumes Grenadier",
  Figuier: "Figuier 101,8 101,8",
};
const tree = ([id, name, sci, family, gbifId, , fr]) => ({
  id,
  version: "0.9.0",
  synthetic: false,
  identity: {
    name,
    localNames: [{ language: "fr", name: fr }],
    scientificName: sci,
    family,
    citations: [
      {
        sourceId: gbifId,
        page: null,
        quote: `"scientificName":"${sci}"`,
        locator: "GBIF name match response",
        interpretation: "direct",
        note: "Name and family from GBIF.",
      },
      {
        sourceId: "ormvat-other-crops",
        page: null,
        quote: TREE_QUOTES[fr] ?? fr,
        locator: "Tadla crop table",
        interpretation: "context_only",
        note: "Grown in the Tadla perimeter.",
      },
    ],
  },
  harvestProduct: "fruit",
  modelType: "orchard",
  cultivars: [],
  applicability: [
    {
      regionId: "morocco-general",
      status: "candidate",
      citations: [
        {
          sourceId: "ormvat-other-crops",
          page: null,
          quote: TREE_QUOTES[fr] ?? fr,
          locator: "Tadla crop table",
          interpretation: "context_only",
          note: "Presence only.",
        },
      ],
      note: "A tree crop stays in place for years, so it is not part of a rotation plan.",
    },
  ],
  rules: [],
  gaps: [
    {
      topic: "planting_window",
      reason: "Tree crops are not planned as rotations.",
    },
  ],
  limitations: [
    "Listed so the farmer sees it is known; no rotation advice is given. ONCA references exist for later tree guidance.",
  ],
});
const GBIF = [
  ["gbif-eggplant", "solanum-melongena"],
  ["gbif-watermelon", "citrullus-lanatus"],
  ["gbif-carrot", "daucus-carota"],
  ...TREES.map((t) => [t[4], t[5]]),
];
export async function releaseData(snapshots) {
  const prior = await release080(snapshots);
  const irrigated = (p) => ({
    ...p,
    rules: p.rules.map((r) => ({
      ...r,
      scope: { ...r.scope, farmingSystems: ["irrigated"] },
    })),
  });
  const maize = irrigated(crop(MAIZE_RULES));
  const old = prior.profiles.find((p) => p.id === "maize");
  return {
    sources: [
      ...prior.sources,
      bulletin("pntta-silage-maize", "d08"),
      ...GBIF.map(([id, slug]) => gbifSource(id, slug)),
    ],
    manifest: { ...prior.manifest, version: "0.9.0" },
    profiles: [
      ...prior.profiles
        .filter((p) => p.id !== "maize")
        .map((p) => ({ ...p, version: "0.9.0" })),
      {
        ...maize,
        version: "0.9.0",
        identity: { ...old.identity },
        cultivars: old.cultivars,
        rules: [
          ...maize.rules,
          {
            id: "maize-heat",
            citations: [
              cite(
                "fao-aquacrop-annex-i",
                15,
                "Maximum air temperature above which pollination starts to fail (heat stress) (°C) Conservative (1) 40",
                "No flowering timing used, so applied across the cycle.",
              ),
            ],
            scope: {
              regionIds: ["morocco-general"],
              farmingSystems: ["irrigated"],
              cultivarIds: "unspecified",
            },
            severity: "soft",
            verification: {
              status: "double_checked",
              checkedOn: "2026-11-01",
              method: "quote_match_and_second_reading",
            },
            conditions: "AquaCrop default; applied across the cycle.",
            metric: "temperature",
            basis: "daily_maximum",
            medium: "air",
            stage: "whole_cycle",
            stageWindow: null,
            lowerDegC: null,
            upperDegC: 40,
          },
        ],
      },
      ...ADDED.map((c) => ({ ...irrigated(crop(c)), version: "0.9.0" })),
      ...TREES.map(tree),
    ],
  };
}
