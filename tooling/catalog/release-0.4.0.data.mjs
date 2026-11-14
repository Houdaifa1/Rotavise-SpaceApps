// Catalog release 0.4.0: release 0.3.0's facts, now usable across Morocco.
// Crops whose guides are national apply in `morocco-general`; rules keep the
// scope of their source, so sugar beet stays with its Tadla sheet. Morocco's 12
// regions are added so results and later regional rules can name a field's region.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  releaseData as release030,
  simplifyRing,
} from "./release-0.3.0.data.mjs";

const REGION_TOLERANCE_DEG = 0.001;
const round = (p) => [Number(p[0].toFixed(6)), Number(p[1].toFixed(6))];
const slug = (name) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const national = (sourceId, page, quote, locator, note) => ({
  sourceId,
  locator,
  interpretation: "context_only",
  note,
  page,
  quote,
});
const CEREALS = national(
  "onca-cereals",
  10,
  "Les céréales sont pratiquées dans les différentes zones agro-climatiques du pays",
  "PDF page 10, section 1.2",
  "Cereals are grown across the country's agroclimatic zones.",
);
const LEGUMES = national(
  "onca-legumes-reference",
  9,
  "La culture des légumineuses alimentaires se répartit sur l'ensemble du Maroc",
  "PDF page 9",
  "Food legumes are grown across Morocco.",
);
const NATIONAL_CROPS = {
  "durum-wheat": CEREALS,
  "bread-wheat": CEREALS,
  barley: CEREALS,
  "faba-bean": LEGUMES,
  lentil: LEGUMES,
  chickpea: LEGUMES,
};
const NOTE =
  "National guidance. Rainfall is not yet checked against the crop, so a dry or desert location can still be listed; local suitability needs a specialist.";

export async function releaseData(snapshots) {
  const base = await release030(snapshots);
  const adm1 = JSON.parse(
    await readFile(join(snapshots, "geoboundaries-MAR-ADM1.geojson"), "utf8"),
  );
  const adm0Source = base.sources.find(
    (s) => s.id === "geoboundaries-mar-adm0",
  );
  const sources = [
    ...base.sources,
    {
      ...adm0Source,
      id: "geoboundaries-mar-adm1",
      file: "geoboundaries-MAR-ADM1.geojson",
      title: "geoBoundaries Morocco ADM1 (12 regions), gbOpen",
      url: "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/MAR/ADM1/geoBoundaries-MAR-ADM1.geojson",
      accessedAt: "2026-11-01T00:09:00.000Z",
      captureNote:
        "Hash covers the downloaded GeoJSON. The release embeds a simplified copy (about 100 m tolerance).",
      scope: "Morocco, 12 administrative regions",
      limitations: [
        "Simplified outlines; points within about 100 m of a boundary may resolve differently.",
        "Administrative boundaries, not agroclimatic zones.",
      ],
    },
  ];
  const regions = adm1.features.map((feature) => {
    const polygons =
      feature.geometry.type === "MultiPolygon"
        ? feature.geometry.coordinates
        : [feature.geometry.coordinates];
    return {
      id: `ma-${slug(feature.properties.shapeName)}`,
      name: feature.properties.shapeName,
      countryCode: "MA",
      scopeNote:
        "Administrative region; regional rules apply only where their source says so.",
      citations: [
        {
          sourceId: "geoboundaries-mar-adm1",
          locator: `shapeName: ${feature.properties.shapeName}`,
          interpretation: "direct",
          note: "Administrative boundary only; no agronomic meaning.",
        },
      ],
      boundary: {
        sourceId: "geoboundaries-mar-adm1",
        locator: `shapeName: ${feature.properties.shapeName}, simplified (Douglas–Peucker, ${REGION_TOLERANCE_DEG}°)`,
        geometry: {
          type: "MultiPolygon",
          coordinates: polygons.map((polygon) =>
            polygon.map((ring) =>
              simplifyRing(ring, REGION_TOLERANCE_DEG).map(round),
            ),
          ),
        },
      },
    };
  });
  const profiles = base.profiles.map((profile) => ({
    ...profile,
    version: "0.4.0",
    applicability: NATIONAL_CROPS[profile.id]
      ? [
          ...profile.applicability,
          {
            regionId: "morocco-general",
            status: "candidate",
            citations: [NATIONAL_CROPS[profile.id]],
            note: NOTE,
          },
        ]
      : profile.applicability,
  }));
  return {
    sources,
    profiles,
    manifest: {
      ...base.manifest,
      version: "0.4.0",
      regions: [...base.manifest.regions, ...regions],
    },
  };
}
