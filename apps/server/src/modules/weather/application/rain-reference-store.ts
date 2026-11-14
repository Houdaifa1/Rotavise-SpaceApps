import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import {
  RAIN_REFERENCE_DATASET,
  RAIN_REFERENCE_FIRST_YEAR,
  RAIN_REFERENCE_LAST_YEAR,
  rainCell,
  rainReferenceSchema,
  type RainReference,
} from "@rotavise/contracts";
import { stableJson } from "../../../common/serialization/stable-json.js";
import { normalizeGiovanni } from "../../earth-observations/providers/normalization.js";
import type { RainTransport } from "../../earth-observations/providers/giovanni/giovanni.client.js";

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");
// At least this share of days per month must have a value.
const MINIMUM_MONTH_COVERAGE = 0.9;
export function normalizeRainReference(
  raw: Uint8Array,
  cell: RainReference["cell"],
  retrievedAt: string,
): RainReference {
  const { days } = normalizeGiovanni(raw);
  const monthly = Array.from({ length: 12 }, () => ({
    sum: 0,
    present: 0,
    all: 0,
  }));
  for (const day of days) {
    const year = Number(day.date.slice(0, 4));
    if (year < RAIN_REFERENCE_FIRST_YEAR || year > RAIN_REFERENCE_LAST_YEAR)
      continue;
    const month = monthly[Number(day.date.slice(5, 7)) - 1]!;
    month.all++;
    if (day.mm !== null) {
      month.sum += day.mm;
      month.present++;
    }
  }
  const years = RAIN_REFERENCE_LAST_YEAR - RAIN_REFERENCE_FIRST_YEAR + 1;
  const monthlyMeanMm = monthly.map((m) => {
    if (!m.all || m.present / m.all < MINIMUM_MONTH_COVERAGE)
      throw new Error("RAIN_REFERENCE_INCOMPLETE");
    // Scaled by coverage so a few missing days do not read as dry days.
    return Number(((m.sum / m.present) * (m.all / years)).toFixed(2));
  });
  return rainReferenceSchema.parse({
    dataset: RAIN_REFERENCE_DATASET,
    cell,
    firstYear: RAIN_REFERENCE_FIRST_YEAR,
    lastYear: RAIN_REFERENCE_LAST_YEAR,
    retrievedAt,
    monthlyMeanMm,
  });
}
export class RainReferenceStore {
  constructor(
    private readonly pool: Pool,
    private readonly transport: RainTransport | null,
  ) {}
  // The stored reference, fetched once. Null without an Earthdata account or
  // when GPM cannot answer: the plan then uses POWER rain and says so.
  async reference(latitude: number, longitude: number, signal: AbortSignal) {
    const cell = rainCell(latitude, longitude);
    const key = `${cell.latitude},${cell.longitude}`;
    const read = async () => {
      const row = (
        await this.pool.query<{
          raw: string;
          normalized_sha256: string;
          retrieved_at: Date;
        }>(
          "SELECT raw,normalized_sha256,retrieved_at FROM rain_references WHERE cell_key=$1",
          [key],
        )
      ).rows[0];
      if (!row) return null;
      const reference = normalizeRainReference(
        Buffer.from(row.raw, "base64"),
        cell,
        row.retrieved_at.toISOString(),
      );
      if (sha256(stableJson(reference)) !== row.normalized_sha256)
        throw new Error("RAIN_REFERENCE_STORED_INVALID");
      return reference;
    };
    const stored = await read();
    if (stored || !this.transport) return stored;
    try {
      const raw = await this.transport.daily(
        cell.latitude,
        cell.longitude,
        `${RAIN_REFERENCE_FIRST_YEAR}-01-01`,
        `${RAIN_REFERENCE_LAST_YEAR}-12-31`,
        signal,
      );
      const retrievedAt = new Date().toISOString();
      const reference = normalizeRainReference(raw, cell, retrievedAt);
      await this.pool.query(
        "INSERT INTO rain_references(id,cell_key,raw,normalized_sha256,retrieved_at) VALUES($1,$2,$3,$4,$5) ON CONFLICT(cell_key) DO NOTHING",
        [
          randomUUID(),
          key,
          Buffer.from(raw).toString("base64"),
          sha256(stableJson(reference)),
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
