// Catalog release 0.3.0: facts read on 2026-10-18 from the cited pages, each
// with its exact words. The builder checks every quote by machine. Rules stay
// "not yet expert-reviewed" until a named specialist reviews them.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CHECKED = {
  status: "double_checked",
  checkedOn: "2026-10-18",
  method: "quote_match_and_second_reading",
};
const EXTRACTED = { status: "extracted" };
const national = (farmingSystems = "unspecified") => ({
  regionIds: ["morocco-general"],
  farmingSystems,
  cultivarIds: "unspecified",
});
const tadla = (farmingSystems = "unspecified") => ({
  regionIds: ["beni-mellal-tadla"],
  farmingSystems,
  cultivarIds: "unspecified",
});
const cite = (
  sourceId,
  page,
  quote,
  locator,
  interpretation = "direct",
  note = "Read on the cited page; quote checked by machine.",
) => ({
  sourceId,
  locator,
  interpretation,
  note,
  page,
  quote,
});
const context = (sourceId, locator, note) => ({
  sourceId,
  locator,
  interpretation: "context_only",
  note,
});
const UNKNOWN_RIGHTS = {
  reuse: "unknown",
  licence: null,
  note: "No reuse licence was found. Facts are cited; the document is not redistributed.",
};
const FAO_RIGHTS = {
  reuse: "unknown",
  licence: null,
  note: "FAO copyright. Facts and short quotations are cited with attribution; the document is not redistributed.",
};
const accessedAt = "2026-10-18T07:47:00.000Z";
const docNote =
  "Hash covers the fetched publisher bytes. The document stays in local research snapshots; only metadata and quotes are committed.";
