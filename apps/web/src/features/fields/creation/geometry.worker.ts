import {
  gridFeatures,
  paintBoundary,
  normalizePolygon,
  interiorPoint,
  mergeBoundaries,
  GeometryError,
  type Grid,
  type Point,
} from "./geometry.js";
import { parseOutline, polygonsFromGeoJSON } from "./importOutline.js";
import type { FieldBoundary } from "@rotavise/contracts";
export type Work =
  | { kind: "grid"; bounds: [Point, Point]; grid: Grid }
  | { kind: "paint"; cells: string[]; grid: Grid }
  | { kind: "normalize"; polygon: unknown }
  | { kind: "import"; buffer: ArrayBuffer; extension: string }
  | { kind: "geojson"; data: unknown }
  | { kind: "point"; boundary: FieldBoundary }
  | { kind: "merge"; boundaries: FieldBoundary[] };
export async function runWork(work: Work): Promise<unknown> {
  switch (work.kind) {
    case "grid":
      return gridFeatures(work.bounds, work.grid);
    case "paint":
      return paintBoundary(work.cells, work.grid);
    case "normalize":
      return normalizePolygon(work.polygon);
    case "import":
      return parseOutline(work.buffer, work.extension);
    case "geojson":
      return polygonsFromGeoJSON(work.data);
    case "point":
      return interiorPoint(work.boundary);
    case "merge":
      return mergeBoundaries(work.boundaries);
  }
}
self.onmessage = (event: MessageEvent<{ id: number; work: Work }>) => {
  const { id, work } = event.data;
  void runWork(work).then(
    (result) => self.postMessage({ id, result }),
    (error) =>
      self.postMessage({
        id,
        issue: error instanceof GeometryError ? error.issue : "invalid",
      }),
  );
};
