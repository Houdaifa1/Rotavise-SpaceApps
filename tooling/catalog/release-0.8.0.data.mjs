// Catalog release 0.8.0: release 0.7.0 plus vegetables and field crops from the
// Moroccan PNTTA bulletins (Institut Agronomique et Vétérinaire Hassan II) with
// FAO-56 tables, and lentil made plannable. A crop with no sourced temperature
// limit has none here: the engine reports that climate was not checked for it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { releaseData as release070 } from "./release-0.7.0.data.mjs";

const index = JSON.parse(
  readFileSync(
    join(
      process.env.HOME,
      "Desktop/Rotavise-sources/2026-11-01/ardna2/sources.json",
    ),
    "utf8",
  ),
);
const CHECKED = {
  status: "double_checked",
  checkedOn: "2026-11-01",
  method: "quote_match_and_second_reading",
};
export const bulletin = (id, file, scope = "Morocco, national bulletin") => ({
  id,
  file: `../2026-11-01/ardna2/${file}.pdf`,
  title: `PNTTA technical bulletin: ${index[`${file}.pdf`].title}`,
  publisher:
    "PNTTA, Ministry of Agriculture and IAV Hassan II, published through ARDNA",
  url: index[`${file}.pdf`].url,
  year: null,
  accessedAt: "2026-11-01T09:00:00.000Z",
  captureNote:
    "Hash covers the fetched bytes. The document stays in local snapshots.",
  scope,
  limitations: [
    "A general bulletin, about 2002; varieties and practices may have changed.",
  ],
  kind: "official_guide",
  rights: {
    reuse: "unknown",
    licence: null,
    note: "No reuse licence found. Facts are cited; the document is not redistributed.",
  },
});
export const gbifSource = (id, slug) => ({
  id,
  file: `gbif/${slug}.json`,
  title: `GBIF Backbone Taxonomy name match: ${slug.replace("-", " ")}`,
  publisher: "Global Biodiversity Information Facility (GBIF)",
  url: `https://api.gbif.org/v1/species/match?name=${slug.replace("-", "%20")}&strict=true`,
  year: null,
  accessedAt: "2026-11-01T09:00:00.000Z",
  captureNote: "The committed file is the exact GBIF API response.",
  scope: "Global taxonomic reference",
  limitations: ["Taxonomy only; no cultivation or suitability inference."],
  kind: "taxonomy",
  rights: {
    reuse: "permitted",
    licence: "CC BY 4.0 (GBIF Backbone Taxonomy)",
    note: "Cite GBIF.org.",
  },
  commit: { name: `gbif-${slug}.json` },
});
const cite = (
  sourceId,
  page,
  quote,
  interpretation = "normalized",
  note = "Quote checked by machine.",
) => ({
  sourceId,
  page,
  quote,
  locator: page ? `PDF page ${page}` : "Table",
  interpretation,
  note,
});
const fao = (quote, note) =>
  cite("fao-56-chapter-6", null, quote, "normalized", note);
