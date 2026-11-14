import type { Pool } from "pg";
import { z } from "zod";
import {
  canopyBiomassResultSchema,
  fieldProfileSchema,
  type CanopyBiomassResponse,
} from "@rotavise/contracts";
import {
  GEDI_POLICY,
  GEDI_PROVENANCE,
  summarizeCanopyBiomass,
} from "@rotavise/domain";
import { PlanError } from "../../plans/application/plan-policy.js";

// GEDI L4B 1 km mean aboveground biomass density cells for Morocco, imported
// once from a file somebody downloaded with their own Earthdata login
// (tooling/earth-observations/gedi-extract.py). The cell holding a field and
// the cells within 3 km stand for the trees and shrubs around it; GEDI's laser
// shots are sparse and a 1 km cell mixes everything inside it, so this says
// nothing about the crop itself.
export const gediImportSchema = z.strictObject({
  product: z.string().min(1).max(200),
  sourceSha256: z.string().regex(/^[a-f0-9]{64}$/),
  // [latitude, longitude, mean AGBD in Mg/ha, standard error in Mg/ha or null]
  cells: z
    .array(
      z.tuple([
        z.number().min(-90).max(90),
        z.number().min(-180).max(180),
        z.number().finite().min(0).max(5000),
        z.number().finite().min(0).max(5000).nullable(),
      ]),
    )
    .min(1)
    .max(2_000_000),
});
export type GediImport = z.infer<typeof gediImportSchema>;
const e3 = (v: number) => Math.round(v * 1000);
const BATCH = 5000;
export class CanopyBiomassService {
  constructor(readonly pool: Pool) {}
  // Writes once per product: cells already stored are left as they are.
  async import(file: unknown) {
    const data = gediImportSchema.parse(file);
    const client = await this.pool.connect();
    let inserted = 0;
    try {
      await client.query("BEGIN");
      for (let i = 0; i < data.cells.length; i += BATCH) {
        const slice = data.cells.slice(i, i + BATCH);
        const r = await client.query(
          `INSERT INTO regional_gedi_biomass(product,latitude_e3,longitude_e3,agbd_mg_ha,se_mg_ha,source_sha256)
          SELECT $1::text,u.a,u.b,u.c,u.d,$6::text FROM unnest($2::int[],$3::int[],$4::numeric[],$5::numeric[]) AS u(a,b,c,d)
          ON CONFLICT DO NOTHING`,
          [
            data.product,
            slice.map((c) => e3(c[0])),
            slice.map((c) => e3(c[1])),
            slice.map((c) => c[2]),
            slice.map((c) => c[3]),
            data.sourceSha256,
          ],
        );
        inserted += r.rowCount ?? 0;
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
  ): Promise<CanopyBiomassResponse> {
    const field = (
      await this.pool.query<{ profile: unknown }>(
        `SELECT f.profile FROM fields f LEFT JOIN auth_users u ON u.id=f.user_id
        WHERE f.id=$1 AND $2::uuid IN (f.user_id,f.guest_owner_id) AND (f.guest_owner_id IS NOT NULL OR u.email_verified)`,
        [fieldId, userId],
      )
    ).rows[0];
    if (!field) throw new PlanError("NOT_FOUND");
    const { location } = fieldProfileSchema.parse(field.profile);
    const product = (
      await this.pool.query<{ product: string }>(
        "SELECT product FROM regional_gedi_biomass ORDER BY imported_at DESC LIMIT 1",
      )
    ).rows[0]?.product;
    if (!product)
      return { available: false, reason: "CANOPY_BIOMASS_NOT_IMPORTED" };
    // A 3 km radius is about 0.027 degrees of latitude and a little more of
    // longitude at Moroccan latitudes; the box is trimmed by real distance.
    const box = (dLat: number, dLon: number) =>
      this.pool.query<{
        lat: number;
        lon: number;
        agbd: string;
        se: string | null;
      }>(
        `SELECT latitude_e3 lat, longitude_e3 lon, agbd_mg_ha::text agbd, se_mg_ha::text se
        FROM regional_gedi_biomass WHERE product=$1 AND latitude_e3 BETWEEN $2 AND $3 AND longitude_e3 BETWEEN $4 AND $5`,
        [
          product,
          e3(location.latitude - dLat),
          e3(location.latitude + dLat),
          e3(location.longitude - dLon),
          e3(location.longitude + dLon),
        ],
      );
    const near = await box(0.03, 0.04);
    const summary = summarizeCanopyBiomass(
      near.rows.map((r) => ({
        latitude: r.lat / 1000,
        longitude: r.lon / 1000,
        agbdMgHa: Number(r.agbd),
        seMgHa: r.se === null ? null : Number(r.se),
      })),
      location.latitude,
      location.longitude,
    );
    if (!summary.surroundings.cellsInRadius) {
      const wide = await box(0.5, 0.6);
      return {
        available: false,
        reason: wide.rowCount
          ? "CANOPY_BIOMASS_NO_ESTIMATE_NEARBY"
          : "CANOPY_BIOMASS_OUTSIDE_IMPORT",
      };
    }
    return {
      available: true,
      result: canopyBiomassResultSchema.parse({
        kind: "gedi",
        policyVersion: GEDI_POLICY.version,
        product,
        resolutionNote:
          "Each value is the mean over a 1 km square estimated from sparse laser shots between April 2019 and March 2023. It describes trees and shrubs in the surroundings, not the crop in the field.",
        observationPeriod: { start: "2019-04-18", end: "2023-03-16" },
        ...summary,
        explanations: [
          "gedi.agbd",
          "gedi.hedges_and_trees",
          "gedi.not_crop_biomass",
        ],
        provenance: GEDI_PROVENANCE,
        limitations: [
          "GEDI measures vegetation height with a laser from the space station, in sparse tracks: cells with too few good shots have no estimate and are not listed, so a missing neighbour does not mean no trees.",
          "A 1 km cell mixes fields, trees, buildings and bare ground; a hedge or windbreak beside one field can be invisible in the cell mean.",
          "Biomass density is modelled from laser height, not weighed. It is calibrated on forests and drylands, so values over annual crops are small and uncertain; read this as 'woody vegetation nearby', never as crop yield or crop biomass.",
          "The standard error covers sampling and model error for the cell, and the neighbourhood error assumes the cells are independent.",
        ],
      }),
    };
  }
}
