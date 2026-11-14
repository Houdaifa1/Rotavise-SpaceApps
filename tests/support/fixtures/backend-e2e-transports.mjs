// Test-only replay of original P9 bytes. No manufactured NASA observations.
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { GiovanniClient } from "../../../apps/server/dist/modules/earth-observations/providers/giovanni/giovanni.client.js";
import { ObservationError } from "../../../apps/server/dist/modules/earth-observations/providers/appeears/appeears.client.js";
import { AppeearsClient } from "../../../apps/server/dist/modules/earth-observations/providers/appeears/appeears.client.js";
import { ExtractionStore } from "../../../apps/server/dist/modules/earth-observations/application/extraction-store.js";

export const evidenceRoot = "docs/evidence/live/2026-11-10-b5";
export const rawFiles = {
  terrain: ["docs/evidence/live/2026-11-09/NASADEM-NC-001-results.csv"],
  ecostress: [
    "docs/evidence/live/2026-11-09/ECO-L2T-LSTE-002-results.csv",
    "docs/evidence/live/2026-11-09/ECO-L4T-ESI-002-results.csv",
  ],
  modis: [`${evidenceRoot}/MOD13Q1-061-results.csv`],
};
export const requiredFiles = (kind) => [
  ...rawFiles[kind],
  `${evidenceRoot}/pilot-extractions.json`,
  `${evidenceRoot}/manifest.json`,
];
export const available = (kind) => requiredFiles(kind).every(existsSync);
export function installExtractionReplay() {
  assert.equal(process.env.NODE_ENV, "test", "Replay is test-only");
  // No stored daily pilot baseline: exercise the documented POWER fallback.
  GiovanniClient.prototype.daily = async function () {
    throw new ObservationError("OBSERVATIONS_NOT_CONFIGURED");
  };
  const referenceFile = `${evidenceRoot}/pilot-extractions.json`;
  const stored = existsSync(referenceFile)
    ? JSON.parse(readFileSync(referenceFile))
    : [];
  const tasks = new Map();
  AppeearsClient.prototype.submit = async function (task) {
    const product = task.params.layers[0].product;
    const kind = product.startsWith("NASADEM")
      ? "terrain"
      : product.startsWith("MOD13")
        ? "modis"
        : "ecostress";
    assert.ok(available(kind), `Missing real ${kind} bytes`);
    const original = stored.find((r) => r.kind === kind);
    // A replay cannot assign observations from another place or sample grid.
    assert.deepEqual(
      task.params.coordinates.map(({ id, latitude, longitude }) => ({
        id,
        latitude,
        longitude,
      })),
      original.request.points,
    );
    const id = `replay-${kind}`;
    tasks.set(id, rawFiles[kind]);
    return id;
  };
  AppeearsClient.prototype.status = async function (id) {
    assert.ok(tasks.has(id));
    return "done";
  };
  AppeearsClient.prototype.bundle = async function (id) {
    return tasks.get(id).map((path, i) => {
      const bytes = readFileSync(path);
      return {
        fileId: String(i),
        name: path.split("/").at(-1),
        size: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    });
  };
  AppeearsClient.prototype.download = async function (id, file) {
    return readFileSync(tasks.get(id)[Number(file.fileId)]);
  };
  AppeearsClient.prototype.remove = async function (id) {
    tasks.delete(id);
  };
  // Only the remote waiting time is removed. Real queue jobs, state transitions,
  // parsing, file hashes, result hashing and persistence still run unchanged.
  const enqueue = ExtractionStore.prototype.enqueue;
  ExtractionStore.prototype.enqueue = function (id) {
    return enqueue.call(this, id, 0);
  };
}
