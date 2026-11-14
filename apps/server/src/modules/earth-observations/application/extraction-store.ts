import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import type { PgBoss } from "pg-boss";
import {
  boundarySamplePoints,
  extractionResultSchema,
  extractionStatusSchema,
  fieldBoundarySchema,
  vegetationHistoryResponseSchema,
  type FieldBoundary,
  type ExtractionKind,
  type ExtractionResult,
  type VegetationAnalysis,
} from "@rotavise/contracts";
import {
  ECOSTRESS_POLICY,
  ECOSTRESS_POLICY_V1,
  TERRAIN_POLICY,
  TERRAIN_PROVENANCE,
  analyzeVegetationHistory,
  summarizeEcostress,
  summarizeTerrain,
  type ElevationGrid,
  type EcostressPixel,
  type EcostressPolicyVersion,
} from "@rotavise/domain";
import { stableJson } from "../../../common/serialization/stable-json.js";
import { EXTRACTION_QUEUE } from "../../../infrastructure/queue/pg-boss.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import {
  ObservationError,
  type AppeearsTask,
  type AppeearsTransport,
} from "../providers/appeears/appeears.client.js";
import {
  normalizeEcostress,
  normalizeNasadem,
} from "../providers/terrain/normalization.js";
import { terrainRequest } from "../providers/terrain/terrain-request.js";
import { normalizeModis } from "../providers/modis/normalization.js";
import {
  MODIS_FIRST_DATE,
  MODIS_LAYERS,
  MODIS_PRODUCT,
  modisPoints,
} from "../providers/modis/modis-request.js";

// Terrain (NASADEM) and ECOSTRESS extractions for a saved field. The life
// cycle matches ObservationStore: a row is the outbox, one worker step submits,
// polls or downloads, and the raw provider files are kept as evidence.
const digest = (value: unknown) =>
  createHash("sha256").update(stableJson(value)).digest("hex");
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
const POLL_SECONDS = 600;
const GIVE_UP_HOURS = 48;
// NASADEM is a static product; AppEEARS lists its extent as these dates.
const NASADEM_DATES = { start: "2000-02-11", end: "2000-02-21" };
type Point = { id: string; latitude: number; longitude: number };
type Request = {
  points: Point[];
  start: string;
  end: string;
  ecostressPolicyVersion?: EcostressPolicyVersion;
  layout?: {
    rows: number;
    cols: number;
    stride: number;
    cellNorthM: number;
    cellEastM: number;
    inside: string;
    ring: { id: string; distanceM: number }[];
  };
};
type Row = {
  id: string;
  field_id: string;
  kind: ExtractionKind;
  status: "queued" | "submitted" | "completed" | "failed";
  request: Request;
  remote_task_id: string | null;
  attempts: number;
  result: unknown;
  result_hash: string | null;
  error_code: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
};
const mdy = (d: string) =>
  `${d.slice(5, 7)}-${d.slice(8, 10)}-${d.slice(0, 4)}`;