const scope = (regionIds) => ({
  regionIds,
  farmingSystems: "unspecified",
  cultivarIds: "unspecified",
});
const base = (id, citations, regions, conditions, fields) => ({
  id,
  citations,
  scope: scope(regions),
  severity: "soft",
  verification: CHECKED,
  conditions,
  ...fields,
});
const NATIONAL = ["morocco-general"];
export function crop(c) {
  const regions = c.regions ?? NATIONAL;
  const rules = [
    ...c.windows.map(([suffix, quote, page, start, end, precision, source]) =>
      base(
        `${c.id}-sowing${suffix}`,
        [cite(source ?? c.source, page, quote)],
        regions,
        c.windowNote,
        { metric: "planting_window", start, end, precision },
      ),
    ),
    base(`${c.id}-duration`, c.durationCitations, regions, c.durationNote, {
      metric: "cycle_duration",
      basis: "sowing_to_harvest",
      minDays: c.days[0],
      maxDays: c.days[1],
    }),
    base(
      `${c.id}-water-curve`,
      [
        fao(c.kcQuote, "Mid and end values."),
        fao(c.groupQuote, "Initial value from the crop group."),
        fao(c.stageQuote, "Stage shares."),
      ],
      NATIONAL,
      "General FAO values, not adjusted locally or calibrated in Morocco.",
      {
        metric: "crop_water_coefficient",
        kcIni: c.kc[0],
        kcMid: c.kc[1],
        kcEnd: c.kc[2],
        stageLengths: c.stages,
      },
    ),
    ...(c.temps ?? []).map(([suffix, basis, lo, up, quote, page, note]) =>
      base(`${c.id}-${suffix}`, [cite(c.source, page, quote)], NATIONAL, note, {
        metric: "temperature",
        basis,
        medium: "air",
        stage: "whole_cycle",
        stageWindow: null,
        lowerDegC: lo,
        upperDegC: up,
      }),
    ),
  ];
  return {
    id: c.id,
    version: "0.8.0",
    synthetic: false,
    identity: {
      name: c.name,
      localNames: [{ language: "fr", name: c.fr }],
      scientificName: c.sci,
      family: c.family,
      citations: [
        cite(
          c.gbifId,
          null,
          `"scientificName":"${c.sci}"`,
          "direct",
          "Name and family from the GBIF Backbone Taxonomy.",
        ),
        cite(
          c.source,
          c.frPage,
          c.frQuote,
          "direct",
          "French name as written.",
        ),
      ],
    },
    harvestProduct: c.product,
    modelType: "annual",
    cultivars: [],
    applicability: regions.map((regionId) => ({
      regionId,
      status: "candidate",
      citations: [
        cite(
          c.source,
          c.frPage,
          c.frQuote,
          "context_only",
          "Grown in Morocco per this bulletin.",
        ),
      ],
      note: c.applyNote,
    })),
    rules,
    gaps: [
      { topic: "cultivar", reason: "Rules are not cultivar-specific." },
      ...(c.temps?.length
        ? []
        : [
            {
              topic: "temperature",
              reason:
                "No sourced damage temperature; climate is not checked for this crop.",
            },
          ]),
    ],
    limitations: [
      "From a general Moroccan bulletin and FAO tables, not yet expert-reviewed.",
    ],
  };
}
// The vegetable sources describe irrigated production, so these are not offered
// to rainfed fields. Onion keeps its sourced rainfed ("bour") January crop.
const IRRIGATED_ONLY = new Set([
  "potato",
  "tomato",
  "table-beet",
  "melon",
  "courgette",
  "pepper",
  "cabbage",
  "pea",
  "green-bean",
  "lettuce",
  "groundnut",
]);
const NOTE = "National bulletin; check your local calendar.";
const SMALL = "Small Vegetables 0.7 1.05 0.95";
const CUCURBIT = "Cucumber Family (Cucurbitaceae) 0.5 1.00 0.80";
const LEGUME = "Legumes (Leguminosae) 0.4 1.15 0.55";
const CROPS = [
  {
    id: "table-beet",
    name: "Table beet",
    fr: "Betterave potagère",
    sci: "Beta vulgaris L.",
    family: "Amaranthaceae",
    product: "root_tuber",
    gbifId: "kew-beet-gbif",
    source: "pntta-roots",
    frPage: 2,
    frQuote: "LA BETTERAVE POTAGÈRE",
    windows: [
      [
        "",
        "Le meilleur moment du semis est Avril-Mai-Juin",
        2,
        "04-01",
        "06-30",
        "full_month",
      ],
    ],
    windowNote: NOTE,
    durationCitations: [
      cite(
        "pntta-roots",
        2,
        "La récolte se fait 4-5 mois après la plantation",
        "normalized",
        "Four to five months encoded as 120–150 days.",
      ),
    ],
    days: [120, 150],
    durationNote: "From the bulletin.",
    kc: [0.5, 1.05, 0.95],
    stages: [25, 30, 25, 10],
    kcQuote: "Beets, table 1.05 0.95",
    groupQuote: "Roots and Tubers 0.5 1.10 0.95",
    stageQuote: "25 30 25 10 90 Feb/Mar Mediterranean",
    applyNote: NOTE,
  },
  {
    id: "melon",
    name: "Melon",
    fr: "Melon",
    sci: "Cucumis melo L.",
    family: "Cucurbitaceae",
    product: "fruit",
    gbifId: "gbif-melon",
    source: "pntta-cucurbits",
    frPage: 1,
    frQuote: "La culture est très populaire au Maroc",
    windows: [
      [
        "",
        "Février-Mars (pour la culture de saison)",
        1,
        "02-01",
        "03-31",
        "full_month",
      ],
    ],
    windowNote: "Season crop, sown in a nursery.",
    durationCitations: [
      cite("pntta-cucurbits", 1, "à partir du 120 ème jour après semis"),
      fao("30 45 35 10 120 Jan Calif., USA", "120 days."),
    ],
    days: [120, 120],
    durationNote: "First harvest; picking lasts 15–20 days more.",
    kc: [0.5, 0.85, 0.6],
    stages: [30, 45, 35, 10],
    kcQuote: "Cantaloupe 0.5 0.85 0.60",
    groupQuote: CUCURBIT,
    stageQuote: "30 45 35 10 120 Jan Calif., USA",
    applyNote: NOTE,
  },
  {
    id: "courgette",
    name: "Courgette",
    fr: "Courgette",
    sci: "Cucurbita pepo L.",
    family: "Cucurbitaceae",
    product: "vegetable",
    gbifId: "gbif-courgette",
    source: "pntta-cucurbits",
    frPage: 2,
    frQuote: "LES COURGES",
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
    windowNote:
      "Late-season open-field sowing; the earlier sowing needs protection and is not modelled.",
    durationCitations: [
      fao("25 35 25 15 100 Apr; Dec. Medit.; Arid Reg.", "100 days."),
      fao("20 30 25 15 90 May/June Medit.; Europe", "90 days."),
    ],
    days: [90, 100],
    durationNote: "FAO rows.",
    kc: [0.5, 0.95, 0.75],
    stages: [20, 30, 25, 15],
    kcQuote: "Squash, Zucchini 0.95 0.75",
    groupQuote: CUCURBIT,
    stageQuote: "20 30 25 15 90 May/June Medit.; Europe",
    applyNote: NOTE,
  },
  {
    id: "pepper",
    name: "Sweet pepper",
    fr: "Poivron",
    sci: "Capsicum annuum L.",
    family: "Solanaceae",
    product: "vegetable",
    gbifId: "gbif-pepper",
    source: "pntta-solanums",
    frPage: 3,
    frQuote: "LE POIVRON-PIMENT",
    windows: [
      [
        "",
        "le semis s'échelonne de fin Janvier à fin Mars",
        3,
        "01-31",
        "03-31",
        "approximate",
      ],
    ],
    windowNote: "Season crop, mainly inland.",
    durationCitations: [
      fao("Sweet peppers (bell) 25/30 35 40 20 125", "125 days."),
      fao("30 40 110 30 210", "210 days as the longer row."),
    ],
    days: [125, 210],
    durationNote: "FAO rows.",
    kc: [0.6, 1.05, 0.9],
    stages: [25, 35, 40, 20],
    kcQuote: "Sweet Peppers (bell) 1.05 2 0.90",
    groupQuote: "Solanum Family (Solanaceae) 0.6 1.15 0.80",
    stageQuote: "Sweet peppers (bell) 25/30 35 40 20 125",
    applyNote: NOTE,
    temps: [
      [
        "heat",
        "daily_maximum",
        null,
        35,
        "réduisent la fructi",
        3,
        "Above 35 °C fruiting and photosynthesis fall.",
      ],
      [
        "cold",
        "daily_minimum",
        8,
        null,
        "Son zéro végétatif se situe à 8˚C",
        3,
        "Growth stops below 8 °C.",
      ],
    ],
  },
  {
    id: "cabbage",
    name: "Cabbage",
    fr: "Chou",
    sci: "Brassica oleracea L.",
    family: "Brassicaceae",
    product: "vegetable",
    gbifId: "gbif-cabbage",
    source: "pntta-brassicas",
    frPage: 2,
    frQuote: "LES CHOUX",
    windows: [
      [
        "",
        "La plantation a lieu de Septembre à Janvier",
        2,
        "09-01",
        "12-31",
        "full_month",
      ],
    ],
    windowNote:
      "Bulletin says September to January; encoded to December because the calendar model needs one year.",
    durationCitations: [
      cite(
        "pntta-brassicas",
        2,
        "pour des cycles de culture variant de 90 à 120 jours",
      ),
    ],
    days: [90, 120],
    durationNote: "From the bulletin.",
    kc: [0.7, 1.05, 0.95],
    stages: [25, 35, 25, 10],
    kcQuote: "Cabbage 1.05 0.95",
    groupQuote: SMALL,
    stageQuote: "25 35 25 10 95 February Mediterranean",
    applyNote: NOTE,
    temps: [
      [
        "growth-range",
        "daily_mean",
        4,
        24,
        "la valeur de 24˚C est considérée comme un maximum alors que 4˚C est une valeur minimale de croissance",
        2,
        "Growth limits, not damage limits.",
      ],
    ],
  },
  {
    id: "pea",
    name: "Pea",
    fr: "Petit pois",
    sci: "Pisum sativum L.",
    family: "Fabaceae",
    product: "vegetable",
    gbifId: "gbif-pea",
    source: "pntta-brassicas",
    frPage: 3,
    frQuote: "LE PETIT POIS",
    windows: [
      [
        "",
        "de Décembre à Février (culture de saison)",
        3,
        "12-01",
        "12-31",
        "full_month",
      ],
      [
        "-late",
        "de Décembre à Février (culture de saison)",
        3,
        "01-01",
        "02-29",
        "full_month",
      ],
    ],
    windowNote: "Season crop; one source window, split at the year's end.",
    durationCitations: [
      fao("20 30 35 15 100 Mar/Apr Mediterranean", "100 days."),
    ],
    days: [100, 100],
    durationNote: "FAO row for a spring sowing.",
    kc: [0.5, 1.15, 1.1],
    stages: [20, 30, 35, 15],
    kcQuote: "Peas - Fresh 0.5 1.15 2 1.10",
    groupQuote: LEGUME,
    stageQuote: "20 30 35 15 100 Mar/Apr Mediterranean",
    applyNote: NOTE,
  },
  {
    id: "green-bean",
    name: "Green bean",
    fr: "Haricot filet",
    sci: "Phaseolus vulgaris L.",
    family: "Fabaceae",
    product: "vegetable",
    gbifId: "gbif-bean",
    source: "pntta-brassicas",
    frPage: 4,
    frQuote: "LE HARICOT FILET",
    windows: [
      [
        "",
        "le semis est effectué de Septembre à Mars pour les primeurs",
        4,
        "09-01",
        "12-31",
        "full_month",
      ],
      [
        "-late",
        "le semis est effectué de Septembre à Mars pour les primeurs",
        4,
        "01-01",
        "03-31",
        "full_month",
      ],
    ],
    windowNote:
      "Open-field early crop; one source window, split at the year's end.",
    durationCitations: [
      fao("20 30 30 10 90 Feb/Mar Calif., Mediterranean", "90 days."),
      fao("15 25 25 10 75 Aug/Sep Calif., Egypt, Lebanon", "75 days."),
    ],
    days: [75, 90],
    durationNote: "FAO rows.",
    kc: [0.5, 1.05, 0.9],
    stages: [20, 30, 30, 10],
    kcQuote: "Beans, green 0.5 1.05 2 0.90",
    groupQuote: LEGUME,
    stageQuote: "20 30 30 10 90 Feb/Mar Calif., Mediterranean",
    applyNote: NOTE,
  },
  {
    id: "lettuce",
    name: "Lettuce",
    fr: "Laitue",
    sci: "Lactuca sativa L.",
    family: "Asteraceae",
    product: "vegetable",
    gbifId: "gbif-lettuce",
    source: "pntta-lettuce",
    frPage: 1,
    frQuote: "LA LAITUE",
    windows: [
      [
        "",
        "Pour la culture de printemps, le semis se fait entre Mars et Août",
        1,
        "03-01",
        "08-31",
        "full_month",
      ],
    ],
    windowNote: "Spring crop, in a nursery.",
    durationCitations: [
      fao("20 30 15 10 75 April Mediterranean", "75 days."),
      fao("30 40 25 10 105 Nov/Jan Mediterranean", "105 days."),
    ],
    days: [75, 105],
    durationNote: "FAO rows.",
    kc: [0.7, 1, 0.95],
    stages: [20, 30, 15, 10],
    kcQuote: "Lettuce 1.00 0.95",
    groupQuote: SMALL,
    stageQuote: "20 30 15 10 75 April Mediterranean",
    applyNote: NOTE,
  },
  {
    id: "groundnut",
    name: "Groundnut",
    fr: "Arachide",
    sci: "Arachis hypogaea L.",
    family: "Fabaceae",
    product: "oilseed",
    gbifId: "gbif-groundnut",
    source: "pntta-groundnut",
    frPage: 1,
    frQuote: "Le semis a lieu en Avril- Mai et la récolte en Septembre-Octobre",
    regions: ["ma-rabat-sale-kenitra", "ma-tangier-tetouan-al-hoceima"],
    windows: [
      [
        "",
        "Le semis a lieu en Avril- Mai et la récolte en Septembre-Octobre",
        1,
        "04-01",
        "05-31",
        "full_month",
      ],
    ],
    windowNote:
      "Irrigated sandy soils on the Atlantic coast from Kénitra to Larache.",
    durationCitations: [
      cite("pntta-groundnut", 1, "à cycle court (90 à 110 jours"),
      cite("pntta-groundnut", 1, "à cycle long (120 à 140 jours"),
    ],
    days: [90, 140],
    durationNote: "Valencia and Virginia types.",
    kc: [0.4, 1.15, 0.6],
    stages: [35, 45, 35, 25],
    kcQuote: "Groundnut (Peanut) 1.15 0.60",
    groupQuote: LEGUME,
    stageQuote: "35 45 35 25 140",
    applyNote: "Coast from Kénitra to Larache.",
  },
];
export async function releaseData(snapshots) {
  const prior = await release070(snapshots);
  const sources = [
    ...prior.sources,
    bulletin("pntta-roots", "d11"),
    bulletin("pntta-cucurbits", "d12"),
    bulletin("pntta-solanums", "d13"),
    bulletin("pntta-brassicas", "d14"),
    bulletin("pntta-lettuce", "d16"),
    bulletin("pntta-groundnut", "d15", "Loukkos irrigated perimeter"),
    gbifSource("kew-beet-gbif", "beta-vulgaris"),
    gbifSource("gbif-melon", "cucumis-melo"),
    gbifSource("gbif-courgette", "cucurbita-pepo"),
    gbifSource("gbif-pepper", "capsicum-annuum"),
    gbifSource("gbif-cabbage", "brassica-oleracea"),
    gbifSource("gbif-pea", "pisum-sativum"),
    gbifSource("gbif-bean", "phaseolus-vulgaris"),
    gbifSource("gbif-lettuce", "lactuca-sativa"),
    gbifSource("gbif-groundnut", "arachis-hypogaea"),
  ];
  const profiles = prior.profiles.map((p) => {
    if (p.id !== "lentil") return { ...p, version: "0.8.0" };
    const upgrade = (r) =>
      [
        "lentil-sowing-irrigated",
        "lentil-sowing-semi-arid",
        "lentil-duration",
      ].includes(r.id)
        ? {
            ...r,
            severity: "soft",
            verification: CHECKED,
            conditions:
              "National reference; climate is not checked for lentil.",
          }
        : r;
    return {
      ...p,
      version: "0.8.0",
      rules: [
        ...p.rules.map(upgrade),
        base(
          "lentil-water-curve",
          [
            fao("Lentil 1.10 0.30", "Mid and end values."),
            fao(LEGUME, "Initial value from the group."),
            fao("25 35 70 40 170 Oct/Nov Arid Region", "Stage shares."),
          ],
          NATIONAL,
          "General FAO values.",
          {
            metric: "crop_water_coefficient",
            kcIni: 0.4,
            kcMid: 1.1,
            kcEnd: 0.3,
            stageLengths: [25, 35, 70, 40],
          },
        ),
      ],
      limitations: [
        "From national guides and FAO tables, not yet expert-reviewed. No sourced damage temperature, so climate is not checked.",
      ],
    };
  });
  return {
    sources,
    manifest: { ...prior.manifest, version: "0.8.0" },
    profiles: [...profiles, ...CROPS.map(crop)].map((p) =>
      IRRIGATED_ONLY.has(p.id)
        ? {
            ...p,
            rules: p.rules.map((r) => ({
              ...r,
              scope: { ...r.scope, farmingSystems: ["irrigated"] },
            })),
            limitations: [
              ...p.limitations,
              "Offered for irrigated fields only: the sources describe irrigated production.",
            ],
          }
        : p,
    ),
  };
}
