import { randomBytes, randomUUID } from "node:crypto";
import type pg from "pg";
import type { PgBoss, Db } from "pg-boss";
import {
  planTokenSchema,
  planStatusSchema,
  planEvidenceSchema,
  intakeResultSchema,
  ownerSessionSchema,
  planRequestV2Schema,
  planLabelSchema,
  planListSchema,
  whatIfSchema,
  type PlanRequest,
  type PlanRequestV2,
} from "@rotavise/contracts";
import {
  catalogHeadById,
  catalogHeadByVersion,
  verifiedCatalog,
} from "../../catalog/application/catalog-store.js";
import {
  PLAN_QUEUE,
  PLANNING_QUEUE,
} from "../../../infrastructure/queue/pg-boss.js";
import type { PlanningStore } from "./planning-store.js";
import {
  withTransaction,
  queueTransaction,
} from "../../../infrastructure/database/transaction.js";
import {
  PlanError,
  anyRequestIdentity,
  tokenHash,
  validateIntakeDates,
  SESSION_SECONDS,
  REQUEST_SECONDS,
} from "./plan-policy.js";
import { planSummary } from "./plan-summary.js";
import { quota } from "../../../common/security/quota.js";
import {
  decodeCursor,
  encodeCursor,
} from "../../../common/http/page-cursor.js";
import type { AccountAuth } from "../../auth/application/auth.js";
import type { Config } from "../../../config/environment.js";