const LSTE = "ECO_L2T_LSTE.002";
const ESI = "ECO_L4T_ESI.002";
export type ExtractionRequest = Request;
// The AppEEARS task for a request: also printed by
// tooling/earth-observations/print-extraction-payload.mjs so it can be read
// before anything is sent.
export function extractionTask(
  kind: ExtractionKind,
  id: string,
  request: Request,
): AppeearsTask {
  const layers =
    kind === "terrain"
      ? [{ product: "NASADEM_NC.001", layer: "NASADEM_HGT" }]
      : kind === "modis"
        ? MODIS_LAYERS.map((layer) => ({ product: MODIS_PRODUCT, layer }))
        : [
            { product: LSTE, layer: "LST" },
            { product: LSTE, layer: "cloud" },
            { product: LSTE, layer: "water" },
            { product: ESI, layer: "ESI" },
            { product: ESI, layer: "cloud" },
            { product: ESI, layer: "water" },
          ];
  return {
    task_type: "point",
    task_name: `rotavise-${id}`,
    params: {
      dates: [{ startDate: mdy(request.start), endDate: mdy(request.end) }],
      layers,
      coordinates: request.points.map((p) => ({ ...p, category: "field" })),
    },
  };
}
// The sample points and dates for a field outline; throws when the outline
// cannot give a clean request.
export function buildExtractionRequest(
  kind: ExtractionKind,
  boundary: FieldBoundary,
  today: string,
): Request {
  if (kind === "terrain") {
    const t = terrainRequest(boundary);
    return {
      points: [...t.grid, ...t.ring].map(({ id, latitude, longitude }) => ({
        id,
        latitude,
        longitude,
      })),
      ...NASADEM_DATES,
      layout: {
        rows: t.rows,
        cols: t.cols,
        stride: t.stride,
        cellNorthM: t.cellNorthM,
        cellEastM: t.cellEastM,
        inside: t.grid.map((g) => (g.inside ? "1" : "0")).join(""),
        ring: t.ring.map((r) => ({ id: r.id, distanceM: r.distanceM })),
      },
    };
  }
  if (kind === "modis")
    return {
      points: modisPoints(boundary),
      start: MODIS_FIRST_DATE,
      end: today,
    };
  const points = boundarySamplePoints(boundary);
  if (!points.length) throw new RangeError("NO_CLEAN_PIXEL");
  return {
    points: points.map((p, i) => ({ id: `p${i + 1}`, ...p })),
    start: `${Number(today.slice(0, 4)) - 2}-01-01`,
    end: today,
    ecostressPolicyVersion: ECOSTRESS_POLICY.version,
  };
}
export class ExtractionStore {
  constructor(
    readonly pool: Pool,
    private readonly boss: PgBoss,
    private readonly appeears: AppeearsTransport,
  ) {}
  // Offline administrator import of an already completed extraction. The
  // original result is preserved (including older normalization policies),
  // while every raw file and the original result are hash-checked again.
  // No route exposes this operation. Ownership belongs to the freshly created
  // guest field, never to a copied account or copied bearer credential.
  async importCompleted(
    fieldId: string,
    row: Row,
    files: {
      name: string;
      raw: Buffer;
      sha256: string;
      created_at: Date;
      created_at_utc?: string;
    }[],
    timestamps?: { createdAt: string; updatedAt: string; completedAt: string },
  ) {
    if (
      row.status !== "completed" ||
      !row.result ||
      !files.length ||
      digest(row.result) !== row.result_hash ||
      files.some((f) => sha(f.raw) !== f.sha256)
    )
      throw new PlanError("STORED_REQUEST_INVALID");
    const sourceTimes = z
      .strictObject({
        createdAt: z.iso.datetime(),
        updatedAt: z.iso.datetime(),
        completedAt: z.iso.datetime(),
      })
      .parse(
        timestamps ?? {
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          completedAt: row.completed_at?.toISOString(),
        },
      );
    const result = extractionResultSchema.parse(row.result);
    // Exercise the current normalizer too, without replacing historical output.
    const replayHash = digest(this.normalize(row, files));
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO field_extractions(id,field_id,kind,status,request,remote_task_id,
        attempts,result,result_hash,error_code,created_at,updated_at,completed_at)
        VALUES($1,$2,$3,'completed',$4,$5,$6,$7,$8,NULL,$9,$10,$11)`,
        [
          row.id,
          fieldId,
          row.kind,
          row.request,
          row.remote_task_id,
          row.attempts,
          result,
          digest(result),
          sourceTimes.createdAt,
          sourceTimes.updatedAt,
          sourceTimes.completedAt,
        ],
      );
      for (const f of files)
        await client.query(
          "INSERT INTO field_extraction_files(extraction_id,name,raw,sha256,created_at) VALUES($1,$2,$3,$4,$5)",
          [
            row.id,
            f.name,
            f.raw,
            sha(f.raw),
            f.created_at_utc
              ? z.iso.datetime().parse(f.created_at_utc)
              : f.created_at,
          ],
        );
      await client.query("COMMIT");
      return { id: row.id, resultHash: digest(result), replayHash };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  private output(row: Row) {
    if (row.result && digest(row.result) !== row.result_hash)
      throw new PlanError("STORED_REQUEST_INVALID");
    return extractionStatusSchema.parse({
      id: row.id,
      fieldId: row.field_id,
      kind: row.kind,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null,
      result: row.result ?? null,
      error: row.error_code ? { code: row.error_code } : null,
    });
  }
  // Both kinds need a saved outline. Returns the extraction in progress for
  // the field and kind if one exists.
  async request(userId: string, fieldId: string, kind: ExtractionKind) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const field = (
        await client.query<{ boundary: unknown; today: string }>(
          `SELECT b.boundary,to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') today
          FROM fields f LEFT JOIN auth_users u ON u.id=f.user_id LEFT JOIN field_boundaries b ON b.field_id=f.id
          WHERE f.id=$1 AND $2::uuid IN (f.user_id,f.guest_owner_id) AND (f.guest_owner_id IS NOT NULL OR u.email_verified) FOR UPDATE OF f`,
          [fieldId, userId],
        )
      ).rows[0];
      if (!field) throw new PlanError("NOT_FOUND");
      const active = (
        await client.query<Row>(
          "SELECT * FROM field_extractions WHERE field_id=$1 AND kind=$2 AND status IN ('queued','submitted') ORDER BY created_at DESC LIMIT 1",
          [fieldId, kind],
        )
      ).rows[0];
      if (active) {
        await client.query("COMMIT");
        return this.output(active);
      }
      const recent = await client.query<{ n: number }>(
        "SELECT count(*)::int n FROM field_extractions o JOIN fields f ON f.id=o.field_id WHERE $1::uuid IN (f.user_id,f.guest_owner_id) AND o.created_at>clock_timestamp()-interval '1 day'",
        [userId],
      );
      if (recent.rows[0]!.n >= 10) throw new PlanError("RATE_LIMITED", 86400);
      const parsed = fieldBoundarySchema.safeParse(field.boundary);
      if (!parsed.success) throw new PlanError("INVALID_INPUT");
      let request: Request;
      try {
        request = buildExtractionRequest(kind, parsed.data, field.today);
      } catch {
        throw new PlanError("INVALID_INPUT");
      }
      const id = randomUUID();
      const row = (
        await client.query<Row>(
          "INSERT INTO field_extractions(id,field_id,kind,request) VALUES($1,$2,$3,$4) RETURNING *",
          [id, fieldId, kind, request],
        )
      ).rows[0]!;
      await client.query("COMMIT");
      return this.output(row);
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  async enqueue(id: string, startAfter = 0) {
    await this.boss.send(
      EXTRACTION_QUEUE,
      { id },
      { singletonKey: id, startAfter },
    );
  }
  async list(userId: string, fieldId: string) {
    const rows = await this.pool.query<Row>(
      `SELECT DISTINCT ON (o.kind) o.* FROM field_extractions o JOIN fields f ON f.id=o.field_id
      WHERE o.field_id=$1 AND $2::uuid IN (f.user_id,f.guest_owner_id) ORDER BY o.kind,o.created_at DESC`,
      [fieldId, userId],
    );
    const owned = await this.pool.query(
      "SELECT 1 FROM fields WHERE id=$1 AND $2::uuid IN (user_id,guest_owner_id)",
      [fieldId, userId],
    );
    if (!owned.rowCount) throw new PlanError("NOT_FOUND");
    return rows.rows.map((r) => this.output(r));
  }
  async read(userId: string, fieldId: string, id: string) {
    const row = (
      await this.pool.query<Row>(
        "SELECT o.* FROM field_extractions o JOIN fields f ON f.id=o.field_id WHERE o.id=$1 AND o.field_id=$2 AND $3::uuid IN (f.user_id,f.guest_owner_id)",
        [id, fieldId, userId],
      )
    ).rows[0];
    if (!row) throw new PlanError("NOT_FOUND");
    return this.output(row);
  }
  async fresh() {
    const rows = await this.pool.query<{ id: string }>(
      "SELECT id FROM field_extractions WHERE status='queued' AND attempts=0 ORDER BY created_at LIMIT 50",
    );
    return rows.rows.map((r) => r.id);
  }
  async stale() {
    const rows = await this.pool.query<{ id: string }>(
      "SELECT id FROM field_extractions WHERE status IN ('queued','submitted') AND updated_at<clock_timestamp()-interval '30 minutes' ORDER BY updated_at LIMIT 50",
    );
    return rows.rows.map((r) => r.id);
  }
  task(row: Row): AppeearsTask {
    return extractionTask(row.kind, row.id, row.request);
  }
  private async save(
    row: Row,
    result: ExtractionResult,
    files: { name: string; raw: Uint8Array }[],
  ) {
    const parsed = extractionResultSchema.parse(result);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const f of files)
        await client.query(
          "INSERT INTO field_extraction_files(extraction_id,name,raw,sha256) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [row.id, f.name, Buffer.from(f.raw), sha(f.raw)],
        );
      await client.query(
        "UPDATE field_extractions SET status='completed',result=$2,result_hash=$3,completed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1 AND status IN ('queued','submitted')",
        [row.id, parsed, digest(parsed)],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }
  private async fail(row: Row, code: string) {
    await this.pool.query(
      "UPDATE field_extractions SET status='failed',error_code=$2,completed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1 AND status IN ('queued','submitted')",
      [row.id, code],
    );
    if (row.remote_task_id)
      await this.appeears
        .remove(row.remote_task_id, AbortSignal.timeout(60000))
        .catch(() => {});
  }
  // One step of an extraction. Returns seconds until the next step, or null.
  async process(id: string, signal: AbortSignal): Promise<number | null> {
    const row = (
      await this.pool.query<Row>(
        "SELECT * FROM field_extractions WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (!row || row.status === "completed" || row.status === "failed")
      return null;
    try {
      await this.pool.query(
        "UPDATE field_extractions SET attempts=least(attempts+1,10),updated_at=clock_timestamp() WHERE id=$1",
        [id],
      );
      if (row.status === "queued") {
        const taskId = await this.appeears.submit(this.task(row), signal);
        await this.pool.query(
          "UPDATE field_extractions SET status='submitted',remote_task_id=$2,attempts=0,updated_at=clock_timestamp() WHERE id=$1 AND status='queued'",
          [id, taskId],
        );
        return POLL_SECONDS;
      }
      const taskId = row.remote_task_id!;
      const state = await this.appeears.status(taskId, signal);
      if (state === "error") {
        await this.fail(row, "OBSERVATION_UPSTREAM_FAILED");
        return null;
      }
      if (state !== "done") {
        if (Date.now() - row.created_at.getTime() > GIVE_UP_HOURS * 3600000) {
          await this.fail(row, "OBSERVATION_TIMEOUT");
          return null;
        }
        // A good answer from NASA resets the error budget: attempts counts
        // consecutive failures, not polls, or one blip after 50 minutes of
        // waiting would fail a task that is allowed to run for 48 hours.
        await this.pool.query(
          "UPDATE field_extractions SET attempts=0 WHERE id=$1",
          [id],
        );
        return POLL_SECONDS;
      }
      const bundle = await this.appeears.bundle(taskId, signal);
      // The file name pattern follows the HLS and SMAP files recorded on
      // 2026-10-17; it is unproven for these products until the first run.
      const wanted =
        row.kind === "terrain"
          ? [/NASADEM[-_]NC[-_]001-results\.csv$/]
          : row.kind === "modis"
            ? [/MOD13Q1[-_]061-results\.csv$/]
            : [
                /ECO[-_]L2T[-_]LSTE[-_]002-results\.csv$/,
                /ECO[-_]L4T[-_]ESI[-_]002-results\.csv$/,
              ];
      const files: { name: string; raw: Uint8Array }[] = [];
      for (const pattern of wanted) {
        const file = bundle.find((f) => pattern.test(f.name));
        if (!file) continue;
        files.push({
          name: file.name.replace(/^.*?-(NASADEM|ECO|MOD13Q1)/, "$1"),
          raw: await this.appeears.download(taskId, file, signal),
        });
      }
      const result = this.normalize(row, files);
      await this.save(row, result, files);
      await this.appeears.remove(taskId, signal).catch(() => {});
      return null;
    } catch (error) {
      if (error instanceof ObservationError) {
        if (
          error.code === "OBSERVATION_UPSTREAM_INVALID" ||
          error.code === "OBSERVATIONS_NOT_CONFIGURED" ||
          error.code === "OBSERVATION_AUTH_FAILED"
        ) {
          await this.fail(row, error.code);
          return null;
        }
        if (row.attempts >= 5) {
          await this.fail(row, error.code);
          return null;
        }
        return POLL_SECONDS;
      }
      throw error;
    }
  }
  normalize(
    row: Row,
    files: { name: string; raw: Uint8Array }[],
  ): ExtractionResult {
    if (row.kind === "terrain") return this.terrain(row, files);
    if (row.kind === "modis") return this.modis(row, files);
    return this.ecostress(row, files);
  }
  private modis(
    row: Row,
    files: { name: string; raw: Uint8Array }[],
  ): ExtractionResult {
    if (!files[0]) throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const { datesSeen, readings } = normalizeModis(
      files[0].raw,
      "centre",
      new Set(row.request.points.map((p) => p.id)),
    );
    return {
      kind: "modis",
      policyVersion: "modis-policy-1",
      product: "MOD13Q1.061 vegetation indices (250 m, 16 day) via AppEEARS",
      resolutionMeters: 250,
      period: { start: row.request.start, end: row.request.end },
      samplePoints: row.request.points.length,
      datesSeen,
      datesUsable: readings.length,
      observations: readings,
      explanations: ["modis.ndvi_history", "modis.pixel_size"],
      provenance: [
        {
          item: "MODIS Terra vegetation indices, 16-day, 250 m",
          origin: "sourced",
          reference:
            "Didan, K. (2021) MOD13Q1 MODIS/Terra Vegetation Indices 16-Day L3 Global 250m SIN Grid V061, NASA LP DAAC, doi:10.5067/MODIS/MOD13Q1.061, via AppEEARS",
        },
        {
          item: "End of MODIS data collection",
          origin: "sourced",
          reference:
            "NASA Earthdata data alert 'Transition from MODIS to VIIRS', issued 2 May 2025 (earthdata.nasa.gov/data/alerts-outages/transition-from-modis-viirs), read on 2026-11-08",
        },
        {
          item: "Good-quality pixels only",
          origin: "engineering_judgment",
          reference:
            "Rotavise keeps pixels whose reliability layer is 0 (good data) and drops marginal, snow, ice and cloudy ones; nothing is filled in",
        },
      ],
      limitations: [
        "Each value covers a 250 m pixel, about 6 hectares: a small field shares its pixel with its surroundings, so the neighbour comparison matters.",
        "Sixteen-day composites pick the best clear day in each period, so a short change of a week can be missed.",
        "NASA's data alert of 2 May 2025 says Terra and Aqua begin shutting down in late 2026 or early 2027 and MODIS data will no longer be collected, and that both platforms are drifting from their designed orbits, which can affect crossing times and data; later dates may stop arriving.",
      ],
    };
  }
  // The field's greenness over the whole MODIS record, set beside the finer
  // HLS analysis when the caller has one.
  async vegetationHistory(
    userId: string,
    fieldId: string,
    hls: VegetationAnalysis | null,
  ) {
    const owned = await this.pool.query<{ today: string }>(
      `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') today FROM fields
      WHERE id=$1 AND $2::uuid IN (user_id,guest_owner_id)`,
      [fieldId, userId],
    );
    if (!owned.rowCount) throw new PlanError("NOT_FOUND");
    const rows = await this.pool.query<Row>(
      "SELECT * FROM field_extractions WHERE field_id=$1 AND kind='modis' ORDER BY created_at DESC LIMIT 10",
      [fieldId],
    );
    const done = rows.rows.find((r) => r.status === "completed");
    if (!done) {
      const latest = rows.rows[0];
      return vegetationHistoryResponseSchema.parse({
        status: "unavailable",
        observation: latest
          ? (latest.status as "queued" | "submitted" | "failed")
          : "none",
        error: latest?.error_code ?? null,
      });
    }
    const status = this.output(done);
    if (status.result?.kind !== "modis")
      throw new PlanError("STORED_REQUEST_INVALID");
    return vegetationHistoryResponseSchema.parse({
      status: "ready",
      extractionId: status.id,
      completedAt: status.completedAt,
      hlsCompared: hls !== null,
      history: analyzeVegetationHistory(
        status.result,
        hls,
        owned.rows[0]!.today,
      ),
    });
  }
  private terrain(
    row: Row,
    files: { name: string; raw: Uint8Array }[],
  ): ExtractionResult {
    const layout = row.request.layout;
    if (!layout || !files[0])
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const heights = normalizeNasadem(
      files[0].raw,
      new Set(row.request.points.map((p) => p.id)),
    );
    const n = layout.rows * layout.cols;
    if (layout.inside.length !== n)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const grid: ElevationGrid = {
      rows: layout.rows,
      cols: layout.cols,
      cellNorthM: layout.cellNorthM,
      cellEastM: layout.cellEastM,
      elevation: Array.from(
        { length: n },
        (_, i) =>
          heights.get(`g${Math.floor(i / layout.cols)}-${i % layout.cols}`) ??
          null,
      ),
      inside: Array.from({ length: n }, (_, i) => layout.inside[i] === "1"),
    };
    const ring = layout.ring.map((r) => ({
      distanceM: r.distanceM,
      elevation: heights.get(r.id) ?? null,
    }));
    const summary = summarizeTerrain(grid, ring);
    const missingPoints = grid.elevation.filter((v) => v === null).length;
    const explanations = ["terrain.elevation", "terrain.dem_noise"];
    if (summary.slope) {
      explanations.push("terrain.slope", "terrain.aspect");
      if (summary.slope.meanPercent < summary.slope.noiseFloorPercent)
        explanations.push("terrain.slope_below_noise");
    }
    if (summary.erosion) explanations.push("terrain.erosion_ls");
    explanations.push("terrain.frost_pocket");
    return {
      kind: "terrain",
      policyVersion: TERRAIN_POLICY.version as "terrain-policy-1",
      product: "NASADEM_NC.001 elevation (30 m) via AppEEARS",
      resolutionMeters: 30,
      grid: {
        rows: layout.rows,
        cols: layout.cols,
        cellNorthM: layout.cellNorthM,
        cellEastM: layout.cellEastM,
        stride: layout.stride,
        requestedPoints: row.request.points.length,
        missingPoints,
      },
      ...summary,
      explanations,
      provenance: [
        {
          item: "NASADEM elevation data",
          origin: "sourced",
          reference:
            "NASA JPL (2020) NASADEM Merged DEM Global 1 arc second NC V001, doi:10.5067/MEaSUREs/NASADEM/NASADEM_NC.001, via AppEEARS",
        },
        ...TERRAIN_PROVENANCE,
      ],
      limitations: [
        "A digital surface model from the year 2000 radar mission, resampled to 30 m: trees, buildings and later earthworks are not what the ground looks like today.",
        `Heights carry a vertical error of a few metres; slopes below about ${summary.slope?.noiseFloorPercent ?? 6}% cannot be told apart from noise.`,
        "Erosion is a relative reading (RUSLE LS factor): it ignores rainfall, soil, cover and flow paths, and is not a soil-loss figure.",
        "The cold-air hint compares the field with points 300 m and 600 m away; it is not a frost forecast and needs local confirmation.",
      ],
    };
  }
  private ecostress(
    row: Row,
    files: { name: string; raw: Uint8Array }[],
  ): ExtractionResult {
    const ids = new Set(row.request.points.map((p) => p.id));
    const policyVersion =
      row.request.ecostressPolicyVersion ?? ECOSTRESS_POLICY_V1.version;
    const pixels: EcostressPixel[] = [];
    const products: (
      | "ECO_L2T_LSTE.002 land surface temperature (70 m) via AppEEARS"
      | "ECO_L4T_ESI.002 evaporative stress index PT-JPL (70 m) via AppEEARS"
    )[] = [];
    for (const f of files) {
      if (/LSTE/.test(f.name)) {
        pixels.push(...normalizeEcostress(f.raw, "lst", ids, policyVersion));
        products.push(
          "ECO_L2T_LSTE.002 land surface temperature (70 m) via AppEEARS",
        );
      } else if (/ESI/.test(f.name)) {
        pixels.push(...normalizeEcostress(f.raw, "esi", ids, policyVersion));
        products.push(
          "ECO_L4T_ESI.002 evaporative stress index PT-JPL (70 m) via AppEEARS",
        );
      }
    }
    if (!products.length)
      throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const s = summarizeEcostress(pixels);
    return {
      kind: "ecostress",
      policyVersion,
      products,
      samplePoints: row.request.points.length,
      period: { start: row.request.start, end: row.request.end },
      acquisitions: s.acquisitions.length,
      months: s.months,
      explanations: [
        "ecostress.lst",
        "ecostress.esi",
        "ecostress.irregular_sampling",
      ],
      provenance: [
        {
          item: "ECOSTRESS tiled land surface temperature and evaporative stress index",
          origin: "sourced",
          reference:
            "NASA JPL ECOSTRESS ECO_L2T_LSTE.002 and ECO_L4T_ESI.002 via AppEEARS (dois 10.5067/ECOSTRESS/ECO_L2T_LSTE.002, 10.5067/ECOSTRESS/ECO_L4T_ESI.002)",
        },
        {
          item: "Monthly means of clear acquisitions",
          origin: "engineering_judgment",
          reference:
            policyVersion === ECOSTRESS_POLICY_V1.version
              ? "Rotavise summary: clear pixels averaged per acquisition, then per month; no threshold is applied"
              : "Rotavise summary: admitted pixels averaged per acquisition, then per month; no crop heat or frost threshold is applied",
        },
        ...(policyVersion === ECOSTRESS_POLICY.version
          ? [
              {
                item: "LST accuracy quality admission",
                origin: "engineering_judgment" as const,
                reference: ECOSTRESS_POLICY.lstQuality.reference,
              },
            ]
          : []),
      ],
      limitations: [
        "The space station passes at changing times and not every day, and cloud removes many scenes: a month's mean is a sample of that month, not a full record.",
        "Land surface temperature is the temperature of the ground and leaves, not air temperature; it is not used as a frost or heat limit.",
        "The evaporative stress index (0 to 1) compares actual with potential evapotranspiration; low values suggest plant water stress but do not name a cause.",
        ...(policyVersion === ECOSTRESS_POLICY.version
          ? [
              "LST requires the QC good or excellent accuracy class; marginal, poor or missing quality removes observations and can leave months without LST. These modeled error classes do not guarantee physical plausibility.",
            ]
          : []),
      ],
    };
  }
}
