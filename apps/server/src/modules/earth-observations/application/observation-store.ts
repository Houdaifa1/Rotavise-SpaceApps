import { createHash, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import type { PgBoss } from "pg-boss";
import {
  boundarySamplePoints,
  fieldBoundarySchema,
  fieldProfileSchema,
  observationResultSchema,
  observationStatusSchema,
  rainSeriesResponseSchema,
  vegetationAnalysisResponseSchema,
  type ObservationKind,
  type ObservationResult,
  type VegetationPolicy,
} from "@rotavise/contracts";
import {
  analyzeVegetation,
  hlsGranulesFromList,
  monthlyTotals,
  rainSeries,
  vegetationHistory,
  VEGETATION_LIMITATIONS,
  type PixelObservation,
} from "@rotavise/domain";
import { stableJson } from "../../../common/serialization/stable-json.js";
import { OBSERVATION_QUEUE } from "../../../infrastructure/queue/pg-boss.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import type { WeatherService } from "../../weather/application/weather.service.js";
import {
  ObservationError,
  type AppeearsTask,
  type AppeearsTransport,
} from "../providers/appeears/appeears.client.js";
import type { RainTransport } from "../providers/giovanni/giovanni.client.js";
import {
  normalizeGiovanni,
  normalizeHls,
  normalizeSmap,
} from "../providers/normalization.js";

export const vegetationPolicy: VegetationPolicy = {
  version: "vegetation-policy-1",
  minimumClearShare: 0.5,
  smoothingObservations: 5,
  seasonLevelFraction: 0.5,
  seasonPeakFraction: 0.75,
  mergeGapDays: 30,
  minimumSeasonDays: 30,
  minimumSignalToNoise: 4,
};
const digest = (value: unknown) =>
  createHash("sha256").update(stableJson(value)).digest("hex");
const sha = (bytes: Uint8Array) =>
  createHash("sha256").update(bytes).digest("hex");
// AppEEARS tasks took 7.5 hours in the 2026-10-17 test; polls are spaced
// and a task is abandoned after two days.
const POLL_SECONDS = 600;
const GIVE_UP_HOURS = 48;
type Request = {
  points: { id: string; latitude: number; longitude: number }[];
  start: string;
  end: string;
};
type Row = {
  id: string;
  field_id: string;
  kind: ObservationKind;
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
export class ObservationStore {
  constructor(
    readonly pool: Pool,
    private readonly boss: PgBoss,
    private readonly appeears: AppeearsTransport,
    private readonly rain: RainTransport,
    private readonly weather: WeatherService,
  ) {}
  private output(row: Row) {
    if (row.result && digest(row.result) !== row.result_hash)
      throw new PlanError("STORED_REQUEST_INVALID");
    return observationStatusSchema.parse({
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
  // Starts an extraction for an owned field, or returns the one in progress.
  // HLS needs a saved outline; SMAP and GPM use the field point rounded to
  // 0.01° (about 1 km), well inside their 9 km and 0.1° cells.
  async request(userId: string, fieldId: string, kind: ObservationKind) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const field = (
        await client.query<{
          profile: unknown;
          boundary: unknown;
          today: string;
        }>(
          `SELECT f.profile,b.boundary,to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') today
          FROM fields f LEFT JOIN auth_users u ON u.id=f.user_id LEFT JOIN field_boundaries b ON b.field_id=f.id
          WHERE f.id=$1 AND $2::uuid IN (f.user_id,f.guest_owner_id) AND (f.guest_owner_id IS NOT NULL OR u.email_verified) FOR UPDATE OF f`,
          [fieldId, userId],
        )
      ).rows[0];
      if (!field) throw new PlanError("NOT_FOUND");
      const active = (
        await client.query<Row>(
          "SELECT * FROM field_observations WHERE field_id=$1 AND kind=$2 AND status IN ('queued','submitted') ORDER BY created_at DESC LIMIT 1",
          [fieldId, kind],
        )
      ).rows[0];
      if (active) {
        await client.query("COMMIT");
        return this.output(active);
      }
      const recent = await client.query<{ n: number }>(
        "SELECT count(*)::int n FROM field_observations o JOIN fields f ON f.id=o.field_id WHERE $1::uuid IN (f.user_id,f.guest_owner_id) AND o.created_at>clock_timestamp()-interval '1 day'",
        [userId],
      );
      if (recent.rows[0]!.n >= 10) throw new PlanError("RATE_LIMITED", 86400);
      const year = Number(field.today.slice(0, 4));
      const { location } = fieldProfileSchema.parse(field.profile);
      const rounded = [
        {
          id: "f1",
          latitude: Number(location.latitude.toFixed(2)),
          longitude: Number(location.longitude.toFixed(2)),
        },
      ];
      let request: Request;
      if (kind === "hls") {
        const parsed = fieldBoundarySchema.safeParse(field.boundary);
        const points = parsed.success ? boundarySamplePoints(parsed.data) : [];
        if (!points.length) throw new PlanError("INVALID_INPUT");
        request = {
          points: points.map((p, i) => ({ id: `p${i + 1}`, ...p })),
          start: `${year - 5}-01-01`,
          end: field.today,
        };
      } else if (kind === "smap")
        request = {
          points: rounded,
          start: `${year - 2}-01-01`,
          end: field.today,
        };
      else {
        // IMERG Final arrives about 3.5 months late; POWER shares the policy.
        const end = (
          await client.query<{ d: string }>(
            "SELECT to_char((clock_timestamp() AT TIME ZONE 'UTC')::date-120,'YYYY-MM-DD') d",
          )
        ).rows[0]!.d;
        request = { points: rounded, start: `${year - 5}-01-01`, end };
      }
      const id = randomUUID();
      const row = (
        await client.query<Row>(
          "INSERT INTO field_observations(id,field_id,kind,request) VALUES($1,$2,$3,$4) RETURNING *",
          [id, fieldId, kind, request],
        )
      ).rows[0]!;
      // The row is the outbox: the worker queues new requests (see fresh()).
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
      OBSERVATION_QUEUE,
      { id },
      { singletonKey: id, startAfter },
    );
  }
  async list(userId: string, fieldId: string) {
    const rows = await this.pool.query<Row>(
      `SELECT DISTINCT ON (o.kind) o.* FROM field_observations o JOIN fields f ON f.id=o.field_id
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
        "SELECT o.* FROM field_observations o JOIN fields f ON f.id=o.field_id WHERE o.id=$1 AND o.field_id=$2 AND $3::uuid IN (f.user_id,f.guest_owner_id)",
        [id, fieldId, userId],
      )
    ).rows[0];
    if (!row) throw new PlanError("NOT_FOUND");
    return this.output(row);
  }
  // The newest completed extraction of one kind for an owned field, or why
  // there is none: never requested, still running, or failed.
  private async latestCompleted(
    userId: string,
    fieldId: string,
    kind: ObservationKind,
  ) {
    const owned = await this.pool.query<{ today: string }>(
      `SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') today FROM fields
      WHERE id=$1 AND $2::uuid IN (user_id,guest_owner_id)`,
      [fieldId, userId],
    );
    if (!owned.rowCount) throw new PlanError("NOT_FOUND");
    const rows = await this.pool.query<Row>(
      "SELECT * FROM field_observations WHERE field_id=$1 AND kind=$2 ORDER BY created_at DESC LIMIT 10",
      [fieldId, kind],
    );
    const done = rows.rows.find((r) => r.status === "completed");
    if (done) return { today: owned.rows[0]!.today, status: this.output(done) };
    const latest = rows.rows[0];
    return {
      today: owned.rows[0]!.today,
      status: null,
      unavailable: {
        status: "unavailable" as const,
        observation: latest
          ? (latest.status as "queued" | "submitted" | "failed")
          : ("none" as const),
        error: latest?.error_code ?? null,
      },
    };
  }
  // The field's own greenness history from its newest completed HLS result.
  async vegetationAnalysis(userId: string, fieldId: string) {
    const found = await this.latestCompleted(userId, fieldId, "hls");
    if (!found.status)
      return vegetationAnalysisResponseSchema.parse(found.unavailable);
    const result = found.status.result;
    if (result?.kind !== "hls") throw new PlanError("STORED_REQUEST_INVALID");
    return vegetationAnalysisResponseSchema.parse({
      status: "ready",
      observationId: found.status.id,
      completedAt: found.status.completedAt,
      analysis: analyzeVegetation(result, found.today),
    });
  }
  // POWER and GPM IMERG monthly rain beside each other for the field's cell.
  async rainSeries(userId: string, fieldId: string) {
    const found = await this.latestCompleted(userId, fieldId, "gpm");
    if (!found.status) return rainSeriesResponseSchema.parse(found.unavailable);
    const result = found.status.result;
    if (result?.kind !== "gpm") throw new PlanError("STORED_REQUEST_INVALID");
    return rainSeriesResponseSchema.parse({
      status: "ready",
      observationId: found.status.id,
      completedAt: found.status.completedAt,
      series: rainSeries(result),
    });
  }
  // New requests the worker has not queued yet.
  async fresh() {
    const rows = await this.pool.query<{ id: string }>(
      "SELECT id FROM field_observations WHERE status='queued' AND attempts=0 ORDER BY created_at LIMIT 50",
    );
    return rows.rows.map((r) => r.id);
  }
  async stale() {
    const rows = await this.pool.query<{ id: string }>(
      "SELECT id FROM field_observations WHERE status IN ('queued','submitted') AND updated_at<clock_timestamp()-interval '30 minutes' ORDER BY updated_at LIMIT 50",
    );
    return rows.rows.map((r) => r.id);
  }
  private task(row: Row): AppeearsTask {
    const layers =
      row.kind === "hls"
        ? [
            { product: "HLSS30.020", layer: "B04" },
            { product: "HLSS30.020", layer: "B8A" },
            { product: "HLSS30.020", layer: "Fmask" },
            { product: "HLSL30.020", layer: "B04" },
            { product: "HLSL30.020", layer: "B05" },
            { product: "HLSL30.020", layer: "Fmask" },
          ]
        : [
            {
              product: "SPL4SMGP.008",
              layer: "Geophysical_Data_sm_rootzone_pctl",
            },
            { product: "SPL4SMGP.008", layer: "Geophysical_Data_sm_rootzone" },
          ];
    return {
      task_type: "point",
      task_name: `rotavise-${row.id}`,
      params: {
        dates: [
          { startDate: mdy(row.request.start), endDate: mdy(row.request.end) },
        ],
        layers,
        coordinates: row.request.points.map((p) => ({
          ...p,
          category: "field",
        })),
      },
    };
  }
  private async save(
    row: Row,
    result: ObservationResult,
    files: { name: string; raw: Uint8Array }[],
  ) {
    const parsed = observationResultSchema.parse(result);
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      for (const f of files)
        await client.query(
          "INSERT INTO field_observation_files(observation_id,name,raw,sha256) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
          [row.id, f.name, Buffer.from(f.raw), sha(f.raw)],
        );
      await client.query(
        "UPDATE field_observations SET status='completed',result=$2,result_hash=$3,completed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1 AND status IN ('queued','submitted')",
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
      "UPDATE field_observations SET status='failed',error_code=$2,completed_at=clock_timestamp(),updated_at=clock_timestamp() WHERE id=$1 AND status IN ('queued','submitted')",
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
        "SELECT * FROM field_observations WHERE id=$1",
        [id],
      )
    ).rows[0];
    if (!row || row.status === "completed" || row.status === "failed")
      return null;
    try {
      await this.pool.query(
        "UPDATE field_observations SET attempts=least(attempts+1,10),updated_at=clock_timestamp() WHERE id=$1",
        [id],
      );
      if (row.kind === "gpm") {
        await this.processRain(row, signal);
        return null;
      }
      if (row.status === "queued") {
        const taskId = await this.appeears.submit(this.task(row), signal);
        await this.pool.query(
          "UPDATE field_observations SET status='submitted',remote_task_id=$2,attempts=0,updated_at=clock_timestamp() WHERE id=$1 AND status='queued'",
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
        return POLL_SECONDS;
      }
      const bundle = await this.appeears.bundle(taskId, signal);
      const wanted =
        row.kind === "hls"
          ? [/-HLSS30-020-results\.csv$/, /-HLSL30-020-results\.csv$/]
          : [/-SPL4SMGP-008-results\.csv$/];
      const files: { name: string; raw: Uint8Array }[] = [];
      for (const pattern of wanted) {
        const file = bundle.find((f) => pattern.test(f.name));
        // A product with no granules in the period may have no file.
        if (!file) continue;
        files.push({
          name: file.name.replace(/^.*?-(HLS|SPL)/, "$1"),
          raw: await this.appeears.download(taskId, file, signal),
        });
      }
      // The granule list names the HLS granules behind each date. It is
      // evidence only: a task without one still completes.
      let granuleList: string | null = null;
      if (row.kind === "hls") {
        const listed = bundle.find((f) => /-granule-list\.txt$/.test(f.name));
        if (listed) {
          const raw = await this.appeears.download(taskId, listed, signal);
          granuleList = new TextDecoder().decode(raw);
          files.push({ name: "granule-list.txt", raw });
        }
      }
      const result = this.normalize(row, files, granuleList);
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
  private normalize(
    row: Row,
    files: { name: string; raw: Uint8Array }[],
    granuleList: string | null = null,
  ): ObservationResult {
    const period = { start: row.request.start, end: row.request.end };
    if (row.kind === "hls") {
      const ids = new Set(row.request.points.map((p) => p.id));
      const pixels: PixelObservation[] = files
        .filter((f) => /^HLS[SL]30/.test(f.name))
        .flatMap((f) =>
          normalizeHls(
            f.raw,
            f.name.startsWith("HLSS30") ? "HLSS30.020" : "HLSL30.020",
            ids,
          ),
        );
      const history = vegetationHistory(
        pixels,
        row.request.points.length,
        period,
        vegetationPolicy,
      );
      const granules = granuleList
        ? hlsGranulesFromList(granuleList, history.observations)
        : [];
      return {
        kind: "hls",
        policy: vegetationPolicy,
        product: "HLS v2.0 (HLSL30.020, HLSS30.020) via AppEEARS",
        ...history,
        ...(granules.length ? { granules } : {}),
        limitations: VEGETATION_LIMITATIONS,
      };
    }
    if (!files[0]) throw new ObservationError("OBSERVATION_UPSTREAM_INVALID");
    const smap = normalizeSmap(files[0].raw);
    const latest = [...smap.days].reverse().find((d) => d.percentile !== null);
    return {
      kind: "smap",
      product: "SMAP L4 SPL4SMGP.008 root-zone soil moisture via AppEEARS",
      cell: smap.cell,
      period,
      days: smap.days,
      latest: latest
        ? { date: latest.date, percentile: latest.percentile! }
        : null,
      limitations: [
        "Model-assimilated soil moisture for a 9 km cell, not a measurement in the field.",
        "Percentiles compare with the product's own climatology and are undefined on some days.",
      ],
    };
  }
  // GPM IMERG daily totals for the 0.1° cell beside POWER's monthly totals for
  // its own cell. Context only: neither is a rain gauge on the field.
  private async processRain(row: Row, signal: AbortSignal) {
    const { latitude, longitude } = row.request.points[0]!;
    const raw = await this.rain.daily(
      latitude,
      longitude,
      row.request.start,
      row.request.end,
      signal,
    );
    const imerg = normalizeGiovanni(raw);
    const imergMonths = monthlyTotals(imerg.days);
    const powerDays: { date: string; mm: number | null }[] = [];
    for (let from = row.request.start; from <= row.request.end;) {
      const to =
        from.slice(0, 4) + "-12-31" < row.request.end
          ? from.slice(0, 4) + "-12-31"
          : row.request.end;
      const response = await this.weather.query(
        {
          latitude,
          longitude,
          startDate: from,
          endDate: to,
          variables: ["precipitation"],
        },
        signal,
      );
      for (const d of response.snapshot.days)
        powerDays.push({ date: d.date, mm: d.values.precipitation ?? null });
      from = `${Number(from.slice(0, 4)) + 1}-01-01`;
    }
    const powerMonths = monthlyTotals(powerDays);
    const daysIn = (month: string) =>
      new Date(
        Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0),
      ).getUTCDate();
    const total = (
      m: { sum: number; days: number; missing: boolean } | undefined,
      month: string,
    ) =>
      m && !m.missing && m.days === daysIn(month)
        ? Number(m.sum.toFixed(1))
        : null;
    const months = [...new Set([...imergMonths.keys(), ...powerMonths.keys()])]
      .sort()
      .map((month) => ({
        month,
        imergMm: total(imergMonths.get(month), month),
        powerMm: total(powerMonths.get(month), month),
        imergDays: imergMonths.get(month)?.days ?? 0,
      }));
    const result: ObservationResult = {
      kind: "gpm",
      product: "GPM IMERG Final daily V07 (GPM_3IMERGDF.07) via Giovanni",
      cell: imerg.cell,
      period: { start: row.request.start, end: row.request.end },
      months,
      limitations: [
        "Satellite estimate for a 0.1° cell and reanalysis for a POWER cell; neither is a field rain gauge.",
        "Satellite rain is less reliable over complex terrain and coasts; differences show uncertainty, not error in either.",
      ],
    };
    await this.save(row, result, [
      { name: "GPM_3IMERGDF.07-giovanni.csv", raw },
    ]);
  }
}