const AQUACROP_ANNEX = "fao-aquacrop-annex-i";
// AquaCrop phenology and pollination stress (FAO AquaCrop 7.3 Annex I).
function aquacropFlowering({
  crop,
  startGdd,
  endGdd,
  upper,
  phenologyPage,
  stressPage,
  quotes,
}) {
  const window = {
    basis: "growing_degree_days_from_sowing",
    method: "aquacrop_method_3",
    startGdd,
    endGdd,
    baseDegC: 0,
    upperDegC: upper,
  };
  const timing = [
    cite(
      AQUACROP_ANNEX,
      phenologyPage,
      quotes.flowering,
      `PDF page ${phenologyPage}, ${crop} 1.3 Flowering`,
      "normalized",
      "Flowering window from the earliest start to the latest end of the recommended ranges.",
    ),
    cite(
      AQUACROP_ANNEX,
      phenologyPage,
      quotes.thresholds,
      `PDF page ${phenologyPage}, ${crop} 1.1 Threshold air temperatures`,
    ),
    cite(
      "fao-aquacrop-chapter-3",
      12,
      "However the check is only on the maximum air temperature",
      "PDF page 12, section 3.2.3 Method 3",
      "direct",
      "Growing-degree-day method used to time the stage.",
    ),
  ];
  return [
    {
      id: `${quotes.prefix}-flowering-heat`,
      citations: [
        cite(
          AQUACROP_ANNEX,
          stressPage,
          quotes.heat,
          `PDF page ${stressPage}, ${crop} 4.2 Air temperature stress`,
        ),
        ...timing,
      ],
      scope: national(),
      severity: "soft",
      verification: CHECKED,
      conditions:
        "AquaCrop default (estimate): pollination starts to fail when the daily maximum exceeds the limit during flowering. Not calibrated for a Moroccan cultivar.",
      metric: "temperature",
      basis: "daily_maximum",
      medium: "air",
      stage: "flowering",
      stageWindow: window,
      lowerDegC: null,
      upperDegC: 35,
    },
    {
      id: `${quotes.prefix}-flowering-cold`,
      citations: [
        cite(
          AQUACROP_ANNEX,
          stressPage,
          quotes.cold,
          `PDF page ${stressPage}, ${crop} 4.2 Air temperature stress`,
        ),
        ...timing,
      ],
      scope: national(),
      severity: "soft",
      verification: CHECKED,
      conditions:
        "AquaCrop default (estimate): pollination starts to fail when the daily minimum falls below the limit during flowering.",
      metric: "temperature",
      basis: "daily_minimum",
      medium: "air",
      stage: "flowering",
      stageWindow: window,
      lowerDegC: 5,
      upperDegC: null,
    },
  ];
}
const cerealSowing = (prefix) => ({
  id: `${prefix}-sowing`,
  citations: [
    cite(
      "onca-cereals",
      43,
      "la date optimale du semis se situerait entre le début du mois de novembre et la moitié du mois de décembre dans la majorité des régions céréalières au Maroc",
      "PDF page 43, section 5.3 and Table 11",
      "normalized",
      "Early November encoded as 1 November; mid-December as 15 December.",
    ),
    cite(
      "inra-wheat",
      4,
      "Semer en automne, de préférence au mois de novembre",
      "PDF page 4, installation",
    ),
  ],
  scope: national(),
  severity: "soft",
  verification: CHECKED,
  conditions:
    "National optimum for most cereal regions; the first autumn rains and the zone decide the actual date.",
  metric: "planting_window",
  start: "11-01",
  end: "12-15",
  precision: "approximate",
});
const crownRot = (prefix) => ({
  id: `${prefix}-crown-rot-break`,
  citations: [
    cite(
      "onca-cereals",
      81,
      "Adopter une rotation d'au moins 2 ans, de préférence de 3 ans avec colza, pois chiche, lentille, fève, ou mélange fourrager",
      "PDF page 81, section 10.1",
      "normalized",
      "Two years encoded as 730 days; three years is preferred.",
    ),
  ],
  scope: national(),
  severity: "soft",
  verification: CHECKED,
  conditions:
    "Applies when crown rot is confirmed on the field; three years is preferred.",
  metric: "crop_health_break",
  issueId: "fusarium-crown-rot",
  minimumBreakDays: 730,
});
const rootRot = (prefix) => ({
  id: `${prefix}-common-root-rot-break`,
  citations: [
    cite(
      "onca-cereals",
      82,
      "Utiliser une rotation d'au moins de 2 ans et de préférence 3 ans",
      "PDF page 82, section 10.2",
      "normalized",
      "Two years encoded as 730 days.",
    ),
  ],
  scope: national(),
  severity: "soft",
  verification: CHECKED,
  conditions:
    "Applies when common root rot is confirmed on the field; three years is preferred.",
  metric: "crop_health_break",
  issueId: "common-root-rot",
  minimumBreakDays: 730,
});
const legumeBeforeCereal = (prefix) => ({
  id: `${prefix}-legume-predecessor`,
  citations: [
    cite(
      "inra-wheat",
      3,
      "Il est important de pratiquer des rotations culturales incluant de préférence les légumineuses alimentaires ou fourragères",
      "PDF page 3, rotation",
      "normalized",
      "Food or forage legumes encoded as the family Fabaceae.",
    ),
    cite(
      "onca-legumes-reference",
      35,
      "un assolement biennal se basant sur une légumineuse et une céréale est fort recommandé",
      "PDF page 35",
    ),
  ],
  scope: national(),
  severity: "soft",
  verification: CHECKED,
  conditions:
    "A preference, not a requirement; no measured soil gain is claimed.",
  metric: "preferred_predecessor_family",
  family: "Fabaceae",
});
const wheatDuration = (prefix) => ({
  id: `${prefix}-duration`,
  citations: [
    cite(
      "fao-56-chapter-6",
      null,
      "30 140 40 30 240 November Mediterranean",
      "Table 11, Winter Wheat",
      "normalized",
      "Mediterranean winter wheat sown in November: 240 days in total.",
    ),
    cite(
      "fao-56-chapter-6",
      null,
      "25 35 65 40 165 Oct/Nov Pakistan; Arid Reg.",
      "Table 11, Grains (small)",
      "normalized",
      "Small grains sown in October/November in arid regions: 165 days.",
    ),
    cite(
      "inra-wheat",
      7,
      "La récolte débute au mois de mai dans les zones arides et semi-arides jusqu'à fin Juin",
      "PDF page 7, harvest",
      "context_only",
      "Moroccan harvest timing is consistent with the FAO range.",
    ),
  ],
  scope: national(),
  severity: "soft",
  verification: CHECKED,
  conditions:
    "FAO-56 general stage lengths, not a Moroccan cultivar trial; the cultivar and season move the harvest within this range.",
  metric: "cycle_duration",
  basis: "sowing_to_harvest",
  minDays: 165,
  maxDays: 240,
});
const french = (sourceId, page, quote, name) => ({
  language: "fr",
  name,
  sourceId,
  page,
  quote,
});
// Douglas–Peucker for a closed ring: split at the vertex farthest from the
// first one so neither half starts and ends on the same point.
export function simplifyRing(ring, tolerance) {
  const open = ring.slice(0, -1);
  if (open.length < 4) return ring;
  let far = 1;
  for (let i = 1; i < open.length; i++)
    if (
      Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]) >
      Math.hypot(open[far][0] - open[0][0], open[far][1] - open[0][1])
    )
      far = i;
  const line = (points) => {
    const keep = new Uint8Array(points.length);
    keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]];
    while (stack.length) {
      const [a, b] = stack.pop();
      const [x1, y1] = points[a];
      const [x2, y2] = points[b];
      const len = Math.hypot(x2 - x1, y2 - y1);
      let max = 0;
      let at = -1;
      for (let i = a + 1; i < b; i++) {
        const [x, y] = points[i];
        const d =
          len === 0
            ? Math.hypot(x - x1, y - y1)
            : Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1) / len;
        if (d > max) {
          max = d;
          at = i;
        }
      }
      if (max > tolerance) {
        keep[at] = 1;
        stack.push([a, at], [at, b]);
      }
    }
    return points.filter((_, i) => keep[i]);
  };
  const first = line(open.slice(0, far + 1));
  const second = line([...open.slice(far), open[0]]);
  const out = [...first, ...second.slice(1)];
  return out.length >= 4 ? out : ring;
}
const NATIONAL_TOLERANCE_DEG = 0.0005;
async function boundaries(snapshots) {
  const read = async (file) =>
    JSON.parse(await readFile(join(snapshots, file), "utf8"));
  const polygons = (f) =>
    f.geometry.type === "MultiPolygon"
      ? f.geometry.coordinates
      : [f.geometry.coordinates];
  const round = (p) => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))];
  const adm2 = await read("geoboundaries-MAR-ADM2.geojson");
  const adm0 = await read("geoboundaries-MAR-ADM0.geojson");
  const pilotNames = [
    "Province de Beni Mellal",
    "Province de Fquih Ben Saleh",
    "Province d'Azilal",
  ];
  const pilotFeatures = adm2.features.filter((f) =>
    pilotNames.some((n) => f.properties.shapeName.startsWith(`${n} `)),
  );
  if (pilotFeatures.length !== 3) throw new Error("PILOT_PROVINCES_NOT_FOUND");
  const pilot = pilotFeatures
    .flatMap(polygons)
    .map((poly) => poly.map((ring) => ring.map(round)));
  // The national outline is simplified (about 50 m) to fit the catalog's
  // vertex limit; the pilot provinces are embedded unchanged.
  const outline = adm0.features
    .flatMap(polygons)
    .map((poly) =>
      poly.map((ring) => simplifyRing(ring, NATIONAL_TOLERANCE_DEG).map(round)),
    );
  return { pilot, outline, pilotNames };
}
export async function releaseData(snapshots) {
  const { pilot, outline, pilotNames } = await boundaries(snapshots);
  const sources = [
    { id: "onca-cereals", reuse: true, file: "onca-cereals.pdf" },
    {
      id: "inra-wheat",
      reuse: true,
      file: "inra-fiche-technique-bles-2023.pdf",
    },
    { id: "onca-sugar-beet", reuse: true, file: "ardna-betterave-bmk.pdf" },
    { id: "kew-durum", reuse: true },
    { id: "kew-faba", reuse: true },
    { id: "kew-beet", reuse: true },
    {
      id: "onca-legumes-reference",
      file: "onca-referentiel-legumineuses.pdf",
      title:
        "Food-legume technical reference, phase III, definitive edition (N1077)",
      publisher: "ONCA / NOVEC, published through ARDNA",
      url: "https://ardna.org/admincockpit/files/contenus_files/ticket_file6197a6d5ca53c-N1077-Referentiel-legumineuse-Ph-III_VD_1.pdf",
      year: null,
      accessedAt,
      captureNote: docNote,
      scope: "Morocco; national guidance with agroclimatic zones",
      limitations: [
        "National reference; no Béni Mellal–Khénifra legume sheet was found.",
        "Publication year not printed on the inspected pages.",
      ],
      kind: "official_guide",
      rights: UNKNOWN_RIGHTS,
    },
    {
      id: "fao-56-chapter-6",
      file: "fao56-chapter6.html",
      encoding: "latin1",
      title:
        "FAO Irrigation and Drainage Paper 56, Chapter 6: ETc – single crop coefficient (Table 11)",
      publisher: "Food and Agriculture Organization of the United Nations",
      url: "https://www.fao.org/4/x0490e/x0490e0b.htm",
      year: 1998,
      accessedAt,
      captureNote: docNote,
      scope: "Global; rows by climatic region and planting period",
      limitations: [
        "General stage lengths; local cultivars and seasons differ.",
        "Several rows describe regions other than Morocco.",
      ],
      kind: "fao_method",
      rights: FAO_RIGHTS,
    },
    {
      id: AQUACROP_ANNEX,
      file: "fao-aquacrop-v73-annexes.pdf",
      title: "AquaCrop Reference Manual, Version 7.3, Annex I: crop parameters",
      publisher: "Food and Agriculture Organization of the United Nations",
      url: "https://www.fao.org/docs/devbuildingforwardbetterlibraries/default-document-library/annexesaquacropv73.pdf",
      year: 2026,
      accessedAt,
      captureNote: docNote,
      scope: "Global default crop parameters",
      limitations: [
        "Default calibration; FAO marks several stress values as estimates.",
        "Not calibrated for Moroccan cultivars.",
      ],
      kind: "fao_method",
      rights: FAO_RIGHTS,
    },
    {
      id: "fao-aquacrop-chapter-3",
      file: "fao-aquacrop-chapter3.pdf",
      title: "AquaCrop Reference Manual, Chapter 3: calculation procedures",
      publisher: "Food and Agriculture Organization of the United Nations",
      url: "https://www.fao.org/fileadmin/user_upload/faowater/docs/AquaCropChapter3.pdf",
      year: 2009,
      accessedAt,
      captureNote: docNote,
      scope: "Method description",
      limitations: [
        "Describes the growing-degree-day methods; no crop values.",
      ],
      kind: "fao_method",
      rights: FAO_RIGHTS,
    },
    ...[
      [
        "onssa-durum",
        "BLE-DUR-.pdf",
        "onssa-ble-dur.pdf",
        "durum wheat",
        "2025/07",
      ],
      [
        "onssa-bread-wheat",
        "BLE-TENDRE-1.pdf",
        "onssa-ble-tendre.pdf",
        "bread wheat",
        "2025/11",
      ],
      ["onssa-barley", "ORGE.pdf", "onssa-orge.pdf", "barley", "2025/07"],
      ["onssa-faba", "FEVE.pdf", "onssa-feve.pdf", "faba bean", "2025/07"],
      [
        "onssa-lentil",
        "LENTILLE.pdf",
        "onssa-lentille.pdf",
        "lentil",
        "2025/10",
      ],
      [
        "onssa-chickpea",
        "POIS-CHICHE.pdf",
        "onssa-pois-chiche.pdf",
        "chickpea",
        "2025/07",
      ],
      [
        "onssa-sugar-beet",
        "BETTERAVE-A-SUCRE.pdf",
        "onssa-betterave-a-sucre.pdf",
        "sugar beet",
        "2025/07",
      ],
      ["onssa-maize", "MAIS.pdf", "onssa-mais.pdf", "maize", "2025/07"],
      [
        "onssa-alfalfa",
        "LUZERNE.pdf",
        "onssa-luzerne.pdf",
        "alfalfa",
        "2025/07",
      ],
    ].map(([id, remote, file, crop, path]) => ({
      id,
      file,
      title: `Official variety catalogue: ${crop}`,
      publisher:
        "ONSSA (Office National de Sécurité Sanitaire des Produits Alimentaires)",
      url: `https://www.onssa.gov.ma/wp-content/uploads/${path}/${remote}`,
      year: 2025,
      accessedAt,
      captureNote: docNote,
      scope: "Morocco; national registration",
      limitations: [
        "Registration is not local performance, seed availability or a recommendation.",
      ],
      kind: "variety_register",
      rights: UNKNOWN_RIGHTS,
    })),
    ...[
      [
        "ormvat-cereals",
        "ormvat-cereales-automne.html",
        "cereales-dautomne",
        "Autumn cereals",
      ],
      ["ormvat-sesame", "ormvat-sesame.html", "sesame", "Sesame"],
      [
        "ormvat-monograph",
        "ormvat-monographie.html",
        "monographie",
        "Monograph",
      ],
      [
        "ormvat-other-crops",
        "ormvat-autres-filieres.html",
        "autres-filieres-agricoles",
        "Other crops",
      ],
    ].map(([id, file, slug, title]) => ({
      id,
      file,
      title: `ORMVAT Tadla: ${title}`,
      publisher: "Office Régional de Mise en Valeur Agricole du Tadla (ORMVAT)",
      url: `https://ormvatadla.ma/${slug}/`,
      year: null,
      accessedAt,
      captureNote: docNote,
      scope: "Tadla irrigated perimeter",
      limitations: [
        "Web page; figures may be historical aggregates.",
        "Presence of a crop is not a planting rule.",
      ],
      kind: "official_communication",
      rights: UNKNOWN_RIGHTS,
    })),
    {
      id: "inra-arabic-guides",
      file: "inra-guide-legumineuses-ar.pdf",
      title:
        "INRA agricultural advice guides in Arabic: cereals; lentil, chickpea and faba bean",
      publisher: "INRA Morocco",
      url: "https://www.inra.org.ma/sites/default/files/publications/ouvrages/guidelegumineusekafaciar.pdf",
      year: null,
      accessedAt,
      captureNote:
        "Scanned document without a text layer; Arabic crop names read from the cover and preamble images. Hash covers the legume guide bytes.",
      scope: "Morocco",
      limitations: [
        "Scanned; names were read from page images and cannot be machine-checked.",
      ],
      kind: "official_guide",
      rights: UNKNOWN_RIGHTS,
    },
    ...[
      ["gbif-bread-wheat", "triticum-aestivum"],
      ["gbif-barley", "hordeum-vulgare"],
      ["gbif-lentil", "lens-culinaris"],
      ["gbif-chickpea", "cicer-arietinum"],
      ["gbif-maize", "zea-mays"],
      ["gbif-sesame", "sesamum-indicum"],
      ["gbif-alfalfa", "medicago-sativa"],
    ].map(([id, slug]) => ({
      id,
      file: `gbif/${slug}.json`,
      title: `GBIF Backbone Taxonomy name match: ${slug.replace("-", " ")}`,
      publisher: "Global Biodiversity Information Facility (GBIF)",
      url: `https://api.gbif.org/v1/species/match?name=${slug.replace("-", "%20")}&strict=true`,
      year: null,
      accessedAt,
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
    })),
    {
      id: "geoboundaries-mar-adm2",
      file: "geoboundaries-MAR-ADM2.geojson",
      title: "geoBoundaries Morocco ADM2 (provinces and prefectures), gbOpen",
      publisher: "geoBoundaries (William & Mary geoLab); source OpenStreetMap",
      url: "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MAR/ADM2/geoBoundaries-MAR-ADM2.geojson",
      year: 2023,
      accessedAt,
      captureNote:
        "Hash covers the downloaded GeoJSON. The release embeds the three pilot provinces unchanged.",
      scope: "Morocco, administrative units as of 2017",
      limitations: [
        "Administrative boundaries, not the ORMVAT irrigated perimeter.",
        "Provinces include mountain areas outside the Tadla plain.",
      ],
      kind: "boundary_dataset",
      rights: {
        reuse: "permitted",
        licence: "Open Database License (ODbL) 1.0",
        note: "© OpenStreetMap contributors, via geoBoundaries. Adapted boundaries in this release are shared under ODbL.",
      },
    },
    {
      id: "geoboundaries-mar-adm0",
      file: "geoboundaries-MAR-ADM0.geojson",
      title: "geoBoundaries Morocco ADM0 (national outline), gbOpen",
      publisher: "geoBoundaries (William & Mary geoLab); source OpenStreetMap",
      url: "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MAR/ADM0/geoBoundaries-MAR-ADM0.geojson",
      year: 2023,
      accessedAt,
      captureNote:
        "Hash covers the downloaded GeoJSON. The release embeds a simplified copy (about 50 m tolerance).",
      scope: "Morocco, national outline",
      limitations: [
        "Simplified outline; points within about 50 m of the border or coast may resolve differently.",
        "Administrative boundary as published by geoBoundaries.",
      ],
      kind: "boundary_dataset",
      rights: {
        reuse: "permitted",
        licence: "Open Database License (ODbL) 1.0",
        note: "© OpenStreetMap contributors, via geoBoundaries. The simplified outline in this release is shared under ODbL.",
      },
    },
  ];
  const issues = [
    {
      id: "fusarium-crown-rot",
      kind: "disease",
      name: "Crown rot (pourriture du collet)",
      scientificName: "Fusarium culmorum; Fusarium cerealis",
      localNames: [
        { language: "fr", name: "Pourriture du collet ou pourriture sèche" },
      ],
      hostCropIds: ["durum-wheat", "bread-wheat", "barley"],
      citations: [
        cite(
          "onca-cereals",
          80,
          "Les blés durs sont plus sensibles à cette maladie, que les blés tendres, les triticales, et les orges",
          "PDF page 80, section 10.1",
        ),
      ],
      synthetic: false,
    },
    {
      id: "common-root-rot",
      kind: "disease",
      name: "Common root rot (piétin commun)",
      scientificName: "Bipolaris sorokiniana",
      localNames: [{ language: "fr", name: "Piétin commun" }],
      hostCropIds: ["barley", "durum-wheat", "bread-wheat"],
      citations: [
        cite(
          "onca-cereals",
          82,
          "En général, l'orge est plus affectée par cette maladie que les blés",
          "PDF page 82, section 10.2",
        ),
      ],
      synthetic: false,
    },
    {
      id: "barley-main-diseases",
      kind: "disease",
      name: "Main barley diseases (helminthosporiosis, smuts)",
      scientificName: null,
      localNames: [],
      hostCropIds: ["barley"],
      citations: [
        cite(
          "onca-cereals",
          89,
          "Les principales maladies de l'orge et les produits fongicides recommandés pour les contrôler",
          "PDF page 89, Table 31",
        ),
      ],
      synthetic: false,
    },
    {
      id: "legume-anthracnose",
      kind: "disease",
      name: "Anthracnose of chickpea and lentil",
      scientificName: "Ascochyta rabiei (chickpea)",
      localNames: [{ language: "fr", name: "Anthracnose" }],
      hostCropIds: ["chickpea", "lentil"],
      citations: [
        cite(
          "onca-legumes-reference",
          74,
          "Elle est due au champignon Ascochyta rabiei",
          "PDF page 74, anthracnose",
        ),
      ],
      synthetic: false,
    },
  ];
  const profileBase = (
    id,
    name,
    scientificName,
    family,
    harvestProduct,
    identityCitation,
    localNames,
  ) => ({
    id,
    version: "0.3.0",
    synthetic: false,
    identity: {
      name,
      localNames: localNames.map(({ language, name }) => ({ language, name })),
      scientificName,
      family,
      citations: [
        identityCitation,
        ...localNames
          .filter((l) => l.sourceId)
          .map((l) =>
            l.quote
              ? cite(
                  l.sourceId,
                  l.page,
                  l.quote,
                  `PDF page ${l.page}, crop name`,
                  "direct",
                  "Local name as written in the source.",
                )
              : context(
                  l.sourceId,
                  l.locator,
                  "Arabic name read from the scanned page image; not machine-checked.",
                ),
          ),
      ],
    },
    harvestProduct,
    modelType: "annual",
  });
  const arabic = (name, locator) => ({
    language: "ar",
    name,
    sourceId: "inra-arabic-guides",
    locator,
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
  const kew = (id) =>
    context(
      id,
      "Accepted name and classification",
      "Accepted taxonomic identity; not cultivar evidence.",
    );
  const tadlaCereals = context(
    "ormvat-cereals",
    "Superficies",
    "Autumn cereals are a major crop group in the Tadla perimeter.",
  );
  const cultivar = (id, name, sourceId, quote) => ({
    id,
    name,
    registration: "registered",
    citations: [cite(sourceId, null, quote, "Official catalogue listing")],
  });
  // Moroccan-bred (INRA) entries of each official register. Registration is
  // not local performance, seed availability or a recommendation.
  const registered = {
    barley: [
      ["adrar", "Adrar", "ADRAR INRA MAROC 1998"],
      ["amalou", "Amalou", "AMALOU INRA MAROC 1997"],
      ["amira", "Amira", "AMIRA INRA MAROC 1996"],
      ["assiya", "Assiya", "ASSIYA INRA MAROC 2016"],
      ["chifaa", "Chifaa", "CHIFAA INRA MAROC 2016"],
      ["firdaws", "Firdaws", "FIRDAWS INRA MAROC 1998"],
    ].map(([id, name, quote]) => cultivar(id, name, "onssa-barley", quote)),
    lentil: [
      ["abda", "Abda", "ABDA (L 593153-16) I.N.R.A.MAROC 2004"],
      ["bekria", "Bekria", "BEKRIA I.N.R.A.MAROC 1989"],
      ["chakkouf", "Chakkouf", "CHAKKOUF (ILL6001-81) I.N.R.A.MAROC 2009"],
      ["zaria", "Zaria", "ZARIA (L8635) I.N.R.A.MAROC 2003"],
      ["karam", "Karam", "KARAM I.N.R.A.MAROC 2024"],
    ].map(([id, name, quote]) => cultivar(id, name, "onssa-lentil", quote)),
    chickpea: [
      ["arifi", "Arifi", "ARIFI (FLIP98-50C) INRA MAROC 2009"],
      ["bouchra", "Bouchra", "BOUCHRA (FLIP97-114C) INRA MAROC 2015"],
      ["douyet", "Douyet", "DOUYET (F84-92C) INRA MAROC 1992"],
      ["farihane", "Farihane", "FARIHANE (F84-79C) INRA MAROC 1994"],
      ["moubarak", "Moubarak", "MOUBARAK(F84-182C) INRA MAROC 1994"],
      ["zahor", "Zahor", "ZAHOR (F84-145C) INRA MAROC 1994"],
    ].map(([id, name, quote]) => cultivar(id, name, "onssa-chickpea", quote)),
    maize: [
      ["doukkalia", "Doukkalia", "DOUKKALIA PRECOCE INRA MAROC 1990"],
      ["el-abdia", "El Abdia", "EL ABDIA PRECOCE INRA MAROC 1999"],
      ["kamla", "Kamla", "KAMLA PRECOCE INRA MAROC 1990"],
    ].map(([id, name, quote]) => cultivar(id, name, "onssa-maize", quote)),
    alfalfa: [
      ["africaine", "Africaine", "AFRICAINE INRA-MAROC 1986"],
      ["moapa", "Moapa", "MOAPA INRA-MAROC 1986"],
      ["sonora", "Sonora", "SONORA INRA MAROC 1986"],
    ].map(([id, name, quote]) => cultivar(id, name, "onssa-alfalfa", quote)),
  };
  const tadlaDemand = (crop) =>
    cite(
      "onca-cereals",
      53,
      "Fkih ben S alah (Tadla) Karim Marzak Carioca Achtar Maghchouch Karim Marzak Achtar Arrehane Carioca Riad",
      "PDF page 53, Table 21",
      "context_only",
      `Varieties in seed demand at the SONACOS Fkih Ben Salah centre (${crop}); not a recommendation.`,
    );
  const cerealGaps = [
    {
      topic: "water_demand",
      reason:
        "No sourced comparable water class; irrigation need comes with the Step 13 water balance.",
    },
    {
      topic: "temperature",
      reason:
        "Ear frost below −4 °C after the 1 cm ear stage (ONCA cereals, page 28) has no sourced stage timing and is not evaluated.",
    },
    {
      topic: "cultivar",
      reason:
        "Rules are not cultivar-specific; cultivar maturity moves the harvest date.",
    },
  ];
  const durum = {
    ...profileBase(
      "durum-wheat",
      "Durum wheat",
      "Triticum turgidum subsp. durum (Desf.) Husn.",
      "Poaceae",
      "dry_grain",
      kew("kew-durum"),
      [
        french(
          "onca-cereals",
          23,
          "Exigences édapho-climatiques du Blé dur",
          "Blé dur",
        ),
        arabic("القمح الصلب", "Cereal guide preamble (scanned)"),
      ],
    ),
    cultivars: [
      cultivar("karim", "Karim", "onssa-durum", "KARIM INRA MAROC 1985"),
      cultivar("marzak", "Marzak", "onssa-durum", "MARZAK INRA MAROC 1984"),
      cultivar(
        "carioca",
        "Carioca",
        "onssa-durum",
        "CARIOCA SERASEM-FRANCE 2005",
      ),
    ],
    applicability: [
      {
        regionId: "beni-mellal-tadla",
        status: "candidate",
        citations: [tadlaCereals, tadlaDemand("durum")],
        note: "Pilot candidate; requires specialist assessment for the farm and campaign.",
      },
    ],
    rules: [
      cerealSowing("durum"),
      wheatDuration("durum"),
      ...aquacropFlowering({
        crop: "Wheat",
        startGdd: 1100,
        endGdd: 1830,
        upper: 26,
        phenologyPage: 45,
        stressPage: 47,
        quotes: {
          prefix: "durum",
          flowering:
            "Time from sowing to flowering (growing degree day) Cultivar (4) Time to emergence + 1000 - 1300 Length of the flowering stage (growing degree day) Cultivar (4) 150 - 280",
          thresholds:
            "T base Base temperature (°C) Conservative (1) 0.0 T upper Upper temperature (°C) Conservative (1) 26.0",
          heat: "Maximum air temperature above which pollination starts to fail (heat stress) (°C) Conservative (1) 35.0 (Estimate)",
          cold: "Minimum air temperature below which pollination starts to fail (cold stress) (°C) Conservative (1) 5.0 (Estimate)",
        },
      }),
      legumeBeforeCereal("durum"),
      crownRot("durum"),
      rootRot("durum"),
      {
        id: "durum-drainage",
        citations: [
          cite(
            "onca-cereals",
            23,
            "Le blé dur exige un sol sain, drainant bien",
            "PDF page 23, section 3.1",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions:
          "Qualitative drainage need; poorly draining soils raise disease risk.",
        metric: "soil_drainage",
        value: "well_drained",
      },
    ],
    gaps: cerealGaps,
    limitations: [
      "Based on national official guides and FAO defaults, not yet expert-reviewed.",
      "Not a Tadla cultivar trial.",
    ],
  };
  const bread = {
    ...profileBase(
      "bread-wheat",
      "Bread wheat",
      "Triticum aestivum L.",
      "Poaceae",
      "dry_grain",
      gbif("gbif-bread-wheat", "Triticum aestivum L."),
      [
        french(
          "onca-cereals",
          23,
          "Exigences édapho-climatiques du Blé tendre",
          "Blé tendre",
        ),
        arabic("القمح اللين", "Cereal guide preamble (scanned)"),
      ],
    ),
    cultivars: [
      cultivar(
        "achtar",
        "Achtar",
        "onssa-bread-wheat",
        "ACHTAR INRA MAROC 1988",
      ),
      cultivar(
        "arrehane",
        "Arrehane",
        "onssa-bread-wheat",
        "ARREHANE INRA MAROC 1996",
      ),
    ],
    applicability: [
      {
        regionId: "beni-mellal-tadla",
        status: "candidate",
        citations: [tadlaCereals, tadlaDemand("bread wheat")],
        note: "Pilot candidate; requires specialist assessment for the farm and campaign.",
      },
    ],
    rules: [
      cerealSowing("bread"),
      wheatDuration("bread"),
      ...aquacropFlowering({
        crop: "Wheat",
        startGdd: 1100,
        endGdd: 1830,
        upper: 26,
        phenologyPage: 45,
        stressPage: 47,
        quotes: {
          prefix: "bread",
          flowering:
            "Time from sowing to flowering (growing degree day) Cultivar (4) Time to emergence + 1000 - 1300 Length of the flowering stage (growing degree day) Cultivar (4) 150 - 280",
          thresholds:
            "T base Base temperature (°C) Conservative (1) 0.0 T upper Upper temperature (°C) Conservative (1) 26.0",
          heat: "Maximum air temperature above which pollination starts to fail (heat stress) (°C) Conservative (1) 35.0 (Estimate)",
          cold: "Minimum air temperature below which pollination starts to fail (cold stress) (°C) Conservative (1) 5.0 (Estimate)",
        },
      }),
      legumeBeforeCereal("bread"),
      crownRot("bread"),
      rootRot("bread"),
      {
        id: "bread-drainage",
        citations: [
          cite(
            "onca-cereals",
            23,
            "Le blé tendre exige un sol sain, drainant bien",
            "PDF page 23, section 3.2",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions: "Qualitative drainage need.",
        metric: "soil_drainage",
        value: "well_drained",
      },
    ],
    gaps: [
      ...cerealGaps,
      {
        topic: "water_demand",
        reason:
          "ONCA (page 23) gives about 500 mm minus zone rainfall; not converted into a rule.",
      },
    ],
    limitations: [
      "Based on national official guides and FAO defaults, not yet expert-reviewed.",
      "Not a Tadla cultivar trial.",
    ],
  };
  const barley = {
    ...profileBase(
      "barley",
      "Barley",
      "Hordeum vulgare L.",
      "Poaceae",
      "dry_grain",
      gbif("gbif-barley", "Hordeum vulgare L."),
      [
        french(
          "onca-cereals",
          23,
          "Exigences édapho-climatiques de l'orge",
          "Orge",
        ),
        arabic("الشعير", "Cereal guide preamble (scanned)"),
      ],
    ),
    cultivars: registered["barley"],
    applicability: [
      {
        regionId: "beni-mellal-tadla",
        status: "candidate",
        citations: [tadlaCereals],
        note: "Pilot candidate; requires specialist assessment for the farm and campaign.",
      },
    ],
    rules: [
      cerealSowing("barley"),
      {
        id: "barley-duration",
        citations: [
          cite(
            "fao-56-chapter-6",
            null,
            "25 35 65 40 165 Oct/Nov Pakistan; Arid Reg.",
            "Table 11, Grains (small)",
            "normalized",
            "Small grains in arid regions: 165 days.",
          ),
          cite(
            "fao-56-chapter-6",
            null,
            "40 60 60 40 200 Nov",
            "Table 11, Barley/Oats/Wheat, November row",
            "normalized",
            "November planting: 200 days; the row names no region.",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions:
          "FAO-56 general stage lengths; the 200-day row does not name its region.",
        metric: "cycle_duration",
        basis: "sowing_to_harvest",
        minDays: 165,
        maxDays: 200,
      },
      ...aquacropFlowering({
        crop: "Barley",
        startGdd: 700,
        endGdd: 1550,
        upper: 15,
        phenologyPage: 49,
        stressPage: 51,
        quotes: {
          prefix: "barley",
          flowering:
            "Time from sowing to flowering (growing degree day) Cultivar (4) 700 - 1,300 Length of the flowering stage (growing degree day) Cultivar (4) 150 - 250",
          thresholds:
            "T base Base temperature (°C) Conservative (1) 0 T upper Upper temperature (°C) Conservative (1) 15",
          heat: "Maximum air temperature above which pollination starts to fail (heat stress) (°C) Conservative (1) 35",
          cold: "Minimum air temperature below which pollination starts to fail (cold stress) (°C) Conservative (1) 5",
        },
      }),
      {
        id: "barley-no-cereal-predecessor",
        citations: [
          cite(
            "onca-cereals",
            23,
            "Dans le but de réduire la pression des maladies et optimiser les rendements, les précédentes céréales sont à écarter",
            "PDF page 23, section 3.3",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions:
          "Avoid a cereal as the previous crop; a warning, not an exclusion.",
        metric: "prohibited_predecessor_family",
        family: "Poaceae",
      },
      legumeBeforeCereal("barley"),
      {
        id: "barley-disease-break",
        citations: [
          cite(
            "onca-cereals",
            89,
            "Il est recommandé de recourir à la pratique de la rotation avec une culture non touchée par les principales maladies de l'orge pour une année au moins",
            "PDF page 89",
            "normalized",
            "One year encoded as 365 days.",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions: "Applies when a main barley disease is confirmed.",
        metric: "crop_health_break",
        issueId: "barley-main-diseases",
        minimumBreakDays: 365,
      },
      crownRot("barley"),
      rootRot("barley"),
      {
        id: "barley-drainage",
        citations: [
          cite(
            "onca-cereals",
            23,
            "il est recommandé de choisir des champs bien drainés",
            "PDF page 23, section 3.3",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions: "Qualitative drainage need.",
        metric: "soil_drainage",
        value: "well_drained",
      },
    ],
    gaps: cerealGaps.filter((g) => g.topic !== "temperature"),
    limitations: [
      "Based on national official guides and FAO defaults, not yet expert-reviewed.",
    ],
  };
  const faba = {
    ...profileBase(
      "faba-bean",
      "Faba bean (dry grain)",
      "Vicia faba L.",
      "Fabaceae",
      "dry_grain",
      kew("kew-faba"),
      [
        french("onca-legumes-reference", 40, "Fève et féverole", "Fève"),
        arabic("الفول", "Legume guide cover (scanned)"),
      ],
    ),
    cultivars: [
      cultivar(
        "karabiga",
        "Karabiga (F213)",
        "onssa-faba",
        "KARABIGA (F213) I.N.R.A. MAROC 1985",
      ),
      cultivar(
        "lobab",
        "Lobab (F269)",
        "onssa-faba",
        "LOBAB (F269) I.N.R.A. 1985",
      ),
      cultivar(
        "hiba",
        "Hiba (Fv1031)",
        "onssa-faba",
        "HIBA (Fv1031) INRA MAROC 2018",
      ),
    ],
    applicability: [
      {
        regionId: "beni-mellal-tadla",
        status: "candidate",
        citations: [
          context(
            "ormvat-other-crops",
            "Other market-garden crops",
            "Green faba is reported in Tadla; dry-grain faba is not separately reported.",
          ),
        ],
        note: "Dry-grain faba in Tadla needs local confirmation; green pods are a different product.",
      },
    ],
    rules: [
      {
        id: "faba-sowing",
        citations: [
          cite(
            "onca-legumes-reference",
            40,
            "Le semis de fève doit avoir lieu de mi-octobre à fin décembre selon les zones agroclimatiques",
            "PDF page 40, 5.4.3",
            "normalized",
            "Mid-October encoded as 15 October; end of December as 31 December.",
          ),
          cite(
            "onca-legumes-reference",
            40,
            "Les semis précoces sont préconisés pour les zones côtières et les semis tardifs pour les plaines intérieures",
            "PDF page 40, 5.4.3",
            "context_only",
            "Inland plains such as Tadla sow later in the window.",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions: "Inland plains sow later in the window.",
        metric: "planting_window",
        start: "10-15",
        end: "12-31",
        precision: "approximate",
      },
      {
        id: "faba-duration",
        citations: [
          cite(
            "fao-56-chapter-6",
            null,
            "dry 90 45 40 60 235 Nov Europe",
            "Table 11, Faba bean, broad bean",
            "normalized",
            "Dry faba sown in November in Europe: 235 days. No Mediterranean autumn row exists.",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions:
          "European autumn row; Moroccan harvests may be earlier (recorded as a gap).",
        metric: "cycle_duration",
        basis: "sowing_to_harvest",
        minDays: 235,
        maxDays: 235,
      },
      {
        id: "faba-frost",
        citations: [
          cite(
            "onca-legumes-reference",
            28,
            "les variétés utilisées sont relativement résistantes au froid (- 4 °C)",
            "PDF page 28",
          ),
          cite(
            "onca-legumes-reference",
            28,
            "La fève craint les gelées tardives au moment de la formation des gousses",
            "PDF page 28",
            "context_only",
            "Late frost matters most at pod formation.",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions:
          "Days with a minimum below −4 °C over the cycle; late frost at pod formation matters most.",
        metric: "temperature",
        basis: "daily_minimum",
        medium: "air",
        stage: "whole_cycle",
        stageWindow: null,
        lowerDegC: -4,
        upperDegC: null,
      },
      {
        id: "faba-cereal-predecessor",
        citations: [
          cite(
            "onca-legumes-reference",
            35,
            "un assolement biennal se basant sur une légumineuse et une céréale est fort recommandé",
            "PDF page 35",
            "normalized",
            "Cereal encoded as the family Poaceae.",
          ),
        ],
        scope: national(),
        severity: "soft",
        verification: CHECKED,
        conditions: "A preference, not a requirement.",
        metric: "preferred_predecessor_family",
        family: "Poaceae",
      },
    ],
    gaps: [
      {
        topic: "cycle_duration",
        reason:
          "No Moroccan sowing-to-harvest range; the FAO European row may overstate the cycle.",
      },
      { topic: "water_demand", reason: "No sourced comparable water class." },
      {
        topic: "temperature",
        reason:
          "Stage temperature optima (ONCA, page 28) are not damage limits and have no sourced timing.",
      },
    ],
    limitations: [
      "Based on national official guides and FAO defaults, not yet expert-reviewed.",
    ],
  };
  const beet = {
    ...profileBase(
      "sugar-beet",
      "Sugar beet",
      "Beta vulgaris L.",
      "Amaranthaceae",
      "sugar_root",
      kew("kew-beet"),
      [
        french(
          "onca-sugar-beet",
          6,
          "Exigence édapho-climatiques de la betterave à sucre",
          "Betterave à sucre",
        ),
      ],
    ),
    cultivars: [],
    applicability: [
      {
        regionId: "beni-mellal-tadla",
        status: "candidate",
        citations: [
          cite(
            "onca-sugar-beet",
            10,
            "Beni Moussa (Souk Sebt) Début septembre -mi novembre",
            "PDF page 10, Table 3",
            "context_only",
            "Regional sheet for the Tadla zones.",
          ),
        ],
        note: "Regional sheet for Béni Moussa, Dir and Béni Amir; campaign dates come from the sugar company each year.",
      },
    ],
    rules: [
      {
        id: "beet-sowing-tadla",
        citations: [
          cite(
            "onca-sugar-beet",
            10,
            "Beni Moussa (Souk Sebt) Début septembre -mi novembre",
            "PDF page 10, Table 3",
            "normalized",
            "Early September encoded as 1 September; mid-November as 15 November.",
          ),
          cite(
            "onca-sugar-beet",
            10,
            "Dir (Kasbat Tadla) Début septembre -mi novembre",
            "PDF page 10, Table 3",
          ),
          cite(
            "onca-sugar-beet",
            10,
            "Beni Amir (Fkih Ben Saleh) Début septembre -mi novembre",
            "PDF page 10, Table 3",
          ),
        ],
        scope: tadla(["irrigated"]),
        severity: "soft",
        verification: CHECKED,
        conditions:
          "Irrigated Tadla zones; the sugar company sets each campaign.",
        metric: "planting_window",
        start: "09-01",
        end: "11-15",
        precision: "approximate",
      },
      {
        id: "beet-duration",
        citations: [
          cite(
            "onca-sugar-beet",
            10,
            "une betterave ayant un cycle de 250 jours, s'étalant de fin octobre à fin Juin",
            "PDF page 10, 3.1.3",
          ),
          cite(
            "fao-56-chapter-6",
            null,
            "45 75 80 30 230 November Mediterranean",
            "Table 11, Sugarbeet",
            "normalized",
            "November Mediterranean: 230 days.",
          ),
          cite(
            "fao-56-chapter-6",
            null,
            "35 60 70 40 205 November Arid Regions",
            "Table 11, Sugarbeet",
            "normalized",
            "November arid regions: 205 days.",
          ),
          cite(
            "onca-sugar-beet",
            30,
            "L'opération de la récolte de la betterave commence au mois de mai",
            "PDF page 30",
            "context_only",
            "Harvest begins in May.",
          ),
        ],
        scope: tadla(["irrigated"]),
        severity: "soft",
        verification: CHECKED,
        conditions:
          "Local 250-day cycle with FAO autumn-sowing rows as the shorter bound.",
        metric: "cycle_duration",
        basis: "sowing_to_harvest",
        minDays: 205,
        maxDays: 250,
      },
      {
        id: "beet-summer-heat",
        citations: [
          cite(
            "onca-sugar-beet",
            6,
            "Les températures maximales les plus favorables à la croissance sont comprises entre 20°C et 28°C",
            "PDF page 6, section 2",
            "normalized",
            "The upper end of the favourable range (28 °C) is used as the heat limit.",
          ),
          cite(
            "onca-sugar-beet",
            6,
            "Au Maroc, les températures estivales élevées constituent le facteur le plus limitant du rendement de la betterave",
            "PDF page 6, section 2",
            "direct",
            "Heat is the documented harmful side; the sheet gives no low-temperature threshold.",
          ),
        ],
        scope: tadla(),
        severity: "soft",
        verification: CHECKED,
        conditions:
          "Days with a maximum above the favourable 28 °C over the cycle; summer heat is the main yield limit in Morocco. Cool days are not counted (no sourced threshold).",
        metric: "temperature",
        basis: "daily_maximum",
        medium: "air",
        stage: "whole_cycle",
        stageWindow: null,
        lowerDegC: null,
        upperDegC: 28,
      },
    ],
    gaps: [
      {
        topic: "temperature",
        reason:
          "Bolting after 30 days at 5 °C from the six-leaf stage and the effect of low temperatures on leaves (page 6) have no modelled stage timing or threshold.",
      },
      {
        topic: "cultivar",
        reason:
          "The ONSSA register lists several hundred varieties, none bred by INRA Morocco; none is recorded until a Tadla source names the varieties grown.",
      },
      {
        topic: "rotation",
        reason:
          "Rotation is listed against cercosporiosis (page 25) without a return interval.",
      },
      {
        topic: "water_demand",
        reason:
          "No sourced comparable water class; the sheet's 600–880 mm use feeds the Step 13 water balance.",
      },
    ],
    limitations: [
      "Regional official sheet and FAO defaults, not yet expert-reviewed.",
    ],
  };
  const referenceOnly =
    "Recorded as reference: not scheduled until a sourced temperature limit allows the same climate comparison as the other crops.";
  const lentil = {
    ...profileBase(
      "lentil",
      "Lentil",
      "Lens culinaris Medik.",
      "Fabaceae",
      "dry_grain",
      gbif("gbif-lentil", "Lens culinaris Medik."),
      [
        french(
          "onca-legumes-reference",
          40,
          "Lentille La date de semis affecte significativement la production de la lentille",
          "Lentille",
        ),
        arabic("العدس", "Legume guide cover (scanned)"),
      ],
    ),
    cultivars: registered["lentil"],
    applicability: [
      {
        regionId: "beni-mellal-tadla",
        status: "candidate",
        citations: [
          context(
            "onca-legumes-reference",
            "PDF page 40",
            "National guidance only.",
          ),
        ],
        note: "Not schedulable in this release.",
      },
    ],
    rules: [
      {
        id: "lentil-sowing-irrigated",
        citations: [
          cite(
            "onca-legumes-reference",
            40,
            "Dans les régions du Bour favorable ou l'irrigué, il est conseillé d'opter pour des semis du 15 octobre à 15 novembre",
            "PDF page 40",
          ),
        ],
        scope: national(["irrigated"]),
        severity: "reference",
        verification: EXTRACTED,
        conditions: referenceOnly,
        metric: "planting_window",
        start: "10-15",
        end: "11-15",
        precision: "exact_day",
      },
      {
        id: "lentil-sowing-semi-arid",
        citations: [
          cite(
            "onca-legumes-reference",
            40,
            "En région semi-aride, le semis est à réaliser de préférence du 15 novembre au 15 décembre",
            "PDF page 40",
          ),
        ],
        scope: national(["rainfed"]),
        severity: "reference",
        verification: EXTRACTED,
        conditions: referenceOnly,
        metric: "planting_window",
        start: "11-15",
        end: "12-15",
        precision: "exact_day",
      },
      {
        id: "lentil-duration",
        citations: [
          cite(
            "fao-56-chapter-6",
            null,
            "25 35 70 40 170 Oct/Nov Arid Region",
            "Table 11, Lentil",
            "normalized",
          ),
        ],
        scope: national(),
        severity: "reference",
        verification: EXTRACTED,
        conditions: referenceOnly,
        metric: "cycle_duration",
        basis: "sowing_to_harvest",
        minDays: 170,
        maxDays: 170,
      },
      {
        id: "lentil-anthracnose-break",
        citations: [
          cite(
            "onca-legumes-reference",
            75,
            "Rotation de 5 ans entre deux légumineuses",
            "PDF page 75, anthracnose",
            "normalized",
            "Five years encoded as 1,825 days.",
          ),
        ],
        scope: national(),
        severity: "reference",
        verification: EXTRACTED,
        conditions: "Applies when anthracnose is confirmed.",
        metric: "crop_health_break",
        issueId: "legume-anthracnose",
        minimumBreakDays: 1825,
      },
    ],
    gaps: [
      {
        topic: "temperature",
        reason:
          "Only germination temperatures are sourced; no damage limit to compare climate risk.",
      },
    ],
    limitations: [referenceOnly],
  };
  const chickpea = {
    ...profileBase(
      "chickpea",
      "Chickpea",
      "Cicer arietinum L.",
      "Fabaceae",
      "dry_grain",
      gbif("gbif-chickpea", "Cicer arietinum L."),
      [
        french(
          "onca-legumes-reference",
          41,
          "Bien que le pois-chiche soit une culture de printemps",
          "Pois chiche",
        ),
        arabic("الحمص", "Legume guide cover (scanned)"),
      ],
    ),
    cultivars: registered["chickpea"],
    applicability: [
      {
        regionId: "beni-mellal-tadla",
        status: "candidate",
        citations: [
          context(
            "onca-legumes-reference",
            "PDF page 41",
            "National guidance only.",
          ),
        ],
        note: "Not schedulable in this release.",
      },
    ],
    rules: [
      {
        id: "chickpea-spring-sowing",
        citations: [
          cite(
            "onca-legumes-reference",
            41,
            "Bien que le pois-chiche soit une culture de printemps (semis effectué durant le mois de Février)",
            "PDF page 41",
          ),
        ],
        scope: national(),
        severity: "reference",
        verification: EXTRACTED,
        conditions: referenceOnly,
        metric: "planting_window",
        start: "02-01",
        end: "02-29",
        precision: "full_month",
      },
      {
        id: "chickpea-anthracnose-break",
        citations: [
          cite(
            "onca-legumes-reference",
            75,
            "Rotation de 5 ans entre deux légumineuses",
            "PDF page 75, anthracnose",
            "normalized",
            "Five years encoded as 1,825 days.",
          ),
        ],
        scope: national(),
        severity: "reference",
        verification: EXTRACTED,
        conditions: "Applies when anthracnose is confirmed.",
        metric: "crop_health_break",
        issueId: "legume-anthracnose",
        minimumBreakDays: 1825,
      },
    ],
    gaps: [
      {
        topic: "cycle_duration",
        reason: "FAO-56 Table 11 has no chickpea row; no sourced duration.",
      },
      { topic: "temperature", reason: "No sourced temperature limit." },
    ],
    limitations: [referenceOnly],
  };
  const listed = (
    id,
    name,
    sci,
    family,
    product,
    gbifId,
    frName,
    frSource,
    frPage,
    frQuote,
    presence,
    modelType = "annual",
  ) => ({
    ...profileBase(
      id,
      name,
      sci,
      family,
      product,
      gbif(gbifId, sci),
      frName ? [french(frSource, frPage, frQuote, frName)] : [],
    ),
    modelType,
    cultivars: registered[id] ?? [],
    applicability: [
      {
        regionId: "beni-mellal-tadla",
        status: "candidate",
        citations: [presence],
        note: "Listed for Tadla; not schedulable in this release.",
      },
    ],
    rules: [],
    gaps: [
      {
        topic: "planting_window",
        reason: "No sourced Tadla sowing window collected yet.",
      },
      { topic: "cycle_duration", reason: "No sourced duration collected yet." },
    ],
    limitations: ["Identity and local presence only."],
  });
  const profiles = [
    durum,
    bread,
    barley,
    faba,
    beet,
    lentil,
    chickpea,
    listed(
      "maize",
      "Maize",
      "Zea mays L.",
      "Poaceae",
      "forage",
      "gbif-maize",
      null,
      null,
      null,
      null,
      cite(
        "ormvat-other-crops",
        null,
        "Mais d’ensilage 754",
        "Forage crops table",
        "context_only",
        "Silage maize area in the Tadla perimeter.",
      ),
    ),
    listed(
      "sesame",
      "Sesame",
      "Sesamum indicum L.",
      "Pedaliaceae",
      "oilseed",
      "gbif-sesame",
      null,
      null,
      null,
      null,
      cite(
        "ormvat-sesame",
        null,
        "Au périmètre du Tadla, la culture du sésame est à cycle productif court sur quatre mois",
        "Mode de culture",
        "context_only",
        "Four-month cycle in Tadla; no dated window on the page.",
      ),
    ),
    listed(
      "alfalfa",
      "Alfalfa",
      "Medicago sativa L.",
      "Fabaceae",
      "forage",
      "gbif-alfalfa",
      null,
      null,
      null,
      null,
      cite(
        "ormvat-other-crops",
        null,
        "Luzerne 30 452",
        "Forage crops table",
        "context_only",
        "Irrigated alfalfa area in the Tadla perimeter.",
      ),
      "multi_year_stand",
    ),
  ];
  const manifest = {
    schemaVersion: "2",
    id: "rotavise-pilot",
    version: "0.3.0",
    synthetic: false,
    regions: [
      {
        id: "beni-mellal-tadla",
        name: "Béni Mellal / Tadla pilot (Béni Mellal, Fquih Ben Saleh and Azilal provinces)",
        countryCode: "MA",
        scopeNote:
          "Administrative provinces containing the ORMVAT Tadla perimeter; wider than the irrigated plain.",
        citations: [
          cite(
            "ormvat-monograph",
            null,
            "La plaine du Tadla se situe à 200 km au Sud-Est de Casablanca",
            "Situation géographique",
            "context_only",
            "The Tadla plain lies in these provinces.",
          ),
        ],
        boundary: {
          sourceId: "geoboundaries-mar-adm2",
          locator: `shapeName: ${pilotNames.join("; ")}`,
          geometry: { type: "MultiPolygon", coordinates: pilot },
        },
      },
      {
        id: "morocco-general",
        name: "Morocco, national guidance",
        countryCode: "MA",
        scopeNote:
          "National guidance applies with a visible condition; it cannot establish every local rule.",
        citations: [
          context(
            "onca-cereals",
            "PDF page 43",
            "National scope of cereal guidance.",
          ),
        ],
        boundary: {
          sourceId: "geoboundaries-mar-adm0",
          locator: `Morocco ADM0 outline, simplified (Douglas–Peucker, ${NATIONAL_TOLERANCE_DEG}°, about 50 m)`,
          geometry: { type: "MultiPolygon", coordinates: outline },
        },
      },
    ],
    issues,
    conflicts: [
      {
        id: "faba-duration-europe",
        ruleIds: ["faba-sowing", "faba-duration"],
        description:
          "The only FAO autumn row for dry faba is European (235 days); Moroccan sowing from mid-October may be harvested earlier.",
        resolution: null,
      },
    ],
  };
  return { sources, manifest, profiles };
}
