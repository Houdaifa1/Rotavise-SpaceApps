// Rebuild reviewed data expectations from original-file extractions, never from
// the target database. Does not read .env. Source files remain outside git.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { prepareStoredCatalog } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { futureClimatePolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { currentFutureClimatePolicy } from "../../apps/server/dist/modules/plans/application/planning-store.js";
import { policyKey } from "../../apps/server/dist/modules/climate-scenarios/application/scenario-store.js";
const hash = (algorithm, text) =>
  createHash(algorithm).update(text).digest("hex");
const grace = JSON.parse(await readFile(process.argv[2], "utf8"));
const gedi = await Promise.all(
  process.argv.slice(3).map(async (p) => JSON.parse(await readFile(p, "utf8"))),
);
function groups(cells, scale, kind) {
  const bins = new Map();
  const seen = new Set();
  for (const c of cells) {
    const [lat, lon] =
      kind === "grace"
        ? [Math.round(c.latitude * scale), Math.round(c.longitude * scale)]
        : [Math.round(c[0] * scale), Math.round(c[1] * scale)];
    const identity = `${lat}|${lon}`;
    if (seen.has(identity)) throw Error("DUPLICATE_REFERENCE_CELL");
    seen.add(identity);
    const key = `${Math.floor(lat / scale)},${Math.floor(lon / scale)}`;
    if (!bins.has(key)) bins.set(key, []);
    if (kind === "grace")
      for (const [month, value] of c.months)
        bins.get(key).push({
          lat,
          lon,
          month,
          line: `${lat}|${lon}|${month}|${value.toFixed(3)}\n`,
        });
    else
      bins.get(key).push({
        lat,
        lon,
        month: "",
        line: `${lat}|${lon}|${c[2].toFixed(3)}|${c[3] === null ? "null" : c[3].toFixed(3)}\n`,
      });
  }
  return [...bins]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, rows]) => {
      rows.sort(
        (a, b) =>
          a.lat - b.lat || a.lon - b.lon || a.month.localeCompare(b.month),
      );
      return {
        tile: key,
        rows: rows.length,
        md5: hash("md5", rows.map((r) => r.line).join("")),
      };
    });
}
const journal = JSON.parse(
  await readFile("packages/database/migrations/meta/_journal.json", "utf8"),
);
const migrations = await Promise.all(
  journal.entries.map(async (e) => ({
    at: e.when,
    sha256: hash(
      "sha256",
      await readFile(`packages/database/migrations/${e.tag}.sql`),
    ),
  })),
);
const catalogs = [];
for (const v of (await readdir("data/catalog/releases"))
  .filter((v) => /^0\.\d+\.0$/.test(v))
  .sort((a, b) => Number(a.split(".")[1]) - Number(b.split(".")[1]))) {
  const c = await loadCatalogRelease(`data/catalog/releases/${v}`);
  catalogs.push({
    id: c.id,
    version: v,
    sha256: prepareStoredCatalog(c).sha256,
    crops: c.profiles.length,
  });
}
const snapshot = JSON.parse(
  await readFile(
    `packages/database/migrations/meta/${String(journal.entries.at(-1).idx).padStart(4, "0")}_snapshot.json`,
    "utf8",
  ),
);
const indexes = Object.values(snapshot.tables).flatMap((t) =>
  Object.values(t.indexes).map((i) => ({
    name: i.name,
    table: t.name,
    method: i.method,
    columns: i.columns.map((c) => c.expression),
  })),
);
const constraints = Object.values(snapshot.tables).flatMap((t) =>
  [
    ...Object.keys(t.checkConstraints),
    ...Object.keys(t.foreignKeys),
    ...Object.keys(t.uniqueConstraints),
    ...Object.keys(t.compositePrimaryKeys),
    ...(Object.values(t.columns).some((column) => column.primaryKey)
      ? [`${t.name}_pkey`]
      : []),
  ].map((name) => ({ table: t.name, name: name.slice(0, 63) })),
);
const triggers = [];
for (const e of journal.entries) {
  const sql = await readFile(
    `packages/database/migrations/${e.tag}.sql`,
    "utf8",
  );
  for (const m of sql.matchAll(
    /CREATE (?:CONSTRAINT )?TRIGGER\s+"?(\w+)"?[\s\S]*?\sON\s+"?(\w+)"?/gi,
  ))
    if (!triggers.some((t) => t.name === m[1]))
      triggers.push({ name: m[1], table: m[2] });
}
const tiles = (
  await readFile("tooling/climate-scenarios/morocco-tiles.txt", "utf8")
)
  .trim()
  .split("\n")
  .map((line) => line.split(/\s+/).map(Number).map(Math.floor));
const expected = {
  catalogs,
  migrations,
  indexes,
  constraints,
  triggers,
  tiles,
  policies: [
    { key: policyKey(futureClimatePolicy), units: 1500 },
    { key: policyKey(currentFutureClimatePolicy), units: 2100 },
  ],
  models: currentFutureClimatePolicy.models.map((m) => m.id),
  variables: ["tasmin", "tasmax", "tas", "pr"],
  grace: {
    sourceSha256: grace.sourceSha256,
    product: grace.product,
    bbox: [20, 37, -18, 0],
    groups: groups(grace.cells, 100, "grace"),
  },
  gedi: {
    sourceSha256: gedi[0].sourceSha256,
    product: gedi[0].product,
    bbox: [20, 37, -18, 0],
    groups: groups(
      gedi.flatMap((d) => d.cells),
      1000,
      "gedi",
    ),
  },
};
await writeFile(
  "apps/server/src/modules/health/data-expectations.ts",
  `// Generated by tooling/operations/build-data-expectations.mjs from hash-identified\n// original NASA files and reviewed repository releases/migrations. Never from DB.\nexport const dataExpectations = ${JSON.stringify(expected, null, 2)} as const;\n`,
);
console.log(
  JSON.stringify({
    catalogs: catalogs.length,
    tiles: tiles.length,
    graceGroups: expected.grace.groups.length,
    gediGroups: expected.gedi.groups.length,
  }),
);
