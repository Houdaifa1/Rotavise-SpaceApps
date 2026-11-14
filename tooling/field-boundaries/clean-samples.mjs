import { readFileSync, writeFileSync } from "node:fs";
import { cleanBoundary } from "../../apps/server/dist/modules/field-boundaries/application/clean-boundary.js";
const root = "docs/evidence/field-boundaries/2026-11-10";
const report = {
  policy: "outer-ring-dp-5m-2pct-1",
  accuracy: "unmeasured",
  sites: {},
};
for (const name of ["tadla", "beni-mellal", "gharb", "souss", "saiss"]) {
  const collection = JSON.parse(
    readFileSync(`${root}/samples/ftw-${name}.geojson`),
  );
  const features = collection.features.filter(
    (f) => f.properties.year === 2025,
  );
  const results = features.map((f) => cleanBoundary(f.geometry));
  const kept = results.filter(Boolean);
  report.sites[name] = {
    input: features.length,
    retained: kept.length,
    dropped: results.filter((r) => !r).length,
    holesDropped: kept.reduce((s, r) => s + r.holesDropped, 0),
    maxAreaChangePercent: Math.max(...kept.map((r) => r.areaChangePercent)),
  };
  collection.features = features.flatMap((f, i) =>
    results[i] ? [{ ...f, geometry: results[i].geometry }] : [],
  );
  writeFileSync(
    `${root}/samples/cleaned-${name}.geojson`,
    JSON.stringify(collection),
  );
}
writeFileSync(
  `${root}/samples/cleaning-summary.json`,
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
