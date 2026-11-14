import type { Pool } from "pg";
import { z } from "zod";
import {
  fieldProfileSchema,
  waterStorageResultSchema,
  type WaterStorageResult,
} from "@rotavise/contracts";
import {
  WATER_TREND_POLICY,
  WaterTrendError,
  waterStorageTrend,
} from "@rotavise/domain";
import { PlanError } from "../../plans/application/plan-policy.js";

// GRACE / GRACE-FO mascon months, imported once from a file somebody
// downloaded with their own Earthdata login (tooling/earth-observations).
// The nearest 0.5 degree cell stands for the region; the satellites resolve
// water storage over hundreds of kilometres, so it says nothing about a field.
export const graceImportSchema = z.strictObject({
  product: z.string().min(1).max(200),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  cells: z
    .array(
      z.strictObject({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        months: z
          .array(
            z.tuple([
              z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
              z.number().finite().min(-2000).max(2000),
            ]),
          )
          .min(1)
          .max(1000),
      }),
    )
    .min(1)
    .max(5000),
});
export type GraceImport = z.infer<typeof graceImportSchema>;
const e2 = (v: number) => Math.round(v * 100);
function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = Math.PI / 180;
  const a =
    Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
    Math.cos(lat1 * rad) *
      Math.cos(lat2 * rad) *
      Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
  return 2 * 6371.0088 * Math.asin(Math.sqrt(a));
}
export class WaterStorageService {
  constructor(readonly pool: Pool) {}
  // Writes once per product: months already stored are left as they are.
  async import(file: unknown) {
    const data = graceImportSchema.parse(file);
    const client = await this.pool.connect();
    let inserted = 0;
    try {
      await client.query("BEGIN");
      const rows = data.cells.flatMap((cell) =>
        cell.months.map(([month, lwe]) => ({
          latitude: e2(cell.latitude),
          longitude: e2(cell.longitude),
          month,
          lwe,
        })),
      );
      for (let offset = 0; offset < rows.length; offset += 5000) {
        const batch = rows.slice(offset, offset + 5000);
        const result = await client.query(
          `INSERT INTO regional_water_storage(product,latitude_e2,longitude_e2,month,lwe_cm,source_sha256)
          SELECT $1::text,u.latitude,u.longitude,u.month,u.lwe,$6::text
          FROM unnest($2::int[],$3::int[],$4::text[],$5::numeric[]) AS u(latitude,longitude,month,lwe)
          ON CONFLICT DO NOTHING`,
          [
            data.product,
            batch.map((r) => r.latitude),
            batch.map((r) => r.longitude),
            batch.map((r) => r.month),
            batch.map((r) => r.lwe),
            data.sourceSha256,
          ],
        );
        inserted += result.rowCount ?? 0;
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
    return { cells: data.cells.length, inserted };
  }
  async forField(
    userId: string,
    fieldId: string,
  ): Promise<
    | { available: true; result: WaterStorageResult }
    | { available: false; reason: string }
  > {
    const field = (
      await this.pool.query<{ profile: unknown }>(
        `SELECT f.profile FROM fields f LEFT JOIN auth_users u ON u.id=f.user_id
        WHERE f.id=$1 AND $2::uuid IN (f.user_id,f.guest_owner_id) AND (f.guest_owner_id IS NOT NULL OR u.email_verified)`,
        [fieldId, userId],
      )
    ).rows[0];
    if (!field) throw new PlanError("NOT_FOUND");
    const { location } = fieldProfileSchema.parse(field.profile);
    const cells = (
      await this.pool.query<{ product: string; lat: number; lon: number }>(
        // This table covers Morocco. A one-degree latitude/two-degree
        // longitude box contains the existing 100 km coverage radius there.
        "SELECT DISTINCT product, latitude_e2 lat, longitude_e2 lon FROM regional_water_storage WHERE latitude_e2 BETWEEN $1 AND $2 AND longitude_e2 BETWEEN $3 AND $4",
        [
          e2(location.latitude - 1),
          e2(location.latitude + 1),
          e2(location.longitude - 2),
          e2(location.longitude + 2),
        ],
      )
    ).rows;
    if (!cells.length) {
      const imported = (
        await this.pool.query("SELECT 1 FROM regional_water_storage LIMIT 1")
      ).rowCount;
      return {
        available: false,
        reason: imported
          ? "WATER_STORAGE_OUTSIDE_IMPORT"
          : "WATER_STORAGE_NOT_IMPORTED",
      };
    }
    const nearest = cells
      .map((c) => ({
        ...c,
        km: distanceKm(
          location.latitude,
          location.longitude,
          c.lat / 100,
          c.lon / 100,
        ),
      }))
      .sort((a, b) => a.km - b.km || (a.product < b.product ? 1 : -1))[0]!;
    // GRACE's effective resolution is far coarser than its 0.5 degree grid, but
    // a cell much farther than the grid step means the import missed the area.
    if (nearest.km > 100)
      return { available: false, reason: "WATER_STORAGE_OUTSIDE_IMPORT" };
    const series = (
      await this.pool.query<{ month: string; lwe: string }>(
        "SELECT month, lwe_cm::text lwe FROM regional_water_storage WHERE product=$1 AND latitude_e2=$2 AND longitude_e2=$3 ORDER BY month",
        [nearest.product, nearest.lat, nearest.lon],
      )
    ).rows.map((r) => ({ month: r.month, lweCm: Number(r.lwe) }));
    let trend;
    try {
      trend = waterStorageTrend(series, WATER_TREND_POLICY);
    } catch (error) {
      if (error instanceof WaterTrendError)
        return { available: false, reason: "WATER_STORAGE_SERIES_TOO_SHORT" };
      throw error;
    }
    return {
      available: true,
      result: waterStorageResultSchema.parse({
        kind: "grace",
        policyVersion: WATER_TREND_POLICY.version,
        product: nearest.product,
        cell: {
          latitude: nearest.lat / 100,
          longitude: nearest.lon / 100,
          distanceKm: Number(nearest.km.toFixed(1)),
        },
        resolutionNote:
          "The satellites sense water storage over areas of hundreds of kilometres. This is the regional trend around your field, not water under it.",
        trend,
        recentMonths: series.slice(-36).map((s) => ({
          month: s.month,
          anomalyCm: Number(s.lweCm.toFixed(2)),
        })),
        explanations: [
          "grace.equivalent_water_height",
          "grace.trend",
          "grace.regional_not_field",
        ],
        provenance: [
          {
            item: "GRACE and GRACE-FO monthly mass-change mascon solution",
            origin: "sourced",
            reference:
              "NASA JPL GRACE and GRACE-FO Mascon RL06.3Mv04 CRI, PO.DAAC collection C3195527175-POCLOUD; mascon method after Watkins et al. (2015) J. Geophys. Res. Solid Earth 120, doi:10.1002/2014JB011547",
          },
          {
            item: "Linear trend with annual and semi-annual cycles",
            origin: "engineering_judgment",
            reference:
              "Rotavise least-squares fit; standard error widened for lag-1 autocorrelation; not a published standard",
          },
        ],
        limitations: [
          "Anomalies are relative to the satellites' own 2004 to 2009 average, in centimetres of equivalent water height; they combine groundwater, soil water, surface water and snow.",
          "Resolution is hundreds of kilometres: it cannot show a farm's well or the water under one field.",
          "A gap of about a year separates GRACE and GRACE-FO (2017 to 2018), and a few other months are missing; gaps are not filled.",
          "A short or noisy series can show no clear trend even when water is falling; the interval shows how uncertain the slope is.",
        ],
      }),
    };
  }
}
