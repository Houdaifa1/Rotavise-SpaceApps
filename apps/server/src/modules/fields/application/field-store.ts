import type { Pool } from "pg";
import { z } from "zod";
import {
  boundaryContains,
  boundaryHectares,
  boundarySamplePoints,
  fieldBoundarySchema,
  fieldProfileSchema,
  cropHistoryEntrySchema,
  type FieldBoundary,
} from "@rotavise/contracts";
import { withTransaction } from "../../../infrastructure/database/transaction.js";
import { PlanError } from "../../plans/application/plan-policy.js";
import {
  decodeCursor,
  encodeCursor,
} from "../../../common/http/page-cursor.js";

type RecordRow = {
  id: string;
  profile?: unknown;
  entry?: unknown;
  version: number;
  created_at: Date;
  updated_at: Date;
  sort_key?: string;
};
function output(row: RecordRow) {
  return {
    id: row.id,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.profile
      ? { profile: fieldProfileSchema.parse(row.profile) }
      : { entry: cropHistoryEntrySchema.parse(row.entry) }),
  };
}
function boundaryOutput(
  boundary: FieldBoundary,
  row: { version: number; updated_at: Date },
) {
  return {
    boundary,
    version: row.version,
    updatedAt: row.updated_at.toISOString(),
    hectares: boundaryHectares(boundary),
    // Points that can sample whole 30 m pixels; zero means too narrow.
    samplePoints: boundarySamplePoints(boundary).length,
  };
}
function page(rows: RecordRow[], limit: number) {
  const last = rows.length > limit ? rows[limit - 1]! : null;
  return {
    items: rows.slice(0, limit).map(output),
    nextCursor: last ? encodeCursor(last.sort_key!, last.id) : null,
  };
}
export class FieldStore {
  constructor(readonly pool: Pool) {}
  async create(
    userId: string,
    raw: unknown,
    rawHistory: unknown = [],
    rawBoundary?: unknown,
  ) {
    const profile = fieldProfileSchema.parse(raw);
    const history = z.array(cropHistoryEntrySchema).max(20).parse(rawHistory);
    const parsedBoundary = fieldBoundarySchema
      .optional()
      .safeParse(rawBoundary);
    if (!parsedBoundary.success) throw new PlanError("INVALID_INPUT");
    const boundary = parsedBoundary.data;
    if (
      boundary &&
      !boundaryContains(
        boundary,
        profile.location.latitude,
        profile.location.longitude,
      )
    )
      throw new PlanError("INVALID_INPUT");
    const sorted = [...history].sort((a, b) =>
      a.planted_on.localeCompare(b.planted_on),
    );
    if (
      sorted.some(
        (entry, index) =>
          index > 0 && sorted[index - 1]!.harvested_on >= entry.planted_on,
      )
    )
      throw new PlanError("INVALID_INPUT");
    return withTransaction(this.pool, async (client) => {
      const owner = await client.query(
        `SELECT id FROM auth_users WHERE id=$1 AND email_verified
        UNION ALL
        SELECT id FROM plan_owners WHERE id=$1 AND user_id IS NULL AND expires_at>clock_timestamp()`,
        [userId],
      );
      if (!owner.rowCount) throw new PlanError("UNAUTHORIZED");
      if (
        (
          await client.query<{ n: number }>(
            "SELECT count(*)::int n FROM fields WHERE $1::uuid IN (user_id,guest_owner_id)",
            [userId],
          )
        ).rows[0]!.n >= 30
      )
        throw new PlanError("RATE_LIMITED", 86400);
      const today = await this.dates(profile, client);
      if (history.some((entry) => entry.harvested_on > today))
        throw new PlanError("INVALID_INPUT");
      const q = await client.query<RecordRow>(
        `INSERT INTO fields(user_id,guest_owner_id,profile)
        SELECT (SELECT id FROM auth_users WHERE id=$1),
          (SELECT id FROM plan_owners WHERE id=$1 AND user_id IS NULL),$2
        RETURNING *`,
        [userId, profile],
      );
      for (const entry of history)
        await client.query(
          "INSERT INTO field_crop_history(field_id,entry) VALUES($1,$2)",
          [q.rows[0]!.id, entry],
        );
      if (boundary)
        await client.query(
          "INSERT INTO field_boundaries(field_id,boundary) VALUES($1,$2)",
          [q.rows[0]!.id, boundary],
        );
      return output(q.rows[0]!);
    });
  }
  private async dates(
    profile: ReturnType<typeof fieldProfileSchema.parse>,
    client: { query: Pool["query"] },
  ) {
    const {
      rows: [row],
    } = await client.query<{ today: string }>(
      "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') today",
    );
    if (
      (profile.soil.status === "known" &&
        profile.soil.observations.some(
          (o) => o.measured_on && o.measured_on > row!.today,
        )) ||
      (profile.crop_health.status === "reported" &&
        profile.crop_health.observations.some(
          (o) => o.observed_on > row!.today,
        ))
    )
      throw new PlanError("INVALID_INPUT");
    return row!.today;
  }
  // Newest fields first; exact microsecond keys, then ids, keep pages stable.
  async list(userId: string, cursor: string | undefined, limit: number) {
    const after = decodeCursor(cursor, "instant");
    const q = await this.pool.query<RecordRow>(
      `SELECT *,(extract(epoch from created_at)*1000000)::bigint::text sort_key FROM fields
      WHERE $1::uuid IN (user_id,guest_owner_id) AND ($2::bigint IS NULL OR ((extract(epoch from created_at)*1000000)::bigint,id)<($2::bigint,$3::uuid))
      ORDER BY created_at DESC,id DESC LIMIT $4`,
      [userId, after?.key ?? null, after?.id ?? null, limit + 1],
    );
    return page(q.rows, limit);
  }
  async read(userId: string, id: string) {
    const q = await this.pool.query<RecordRow>(
      "SELECT * FROM fields WHERE id=$1 AND $2::uuid IN (user_id,guest_owner_id)",
      [id, userId],
    );
    if (!q.rows[0]) throw new PlanError("NOT_FOUND");
    return output(q.rows[0]);
  }
  async update(userId: string, id: string, version: number, raw: unknown) {
    const profile = fieldProfileSchema.parse(raw);
    await this.dates(profile, this.pool);
    const q = await this.pool.query<RecordRow>(
      "UPDATE fields SET profile=$4,version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND $2::uuid IN (user_id,guest_owner_id) AND version=$3 RETURNING *",
      [id, userId, version, profile],
    );
    if (!q.rows[0]) {
      await this.read(userId, id);
      throw new PlanError("IDEMPOTENCY_CONFLICT");
    }
    return output(q.rows[0]);
  }
  async remove(userId: string, id: string) {
    const q = await this.pool.query(
      "DELETE FROM fields WHERE id=$1 AND $2::uuid IN (user_id,guest_owner_id) RETURNING id",
      [id, userId],
    );
    if (!q.rowCount) throw new PlanError("NOT_FOUND");
  }
  async history(
    userId: string,
    fieldId: string,
    cursor: string | undefined,
    limit: number,
  ) {
    await this.read(userId, fieldId);
    // Most recent planting first; ISO dates sort correctly in the C collation.
    const after = decodeCursor(cursor, "date");
    const q = await this.pool.query<RecordRow>(
      `SELECT h.*,h.entry->>'planted_on' sort_key FROM field_crop_history h JOIN fields f ON f.id=h.field_id
      WHERE h.field_id=$1 AND $2::uuid IN (f.user_id,f.guest_owner_id) AND ($3::text IS NULL OR ((h.entry->>'planted_on') COLLATE "C",h.id)<($3::text COLLATE "C",$4::uuid))
      ORDER BY (h.entry->>'planted_on') COLLATE "C" DESC,h.id DESC LIMIT $5`,
      [fieldId, userId, after?.key ?? null, after?.id ?? null, limit + 1],
    );
    return page(q.rows, limit);
  }
  async saveHistory(
    userId: string,
    fieldId: string,
    raw: unknown,
    id?: string,
    version?: number,
  ) {
    const entry = cropHistoryEntrySchema.parse(raw);
    return withTransaction(this.pool, async (client) => {
      const field = await client.query<{ today: string }>(
        "SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') today FROM fields WHERE id=$1 AND $2::uuid IN (user_id,guest_owner_id) FOR UPDATE",
        [fieldId, userId],
      );
      if (!field.rows[0]) throw new PlanError("NOT_FOUND");
      if (entry.harvested_on > field.rows[0].today)
        throw new PlanError("INVALID_INPUT");
      if (
        !id &&
        (
          await client.query<{ n: number }>(
            "SELECT count(*)::int n FROM field_crop_history WHERE field_id=$1",
            [fieldId],
          )
        ).rows[0]!.n >= 500
      )
        throw new PlanError("RATE_LIMITED", 86400);
      const overlaps = await client.query(
        "SELECT id FROM field_crop_history WHERE field_id=$1 AND ($2::uuid IS NULL OR id<>$2) AND entry->>'planted_on'<=$4 AND entry->>'harvested_on'>=$3 LIMIT 1",
        [fieldId, id ?? null, entry.planted_on, entry.harvested_on],
      );
      if (overlaps.rowCount) throw new PlanError("INVALID_INPUT");
      const q = id
        ? await client.query<RecordRow>(
            "UPDATE field_crop_history SET entry=$4,version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND field_id=$2 AND version=$3 RETURNING *",
            [id, fieldId, version, entry],
          )
        : await client.query<RecordRow>(
            "INSERT INTO field_crop_history(field_id,entry) VALUES($1,$2) RETURNING *",
            [fieldId, entry],
          );
      if (!q.rows[0]) {
        if (
          !(
            await client.query(
              "SELECT id FROM field_crop_history WHERE id=$1 AND field_id=$2",
              [id, fieldId],
            )
          ).rowCount
        )
          throw new PlanError("NOT_FOUND");
        throw new PlanError("IDEMPOTENCY_CONFLICT");
      }
      return output(q.rows[0]);
    });
  }
  async boundary(userId: string, fieldId: string) {
    await this.read(userId, fieldId);
    const q = await this.pool.query<{
      boundary: unknown;
      version: number;
      updated_at: Date;
    }>(
      "SELECT b.boundary,b.version,b.updated_at FROM field_boundaries b JOIN fields f ON f.id=b.field_id WHERE b.field_id=$1 AND $2::uuid IN (f.user_id,f.guest_owner_id)",
      [fieldId, userId],
    );
    const row = q.rows[0];
    return row
      ? boundaryOutput(fieldBoundarySchema.parse(row.boundary), row)
      : null;
  }
  // The field's point must lie inside its outline, so plans and satellite
  // samples describe the same place.
  async saveBoundary(
    userId: string,
    fieldId: string,
    raw: unknown,
    expectedVersion: number | null,
  ) {
    const boundary = fieldBoundarySchema.parse(raw);
    return withTransaction(this.pool, async (client) => {
      const field = await client.query<{ profile: unknown }>(
        "SELECT profile FROM fields WHERE id=$1 AND $2::uuid IN (user_id,guest_owner_id) FOR UPDATE",
        [fieldId, userId],
      );
      if (!field.rows[0]) throw new PlanError("NOT_FOUND");
      const { location } = fieldProfileSchema.parse(field.rows[0].profile);
      if (!boundaryContains(boundary, location.latitude, location.longitude))
        throw new PlanError("INVALID_INPUT");
      const q =
        expectedVersion === null
          ? await client.query(
              "INSERT INTO field_boundaries(field_id,boundary) VALUES($1,$2) ON CONFLICT(field_id) DO NOTHING RETURNING version,updated_at",
              [fieldId, boundary],
            )
          : await client.query(
              "UPDATE field_boundaries SET boundary=$3,version=version+1,updated_at=clock_timestamp() WHERE field_id=$1 AND version=$2 RETURNING version,updated_at",
              [fieldId, expectedVersion, boundary],
            );
      if (!q.rows[0]) throw new PlanError("IDEMPOTENCY_CONFLICT");
      return boundaryOutput(boundary, q.rows[0]);
    });
  }
  async removeBoundary(userId: string, fieldId: string) {
    const q = await this.pool.query(
      "DELETE FROM field_boundaries b USING fields f WHERE b.field_id=$1 AND f.id=b.field_id AND $2::uuid IN (f.user_id,f.guest_owner_id) RETURNING b.field_id",
      [fieldId, userId],
    );
    if (!q.rowCount) throw new PlanError("NOT_FOUND");
  }
  async removeHistory(userId: string, fieldId: string, id: string) {
    const q = await this.pool.query(
      "DELETE FROM field_crop_history h USING fields f WHERE h.id=$1 AND h.field_id=$2 AND f.id=h.field_id AND $3::uuid IN (f.user_id,f.guest_owner_id) RETURNING h.id",
      [id, fieldId, userId],
    );
    if (!q.rowCount) throw new PlanError("NOT_FOUND");
  }
}
