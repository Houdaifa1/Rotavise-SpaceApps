import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  SOIL_ATTRIBUTION,
  SOIL_DATASET,
  soilCell,
  soilDepths,
  soilEstimateSchema,
  soilProperties,
  soilPropertyScale,
  type SoilEstimate,
  type SoilProperty,
} from "@rotavise/contracts";
import { stableJson } from "../../../common/serialization/stable-json.js";
import { readSoilTiff } from "../providers/soilgrids/geotiff.js";
import {
  SoilGridsProvider,
  type SoilProvider,
} from "../providers/soilgrids/soilgrids.provider.js";

const NO_DATA = -32768;
const THICKNESS = { "0-5cm": 5, "5-15cm": 10, "15-30cm": 15 } as const;
const sha256 = (v: string | Uint8Array) =>
  createHash("sha256").update(v).digest("hex");
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
};
const FIELDS: Record<SoilProperty, keyof SoilEstimate> = {
  phh2o: "phWater",
  clay: "clayPercent",
  sand: "sandPercent",
  silt: "siltPercent",
  soc: "organicCarbonGPerKg",
  bdod: "bulkDensityGPerCm3",
  cec: "cationExchangeCmolPerKg",
  nitrogen: "nitrogenGPerKg",
};
// Turns the stored responses into an estimate, so every read can be re-derived
// from the raw bytes.
export function normalizeSoil(
  layers: {
    property: SoilProperty;
    depth: keyof typeof THICKNESS;
    base64: string;
  }[],
  cell: { latitude: number; longitude: number },
  retrievedAt: string,
): SoilEstimate {
  const fields: Partial<Record<keyof SoilEstimate, number | null>> = {};
  for (const property of soilProperties) {
    let sum = 0,
      weight = 0;
    for (const depth of soilDepths) {
      const layer = layers.find(
        (l) => l.property === property && l.depth === depth,
      );
      if (!layer) throw new Error("SOIL_LAYER_MISSING");
      const { values } = readSoilTiff(Buffer.from(layer.base64, "base64"));
      // Water, cities and bare rock are stored as no data or zero.
      const present = values.filter((v) => v !== NO_DATA && v > 0);
      if (present.length * 2 < values.length) continue;
      sum += median(present) * THICKNESS[depth];
      weight += THICKNESS[depth];
    }
    fields[FIELDS[property]] =
      weight === 30
        ? Number((sum / weight / soilPropertyScale[property]).toFixed(2))
        : null;
  }
  return soilEstimateSchema.parse({
    dataset: SOIL_DATASET,
    attribution: SOIL_ATTRIBUTION,
    adapterVersion: "1",
    cell,
    depth: "0-30cm",
    retrievedAt,
    ...fields,
  });
}
export class SoilStore {
  constructor(
    private readonly pool: Pool,
    private readonly provider: SoilProvider = new SoilGridsProvider(),
  ) {}
  // The stored estimate for the field's cell, fetched once and kept. Returns
  // null when SoilGrids cannot answer: soil is then simply reported as unknown.
  async estimate(
    latitude: number,
    longitude: number,
    signal: AbortSignal,
  ): Promise<(SoilEstimate & { id: string; sha256: string }) | null> {
    const cell = soilCell(latitude, longitude);
    const key = `${cell.latitude},${cell.longitude}`;
    const read = async () => {
      const row = (
        await this.pool.query<{
          id: string;
          layers: Parameters<typeof normalizeSoil>[0];
          normalized_sha256: string;
          retrieved_at: Date;
        }>(
          "SELECT id,layers,normalized_sha256,retrieved_at FROM soil_estimates WHERE cell_key=$1",
          [key],
        )
      ).rows[0];
      if (!row) return null;
      const estimate = normalizeSoil(
        row.layers,
        cell,
        row.retrieved_at.toISOString(),
      );
      if (sha256(stableJson(estimate)) !== row.normalized_sha256)
        throw new Error("SOIL_STORED_INVALID");
      return { ...estimate, id: row.id, sha256: row.normalized_sha256 };
    };
    const stored = await read();
    if (stored) return stored;
    try {
      const requests = soilProperties.flatMap((property) =>
        soilDepths.map((depth) => ({ property, depth })),
      );
      const layers: Parameters<typeof normalizeSoil>[0] = [];
      const work = async () => {
        for (let next = requests.shift(); next; next = requests.shift()) {
          const bytes = await this.provider.fetch({ ...cell, ...next }, signal);
          layers.push({
            ...next,
            base64: Buffer.from(bytes).toString("base64"),
          });
        }
      };
      await Promise.all([work(), work(), work()]);
      const retrievedAt = new Date().toISOString();
      const estimate = normalizeSoil(layers, cell, retrievedAt);
      // Cities and water have no soil values; nothing useful to keep.
      if (estimate.phWater === null && estimate.clayPercent === null)
        return null;
      await this.pool.query(
        "INSERT INTO soil_estimates(id,cell_key,layers,normalized_sha256,retrieved_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(cell_key) DO NOTHING",
        [
          randomUUID(),
          key,
          JSON.stringify(layers),
          sha256(stableJson(estimate)),
          retrievedAt,
        ],
      );
      return await read();
    } catch (error) {
      if (signal.aborted) throw error;
      return null;
    }
  }
}
