import { readFileSync } from "node:fs";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { WEATHER_REGISTRY } from "../../apps/server/dist/modules/weather/providers/nasa-power/parameters.js";
import {
  datesBetween,
  climateWeatherVariables,
} from "../../packages/contracts/dist/index.js";
import { normalizedWeatherHash } from "../../packages/domain/dist/index.js";

export const policy = {
  version: "historical-policy-1",
  firstAnchorYear: 2010,
  lastAnchorYear: 2015,
  splitAfterYear: 2012,
  minimumCompleteAnalogs: 4,
  minimumPeriodAnalogs: 2,
};
export function syntheticSnapshot(
  startDate,
  endDate,
  number = 1,
  mapper = () => ({
    temperatureMin: 5,
    temperatureMax: 22,
    temperatureMean: 12,
    precipitation: 0,
  }),
  variables = [...climateWeatherVariables],
) {
  const request = {
    latitude: 32.3,
    longitude: -6.3,
    startDate,
    endDate,
    variables,
  };
  const dates = datesBetween(startDate, endDate);
  const raw = {
    type: "Feature",
    geometry: { type: "Point", coordinates: [-6.3, 32.3, 528.93] },
    properties: {
      parameter: Object.fromEntries(
        variables.map((v) => [
          WEATHER_REGISTRY[v].parameter,
          Object.fromEntries(
            dates.map((d, i) => [
              d.replaceAll("-", ""),
              mapper(d, i)[v] ?? -999,
            ]),
          ),
        ]),
      ),
    },
    header: {
      api: { version: "synthetic-test-1", name: "POWER Daily API" },
      sources: ["MERRA2"],
      fill_value: -999,
      time_standard: "UTC",
      start: startDate.replaceAll("-", ""),
      end: endDate.replaceAll("-", ""),
    },
    parameters: Object.fromEntries(
      variables.map((v) => [
        WEATHER_REGISTRY[v].parameter,
        {
          units: WEATHER_REGISTRY[v].sourceUnit,
          longname: "Synthetic test value; no real weather",
        },
      ]),
    ),
    messages: [],
  };
  // Exact-coordinate synthetic evidence, as adapter 2 stored it.
  const snapshot = normalizeNasa(
    JSON.stringify(raw),
    request,
    "2026-09-27T00:00:00.000Z",
    "2",
  );
  return {
    snapshotId: `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`,
    normalizedSha256: normalizedWeatherHash(snapshot),
    synthetic: true,
    snapshot,
  };
}
export function rehash(evidence) {
  for (const e of evidence)
    e.normalizedSha256 = normalizedWeatherHash(e.snapshot);
  return evidence;
}
export function climateFixture() {
  const v = JSON.parse(
    readFileSync("tests/support/fixtures/engine.synthetic.json", "utf8"),
  );
  if (
    !v.synthetic ||
    !v.catalog.synthetic ||
    v.catalog.profiles.some((p) => !p.synthetic) ||
    v.catalog.sources.some((s) => !s.synthetic)
  )
    throw new Error("SYNTHETIC_LABEL_REQUIRED");
  const gamma = JSON.parse(
    JSON.stringify(v.catalog.profiles[1]).replaceAll(
      "synthetic-beta",
      "synthetic-gamma",
    ),
  );
  gamma.identity.family = "Solanaceae";
  gamma.identity.name = "Invented synthetic gamma";
  v.catalog.profiles.push(gamma);
  v.context.cultivars.push({ cropId: gamma.id, cultivarId: gamma.cultivar.id });
  for (const [i, p] of v.catalog.profiles.entries()) {
    const base = structuredClone(p.knowledge.duration.rules[0]);
    for (const key of ["metric", "unit", "timeBasis", "stage", "min", "max"])
      delete base[key];
    const rule = (metric, extra) => ({
      ...base,
      severity: "soft",
      id: `${p.id}-${metric.replaceAll("_", "-")}`,
      metric,
      ...extra,
    });
    p.knowledge.temperatureRequirements = {
      status: "sourced",
      rules: [
        rule("temperature", {
          unit: "degC",
          timeBasis: "daily_maximum",
          stage: "whole_cycle",
          medium: "air",
          min: 0,
          max: 40,
        }),
      ],
    };
    p.knowledge.waterDemandClass = {
      status: "sourced",
      rules: [
        rule("water_demand_class", {
          unit: "relative_class",
          timeBasis: "declared_comparison_method",
          stage: "whole_cycle",
          value: ["low", "high", "moderate"][i],
          comparisonMethod:
            "Invented comparable ordinal classes, synthetic only",
        }),
      ],
    };
    p.knowledge.rotationRestrictions.rules.push(
      rule("preferred_predecessor_family", {
        unit: "family",
        timeBasis: "previous_crop",
        stage: "whole_cycle",
        family: i === 1 ? "Poaceae" : "Fabaceae",
      }),
    );
    const additional = structuredClone(p.knowledge.plantingWindows.rules[0]);
    additional.id = `${p.id}-additional-window`;
    additional.start = i === 0 ? "01-04" : "12-30";
    additional.end = i === 0 ? "01-06" : "12-31";
    p.knowledge.plantingWindows.rules.push(additional);
  }
  v.policy = structuredClone(policy);
  v.weather = Array.from({ length: 6 }, (_, i) =>
    syntheticSnapshot(
      `${2010 + i}-12-29`,
      `${2011 + i}-01-10`,
      i + 1,
      (_, d) => ({
        temperatureMin: 5 + i,
        temperatureMax: 22 + i,
        temperatureMean: 12 + i,
        precipitation: [0, 0.5, 1, 2][d % 4],
      }),
    ),
  );
  v.purpose =
    "Invented crops, review actors and weather: infrastructure only, never farmer advice";
  return v;
}
