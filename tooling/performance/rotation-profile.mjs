// Times the rotation engine on a real catalog release and prints a hash of
// each result so a speed-up can be checked for identical output.
// Usage: node tooling/performance/rotation-profile.mjs [release] [--near]
// --near runs the future-climate case under the live policy, which adds the
// near-term period (and its synthetic series) to the mid-century worlds.
// Not agronomic evidence: weather is the synthetic test fixture.
import { createHash } from "node:crypto";
import {
  assessRotationsCore,
  rotationNearTermNeedsCore,
  rotationScenarioNeedsCore,
} from "../../packages/domain/dist/rotation/assess.js";
import { currentFutureClimatePolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  rotationWeather,
  rotationRequest,
  rotationPolicy,
  syntheticScenarioSeries,
} from "../../tests/support/rotation.mjs";

const near = process.argv.includes("--near");
const release =
  process.argv.slice(2).find((a) => !a.startsWith("--")) ?? "0.11.0";
const assessedOn = "2026-10-15";
const catalog = await loadCatalogRelease(`data/catalog/releases/${release}`);
const weather = rotationWeather();
const priorities = { climate: 3, water: 2, soil_health: 2, crop_health: 1 };
const preferences = (prefs) => ({
  ...prefs,
  excluded_crop_ids: [],
  priorities,
});
const four = ["spelt", "hairy-vetch", "sainfoin", "durum-wheat"];
const cases = {
  whole_catalog_suggest: {
    request: rotationRequest({
      history: { status: "unknown" },
      preferences: preferences({ mode: "suggest", considered_crop_ids: [] }),
    }),
  },
  consider_four: {
    request: rotationRequest({
      history: { status: "unknown" },
      preferences: preferences({ mode: "consider", considered_crop_ids: four }),
    }),
  },
  // A tight climate budget: exhaustion must disable climate exactly as before.
  budget_exhausted: {
    request: rotationRequest({
      history: { status: "unknown" },
      preferences: preferences({ mode: "consider", considered_crop_ids: four }),
    }),
    policy: { ...rotationPolicy, maxClimateDayVisits: 300000 },
  },
  engine7_declared_with_futures: {
    request: rotationRequest({
      history: { status: "unknown" },
      current_rotation: { crop_ids: ["durum-wheat", "faba-bean"] },
      preferences: preferences({
        mode: "consider",
        considered_crop_ids: ["barley", "lentil", "durum-wheat", "faba-bean"],
      }),
    }),
    engine: "rotation-engine-7",
    futures: true,
  },
};
const sha = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
for (const [name, c] of Object.entries(cases)) {
  const base = c.policy ?? rotationPolicy;
  const policy =
    near && c.futures
      ? { ...base, futureClimate: currentFutureClimatePolicy }
      : base;
  const wanted = c.futures
    ? rotationScenarioNeedsCore(c.request, catalog, policy, assessedOn)
    : null;
  const series = wanted
    ? [
        ...syntheticScenarioSeries(wanted),
        ...(near
          ? syntheticScenarioSeries(
              rotationNearTermNeedsCore(c.request, catalog, policy, assessedOn),
            ).map((s) => ({
              ...s,
              unitId: s.unitId.replace("-9000-", "-9100-"),
            }))
          : []),
      ]
    : null;
  const started = process.hrtime.bigint();
  const cpuStarted = process.cpuUsage();
  const r = assessRotationsCore(
    c.request,
    catalog,
    weather,
    policy,
    assessedOn,
    true,
    series,
    null,
    null,
    c.engine ?? "rotation-engine-6",
  );
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const cpu = process.cpuUsage(cpuStarted);
  console.log(
    JSON.stringify({
      case: name,
      release,
      seconds: Math.round(seconds * 1000) / 1000,
      cpuSeconds: Math.round(((cpu.user + cpu.system) / 1e6) * 1000) / 1000,
      schedulable: r.crops.filter((x) => x.status === "schedulable").length,
      candidates: r.candidates.length,
      sha256: sha(r),
    }),
  );
}
