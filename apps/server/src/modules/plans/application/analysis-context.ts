import { createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import {
  rotationAnalysisContextSchema,
  extractionResultSchema,
  observationResultSchema,
  fieldProfileSchema,
  type PlanRequestV2,
  type RotationAnalysisContext,
  type AnalysisGrid,
} from "@rotavise/contracts";
import { stableJson } from "../../../common/serialization/stable-json.js";
import { PlanError } from "./plan-policy.js";
import { WaterStorageService } from "../../earth-observations/application/water-storage.service.js";

const digest = (v: unknown) =>
  createHash("sha256").update(stableJson(v)).digest("hex");
// Copy completed, hash-verified context at acceptance into the already hashed
// versions JSON. A retry never reselects mutable extraction rows or GRACE data.
export async function pinAnalysisContext(
  client: PoolClient,
  pool: Pool,
  requestId: string,
  input: PlanRequestV2,
): Promise<RotationAnalysisContext> {
  const context: RotationAnalysisContext = {
    fieldId: input.field_id ?? null,
    terrain: null,
    ecostress: null,
    waterStorage: null,
    observations: [],
  };
  if (!input.field_id) return context;
  const field = (
    await client.query<{ profile: unknown; principal: string }>(
      `SELECT f.profile,coalesce(o.user_id,o.id) principal FROM fields f
     JOIN plan_requests r ON r.id=$1 JOIN plan_owners o ON o.id=r.owner_id
     LEFT JOIN auth_users u ON u.id=f.user_id
     WHERE f.id=$2 AND (f.guest_owner_id=o.id OR (f.user_id=o.user_id AND u.email_verified)) FOR SHARE OF f`,
      [requestId, input.field_id],
    )
  ).rows[0];
  if (!field) throw new PlanError("NOT_FOUND");
  const profile = fieldProfileSchema.parse(field.profile);
  if (
    profile.location.latitude !== input.location.latitude ||
    profile.location.longitude !== input.location.longitude
  )
    throw new PlanError("INVALID_INPUT");
  const rows = (
    await client.query<{
      id: string;
      result: unknown;
      result_hash: string;
      request: { points?: { latitude: number; longitude: number }[] };
    }>(
      `SELECT DISTINCT ON (kind) id,result,result_hash,request FROM field_extractions WHERE field_id=$1 AND status='completed' ORDER BY kind,completed_at DESC,id DESC`,
      [input.field_id],
    )
  ).rows;
  for (const row of rows) {
    if (digest(row.result) !== row.result_hash)
      throw new PlanError("INVALID_INPUT");
    const result = extractionResultSchema.parse(row.result);
    const samplePoints = (row.request.points ?? []).map(
      ({ latitude, longitude }) => ({ latitude, longitude }),
    );
    if (result.kind === "terrain")
      context.terrain = {
        id: row.id,
        sha256: row.result_hash,
        result,
        samplePoints,
      };
    if (result.kind === "ecostress")
      context.ecostress = {
        id: row.id,
        sha256: row.result_hash,
        result,
        samplePoints,
      };
    if (result.kind === "modis")
      context.observations.push(
        observationGrid(
          "MODIS",
          250,
          row.id,
          row.result_hash,
          samplePoints,
          result.product,
        ),
      );
  }
  const observations = (
    await client.query<{
      id: string;
      result: unknown;
      result_hash: string;
      request: { points?: { latitude: number; longitude: number }[] };
    }>(
      `SELECT DISTINCT ON (kind) id,result,result_hash,request FROM field_observations WHERE field_id=$1 AND status='completed' ORDER BY kind,completed_at DESC,id DESC`,
      [input.field_id],
    )
  ).rows;
  for (const row of observations) {
    if (digest(row.result) !== row.result_hash)
      throw new PlanError("INVALID_INPUT");
    const result = observationResultSchema.parse(row.result);
    const g = observationGrid(
      result.kind === "hls" ? "HLS" : result.kind === "smap" ? "SMAP" : "GPM",
      result.kind === "hls" ? 30 : result.kind === "smap" ? 9000 : null,
      row.id,
      row.result_hash,
      (row.request.points ?? []).map(({ latitude, longitude }) => ({
        latitude,
        longitude,
      })),
      result.product,
    );
    if (result.kind === "smap") {
      g.row = result.cell.line;
      g.column = result.cell.sample;
    }
    // GPM field observations are context; the engine's independent monthly
    // climatology remains its rain input and is reported by the domain.
    if (result.kind !== "gpm") context.observations.push(g);
  }
  const storage = await new WaterStorageService(pool).forField(
    field.principal,
    input.field_id,
  );
  if (storage.available)
    context.waterStorage = {
      result: storage.result,
      sha256: digest(storage.result),
    };
  return rotationAnalysisContextSchema.parse(context);
}
function observationGrid(
  input: AnalysisGrid["input"],
  meters: number | null,
  id: string,
  sha: string,
  samplePoints: AnalysisGrid["samplePoints"],
  product: string,
): AnalysisGrid {
  return {
    input,
    use: "reported_context",
    grid: product,
    resolution: { meters, latitudeDegrees: null, longitudeDegrees: null },
    cell: null,
    row: null,
    column: null,
    tile: null,
    selection:
      "pinned field extraction points; pixel identity not_found unless returned in source summary",
    samplePoints,
    evidenceIds: [id, sha],
    resampling: "none_added",
    upstreamResampling: "not_found; provider processing retained",
  };
}
