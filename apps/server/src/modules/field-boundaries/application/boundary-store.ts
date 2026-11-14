import type { Pool } from "pg";
import {
  boundaryContains,
  fieldSuggestionSchema,
  fieldBoundaryTileResponseSchema,
  fieldBoundaryAtResponseSchema,
  FIELD_SUGGESTION_LIMITATIONS,
  type FieldSuggestion,
} from "@rotavise/contracts";

const notice = {
  attribution:
    "Fields of The World (Robinson et al., 2026), CC BY 4.0" as const,
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/" as const,
  sourceUrl: "https://source.coop/ftw/global-data" as const,
  limitations: [...FIELD_SUGGESTION_LIMITATIONS],
};
export function tileBounds(x: number, y: number) {
  const lon = (n: number) => (n / 16384) * 360 - 180;
  const lat = (n: number) =>
    (Math.atan(Math.sinh(Math.PI * (1 - (2 * n) / 16384))) * 180) / Math.PI;
  return [lon(x), lat(y + 1), lon(x + 1), lat(y)] as const;
}
export class BoundaryStore {
  constructor(readonly pool: Pool) {}
  private async candidates(
    bounds: readonly number[],
  ): Promise<FieldSuggestion[]> {
    const [west, south, east, north] = bounds;
    const result = await this.pool.query(
      `SELECT c.* FROM boundary_candidates c
      JOIN boundary_datasets d ON d.sha256=c.dataset_sha256 AND d.active
      WHERE c.bounds && box(point($1,$2),point($3,$4))
      ORDER BY c.area_hectares,c.source_id LIMIT 5001`,
      [west, south, east, north],
    );
    // Fail closed instead of silently truncating a dense tile/point result.
    if (result.rows.length > 5000) throw new Error("BOUNDARY_RESULT_LIMIT");
    return result.rows.map((row) =>
      fieldSuggestionSchema.parse({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          id: `ftw-2025:${row.dataset_sha256}:${row.source_id}`,
          areaHectares: row.area_hectares,
          source: "ftw-global-2025",
          confidence: row.confidence,
          datasetSha256: row.dataset_sha256,
          holesDropped: row.holes_dropped,
          areaChangePercent: row.area_change_percent,
        },
      }),
    );
  }
  async tile(x: number, y: number) {
    // Return whole shapes intersecting the tile's bounding box, never clipped
    // fragments; the same stable id can appear in adjacent tiles.
    const features = await this.candidates(tileBounds(x, y));
    return fieldBoundaryTileResponseSchema.parse({
      ...notice,
      type: "FeatureCollection",
      features,
      coverage: features.length ? "suggestions" : "no_fields_found",
    });
  }
  async at(latitude: number, longitude: number) {
    const fields = await this.candidates([
      longitude,
      latitude,
      longitude,
      latitude,
    ]);
    // Strict interior, as for the shared saved-field contract. Where source
    // polygons overlap, choose the smallest containing shape, then stable id.
    const field = fields.find((f) =>
      boundaryContains(f.geometry, latitude, longitude),
    );
    return field
      ? fieldBoundaryAtResponseSchema.parse({ ...notice, field })
      : null;
  }
}
