// Catalog release 0.7.0: release 0.6.0 plus sunflower, rapeseed, potato, onion
// and tomato from ONCA's technical references and FAO tables, and sugar beet in
// the three other regions with ONCA sheets. Each rule keeps its source's scope.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { releaseData as release060 } from "./release-0.6.0.data.mjs";

const index = JSON.parse(
  readFileSync(
    join(
      process.env.HOME,
      "Desktop/Rotavise-sources/2026-11-01/ardna/sources.json",
    ),
    "utf8",
  ),
);
const ardna = (id, file, title, scope) => {
  return {
    id,
    file: `../2026-11-01/ardna/${file}.pdf`,
    title,
    publisher: "ONCA / NOVEC, published through ARDNA",
    url: index[file].url,
    year: null,
    accessedAt: "2026-11-01T09:00:00.000Z",
    captureNote:
      "Hash covers the fetched bytes. The document stays in local snapshots.",
    scope,
    limitations: [
      "Rules are not cultivar trials.",
      "Publication year not printed on the inspected pages.",
    ],
    kind: "official_guide",
    rights: {
      reuse: "unknown",
      licence: null,
      note: "No reuse licence found. Facts are cited; the document is not redistributed.",
    },
  };
};
const gbifSource = (id, slug) => ({
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
const CHECKED = {
  status: "double_checked",
  checkedOn: "2026-11-01",
  method: "quote_match_and_second_reading",
};
const cite = (
  sourceId,
  page,
  quote,
  locator,
  interpretation = "direct",
  note = "Read on the cited page; quote checked by machine.",
) => ({
  sourceId,
  page,
  quote,
  locator,
  interpretation,
  note,
});
const fao = (quote, locator, note) =>
  cite("fao-56-chapter-6", null, quote, locator, "normalized", note);
const scope = (regionIds, farmingSystems = "unspecified") => ({
  regionIds,
  farmingSystems,
  cultivarIds: "unspecified",
});
const NATIONAL = ["morocco-general"];
const rule = (id, citations, regions, conditions, fields, farming) => ({
  id,
  citations,
  scope: scope(regions, farming),
  severity: "soft",
  verification: CHECKED,
  conditions,
  ...fields,
});
const window_ = (
  id,
  citations,
  regions,
  start,
  end,
  precision,
  conditions,
  farming,
) =>
  rule(
    id,
    citations,
    regions,
    conditions,
    { metric: "planting_window", start, end, precision },
    farming,
  );
const duration = (id, citations, regions, minDays, maxDays, conditions) =>
  rule(id, citations, regions, conditions, {
    metric: "cycle_duration",
    basis: "sowing_to_harvest",
    minDays,
    maxDays,
  });
const temp = (
  id,
  citations,
  regions,
  basis,
  lowerDegC,
  upperDegC,
  conditions,
  stage = "whole_cycle",
  stageWindow = null,
) =>
  rule(id, citations, regions, conditions, {
    metric: "temperature",
    basis,
    medium: "air",
    stage,
    stageWindow,
    lowerDegC,
    upperDegC,
  });
const curve = (id, kc, stageLengths, citations, regions = NATIONAL) =>
  rule(
    `${id}-water-curve`,
    citations,
    regions,
    "General FAO values for subhumid climates, not adjusted locally or calibrated in Morocco.",
    {
      metric: "crop_water_coefficient",
      kcIni: kc[0],
      kcMid: kc[1],
      kcEnd: kc[2],
      stageLengths,
    },
  );
const ph = (id, source, page, quote, min, max, regions = NATIONAL) =>
  rule(
    `${id}-soil-ph`,
    [
      cite(
        source,
        page,
        quote,
        `PDF page ${page}`,
        "normalized",
        "Range as written; the guide does not state the method.",
      ),
    ],
    regions,
    "Preference from the ONCA sheet; warns only.",
    { metric: "soil_ph", method: "unspecified", min, max },
  );
const applies = (regionId, citation, note) => ({
  regionId,
  status: "candidate",
  citations: [citation],
  note,
});
const gbif = (id, name) =>
  cite(
    id,
    null,
    `"scientificName":"${name}"`,
    "GBIF name match response",
    "direct",
    "Name and family from the GBIF Backbone Taxonomy.",
  );
const profile = ({
  id,
  name,
  sci,
  family,
  product,
  gbifId,
  fr,
  applicability,
  rules,
  gaps,
  limitations,
  cultivars = [],
}) => ({
  id,
  version: "0.7.0",
  synthetic: false,
  identity: {
    name,
    localNames: [{ language: "fr", name: fr.name }],
    scientificName: sci,
    family,
    citations: [
      gbif(gbifId, sci),
      cite(fr.source, fr.page, fr.quote, `PDF page ${fr.page}, crop name`),
    ],
  },
  harvestProduct: product,
  modelType: "annual",
  cultivars,
  applicability,
  rules,
  gaps: [
    { topic: "cultivar", reason: "Rules are not cultivar-specific." },
    ...gaps,
  ],
  limitations: [
    "From ONCA references and FAO tables, not yet expert-reviewed.",
    ...limitations,
  ],
});
const ANNEX = "fao-aquacrop-annex-i";
const RSK = "ma-rabat-sale-kenitra",
  FM = "ma-fez-meknes",
  TTH = "ma-tangier-tetouan-al-hoceima";
const sunflower = profile({
  id: "sunflower",
  name: "Sunflower",
  sci: "Helianthus annuus L.",
  family: "Asteraceae",
  product: "oilseed",
  gbifId: "gbif-sunflower",
  fr: {
    name: "Tournesol",
    source: "ardna-oilseed-rsk",
    page: 6,
    quote: "Techniques de production du tournesol",
  },
  applicability: [
    applies(
      RSK,
      cite(
        "ardna-oilseed-rsk",
        7,
        "Zone côtière et centre (Allal Tazi, Souk Larbâa et Belksiri ) Tournesol",
        "PDF page 7",
        "context_only",
        "Regional sheet.",
      ),
      "Regional sheet for Rabat-Salé-Kénitra; other regions have no sowing date yet.",
    ),
  ],
  rules: [
    window_(
      "sunflower-sowing-rsk",
      [
        cite(
          "ardna-oilseed-rsk",
          7,
          "Semis au mi-Février pour Leila et Bosfora",
          "PDF page 7",
          "normalized",
          "Mid-February encoded as 15 February.",
        ),
        cite(
          "ardna-oilseed-rsk",
          7,
          "Tournesol Semis en fin Février pour Leila et Bosfora",
          "PDF page 7",
          "normalized",
          "End of February encoded as 29 February, the window's last day.",
        ),
      ],
      [RSK],
      "02-15",
      "02-29",
      "approximate",
      "Dates written for two varieties; the sheet's zones differ by two weeks.",
    ),
    duration(
      "sunflower-duration",
      [
        fao(
          "25 35 45 25 130 April/May Medit.; California",
          "Table 11, Sunflower",
          "April/May row; a February sowing may run longer.",
        ),
      ],
      NATIONAL,
      130,
      130,
      "FAO spring row; no Moroccan duration found.",
    ),
    ...[
      [
        "heat",
        "daily_maximum",
        null,
        40,
        "Maximum air temperature above which pollination starts to fail (heat stress) (°C) Conservative (1) 40",
      ],
      [
        "cold",
        "daily_minimum",
        10,
        null,
        "Minimum air temperature below which pollination starts to fail (cold stress) (°C) Conservative (1) 10",
      ],
    ].map(([k, basis, lo, up, quote]) =>
      temp(
        `sunflower-flowering-${k}`,
        [
          cite(ANNEX, 39, quote, "PDF page 39, Sunflower 4.2"),
          cite(
            ANNEX,
            37,
            "Time from sowing to flowering (growing degree day) Cultivar (4) Time to emergence + 1000 - 1300 Length of the flowering stage (growing degree day) Cultivar (4) 300 - 400",
            "PDF page 37, Sunflower 1.3",
            "normalized",
            "Window from 150+1000 to 200+1300+400 growing degree days.",
          ),
        ],
        NATIONAL,
        basis,
        lo,
        up,
        "AquaCrop default; not calibrated for a Moroccan cultivar.",
        "flowering",
        {
          basis: "growing_degree_days_from_sowing",
          method: "aquacrop_method_3",
          startGdd: 1150,
          endGdd: 1900,
          baseDegC: 4,
          upperDegC: 30,
        },
      ),
    ),
    curve(
      "sunflower",
      [0.35, 1.15, 0.35],
      [25, 35, 45, 25],
      [
        fao(
          "Sunflower 1.0-1.15 9 0.35 2.0",
          "Table 12, Sunflower",
          "Upper mid value 1.15 and end 0.35.",
        ),
        fao(
          "Oil Crops 0.35 1.15 0.35",
          "Table 12, Oil crops group",
          "Initial value 0.35 from the group.",
        ),
        fao(
          "25 35 45 25 130 April/May Medit.; California",
          "Table 11, Sunflower",
          "Stage shares.",
        ),
      ],
    ),
  ],
  gaps: [
    {
      topic: "planting_window",
      reason: "Only the Rabat-Salé-Kénitra sheet gives dated sowing.",
    },
  ],
  limitations: [],
});
const rapeseed = profile({
  id: "rapeseed",
  name: "Rapeseed",
  sci: "Brassica napus L.",
  family: "Brassicaceae",
  product: "oilseed",
  gbifId: "gbif-rapeseed",
  fr: {
    name: "Colza",
    source: "ardna-oilseed-reference",
    page: 62,
    quote: "Semis du colza",
  },
  applicability: [FM, RSK, TTH].map((r) =>
    applies(
      r,
      cite(
        "ardna-oilseed-fm",
        22,
        "Ces variétés sont destinées à des zones du Bour favorable, notamment le Saïs, le Gharb et le Loukkos",
        "PDF page 22",
        "context_only",
        "Favourable rainfed zones named by the sheet.",
      ),
      "Zones the ONCA sheet names.",
    ),
  ),
  rules: [
    window_(
      "rapeseed-sowing",
      [
        cite(
          "ardna-oilseed-reference",
          62,
          "L'époque idéale de semis est comprise entre 15 octobre et 15 novembre",
          "PDF page 62, 4.4.2",
        ),
      ],
      NATIONAL,
      "10-15",
      "11-15",
      "exact_day",
      "National reference.",
    ),
    duration(
      "rapeseed-duration",
      [
        cite(
          "ardna-oilseed-reference",
          64,
          "A 163 jours après semis, cette dernière accomplit déjà son cycle biologique",
          "PDF page 64, 4.5",
          "normalized",
          "One short-cycle variety, Narjisse.",
        ),
      ],
      NATIONAL,
      163,
      163,
      "One short-cycle variety; others may take longer.",
    ),
    temp(
      "rapeseed-frost",
      [
        cite(
          "ardna-oilseed-fm",
          21,
          "la température minimale descend en dessous de -4°C",
          "PDF page 21, 2.2",
        ),
      ],
      NATIONAL,
      "daily_minimum",
      -4,
      null,
      "Foliage frost; the sheet refers to the winter phase.",
    ),
    ph(
      "rapeseed",
      "ardna-oilseed-fm",
      21,
      "Le meilleur pH du sol se situe entre 6 et 8.5",
      6,
      8.5,
    ),
    curve(
      "rapeseed",
      [0.35, 1.15, 0.35],
      [25, 35, 45, 25],
      [
        fao(
          "Rapeseed, Canola 1.0-1.15 9 0.35 0.6",
          "Table 12, Rapeseed",
          "Upper mid value 1.15 and end 0.35.",
        ),
        fao(
          "Oil Crops 0.35 1.15 0.35",
          "Table 12, Oil crops group",
          "Initial value 0.35 from the group.",
        ),
        fao(
          "25 35 45 25 130 April/May Medit.; California",
          "Table 11, Sunflower",
          "FAO has no rapeseed row; the sunflower oil crop's stage shares are used as a stated substitute.",
        ),
      ],
    ),
  ],
  gaps: [
    { topic: "cycle_duration", reason: "Only one variety's cycle is sourced." },
  ],
  limitations: ["Water stage shares borrow the sunflower row."],
});
const potato = profile({
  id: "potato",
  name: "Potato (main season)",
  sci: "Solanum tuberosum L.",
  family: "Solanaceae",
  product: "root_tuber",
  gbifId: "gbif-potato",
  fr: {
    name: "Pomme de terre",
    source: "ardna-vegetable-reference",
    page: 13,
    quote: "la culture de pomme de terre",
  },
  applicability: [
    applies(
      "morocco-general",
      cite(
        "ardna-vegetable-reference",
        13,
        "elle est devenue cultivable pratiquement dans toutes les régions du Maroc",
        "PDF page 13",
        "context_only",
        "National presence.",
      ),
      "National reference; needs irrigation in most places.",
    ),
  ],
  rules: [
    window_(
      "potato-sowing-main",
      [
        cite(
          "ardna-vegetable-reference",
          13,
          "La plantation s'effectue entre Janvier et Février",
          "PDF page 13",
          "normalized",
          "Main season; the other four planting seasons are not modelled.",
        ),
      ],
      NATIONAL,
      "01-01",
      "02-29",
      "full_month",
      "Main season only.",
    ),
    duration(
      "potato-duration",
      [
        cite(
          "ardna-vegetable-souss",
          19,
          "La durée complète du cycle végétatif vari d'environ 80 à 150 jours",
          "PDF page 19, 10.2",
        ),
      ],
      NATIONAL,
      80,
      150,
      "Depends on variety.",
    ),
    temp(
      "potato-frost",
      [
        cite(
          "ardna-vegetable-reference",
          13,
          "La pomme de terre est très sensible au gel",
          "PDF page 13",
          "normalized",
          "Frost encoded as a minimum below 0 °C; the guide gives no figure.",
        ),
      ],
      NATIONAL,
      "daily_minimum",
      0,
      null,
      "Any frost day counts.",
    ),
    ph(
      "potato",
      "ardna-vegetable-rsk",
      7,
      "dans un sol légèrement acide (pH=5.5 à 6)",
      5.5,
      6,
    ),
    curve(
      "potato",
      [0.5, 1.15, 0.75],
      [25, 30, 45, 30],
      [
        fao("Potato 1.15 0.75", "Table 12, Potato", "Mid 1.15, end 0.75."),
        fao(
          "Roots and Tubers 0.5 1.10 0.95",
          "Table 12, Roots and tubers group",
          "Initial 0.5 from the group.",
        ),
        fao(
          "25 30 30/45 30 115/130 Jan/Nov (Semi) Arid Climate",
          "Table 11, Potato",
          "Stage shares, using 45 for the mid stage.",
        ),
      ],
    ),
  ],
  gaps: [
    {
      topic: "planting_window",
      reason:
        "Early, late, off-season and mountain crops are in the source but not modelled.",
    },
  ],
  limitations: [
    "Moroccan soils are usually above the preferred pH, so most fields will show this warning.",
  ],
});
const onion = profile({
  id: "onion",
  name: "Onion (dry)",
  sci: "Allium cepa L.",
  family: "Amaryllidaceae",
  product: "vegetable",
  gbifId: "gbif-onion",
  fr: {
    name: "Oignon",
    source: "ardna-vegetable-rsk",
    page: 21,
    quote: "Culture d'oignon",
  },
  applicability: [
    applies(
      TTH,
      cite(
        "ardna-vegetable-tth",
        22,
        "Deux périodes de production de l'oignon dans la zone",
        "PDF page 22",
        "context_only",
        "Tangier zone.",
      ),
      "Dated planting is sourced only for the Tangier zone.",
    ),
  ],
  rules: [
    window_(
      "onion-planting-january",
      [
        cite(
          "ardna-vegetable-tth",
          22,
          "Plantation de janvier et récolte en mai",
          "PDF page 22, Table 7",
          "normalized",
          "January, the whole month.",
        ),
      ],
      [TTH],
      "01-01",
      "01-31",
      "full_month",
      "Transplanted; the nursery starts in October.",
    ),
    window_(
      "onion-planting-april",
      [
        cite(
          "ardna-vegetable-tth",
          22,
          "Plantation d'avril et récolte en juillet",
          "PDF page 22, Table 7",
          "normalized",
          "April, the whole month.",
        ),
      ],
      [TTH],
      "04-01",
      "04-30",
      "full_month",
      "Transplanted.",
    ),
    duration(
      "onion-duration",
      [
        cite(
          "ardna-vegetable-tth",
          22,
          "Plantation d'avril et récolte en juillet",
          "PDF page 22",
          "normalized",
          "About 100 days from planting.",
        ),
        fao(
          "15 25 70 40 150 April Mediterranean",
          "Table 11, Onion (dry)",
          "150 days as the longer bound.",
        ),
      ],
      NATIONAL,
      100,
      150,
      "Counted from transplanting; the nursery is extra.",
    ),
    temp(
      "onion-frost",
      [
        cite(
          "ardna-vegetable-rsk",
          21,
          "La plante est sensible au gel pendant la phase d'installation",
          "PDF page 21, 3.1",
          "normalized",
          "Frost encoded as a minimum below 0 °C over the cycle.",
        ),
      ],
      NATIONAL,
      "daily_minimum",
      0,
      null,
      "The source names the establishment phase; applied across the cycle.",
    ),
    curve(
      "onion",
      [0.7, 1.05, 0.75],
      [15, 25, 70, 40],
      [
        fao(
          "Onions - dry 1.05 0.75",
          "Table 12, Onions",
          "Mid 1.05, end 0.75.",
        ),
        fao(
          "Small Vegetables 0.7 1.05 0.95",
          "Table 12, Small vegetables group",
          "Initial 0.7 from the group.",
        ),
        fao(
          "15 25 70 40 150 April Mediterranean",
          "Table 11, Onion (dry)",
          "Stage shares.",
        ),
      ],
    ),
  ],
  gaps: [
    {
      topic: "planting_window",
      reason: "Other regions give nursery dates only.",
    },
  ],
  limitations: [],
});
const tomato = profile({
  id: "tomato",
  name: "Tomato (open field)",
  sci: "Solanum lycopersicum L.",
  family: "Solanaceae",
  product: "vegetable",
  gbifId: "gbif-tomato",
  fr: {
    name: "Tomate",
    source: "ardna-vegetable-rsk",
    page: 31,
    quote: "Culture de tomate",
  },
  applicability: [
    applies(
      "morocco-general",
      cite(
        "ardna-vegetable-reference",
        85,
        "la tomate de saison pratiquée en plein champs",
        "PDF page 85",
        "context_only",
        "National reference.",
      ),
      "Open-field season crop; greenhouse tomato is not modelled.",
    ),
  ],
  rules: [
    window_(
      "tomato-sowing",
      [
        cite(
          "ardna-vegetable-reference",
          85,
          "les périodes de semis peuvent aller du mifévrier jusqu'au mois de mars",
          "PDF page 85",
          "normalized",
          "Mid-February encoded as 15 February; March to its last day.",
        ),
      ],
      NATIONAL,
      "02-15",
      "03-31",
      "approximate",
      "Open field; greenhouse dates differ.",
    ),
    duration(
      "tomato-duration",
      [
        fao(
          "30 40 40 25 135 January Arid Region",
          "Table 11, Tomato",
          "135 days.",
        ),
        fao(
          "30 40 45 30 145 April/May Mediterranean",
          "Table 11, Tomato",
          "145 days.",
        ),
      ],
      NATIONAL,
      135,
      145,
      "FAO rows; no Moroccan open-field duration found.",
    ),
    temp(
      "tomato-cold",
      [
        cite(
          "ardna-vegetable-souss",
          20,
          "Les basses températures (<10°C) ralentissent la croissance",
          "PDF page 20, 4.1.1",
        ),
      ],
      NATIONAL,
      "daily_minimum",
      10,
      null,
      "A growth limit, stricter than a damage limit.",
    ),
    temp(
      "tomato-heat",
      [
        cite(
          ANNEX,
          43,
          "Maximum air temperature above which pollination starts to fail (heat stress) (°C) Conservative (1) 40.0 (Estimated)",
          "PDF page 43",
          "normalized",
          "The annex gives no flowering timing for tomato, so it is applied across the cycle.",
        ),
      ],
      NATIONAL,
      "daily_maximum",
      null,
      40,
      "AquaCrop estimate; applied across the cycle.",
    ),
    ph(
      "tomato",
      "ardna-vegetable-rsk",
      31,
      "La culture de tomate préfère un sol légèrement acide (5,8 < pH< 6,8)",
      5.8,
      6.8,
    ),
    curve(
      "tomato",
      [0.6, 1.15, 0.8],
      [30, 40, 45, 30],
      [
        fao(
          "Tomato 1.15 2 0.70-0.90 0.6",
          "Table 12, Tomato",
          "Mid 1.15; end 0.80, the middle of the range.",
        ),
        fao(
          "Solanum Family (Solanaceae) 0.6 1.15 0.80",
          "Table 12, Solanum family group",
          "Initial 0.6 from the group.",
        ),
        fao(
          "30 40 45 30 145 April/May Mediterranean",
          "Table 11, Tomato",
          "Stage shares.",
        ),
      ],
    ),
  ],
  gaps: [
    {
      topic: "planting_window",
      reason: "Greenhouse and industrial tomato are not modelled.",
    },
  ],
  limitations: ["Moroccan soils are usually above the preferred pH."],
});
const BEET_REGIONS = {
  "ma-oriental": [
    "ardna-sugar-oriental",
    10,
    "Oriental 3 Triffa Début septembre -mi novembre",
    "09-01",
    "11-15",
  ],
  "ma-casablanca-settat": [
    "ardna-sugar-cs",
    11,
    "Zemamera Début septembre -mi novembre",
    "09-01",
    "11-15",
  ],
  "ma-rabat-sale-kenitra": [
    "ardna-sugar-rsk",
    11,
    "Souk Larbâa - Allal Tazi Septembre - Octobre (précoce) ou novembre (tardif)",
    "09-01",
    "11-30",
  ],
};
export async function releaseData(snapshots) {
  const base = await release060(snapshots);
  const sources = [
    ...base.sources,
    ardna(
      "ardna-oilseed-reference",
      "ref-oleagineuses",
      "Oilseed technical reference, sunflower and rapeseed (N1077)",
      "Morocco, national",
    ),
    ardna(
      "ardna-oilseed-fm",
      "ole-fm",
      "Oilseed technical sheet, Fès-Meknès (N1077)",
      "Fès-Meknès",
    ),
    ardna(
      "ardna-oilseed-rsk",
      "ole-rsk",
      "Oilseed technical sheet, Rabat-Salé-Kénitra (N1077)",
      "Rabat-Salé-Kénitra",
    ),
    ardna(
      "ardna-vegetable-reference",
      "ref-maraicheres",
      "Vegetable technical reference: tomato, potato, onion (N1077)",
      "Morocco, national",
    ),
    ardna(
      "ardna-vegetable-rsk",
      "mar-rsk",
      "Vegetable sheet, Rabat-Salé-Kénitra (N1077)",
      "Rabat-Salé-Kénitra",
    ),
    ardna(
      "ardna-vegetable-souss",
      "mar-sm",
      "Vegetable sheet, Souss-Massa (N1077)",
      "Souss-Massa",
    ),
    ardna(
      "ardna-vegetable-tth",
      "mar-tth",
      "Vegetable sheet, Tanger-Tétouan-Al Hoceima (N1077)",
      "Tanger-Tétouan-Al Hoceima",
    ),
    ardna(
      "ardna-sugar-oriental",
      "suc-oriental",
      "Sugar crops sheet, Oriental (N1077)",
      "Oriental",
    ),
    ardna(
      "ardna-sugar-cs",
      "suc-cs",
      "Sugar crops sheet, Casablanca-Settat (N1077)",
      "Casablanca-Settat",
    ),
    ardna(
      "ardna-sugar-rsk",
      "suc-rsk",
      "Sugar crops sheet, Rabat-Salé-Kénitra (N1077)",
      "Rabat-Salé-Kénitra",
    ),
    gbifSource("gbif-sunflower", "helianthus-annuus"),
    gbifSource("gbif-rapeseed", "brassica-napus"),
    gbifSource("gbif-potato", "solanum-tuberosum"),
    gbifSource("gbif-onion", "allium-cepa"),
    gbifSource("gbif-tomato", "solanum-lycopersicum"),
  ];
  const beetRegions = Object.keys(BEET_REGIONS);
  const profiles = base.profiles.map((p) => {
    if (p.id !== "sugar-beet") return { ...p, version: "0.7.0" };
    return {
      ...p,
      version: "0.7.0",
      applicability: [
        ...p.applicability,
        ...beetRegions.map((r) =>
          applies(
            r,
            cite(
              BEET_REGIONS[r][0],
              BEET_REGIONS[r][1],
              BEET_REGIONS[r][2],
              `PDF page ${BEET_REGIONS[r][1]}, Table 3`,
              "context_only",
              "Regional sheet.",
            ),
            "Regional sheet; the sugar company sets each campaign.",
          ),
        ),
      ],
      rules: [
        // The regional sheets share the national agronomy text, so duration and heat widen.
        ...p.rules.map((r) =>
          r.id === "beet-duration" ||
          r.id === "beet-summer-heat" ||
          r.id === "beet-soil-ph"
            ? {
                ...r,
                scope: {
                  ...r.scope,
                  regionIds: [...r.scope.regionIds, ...beetRegions],
                },
              }
            : r,
        ),
        ...beetRegions.map((r) =>
          window_(
            `beet-sowing-${r.slice(3)}`,
            [
              cite(
                BEET_REGIONS[r][0],
                BEET_REGIONS[r][1],
                BEET_REGIONS[r][2],
                `PDF page ${BEET_REGIONS[r][1]}, Table 3`,
                "normalized",
                "Regional sowing dates.",
              ),
            ],
            [r],
            BEET_REGIONS[r][3],
            BEET_REGIONS[r][4],
            "approximate",
            "Irrigated; the sugar company sets each campaign.",
            ["irrigated"],
          ),
        ),
      ],
    };
  });
  const added = [sunflower, rapeseed, potato, onion, tomato];
  return {
    sources,
    manifest: { ...base.manifest, version: "0.7.0" },
    profiles: [...profiles, ...added],
  };
}