type PlanRow = {
  id: string;
  owner_id: string;
  input: unknown;
  input_hash: string;
  label: string | null;
  initial_label: string | null;
  parent_plan_id: string | null;
  evidence: unknown;
  catalog_snapshot_id: string;
  queue_job_id: string;
  status: "queued" | "running" | "completed" | "failed";
  attempts: number;
  created_at: Date;
  updated_at: Date;
  expires_at: Date;
  error_code: string | null;
  result?: unknown;
};
type Enqueue = (id: string, queueId: string, db: Db) => Promise<string | null>;
export class PlanStore {
  constructor(
    readonly pool: pg.Pool,
    readonly boss: PgBoss,
    readonly catalogId: string,
    readonly catalogVersion: string,
    readonly account?: { auth: AccountAuth; config: Config },
    readonly planning?: PlanningStore,
  ) {}
  async quota(subject: string, limit: number, seconds: number) {
    return quota(this.pool, subject, limit, seconds);
  }
  async accountOwner(userId: string) {
    const q = await this.pool.query<{ id: string }>(
      `INSERT INTO plan_owners(user_id)
      SELECT id FROM auth_users WHERE id=$1 AND email_verified
      ON CONFLICT(user_id) DO UPDATE SET user_id=excluded.user_id RETURNING id`,
      [userId],
    );
    if (!q.rows[0]) throw new PlanError("UNAUTHORIZED");
    return q.rows[0].id;
  }
  async createOwner(ip: string) {
    await this.quota("session:" + ip, 20, 3600);
    const token = randomBytes(32).toString("base64url");
    const q = await this.pool.query<{ expires_at: Date }>(
      "INSERT INTO plan_owners(token_hash,expires_at) VALUES($1,now()+$2*interval '1 second') RETURNING expires_at",
      [tokenHash(token), SESSION_SECONDS],
    );
    return ownerSessionSchema.parse({
      accessToken: token,
      expiresAt: q.rows[0]!.expires_at.toISOString(),
    });
  }
  async authenticate(token: string | undefined) {
    if (!planTokenSchema.safeParse(token).success)
      throw new PlanError("UNAUTHORIZED");
    const q = await this.pool.query<{ id: string }>(
      "SELECT id FROM plan_owners WHERE token_hash=$1 AND expires_at>clock_timestamp()",
      [tokenHash(token!)],
    );
    if (!q.rows[0]) throw new PlanError("UNAUTHORIZED");
    return q.rows[0].id;
  }
  async submit(
    ownerId: string,
    key: string,
    raw: PlanRequest | PlanRequestV2,
    enqueue?: Enqueue,
    metadata: { label?: string; parentPlanId?: string } = {},
  ) {
    const parsedLabel = planLabelSchema.optional().safeParse(metadata.label);
    if (!parsedLabel.success) throw new PlanError("INVALID_INPUT");
    const initialLabel = parsedLabel.data ?? null;
    const parentPlanId = metadata.parentPlanId ?? null;
    const identity = anyRequestIdentity(raw);
    const fullPlanning = this.planning?.config.PLANNING_ENABLED === "true";
    // Rotation requests exist only for the full workflow.
    if (identity.format === "2" && !fullPlanning)
      throw new PlanError("INVALID_INPUT");
    const catalogVersion =
      identity.format === "2"
        ? this.planning!.config.ROTATION_CATALOG_VERSION
        : this.catalogVersion;
    return withTransaction(this.pool, async (client) => {
      // Serialize this owner's acceptance against revoke and parallel submissions.
      const owner = await client.query<{
        expires_at: Date | null;
        user_id: string | null;
        today: string;
      }>(
        "SELECT expires_at,user_id,to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD') today FROM plan_owners WHERE id=$1 AND (user_id IS NOT NULL OR expires_at>clock_timestamp()) FOR UPDATE",
        [ownerId],
      );
      if (!owner.rows[0]) throw new PlanError("UNAUTHORIZED");
      if (
        (
          await client.query(
            "SELECT request_id FROM plan_claims WHERE guest_owner_id=$1 AND original_key=$2",
            [ownerId, key],
          )
        ).rowCount
      )
        throw new PlanError("NOT_FOUND");
      const existing = await client.query<PlanRow & { active: boolean }>(
        "SELECT *,expires_at>clock_timestamp() active FROM plan_requests WHERE owner_id=$1 AND idempotency_key=$2",
        [ownerId, key],
      );
      if (existing.rows[0]) {
        if (
          existing.rows[0].input_hash !== identity.hash ||
          existing.rows[0].initial_label !== initialLabel ||
          existing.rows[0].parent_plan_id !== parentPlanId
        )
          throw new PlanError("IDEMPOTENCY_CONFLICT");
        if (!existing.rows[0].active) throw new PlanError("NOT_FOUND");
        return {
          id: existing.rows[0].id,
          expiresAt: existing.rows[0].expires_at.toISOString(),
        };
      }
      if (parentPlanId) {
        const parent = await client.query(
          "SELECT id FROM plan_requests WHERE id=$1 AND owner_id=$2 AND expires_at>clock_timestamp() FOR SHARE",
          [parentPlanId, ownerId],
        );
        if (!parent.rowCount) throw new PlanError("NOT_FOUND");
      }
      if (!validateIntakeDates(identity.input, owner.rows[0].today))
        throw new PlanError("INVALID_INPUT");
      const count = await client.query<{ n: number }>(
        "SELECT count(*)::int n FROM plan_requests WHERE owner_id=$1",
        [ownerId],
      );
      if (count.rows[0]!.n >= (owner.rows[0].user_id ? 200 : 20))
        throw new PlanError("RATE_LIMITED", REQUEST_SECONDS);
      const snapshot = await catalogHeadByVersion(
        client,
        this.catalogId,
        catalogVersion,
      );
      if (!snapshot) throw new PlanError("CATALOG_UNAVAILABLE");
      let prepared;
      try {
        prepared = await verifiedCatalog(client, snapshot);
      } catch {
        throw new PlanError("CATALOG_UNAVAILABLE");
      }
      if (
        prepared.format !== identity.format ||
        prepared.sha256 !== snapshot.content_sha256 ||
        prepared.catalog.id !== this.catalogId ||
        prepared.catalog.version !== catalogVersion
      )
        throw new PlanError("CATALOG_UNAVAILABLE");
      const evidence = planEvidenceSchema.parse({
        catalogSnapshotId: snapshot.id,
        catalogId: this.catalogId,
        catalogVersion,
        catalogSha256: snapshot.content_sha256,
        intakeVersion: "1",
        policyVersion: "intake-policy-1",
        weatherSnapshotIds: [],
        engineVersion: null,
        rankingVersion: null,
      });
      const id = randomUUID(),
        queueId = randomUUID();
      const insert = await client.query<{ expires_at: Date }>(
        "INSERT INTO plan_requests(id,owner_id,idempotency_key,input,input_hash,evidence,catalog_snapshot_id,queue_job_id,expires_at,retention,label,initial_label,parent_plan_id) VALUES($1,$2,$3,$4,$5,$6,$7,$8,least($9::timestamptz,now()+$10*interval '1 second'),$11,$12,$12,$13) RETURNING expires_at",
        [
          id,
          ownerId,
          key,
          identity.input,
          identity.hash,
          evidence,
          snapshot.id,
          queueId,
          owner.rows[0].expires_at,
          owner.rows[0].user_id ? 365 * REQUEST_SECONDS : REQUEST_SECONDS,
          owner.rows[0].user_id ? "account" : "guest",
          initialLabel,
          parentPlanId,
        ],
      );
      if (fullPlanning)
        await this.planning!.accept(
          client,
          id,
          identity.input,
          owner.rows[0].today,
        );
      const jobId = await (enqueue
        ? enqueue(id, queueId, queueTransaction(client))
        : this.boss.send(
            fullPlanning ? PLANNING_QUEUE : PLAN_QUEUE,
            { requestId: id },
            { id: queueId, db: queueTransaction(client) },
          ));
      if (jobId !== queueId) throw new Error("PLAN_ENQUEUE_FAILED");
      return { id, expiresAt: insert.rows[0]!.expires_at.toISOString() };
    });
  }
  // Runs an existing format 2 plan again with a what-if test on top. The new
  // plan is the stored request plus `what_if`, so it is hashed, owner-scoped
  // and queued exactly like any other rotation request.
  async submitWhatIf(
    ownerId: string,
    key: string,
    planId: string,
    whatIf: unknown,
  ) {
    const parsed = whatIfSchema.safeParse(whatIf);
    if (!parsed.success) throw new PlanError("INVALID_INPUT");
    const source = await this.read(ownerId, planId);
    const stored = planRequestV2Schema.safeParse(
      (source as { input?: unknown }).input,
    );
    if (!stored.success) throw new PlanError("INVALID_INPUT");
    return this.submit(
      ownerId,
      key,
      { ...stored.data, what_if: parsed.data },
      undefined,
      { parentPlanId: planId },
    );
  }
  async read(ownerId: string, id: string) {
    const full = await this.planning?.read(ownerId, id);
    if (full) return full;
    const q = await this.pool.query<PlanRow>(
      "SELECT r.*,s.result FROM plan_requests r JOIN plan_owners o ON o.id=r.owner_id LEFT JOIN plan_intake_results s ON s.request_id=r.id WHERE r.id=$1 AND r.owner_id=$2 AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp())",
      [id, ownerId],
    );
    const r = q.rows[0];
    if (!r) throw new PlanError("NOT_FOUND");
    try {
      if (anyRequestIdentity(r.input).hash !== r.input_hash)
        throw new Error("HASH_MISMATCH");
      if (
        planEvidenceSchema.parse(r.evidence).catalogSnapshotId !==
        r.catalog_snapshot_id
      )
        throw new Error("EVIDENCE_MISMATCH");
      const stages = {
        queued: "awaiting_intake",
        running: "verifying_intake",
        completed: "intake_complete",
        failed: "intake_failed",
      };
      return planStatusSchema.parse({
        id: r.id,
        label: r.label,
        parentPlanId: r.parent_plan_id,
        status: r.status,
        stage: stages[r.status],
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
        expiresAt: r.expires_at.toISOString(),
        attempts: r.attempts,
        input: r.input,
        evidence: r.evidence,
        result: r.result ?? null,
        error: r.error_code ? { code: r.error_code } : null,
      });
    } catch {
      throw new PlanError("STORED_REQUEST_INVALID");
    }
  }
  serializeRead(value: { id: string }) {
    return this.planning?.serializeRead(value) ?? JSON.stringify(value);
  }
  async remove(ownerId: string, id: string) {
    const q = await this.pool.query(
      "DELETE FROM plan_requests r USING plan_owners o WHERE r.id=$1 AND r.owner_id=$2 AND o.id=r.owner_id AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp()) RETURNING r.id",
      [id, ownerId],
    );
    if (!q.rowCount) throw new PlanError("NOT_FOUND");
  }
  // Newest first. The cursor compares exact microsecond keys, then ids.
  async list(ownerId: string, cursor: string | undefined, limit: number) {
    const after = decodeCursor(cursor, "instant");
    const q = await this.pool.query<{
      id: string;
      status: string;
      created_at: Date;
      expires_at: Date;
      sort_key: string;
      input: unknown;
      label: string | null;
      parent_plan_id: string | null;
      field_name: string | null;
      summary_result: unknown;
    }>(
      `SELECT r.id,coalesce(p.status,r.status) status,r.created_at,r.expires_at,
        (extract(epoch from r.created_at)*1000000)::bigint::text sort_key,
        r.input,r.label,r.parent_plan_id,f.profile->>'name' field_name,
        jsonb_build_object('strategies',p.strategy_summary) summary_result
      FROM plan_requests r JOIN plan_owners o ON o.id=r.owner_id
      LEFT JOIN planning_runs p ON p.request_id=r.id
      LEFT JOIN fields f ON f.id::text=r.input->>'field_id'
        AND (f.user_id=o.user_id OR f.guest_owner_id=o.id)
      WHERE r.owner_id=$1 AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp()) AND r.expires_at>clock_timestamp()
      AND ($2::bigint IS NULL OR ((extract(epoch from r.created_at)*1000000)::bigint,r.id)<($2::bigint,$3::uuid))
      ORDER BY r.created_at DESC,r.id DESC LIMIT $4`,
      [ownerId, after?.key ?? null, after?.id ?? null, limit + 1],
    );
    const last = q.rows.length > limit ? q.rows[limit - 1]! : null;
    return planListSchema.parse({
      items: q.rows.slice(0, limit).map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.created_at.toISOString(),
        expiresAt: r.expires_at.toISOString(),
        label: r.label,
        parentPlanId: r.parent_plan_id,
        fieldName: r.field_name,
        ...planSummary(r.input, r.status, r.summary_result),
      })),
      nextCursor: last ? encodeCursor(last.sort_key, last.id) : null,
    });
  }
  async setLabel(ownerId: string, id: string, rawLabel: unknown) {
    const parsed = planLabelSchema.nullable().safeParse(rawLabel);
    if (!parsed.success) throw new PlanError("INVALID_INPUT");
    const q = await this.pool.query<{ id: string; label: string | null }>(
      `UPDATE plan_requests r SET label=$3
      FROM plan_owners o WHERE r.id=$1 AND r.owner_id=$2 AND o.id=r.owner_id
      AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp())
      RETURNING r.id,r.label`,
      [id, ownerId, parsed.data],
    );
    if (!q.rows[0]) throw new PlanError("NOT_FOUND");
    return q.rows[0];
  }
  async claim(guestOwnerId: string, accountOwnerId: string, id: string) {
    return withTransaction(this.pool, async (client) => {
      const owners = await client.query<{
        id: string;
        user_id: string | null;
        live: boolean;
      }>(
        "SELECT id,user_id,(user_id IS NOT NULL OR expires_at>clock_timestamp()) live FROM plan_owners WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE",
        [[guestOwnerId, accountOwnerId]],
      );
      if (
        !owners.rows.some(
          (r) => r.id === guestOwnerId && !r.user_id && r.live,
        ) ||
        !owners.rows.some((r) => r.id === accountOwnerId && r.user_id && r.live)
      )
        throw new PlanError("UNAUTHORIZED");
      const previous = await client.query<{
        account_owner_id: string;
        guest_owner_id: string;
      }>("SELECT * FROM plan_claims WHERE request_id=$1", [id]);
      if (previous.rows[0]) {
        if (
          previous.rows[0].account_owner_id !== accountOwnerId ||
          previous.rows[0].guest_owner_id !== guestOwnerId
        )
          throw new PlanError("NOT_FOUND");
        if (
          !(
            await client.query(
              "SELECT id FROM plan_requests WHERE id=$1 AND owner_id=$2 AND expires_at>clock_timestamp()",
              [id, accountOwnerId],
            )
          ).rowCount
        )
          throw new PlanError("NOT_FOUND");
        return { id, claimed: true };
      }
      const request = await client.query<{ idempotency_key: string }>(
        "SELECT idempotency_key FROM plan_requests WHERE id=$1 AND owner_id=$2 AND expires_at>clock_timestamp() FOR UPDATE",
        [id, guestOwnerId],
      );
      if (!request.rows[0]) throw new PlanError("NOT_FOUND");
      if (
        (
          await client.query<{ n: number }>(
            "SELECT count(*)::int n FROM plan_requests WHERE owner_id=$1",
            [accountOwnerId],
          )
        ).rows[0]!.n >= 200
      )
        throw new PlanError("RATE_LIMITED", 86400);
      await client.query(
        "INSERT INTO plan_claims(request_id,guest_owner_id,original_key,account_owner_id) VALUES($1,$2,$3,$4)",
        [id, guestOwnerId, request.rows[0].idempotency_key, accountOwnerId],
      );
      await client.query(
        "UPDATE plan_requests SET owner_id=$2,idempotency_key=$3,retention='account',expires_at=created_at+interval '365 days' WHERE id=$1",
        [id, accountOwnerId, "claimed-" + id],
      );
      // A guest's fields move with the guest's first claimed plan.
      await client.query(
        `UPDATE fields SET guest_owner_id=NULL,
          user_id=(SELECT user_id FROM plan_owners WHERE id=$2)
        WHERE guest_owner_id=$1`,
        [guestOwnerId, accountOwnerId],
      );
      return { id, claimed: true };
    });
  }
  async revoke(ownerId: string) {
    await this.pool.query("DELETE FROM plan_owners WHERE id=$1", [ownerId]);
  }
  async begin(id: string) {
    const q = await this.pool.query<PlanRow>(
      "UPDATE plan_requests r SET status='running',attempts=attempts+1,updated_at=now() FROM plan_owners o WHERE r.id=$1 AND o.id=r.owner_id AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp()) AND r.status IN ('queued','running') RETURNING r.*",
      [id],
    );
    return q.rows[0] ?? null;
  }
  async verifyAndComplete(id: string, afterInsert?: () => Promise<void>) {
    await withTransaction(this.pool, async (client) => {
      const q = await client.query<PlanRow>(
        "SELECT r.* FROM plan_requests r JOIN plan_owners o ON o.id=r.owner_id WHERE r.id=$1 AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp()) FOR UPDATE OF r",
        [id],
      );
      const row = q.rows[0];
      if (!row || ["completed", "failed"].includes(row.status)) return;
      let evidence;
      try {
        if (anyRequestIdentity(row.input).hash !== row.input_hash)
          throw new Error("MISMATCH");
        evidence = planEvidenceSchema.parse(row.evidence);
        if (evidence.catalogSnapshotId !== row.catalog_snapshot_id)
          throw new Error("MISMATCH");
      } catch {
        await this.fail(client, id, "STORED_REQUEST_INVALID");
        return;
      }
      try {
        const snapshot = await catalogHeadById(client, row.catalog_snapshot_id);
        if (!snapshot) throw new Error("MISSING");
        const prepared = await verifiedCatalog(client, snapshot);
        if (
          prepared.sha256 !== evidence.catalogSha256 ||
          snapshot.content_sha256 !== evidence.catalogSha256 ||
          prepared.catalog.id !== evidence.catalogId ||
          prepared.catalog.version !== evidence.catalogVersion
        )
          throw new Error("MISMATCH");
      } catch {
        await this.fail(client, id, "CATALOG_EVIDENCE_INVALID");
        return;
      }
      const result = intakeResultSchema.parse({
        kind: "request_intake",
        requestIntegrity: "verified",
        catalogIntegrity: "verified",
        planning: "not_implemented",
        recommendations: null,
        weather: "not_requested",
      });
      const inserted = await client.query(
        "INSERT INTO plan_intake_results(request_id,result) SELECT r.id,$2::jsonb FROM plan_requests r JOIN plan_owners o ON o.id=r.owner_id WHERE r.id=$1 AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp()) ON CONFLICT(request_id) DO NOTHING RETURNING request_id",
        [id, result],
      );
      if (!inserted.rowCount) return;
      await afterInsert?.();
      const completed = await client.query(
        "UPDATE plan_requests r SET status='completed',completed_at=now(),updated_at=now() FROM plan_owners o WHERE r.id=$1 AND o.id=r.owner_id AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp()) RETURNING r.id",
        [id],
      );
      if (!completed.rowCount)
        throw new Error("INTAKE_EXPIRED_DURING_COMPLETION");
    });
  }
  private async fail(client: pg.PoolClient, id: string, code: string) {
    await client.query(
      "UPDATE plan_requests SET status='failed',error_code=$2,completed_at=now(),updated_at=now() WHERE id=$1 AND status IN ('queued','running')",
      [id, code],
    );
  }
  async maintain() {
    // Each statement has a bounded batch and uses database time. Expiry blocks
    // access independently of housekeeping. Queue rows carry no field input.
    await this.pool.query(
      "DELETE FROM plan_requests WHERE id IN (SELECT id FROM plan_requests WHERE expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100)",
    );
    await this.pool.query(
      "DELETE FROM plan_owners WHERE id IN (SELECT id FROM plan_owners WHERE expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100)",
    );
    await this.pool.query(
      "DELETE FROM plan_quotas WHERE key_hash IN (SELECT key_hash FROM plan_quotas WHERE expires_at<=clock_timestamp() ORDER BY expires_at LIMIT 100)",
    );
    const pending = await this.pool.query<{ id: string; queue_job_id: string }>(
      "SELECT id,queue_job_id FROM plan_requests r WHERE status IN ('queued','running') AND NOT EXISTS(SELECT 1 FROM planning_runs p WHERE p.request_id=r.id) ORDER BY updated_at LIMIT 100",
    );
    for (const row of pending.rows)
      await withTransaction(this.pool, async (client) => {
        await client.query(
          "SELECT id FROM plan_requests WHERE id=$1 FOR UPDATE",
          [row.id],
        );
        const [job] = await this.boss.findJobs(PLAN_QUEUE, {
          id: row.queue_job_id,
          db: queueTransaction(client),
        });
        if (!job || ["failed", "cancelled", "completed"].includes(job.state))
          await this.fail(
            client,
            row.id,
            job?.state === "failed"
              ? "RETRIES_EXHAUSTED"
              : "QUEUE_TERMINAL_WITHOUT_RESULT",
          );
        else if (["created", "retry"].includes(job.state))
          await client.query(
            "UPDATE plan_requests SET status='queued',updated_at=now() WHERE id=$1 AND status='running'",
            [row.id],
          );
      });
  }
  async ready() {
    await this.pool.query(
      "SELECT token_hash,expires_at FROM plan_owners LIMIT 0",
    );
    await this.pool.query(
      "SELECT owner_id,input_hash,evidence,expires_at,status FROM plan_requests LIMIT 0",
    );
    await this.pool.query(
      "SELECT request_id,result FROM plan_intake_results LIMIT 0",
    );
    await this.pool.query("SELECT key_hash,count FROM plan_quotas LIMIT 0");
    if (!(await this.boss.getQueue(PLAN_QUEUE)))
      throw new Error("PLAN_QUEUE_UNAVAILABLE");
    await this.planning?.ready();
  }
}
