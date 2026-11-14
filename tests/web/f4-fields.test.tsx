import { expect, test } from "@jest/globals";
import {
  fieldUpdateRequestSchema,
  type FieldProfile,
} from "@rotavise/contracts";
import {
  cropMatches,
  normalizeCropSearch,
} from "../../apps/web/src/features/crops/names.js";
import {
  cropLabels,
  type CatalogueCrop,
} from "../../apps/web/src/design/primitives/crops.js";
import {
  fieldBody,
  overlaps,
} from "../../apps/web/src/features/fields/detail/fieldData.js";
import {
  healthWith,
  soilWith,
  waterWith,
  type HealthReport,
  type SoilReading,
} from "../../apps/web/src/features/fields/detail/inputBodies.js";

const profile = {
  schema_version: "1",
  name: "Verification field",
  location: { latitude: 32.4, longitude: -6.55 },
  soil: { status: "unknown" },
  water: { status: "unknown" },
  crop_health: { status: "unknown" },
} satisfies FieldProfile;
const field = { profile, version: 3 };
const ph: SoilReading = {
  metric: "ph",
  unit: "pH",
  value: 0,
  method: "water",
  source: "laboratory_report",
  measured_on: null,
};
const organic: SoilReading = {
  metric: "organic_matter",
  unit: "percent_mass",
  value: 2,
  method: "Recorded method",
  source: "farmer_observation",
  measured_on: "2025-10-15",
};
const texture: SoilReading = {
  metric: "texture",
  classification: "Recorded class",
  classification_system: "Recorded system",
  source: "farmer_observation",
  measured_on: null,
};
const health: HealthReport = {
  crop_id: "bread-wheat",
  kind: "disease",
  name: "Observed issue",
  source: "specialist_report",
  observed_on: "2025-11-02",
  confirmation: "confirmed",
};

for (const [name, input, golden] of [
  [
    "pH",
    { soil: soilWith(profile, ph.metric, ph) },
    {
      soil: {
        status: "known",
        observations: [
          {
            metric: "ph",
            value: 0,
            unit: "pH",
            method: "water",
            measured_on: null,
            source: "laboratory_report",
          },
        ],
      },
    },
  ],
  [
    "organic matter",
    { soil: soilWith(profile, organic.metric, organic) },
    {
      soil: {
        status: "known",
        observations: [
          {
            metric: "organic_matter",
            value: 2,
            unit: "percent_mass",
            method: "Recorded method",
            measured_on: "2025-10-15",
            source: "farmer_observation",
          },
        ],
      },
    },
  ],
  [
    "texture",
    { soil: soilWith(profile, texture.metric, texture) },
    {
      soil: {
        status: "known",
        observations: [
          {
            metric: "texture",
            classification: "Recorded class",
            classification_system: "Recorded system",
            measured_on: null,
            source: "farmer_observation",
          },
        ],
      },
    },
  ],
  [
    "water",
    { water: waterWith("irrigation_limited") },
    { water: { status: "reported", availability: "irrigation_limited" } },
  ],
  [
    "health",
    { crop_health: healthWith(profile, undefined, health) },
    {
      crop_health: {
        status: "reported",
        observations: [
          {
            crop_id: "bread-wheat",
            kind: "disease",
            name: "Observed issue",
            observed_on: "2025-11-02",
            source: "specialist_report",
            confirmation: "confirmed",
          },
        ],
      },
    },
  ],
] as const) {
  test(`${name} update uses the v1 field JSON and preserves other fields`, () => {
    const body = fieldBody(field, input);
    expect(body).toEqual({
      expectedVersion: 3,
      profile: { ...profile, ...golden },
    });
    expect(fieldUpdateRequestSchema.parse(body)).toEqual(body);
  });
}

test("removing the last soil or health observation returns unknown and clears no other data", () => {
  expect(
    soilWith(
      { ...profile, soil: { status: "known", observations: [ph] } },
      "ph",
    ),
  ).toEqual({ status: "unknown" });
  expect(
    healthWith(
      {
        ...profile,
        crop_health: { status: "reported", observations: [health] },
      },
      health,
    ),
  ).toEqual({ status: "unknown" });
  expect(waterWith("unknown")).toEqual({ status: "unknown" });
  expect(() =>
    fieldBody(field, {
      crop_health: healthWith(profile, undefined, {
        ...health,
        source: "farmer_report",
      }),
    }),
  ).toThrow();
});

test("overlap includes shared endpoints and excludes only the current history record", () => {
  const entry = {
    schema_version: "1",
    crop_id: "bread-wheat",
    planted_on: "2025-10-01",
    harvested_on: "2026-06-15",
  } as const;
  const items = [
    { id: "editing", version: 1, createdAt: "", updatedAt: "", entry },
  ];
  expect(
    overlaps(
      { ...entry, planted_on: "2026-06-15", harvested_on: "2026-07-01" },
      items,
    ),
  ).toBe(true);
  expect(
    overlaps(
      { ...entry, planted_on: "2026-06-16", harvested_on: "2026-07-01" },
      items,
    ),
  ).toBe(false);
  expect(overlaps(entry, items, "editing")).toBe(false);
});

test("search considers every name in all four languages and the scientific name", () => {
  const crop: CatalogueCrop = {
    id: "barley",
    name: "Barley",
    scientificName: "Hordeum vulgare",
    family: "Poaceae",
    reviewStatus: "pending",
    cultivars: [],
    localNames: [
      { language: "fr", name: "Orge" },
      { language: "ar", name: "شَعِير" },
      { language: "ary", name: "شّعير" },
      { language: "en", name: "Common barley" },
    ],
  };
  for (const query of [
    "barley",
    "orge",
    "شَعِير",
    "شّعير",
    "Hordeum",
    "شـعير",
    "Common barley",
  ])
    expect(cropMatches(crop, query)).toBe(true);
  expect(cropMatches(crop, "beet")).toBe(false);
  expect(normalizeCropSearch("أَإِآٱـ")).toBe("اااا");
  expect(
    cropLabels(
      {
        ...crop,
        localNames: crop.localNames.filter((name) => name.language !== "ary"),
      },
      "ary",
    )[0],
  ).toMatchObject({ language: "ar", fallback: true });
});
