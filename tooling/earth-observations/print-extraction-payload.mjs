// Prints the AppEEARS request Rotavise would send for a field outline, so it
// can be read before any job is started. It makes no network call and needs no
// login.
// Usage: pnpm extractions:preview terrain|ecostress|modis <outline.geojson>
// The file holds a GeoJSON Polygon, for example
// {"type":"Polygon","coordinates":[[[-6.5503,32.3998],[-6.5496,32.3998],
//   [-6.5496,32.4004],[-6.5503,32.4004],[-6.5503,32.3998]]]}
import { readFileSync } from "node:fs";
import { fieldBoundarySchema } from "../../packages/contracts/dist/index.js";
import {
  buildExtractionRequest,
  extractionTask,
} from "../../apps/server/dist/modules/earth-observations/application/extraction-store.js";

const [kind, file] = process.argv.slice(2);
if (!["terrain", "ecostress", "modis"].includes(kind) || !file) {
  console.error(
    "usage: pnpm extractions:preview terrain|ecostress|modis <outline.geojson>",
  );
  process.exit(2);
}
const boundary = fieldBoundarySchema.parse(
  JSON.parse(readFileSync(file, "utf8")),
);
const today = new Date().toISOString().slice(0, 10);
const request = buildExtractionRequest(kind, boundary, today);
const task = extractionTask(kind, "preview", request);
console.log(JSON.stringify(task, null, 2));
console.error(
  `${kind}: ${task.params.coordinates.length} points, ${task.params.layers.length} layers, ${task.params.dates[0].startDate} to ${task.params.dates[0].endDate}`,
);
