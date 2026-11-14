// P8-comparable engine timings. Catalog, policy and engine are current; weather
// is explicitly synthetic test data (not NASA evidence). No HTTP/DB dependency
// is introduced into packages/domain. Run pnpm build:server first.
import { createHash } from "node:crypto";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { assessRotationsCore } from "../../packages/domain/dist/rotation/assess.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { rotationPlanningPolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import {
  rotationRequest,
  rotationWeather,
} from "../../tests/support/rotation.mjs";
const catalog = await loadCatalogRelease("data/catalog/releases/0.15.0");
const policy = { ...rotationPlanningPolicy, research: "benefits-2" };
const weather = rotationWeather();
const report = {
  date: new Date().toISOString(),
  machine: {
    model: os.cpus()[0].model,
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    load: os.loadavg(),
  },
  catalog: "0.15.0",
  syntheticWeather: true,
  cases: [],
};
for (const mode of ["suggest", "declared"]) {
  const request = rotationRequest({
    history: { status: "unknown" },
    preferences: {
      mode: mode === "suggest" ? "suggest" : "consider",
      considered_crop_ids:
        mode === "suggest"
          ? []
          : ["barley", "lentil", "durum-wheat", "faba-bean"],
      excluded_crop_ids: [],
      priorities: { climate: 3, water: 2, soil_health: 2, crop_health: 1 },
    },
    ...(mode === "declared"
      ? { current_rotation: { crop_ids: ["durum-wheat", "faba-bean"] } }
      : {}),
  });
  const start = performance.now();
  const cpuStart = process.cpuUsage();
  const result = assessRotationsCore(
    request,
    catalog,
    weather,
    policy,
    "2026-10-15",
    true,
    null,
    null,
    null,
    "rotation-engine-7",
  );
  const seconds = (performance.now() - start) / 1000;
  const cpu = process.cpuUsage(cpuStart);
  const row = {
    mode,
    seconds,
    cpuSeconds: (cpu.user + cpu.system) / 1000000,
    sha256: createHash("sha256").update(JSON.stringify(result)).digest("hex"),
    bytes: Buffer.byteLength(JSON.stringify(result)),
    candidates: result.candidates.length,
    schedulable: result.crops.filter((c) => c.status === "schedulable").length,
  };
  report.cases.push(row);
  console.log(JSON.stringify(row));
  if (seconds >= 6) process.exitCode = 1;
}
console.log(JSON.stringify(report, null, 2));
