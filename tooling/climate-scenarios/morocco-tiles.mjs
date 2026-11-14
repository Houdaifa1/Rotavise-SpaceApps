// Lists the 1° future-climate tiles that touch Morocco's national outline in
// catalog 0.4.0, north first. Prints one "latitude longitude" line per tile,
// using each tile's centre (any point in a tile prepares that tile).
// Usage: node tooling/climate-scenarios/morocco-tiles.mjs
import { readFileSync } from "node:fs";
import { containsPoint } from "../../packages/domain/dist/rotation/geometry.js";

const manifest = JSON.parse(
  readFileSync("data/catalog/releases/0.4.0/manifest.json", "utf8"),
);
const { geometry } = manifest.regions.find(
  (r) => r.id === "morocco-general",
).boundary;
const STEP = 0.05;
const touches = (lat, lon) => {
  for (let y = lat; y <= lat + 1; y += STEP)
    for (let x = lon; x <= lon + 1; x += STEP)
      if (containsPoint(geometry, x, y)) return true;
  return false;
};
for (let lat = 36; lat >= 20; lat--)
  for (let lon = -18; lon <= -1; lon++)
    if (touches(lat, lon)) console.log(`${lat + 0.5} ${lon + 0.5}`);
