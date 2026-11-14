import { pinAnalysisContext } from "./analysis-context.js";
import { randomUUID, createHash } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import type { PgBoss } from "pg-boss";
import {
  catalogV2ContentHash,
  validateCatalogStructure,
  validateCatalogV2Structure,
} from "@rotavise/catalog";
import {
  planningVersionsSchema,
  planningStatusSchema,
  planningResultSchema,
  sequenceContextSchema,
  historicalPolicySchema,
  powerCell,
  rotationAssessmentSchema,
  rotationPlanningStatusSchema,
  rotationPlanningVersionsSchema,
  type PlanRequest,
  type PlanRequestV2,
  type RotationAssessment,
  type RotationPlanningVersions,
  type RotationPlanningStatus,
  type RotationPolicyV2,
  type RotationAssessmentV5,
  type RotationAssessmentV6,
  type FutureClimatePolicy,
  type ScenarioSeries,
  type ScenarioUnitIdentity,
  type PlanningVersions,
  type HistoricalPolicy,
  type SequenceContext,
  type HistoricalAssessment,
  type SequenceResult,
} from "@rotavise/contracts";
import {
  generateSequences,
  assessHistoricalSequences,
  selectPlanningComparisons,
  normalizedWeatherHash,
  assessRotations,
  addSoilCarbon,
  attachYields,
  rankWithYields,
  rankResearchCandidates,
  syncResearchStrategies,
  syncStrategyRanks,
  textureClass,
  yieldRequestWeather,
  yieldSimulations,
  rotationWeatherNeeds,
  rotationScenarioNeeds,
  rotationNearTermNeeds,
} from "@rotavise/domain";
import type { Config } from "../../../config/environment.js";
import {
  withTransaction,
  queueTransaction,
} from "../../../infrastructure/database/transaction.js";
import { PLANNING_QUEUE } from "../../../infrastructure/queue/pg-boss.js";
import { stableJson } from "../../../common/serialization/stable-json.js";
import { WeatherService } from "../../weather/application/weather.service.js";
import { weatherRequestKey } from "../../weather/application/weather-request.js";
import { WeatherError } from "../../weather/providers/weather-provider.js";
import {
  requestIdentity,
  requestIdentityV2,
  PlanError,
} from "./plan-policy.js";
import {
  catalogHeadById,
  verifiedCatalog,
  type VerifiedCatalog,
} from "../../catalog/application/catalog-store.js";
import { ScenarioStore } from "../../climate-scenarios/application/scenario-store.js";
import { SoilStore } from "../../soil/application/soil-store.js";
import { GiovanniClient } from "../../earth-observations/providers/giovanni/giovanni.client.js";
import { RainReferenceStore } from "../../weather/application/rain-reference-store.js";
import { enqueueTile } from "../../climate-scenarios/worker/scenario.handler.js";
import { ScenarioError } from "../../climate-scenarios/providers/nex-gddp/normalization.js";

export const planningBaseline: HistoricalPolicy = {
  version: "historical-policy-1",
  firstAnchorYear: 1991,
  lastAnchorYear: 2020,
  splitAfterYear: 2005,
  minimumCompleteAnalogs: 24,
  minimumPeriodAnalogs: 12,
};
// The ISIMIP3b primary models (Lange 2021, ISIMIP3b bias adjustment), each
// with its own calendar, under SSP2-4.5 and SSP5-8.5. Data years run five
// years past the last anchor so a five-year rotation can finish.
export const futureClimatePolicy: FutureClimatePolicy = {
  dataset: "NEX-GDDP-CMIP6",
  datasetVersion: "2.0",
  ensemble: "isimip3b-primary",
  models: [
    { id: "GFDL-ESM4", variant: "r1i1p1f1", grid: "gr1", calendar: "365_day" },
    {
      id: "IPSL-CM6A-LR",
      variant: "r1i1p1f1",
      grid: "gr",
      calendar: "standard",
    },
    {
      id: "MPI-ESM1-2-HR",
      variant: "r1i1p1f1",
      grid: "gn",
      calendar: "proleptic_gregorian",
    },
    {
      id: "MRI-ESM2-0",
      variant: "r1i1p1f1",
      grid: "gn",
      calendar: "proleptic_gregorian",
    },
    { id: "UKESM1-0-LL", variant: "r1i1p1f2", grid: "gn", calendar: "360_day" },
  ],
  baseline: {
    experiment: "historical",
    firstAnchorYear: 1985,
    lastAnchorYear: 2004,
    lastDataYear: 2009,
  },
  futures: [
    {
      experiment: "ssp245",
      firstAnchorYear: 2041,
      lastAnchorYear: 2060,
      lastDataYear: 2065,
    },
    {
      experiment: "ssp585",
      firstAnchorYear: 2041,
      lastAnchorYear: 2060,
      lastDataYear: 2065,
    },
  ],
  minimumCompleteAnalogs: 20,
};
// The policy plans pin from now on: the one above plus a near-term period,
// rotations starting 2026-2035 with data to 2040 (SSP years only: the
// baseline is each model's own 1985-2004, so historical 2010-2014 and SSP
// 2015-2025 are not read and not fetched). Its minimum of 8 complete analogs
// is declared policy for a ten-year window. The policy key differs, so tiles
// get new rows, but units are shared by identity: an extended tile fetches
// only the new years. Plans pinned to the policy above read as they did.
export const currentFutureClimatePolicy: FutureClimatePolicy = {
  ...futureClimatePolicy,
  nearTerm: {
    windows: [
      {
        experiment: "ssp245",
        firstAnchorYear: 2026,
        lastAnchorYear: 2035,
        lastDataYear: 2040,
      },
      {
        experiment: "ssp585",
        firstAnchorYear: 2026,
        lastAnchorYear: 2035,
        lastDataYear: 2040,
      },
    ],
    minimumCompleteAnalogs: 8,
  },
};
// Rotation policy for format 2 requests. Anchors keep consecutive years; the
// search and climate bounds are measured in the Step 10 benchmark.
export const rotationPlanningPolicy: RotationPolicyV2 = {
  version: "rotation-policy-2",
  firstAnchorYear: 1991,
  lastAnchorYear: 2020,
  minimumCompleteAnalogs: 20,
  preparationGapDays: 0,
  representativeStepDays: 7,
  beamWidth: 150,
  perFirstCropWidth: 25,
  maxExpansions: 2000000,
  maxSlots: 12,
  maxClimateDayVisits: 80000000,
  outputCandidates: 50,
  futureClimate: currentFutureClimatePolicy,
  outputs: "rotation-outputs-1",
};
const climateVariables = [
  "precipitation",
  "temperatureMax",
  "temperatureMean",
  "temperatureMin",
] as (
  "precipitation" | "temperatureMax" | "temperatureMean" | "temperatureMin"
)[];
// Rotations given crop-model yields, to keep a plan's work bounded.
const YIELD_CANDIDATES = 50;
const scienceResponseSchema = z.strictObject({
  model: z.string().max(40),
  modelVersion: z.string().max(40),
  serviceVersion: z.string().max(20),
  results: z
    .array(
      z
        .strictObject({
          yieldTPerHa: z.number().nonnegative().max(500),
          potentialTPerHa: z.number().nonnegative().max(500),
          irrigationMm: z.number().nonnegative().max(10000),
        })
        .nullable(),
    )
    .max(4000),
});
const stripSoilIdentity = (
  stored: Awaited<ReturnType<SoilStore["estimate"]>>,
) => {
  if (!stored) return null;
  const estimate: Partial<typeof stored> = { ...stored };
  delete estimate.id;
  delete estimate.sha256;
  return estimate;
};
// Weather is requested for the POWER source cell, never the field position.
const powerSite = (location: { latitude: number; longitude: number }) => {
  const { latitude, longitude } = powerCell(
    location.latitude,
    location.longitude,
  );
  return { latitude, longitude };
};
const digest = (value: unknown) =>
  createHash("sha256").update(stableJson(value)).digest("hex");
const day = (date: Date) => date.toISOString().slice(0, 10);
const plus = (value: string, days: number) =>
  day(new Date(Date.parse(value) + days * 86400000));
class Gone extends Error {}
class WorkflowFailure extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
type FixtureDependencies = {
  synthetic: true;
  catalog: unknown;
  context: SequenceContext;
  policy: HistoricalPolicy;
  generate: (
    input: unknown,
    catalog: unknown,
    context: unknown,
  ) => SequenceResult;
  assess: (
    input: unknown,
    catalog: unknown,
    context: unknown,
    weather: unknown,
    policy: unknown,
  ) => HistoricalAssessment;
};
type ScenarioNeeds = {
  cell: { latitude: number; longitude: number };
  units: ScenarioUnitIdentity[];
};
type RotationFixture = {
  synthetic: true;
  catalog: unknown;
  policy: RotationPolicyV2;
  assess: (
    input: unknown,
    catalog: unknown,
    weather: unknown,
    policy: unknown,
    assessedOn: string,
    scenarios: unknown,
    engineVersion?: "rotation-engine-6" | "rotation-engine-7",
    analysisContext?: unknown,
  ) => RotationAssessment;
  scenarioNeeds: (
    input: unknown,
    catalog: unknown,
    policy: unknown,
    assessedOn: string,
  ) => ScenarioNeeds | null;
  // The extra near-term units, when the fixture's policy has that period.
  nearTermNeeds?: (
    input: unknown,
    catalog: unknown,
    policy: unknown,
    assessedOn: string,
  ) => ScenarioNeeds | null;
  // Labelled synthetic series, or null to act as an unprepared tile.
  scenarios: (needs: ScenarioNeeds) => ScenarioSeries[] | null;
  needs: (
    input: unknown,
    catalog: unknown,
    policy: unknown,
    assessedOn: string,
  ) => { start: string; end: string }[];
};
type Run = {
  request_id: string;
  versions: unknown;
  versions_hash: string;
  status: string;
  stage: string;
  attempts: number;
  lease_id: string | null;
  created_at: Date;
  updated_at: Date;
  result: unknown;
  result_hash: string | null;
  error_code: string | null;
  input: unknown;
  input_hash: string;
  intake_evidence: unknown;
  catalog_snapshot_id: string;
  intake_status: string;
  expires_at: Date;
  owner_id: string;
  label: string | null;
  parent_plan_id: string | null;
};

function freezeRead<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeRead(child);
    Object.freeze(value);
  }
  return value;
}

export class PlanningStore {
  // Only fully validated completed rotation responses. Every hit still checks
  // ownership, expiry, both row revisions and the separate evidence links in PG.
  private readonly completedReads = new Map<
    string,
    {
      revision: string;
      value: RotationPlanningStatus;
      serialized: string;
      bytes: number;
    }
  >();
  private completedReadBytes = 0;

  readonly weather: WeatherService;
  readonly scenarios: ScenarioStore;
  readonly soil: SoilStore;
  readonly rainReferences: RainReferenceStore;
  constructor(
    readonly pool: Pool,
    readonly boss: PgBoss,
    readonly config: Config,
    weather?: WeatherService,
    private readonly fixture?: FixtureDependencies,
    private readonly rotationFixture?: RotationFixture,
    scenarios?: ScenarioStore,
    soil?: SoilStore,
  ) {
    for (const seam of [fixture, rotationFixture])
      if (
        seam &&
        (config.NODE_ENV !== "test" ||
          process.env.NODE_ENV === "production" ||
          seam.synthetic !== true)
      )
        throw new Error("PLANNING_SYNTHETIC_REJECTED");
    this.weather = weather ?? new WeatherService(pool);
    this.scenarios = scenarios ?? new ScenarioStore(pool);
    this.soil = soil ?? new SoilStore(pool);
    this.rainReferences = new RainReferenceStore(
      pool,
      config.EARTHDATA_USERNAME
        ? new GiovanniClient(
            config.EARTHDATA_USERNAME,
            config.EARTHDATA_PASSWORD,
          )
        : null,
    );
  }
  async accept(
    client: PoolClient,
    id: string,
    input: PlanRequest | PlanRequestV2,
    assessedOn: string,
  ) {
    if (input.schema_version === "2") {
      const fixtureCatalog = this.rotationFixture
        ? validateCatalogV2Structure(this.rotationFixture.catalog)
        : null;
      // Select new behavior only for a research-bearing catalog, and persist it
      // in the same immutable versions hash as the existing policy.
      const researchCatalog = !this.rotationFixture
        ? (
            await client.query<{
              research: string | null;
              benefits: string | null;
            }>(
              "SELECT c.body->'profiles'->0->'research'->>'version' AS research, c.body->'profiles'->0->'research'->'benefits'->>'version' AS benefits FROM plan_requests r JOIN catalog_versions c ON c.id=r.catalog_snapshot_id WHERE r.id=$1",
              [id],
            )
          ).rows[0]
        : undefined;
      const policy =
        this.rotationFixture?.policy ??
        (researchCatalog?.research === "income-benefits-1"
          ? {
              ...rotationPlanningPolicy,
              research:
                researchCatalog.benefits === "benefits-2"
                  ? ("benefits-2" as const)
                  : ("income-benefits-1" as const),
            }
          : rotationPlanningPolicy);
      const versions = rotationPlanningVersionsSchema.parse({
        workflowVersion: "planning-workflow-6",
        engineVersion: "rotation-engine-7",
        assessedOn,
        policy,
        ...(policy.outputs
          ? {
              analysisContext: await pinAnalysisContext(
                client,
                this.pool,
                id,
                input,
              ),
            }
          : {}),
        syntheticFixture: fixtureCatalog
          ? {
              catalog: fixtureCatalog,
              catalogSha256: catalogV2ContentHash(fixtureCatalog),
            }
          : null,
      });
      await client.query(
        "INSERT INTO planning_runs(request_id,versions,versions_hash) VALUES($1,$2,$3)",
        [id, versions, digest(versions)],
      );
      return;
    }
    const context = sequenceContextSchema.parse(
      this.fixture?.context ?? {
        assessedOn,
        location: input.location,
        region: { status: "unresolved" },
        productionSystem:
          input.water.status === "unknown"
            ? null
            : input.water.availability === "rainfed"
              ? "rainfed"
              : "irrigated",
        historyCoverageStart: null,
        cultivars: [],
        verifiedHealthObservations: [],
      },
    );
    const fixtureCatalog = this.fixture
      ? validateCatalogStructure(this.fixture.catalog)
      : null;
    const versions = planningVersionsSchema.parse({
      workflowVersion: "planning-workflow-1",
      contextVersion: "unresolved-context-1",
      sequenceEngineVersion: "sequence-engine-2",
      engineVersion: "historical-engine-1",
      rankingVersion: "ranking-heuristics-1",
      selectionVersion: "group-selection-1",
      context,
      policy: historicalPolicySchema.parse(
        this.fixture?.policy ?? planningBaseline,
      ),
      syntheticFixture: fixtureCatalog
        ? {
            catalog: fixtureCatalog,
            catalogSha256: normalizedWeatherHash(fixtureCatalog),
          }
        : null,
    });
    await client.query(
      "INSERT INTO planning_runs(request_id,versions,versions_hash) VALUES($1,$2,$3)",
      [id, versions, digest(versions)],
    );
  }
  async ready() {
    await this.pool.query(
      "SELECT request_id,versions,lease_id,result_hash FROM planning_runs LIMIT 0",
    );
    await this.pool.query(
      "SELECT request_id,snapshot_id FROM planning_weather LIMIT 0",
    );
    if (!(await this.boss.getQueue(PLANNING_QUEUE)))
      throw new Error("PLANNING_QUEUE_UNAVAILABLE");
  }
  async load(id: string, ownerId?: string) {
    const q = await this.pool.query<Run>(
      `SELECT p.*,r.input,r.input_hash,r.evidence intake_evidence,r.catalog_snapshot_id,r.status intake_status,r.expires_at,r.owner_id,r.label,r.parent_plan_id
      FROM planning_runs p JOIN plan_requests r ON r.id=p.request_id JOIN plan_owners o ON o.id=r.owner_id
      WHERE p.request_id=$1 AND ($2::uuid IS NULL OR r.owner_id=$2) AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp())`,
      [id, ownerId ?? null],
    );
    return q.rows[0] ?? null;
  }
  private versions(row: Run) {
    const versions = planningVersionsSchema.parse(row.versions);
    if (
      digest(versions) !== row.versions_hash ||
      stableJson(versions.context.location) !==
        stableJson(requestIdentity(row.input).input.location)
    )
      throw new WorkflowFailure("STORED_REQUEST_INVALID");
    if (
      versions.syntheticFixture &&
      (!this.fixture ||
        digest(versions.syntheticFixture.catalog) !==
          versions.syntheticFixture.catalogSha256 ||
        digest(this.fixture.catalog) !==
          versions.syntheticFixture.catalogSha256)
    )
      throw new WorkflowFailure("STORED_REQUEST_INVALID");
    return versions;
  }
  private rotationVersions(row: Run): RotationPlanningVersions {
    const versions = rotationPlanningVersionsSchema.parse(row.versions);
    const fixture = versions.syntheticFixture;
    if (
      digest(versions) !== row.versions_hash ||
      (fixture &&
        (!this.rotationFixture ||
          catalogV2ContentHash(fixture.catalog) !== fixture.catalogSha256 ||
          catalogV2ContentHash(
            validateCatalogV2Structure(this.rotationFixture.catalog),
          ) !== fixture.catalogSha256))
    )
      throw new WorkflowFailure("STORED_REQUEST_INVALID");
    return versions;
  }
  private isRotation(row: Run) {
    const versions = row.versions as { workflowVersion?: unknown } | null;
    return (
      versions?.workflowVersion === "planning-workflow-2" ||
      versions?.workflowVersion === "planning-workflow-3" ||
      versions?.workflowVersion === "planning-workflow-4" ||
      versions?.workflowVersion === "planning-workflow-5" ||
      versions?.workflowVersion === "planning-workflow-6"
    );
  }
  private async readRotation(row: Run, id: string) {
    const versions = this.rotationVersions(row);
    if (versions.syntheticFixture && !this.rotationFixture)
      throw new Error("SYNTHETIC_REJECTED");
    if (requestIdentityV2(row.input).hash !== row.input_hash)
      throw new Error("INVALID_REQUEST");
    if (
      row.result &&
      digest(rotationAssessmentSchema.parse(row.result)) !== row.result_hash
    )
      throw new Error("INVALID_RESULT");
    const ids = await this.pool.query<{ snapshot_id: string }>(
      "SELECT DISTINCT snapshot_id FROM planning_weather WHERE request_id=$1 ORDER BY snapshot_id",
      [id],
    );
    const units = await this.pool.query<{ unit_id: string }>(
      "SELECT unit_id FROM planning_scenario_units WHERE request_id=$1 ORDER BY unit_id",
      [id],
    );
    return rotationPlanningStatusSchema.parse({
      id,
      label: row.label,
      parentPlanId: row.parent_plan_id,
      status: row.status,
      stage: row.stage,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      expiresAt: row.expires_at.toISOString(),
      attempts: row.attempts,
      input: row.input,
      intakeEvidence: row.intake_evidence,
      versions,
      weatherSnapshotIds: ids.rows.map((r) => r.snapshot_id),
      scenarioUnitIds: units.rows.map((r) => r.unit_id),
      result: row.result,
      error: row.error_code ? { code: row.error_code } : null,
    });
  }
  // Called only after read() has checked owner, expiry, row revisions and
  // evidence links. Identity equality prevents another result using the bytes.
  serializeRead(value: { id: string }) {
    const cached = this.completedReads.get(value.id);
    return cached?.value === value ? cached.serialized : JSON.stringify(value);
  }
  async read(ownerId: string, id: string) {
    // Read the small guard first rather than fetching/parsing a multi-MB jsonb
    // result on every poll. xmin invalidates even a controlled body rewrite that
    // bypasses the immutable trigger; changes to evidence links also miss.
    const head = (
      await this.pool.query<{
        run_revision: string;
        request_revision: string;
        weather: string[];
        scenarios: string[];
      }>(
        `SELECT p.xmin::text run_revision,r.xmin::text request_revision,
       ARRAY(SELECT DISTINCT snapshot_id::text FROM planning_weather WHERE request_id=p.request_id ORDER BY snapshot_id::text) weather,
       ARRAY(SELECT unit_id::text FROM planning_scenario_units WHERE request_id=p.request_id ORDER BY unit_id::text) scenarios
       FROM planning_runs p JOIN plan_requests r ON r.id=p.request_id JOIN plan_owners o ON o.id=r.owner_id
       WHERE p.request_id=$1 AND r.owner_id=$2 AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp())`,
        [id, ownerId],
      )
    ).rows[0];
    if (!head) return null;
    const revision = JSON.stringify(head);
    const cached = this.completedReads.get(id);
    if (cached?.revision === revision) {
      this.completedReads.delete(id);
      this.completedReads.set(id, cached);
      return cached.value;
    }
    if (cached) {
      this.completedReads.delete(id);
      this.completedReadBytes -= cached.bytes;
    }
    const row = await this.load(id, ownerId);
    if (!row) return null;
    if (this.isRotation(row))
      try {
        const value = await this.readRotation(row, id);
        if (value.status === "completed" && value.result) {
          const serialized = JSON.stringify(value);
          const bytes = Buffer.byteLength(serialized);
          const capacity = 32 * 1024 * 1024;
          if (bytes <= capacity) {
            // Another cold read can publish this id while this one awaits PG.
            // Replacing it must release its charge before adding the new value.
            const replaced = this.completedReads.get(id);
            if (replaced) {
              this.completedReads.delete(id);
              this.completedReadBytes -= replaced.bytes;
            }
            while (
              this.completedReads.size >= 8 ||
              this.completedReadBytes + bytes > capacity
            ) {
              const oldest = this.completedReads.keys().next().value!;
              this.completedReadBytes -= this.completedReads.get(oldest)!.bytes;
              this.completedReads.delete(oldest);
            }
            this.completedReads.set(id, {
              revision,
              value: freezeRead(value),
              serialized,
              bytes,
            });
            this.completedReadBytes += bytes;
          }
        }
        return value;
      } catch {
        throw new PlanError("STORED_REQUEST_INVALID");
      }
    try {
      if (requestIdentity(row.input).hash !== row.input_hash)
        throw new Error("INVALID_REQUEST");
      const versions = this.versions(row);
      // Test-only persisted outputs cannot be served by the production API.
      if (versions.syntheticFixture && !this.fixture)
        throw new Error("SYNTHETIC_REJECTED");
      if (
        row.result &&
        digest(planningResultSchema.parse(row.result)) !== row.result_hash
      )
        throw new Error("INVALID_RESULT");
      const ids = await this.pool.query<{ snapshot_id: string }>(
        "SELECT DISTINCT snapshot_id FROM planning_weather WHERE request_id=$1 ORDER BY snapshot_id",
        [id],
      );
      const result = planningStatusSchema.parse({
        id,
        label: row.label,
        parentPlanId: row.parent_plan_id,
        status: row.status,
        stage: row.stage,
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        expiresAt: row.expires_at.toISOString(),
        attempts: row.attempts,
        input: row.input,
        intakeEvidence: row.intake_evidence,
        versions,
        weatherSnapshotIds: ids.rows.map((r) => r.snapshot_id),
        result: row.result,
        error: row.error_code ? { code: row.error_code } : null,
      });
      if (
        result.result &&
        stableJson(result.weatherSnapshotIds) !==
          stableJson(
            result.result.assessment.evidence.map((e) => e.snapshotId).sort(),
          )
      )
        throw new Error("INVALID_WEATHER_REFERENCES");
      return result;
    } catch {
      throw new PlanError("STORED_REQUEST_INVALID");
    }
  }
  async begin(id: string) {
    const lease = randomUUID();
    const q = await this.pool.query<{ attempts: number }>(
      `UPDATE planning_runs p SET status='running',stage='verifying_evidence',attempts=p.attempts+1,lease_id=$2,lease_until=clock_timestamp()+interval '900 seconds',updated_at=clock_timestamp()
      FROM plan_requests r JOIN plan_owners o ON o.id=r.owner_id WHERE p.request_id=$1 AND r.id=p.request_id AND r.expires_at>clock_timestamp()
      AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp()) AND p.attempts<3 AND (p.status='queued' OR (p.status='running' AND p.lease_until<=clock_timestamp())) RETURNING p.attempts`,
      [id, lease],
    );
    return q.rows[0] ? { lease, attempt: q.rows[0].attempts } : null;
  }
  private async stage(id: string, lease: string, stage: string) {
    const q = await this.pool.query(
      `UPDATE planning_runs p SET stage=$3,updated_at=clock_timestamp() FROM plan_requests r JOIN plan_owners o ON o.id=r.owner_id
      WHERE p.request_id=$1 AND p.lease_id=$2 AND p.status='running' AND p.lease_until>clock_timestamp() AND r.id=p.request_id AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp()) RETURNING p.request_id`,
      [id, lease, stage],
    );
    if (!q.rowCount) throw new Gone();
  }
  // Checkpoints each weather request: a retry reuses pinned snapshots and
  // never fetches a request twice for the same plan.
  private async pinWeather(
    id: string,
    lease: string,
    requests: {
      latitude: number;
      longitude: number;
      startDate: string;
      endDate: string;
      variables: typeof climateVariables;
    }[],
    signal: AbortSignal,
    synthetic: boolean,
  ) {
    const weather = [];
    for (const request of requests) {
      if (signal.aborted) throw new WorkflowFailure("PLANNING_LIMIT_EXCEEDED");
      await this.stage(id, lease, "retrieving_weather");
      const key = weatherRequestKey(request);
      const pin = (
        await this.pool.query<{ snapshot_id: string }>(
          "SELECT snapshot_id FROM planning_weather WHERE request_id=$1 AND request_key=$2",
          [id, key],
        )
      ).rows[0];
      let snapshotId = pin?.snapshot_id;
      if (!snapshotId) {
        snapshotId = (await this.weather.query(request, signal)).snapshotId;
        const q = await this.pool.query<{ snapshot_id: string }>(
          `INSERT INTO planning_weather(request_id,request_key,snapshot_id)
          SELECT p.request_id,$3,$4 FROM planning_runs p JOIN plan_requests r ON r.id=p.request_id JOIN plan_owners o ON o.id=r.owner_id
          WHERE p.request_id=$1 AND p.lease_id=$2 AND p.status='running' AND p.lease_until>clock_timestamp() AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp())
          ON CONFLICT(request_id,request_key) DO UPDATE SET snapshot_id=planning_weather.snapshot_id RETURNING snapshot_id`,
          [id, lease, key, snapshotId],
        );
        if (!q.rows[0]) throw new Gone();
        snapshotId = q.rows[0].snapshot_id;
      }
      const evidence = await this.weather.evidence(snapshotId, synthetic);
      if (stableJson(evidence.snapshot.request) !== stableJson(request))
        throw new WorkflowFailure("STORED_REQUEST_INVALID");
      weather.push(evidence);
    }
    return weather;
  }
  // Future-climate series for the field cell, pinned to the run. A tile that
  // is not prepared yet is requested within limits; the plan then completes
  // without future climate and says why.
  private async pinScenarios(
    id: string,
    lease: string,
    needs: ScenarioNeeds | null,
    policy: FutureClimatePolicy,
  ): Promise<ScenarioSeries[] | null> {
    if (!needs) return null;
    await this.stage(id, lease, "retrieving_weather");
    let series: ScenarioSeries[] | null;
    try {
      series = this.rotationFixture
        ? this.rotationFixture.scenarios(needs)
        : await this.scenarios.series(needs);
    } catch (error) {
      if (error instanceof ScenarioError)
        throw new WorkflowFailure("CATALOG_EVIDENCE_INVALID");
      throw error;
    }
    if (!series) {
      const tile = needs.units[0]!.tile;
      if (this.config.CLIMATE_SCENARIOS_ENABLED === "true") {
        const outcome = await this.scenarios.request(
          tile,
          policy,
          this.config.SCENARIO_TILES_PER_DAY,
        );
        if (outcome !== "limited") await enqueueTile(this.boss, tile, policy);
      }
      return null;
    }
    // Pins are idempotent: units are immutable, so a retry pins the same ids.
    await this.pool.query(
      `INSERT INTO planning_scenario_units(request_id,unit_id)
      SELECT p.request_id,u FROM planning_runs p, unnest($3::uuid[]) u
      WHERE p.request_id=$1 AND p.lease_id=$2 AND p.status='running' AND p.lease_until>clock_timestamp()
      ON CONFLICT DO NOTHING`,
      [id, lease, [...new Set(series.map((s) => s.unitId))]],
    );
    return series;
  }
  private async processRotation(
    row: Run,
    id: string,
    lease: string,
    signal: AbortSignal,
  ) {
    const versions = this.rotationVersions(row);
    // Older workflows ran retired engines; their completed results stay
    // readable, but unfinished runs cannot be continued.
    if (
      versions.workflowVersion !== "planning-workflow-5" &&
      versions.workflowVersion !== "planning-workflow-6"
    )
      throw new WorkflowFailure("WORKFLOW_VERSION_UNSUPPORTED");
    const engineVersion = versions.engineVersion;
    const identity = requestIdentityV2(row.input);
    if (identity.hash !== row.input_hash || row.intake_status !== "completed")
      throw new WorkflowFailure("STORED_REQUEST_INVALID");
    let real;
    try {
      const snapshot = await catalogHeadById(
        this.pool,
        row.catalog_snapshot_id,
      );
      real = await verifiedCatalog(this.pool, snapshot!);
      if (
        real.format !== "2" ||
        real.sha256 !== snapshot!.content_sha256 ||
        (row.intake_evidence as { catalogSha256: string }).catalogSha256 !==
          real.sha256
      )
        throw new Error("MISMATCH");
    } catch {
      throw new WorkflowFailure("CATALOG_EVIDENCE_INVALID");
    }
    const catalog = versions.syntheticFixture?.catalog ?? real.catalog;
    const { policy, assessedOn } = versions;
    await this.stage(id, lease, "generating_sequences");
    const ranges = this.rotationFixture
      ? this.rotationFixture.needs(identity.input, catalog, policy, assessedOn)
      : rotationWeatherNeeds(identity.input, catalog, policy, assessedOn);
    if (ranges.length > 128)
      throw new WorkflowFailure("PLANNING_LIMIT_EXCEEDED");
    const weather = await this.pinWeather(
      id,
      lease,
      ranges.map((r) => ({
        ...powerSite(identity.input.location),
        startDate: r.start,
        endDate: r.end,
        variables: climateVariables,
      })),
      signal,
      !!this.rotationFixture,
    );
    const midCentury = await this.pinScenarios(
      id,
      lease,
      this.rotationFixture
        ? this.rotationFixture.scenarioNeeds(
            identity.input,
            catalog,
            policy,
            assessedOn,
          )
        : rotationScenarioNeeds(identity.input, catalog, policy, assessedOn),
      policy.futureClimate,
    );
    // The near-term units are pinned apart, and only when the mid-century
    // ones are there. A tile not yet extended asks to be prepared and the plan
    // still completes, saying the near-term period is missing.
    const nearNeeds =
      midCentury === null
        ? null
        : this.rotationFixture
          ? (this.rotationFixture.nearTermNeeds?.(
              identity.input,
              catalog,
              policy,
              assessedOn,
            ) ?? null)
          : rotationNearTermNeeds(identity.input, catalog, policy, assessedOn);
    const nearTerm = nearNeeds
      ? await this.pinScenarios(id, lease, nearNeeds, policy.futureClimate)
      : null;
    const scenarios =
      midCentury && nearTerm ? [...midCentury, ...nearTerm] : midCentury;
    // Modelled soil is only for fields with no soil test, and never blocks a plan.
    const soil =
      this.rotationFixture ||
      identity.input.soil.status === "known" ||
      !weather.length
        ? null
        : stripSoilIdentity(
            await this.soil.estimate(
              identity.input.location.latitude,
              identity.input.location.longitude,
              signal,
            ),
          );
    const rain =
      this.rotationFixture || !weather.length
        ? null
        : await this.rainReferences.reference(
            identity.input.location.latitude,
            identity.input.location.longitude,
            signal,
          );
    await this.stage(id, lease, "calculating");
    const calculationStarted = performance.now();
    const result = this.rotationFixture
      ? this.rotationFixture.assess(
          identity.input,
          catalog,
          weather,
          policy,
          assessedOn,
          scenarios,
          engineVersion,
          "analysisContext" in versions ? versions.analysisContext : null,
        )
      : assessRotations(
          identity.input,
          catalog,
          weather,
          policy,
          assessedOn,
          scenarios,
          soil,
          rain,
          engineVersion,
          "analysisContext" in versions ? versions.analysisContext : null,
        );
    console.log(
      JSON.stringify({
        event: "rotation_engine_finished",
        requestId: id,
        seconds: (performance.now() - calculationStarted) / 1000,
      }),
    );
    if (signal.aborted) throw new WorkflowFailure("PLANNING_LIMIT_EXCEEDED");
    if (
      !this.rotationFixture &&
      (result.engineVersion === "rotation-engine-6" ||
        result.engineVersion === "rotation-engine-7")
    )
      await this.addYields(
        result as RotationAssessmentV5 | RotationAssessmentV6,
        weather,
        identity.input,
        policy,
        signal,
      );
    if (Buffer.byteLength(stableJson(result)) > 8388608)
      throw new WorkflowFailure("PLANNING_LIMIT_EXCEEDED");
    await this.pool.query(
      `UPDATE planning_runs p SET status='completed',stage='complete',result=$3,result_hash=$4,completed_at=clock_timestamp(),updated_at=clock_timestamp(),lease_id=null,lease_until=null
      FROM plan_requests r JOIN plan_owners o ON o.id=r.owner_id WHERE p.request_id=$1 AND p.lease_id=$2 AND p.status='running' AND p.lease_until>clock_timestamp() AND r.id=p.request_id AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp())`,
      [id, lease, result, digest(result)],
    );
  }
  // Yields for the top rotations. The crop model never decides a plan: if it
  // is absent or fails, the plan completes without yields.
  private async addYields(
    result: RotationAssessmentV5 | RotationAssessmentV6,
    weather: unknown,
    input: PlanRequestV2,
    policy: RotationPolicyV2,
    signal: AbortSignal,
  ) {
    const url = this.config.SCIENCE_URL;
    if (!url || !result.candidates.length) return;
    // The strategies' rotations always get yields, so they stay comparable.
    const pinned = new Set(
      "strategies" in result
        ? result.strategies.items.map((s) => s.candidateId)
        : [],
    );
    const top = [
      ...result.candidates.slice(0, YIELD_CANDIDATES),
      ...result.candidates
        .slice(YIELD_CANDIDATES)
        .filter((c) => pinned.has(c.id)),
    ];
    const simulations = yieldSimulations(
      top,
      policy.firstAnchorYear,
      policy.lastAnchorYear,
      policy.representativeStepDays,
    );
    if (!simulations.length) return;
    const series = yieldRequestWeather(weather, input, result, simulations);
    if (!series) {
      console.error("SCIENCE_WEATHER_INCOMPLETE");
      return;
    }
    const soil = result.soilEstimate;
    const known =
      soil?.clayPercent != null &&
      soil.sandPercent != null &&
      soil.siltPercent != null;
    const soilClass = known
      ? textureClass(soil.clayPercent!, soil.sandPercent!, soil.siltPercent!)
      : "Loam";
    const irrigated =
      input.water.status === "reported" &&
      input.water.availability !== "rainfed";
    try {
      const response = await fetch(new URL("/aquacrop", url), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          soil: soilClass,
          irrigated,
          weather: series,
          simulations: simulations.map(({ crop, sown, end }) => ({
            crop,
            sown,
            end,
          })),
        }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(240000)]),
      });
      if (!response.ok) {
        console.error("SCIENCE_SERVICE_REJECTED");
        return;
      }
      const body = scienceResponseSchema.parse(await response.json());
      if (body.results.length !== simulations.length) return;
      result.yields = attachYields(
        top,
        simulations,
        body.results,
        policy.representativeStepDays,
        {
          model: body.model,
          modelVersion: body.modelVersion,
          serviceVersion: body.serviceVersion,
          soilClass,
          soilAssumed: !known,
          irrigated,
        },
      );
      const ranked = rankWithYields(top, result.yields);
      result.yields = ranked.yields;
      result.candidates = result.catalogResearch
        ? rankResearchCandidates(ranked.candidates, input)
        : ranked.candidates;
      if (result.catalogResearch) {
        result.catalogResearch.ranking.appliedCandidates =
          result.candidates.filter(
            (c) => c.resources?.income.ranking.applied,
          ).length;
        result.catalogResearch.ranking.scope = "shown_after_yields";
      }
      if ("strategies" in result) {
        syncStrategyRanks(result.strategies, result.candidates);
        if (result.catalogResearch)
          syncResearchStrategies(result.strategies, result.candidates);
      }
      for (const choice of result.choices) {
        if (choice.outcome !== "ranked") continue;
        const best = result.candidates.find((c) =>
          c.slots.some((s) => s.cropId === choice.cropId),
        );
        choice.bestCandidateId = best?.id ?? null;
        choice.bestRank = best?.rank ?? null;
      }
      addSoilCarbon(result, weather, input);
    } catch (error) {
      console.error("SCIENCE_SERVICE_UNAVAILABLE");
      if (signal.aborted) throw error;
    }
  }
  async process(id: string, lease: string, signal: AbortSignal) {
    const row = await this.load(id);
    if (!row || row.lease_id !== lease || row.status !== "running") return;
    try {
      if (this.isRotation(row)) {
        await this.processRotation(row, id, lease, signal);
        return;
      }
      const versions = this.versions(row);
      const input = requestIdentity(row.input);
      if (input.hash !== row.input_hash || row.intake_status !== "completed")
        throw new WorkflowFailure("STORED_REQUEST_INVALID");
      let real: Extract<VerifiedCatalog, { format: "1" }>;
      try {
        const snapshot = await catalogHeadById(
          this.pool,
          row.catalog_snapshot_id,
        );
        const verified = await verifiedCatalog(this.pool, snapshot!);
        if (
          verified.format !== "1" ||
          verified.sha256 !== snapshot!.content_sha256 ||
          (row.intake_evidence as { catalogSha256: string }).catalogSha256 !==
            verified.sha256
        )
          throw new Error("MISMATCH");
        real = verified;
      } catch {
        throw new WorkflowFailure("CATALOG_EVIDENCE_INVALID");
      }
      const catalog = versions.syntheticFixture?.catalog ?? real.catalog;
      await this.stage(id, lease, "generating_sequences");
      const sequence = this.fixture
        ? this.fixture.generate(input.input, catalog, versions.context)
        : generateSequences(input.input, catalog, versions.context);
      const requests = this.weatherRequests(sequence, versions);
      const weather = await this.pinWeather(
        id,
        lease,
        requests,
        signal,
        !!this.fixture,
      );
      await this.stage(id, lease, "calculating");
      const assessment = this.fixture
        ? this.fixture.assess(
            input.input,
            catalog,
            versions.context,
            weather,
            versions.policy,
          )
        : assessHistoricalSequences(
            input.input,
            catalog,
            versions.context,
            weather,
            versions.policy,
          );
      if (signal.aborted) throw new WorkflowFailure("PLANNING_LIMIT_EXCEEDED");
      const result = selectPlanningComparisons(assessment);
      if (Buffer.byteLength(stableJson(result)) > 8388608)
        throw new WorkflowFailure("PLANNING_LIMIT_EXCEEDED");
      await this.pool.query(
        `UPDATE planning_runs p SET status='completed',stage='complete',result=$3,result_hash=$4,completed_at=clock_timestamp(),updated_at=clock_timestamp(),lease_id=null,lease_until=null
        FROM plan_requests r JOIN plan_owners o ON o.id=r.owner_id WHERE p.request_id=$1 AND p.lease_id=$2 AND p.status='running' AND p.lease_until>clock_timestamp() AND r.id=p.request_id AND r.expires_at>clock_timestamp() AND (o.user_id IS NOT NULL OR o.expires_at>clock_timestamp())`,
        [id, lease, result, digest(result)],
      );
    } catch (error) {
      if (error instanceof Gone) return;
      const code =
        error instanceof WorkflowFailure
          ? error.code
          : error instanceof WeatherError
            ? "WEATHER_UNAVAILABLE"
            : error &&
                typeof error === "object" &&
                "code" in error &&
                String(error.code).includes("LIMIT")
              ? "PLANNING_LIMIT_EXCEEDED"
              : "CALCULATION_FAILED";
      if (
        code === "WEATHER_UNAVAILABLE" &&
        row.attempts < 3 &&
        !signal.aborted
      ) {
        await this.pool.query(
          "UPDATE planning_runs SET status='queued',stage='awaiting_processing',lease_id=null,lease_until=null,updated_at=clock_timestamp() WHERE request_id=$1 AND lease_id=$2 AND status='running'",
          [id, lease],
        );
        throw new Error("WEATHER_UNAVAILABLE");
      }
      await this.fail(id, code, lease);
    }
  }
  weatherRequests(sequence: SequenceResult, versions: PlanningVersions) {
    const intervals: { start: string; end: string }[] = [];
    for (const pair of sequence.pairs)
      for (const schedule of pair.schedules) {
        if (!["eligible", "conditional"].includes(schedule.status)) continue;
        for (
          let year = versions.policy.firstAnchorYear;
          year <= versions.policy.lastAnchorYear;
          year++
        ) {
          const offset = year - Number(schedule.first.sownOn.slice(0, 4));
          const shift = (date: string) => {
            const shifted =
              String(Number(date.slice(0, 4)) + offset) + date.slice(4);
            if (day(new Date(shifted)) !== shifted)
              throw new RangeError("LEAP_BOUNDARY");
            return shifted;
          };
          try {
            for (const cycle of [schedule.first, schedule.second])
              intervals.push({
                start: shift(cycle.sownOn),
                end: shift(cycle.harvestLatest),
              });
          } catch (error) {
            if (!(error instanceof RangeError)) throw error;
          }
          if (intervals.length > 200000)
            throw new WorkflowFailure("PLANNING_LIMIT_EXCEEDED");
        }
      }
    const merged: { start: string; end: string }[] = [];
    for (const item of intervals.sort((a, b) =>
      a.start < b.start ? -1 : a.start > b.start ? 1 : a.end < b.end ? -1 : 1,
    )) {
      const previous = merged.at(-1);
      if (previous && item.start <= plus(previous.end, 1)) {
        if (item.end > previous.end) previous.end = item.end;
      } else merged.push({ ...item });
    }
    const requests = [];
    let days = 0;
    for (const range of merged)
      for (let start = range.start; start <= range.end;) {
        const end = plus(start, 365) < range.end ? plus(start, 365) : range.end;
        days += (Date.parse(end) - Date.parse(start)) / 86400000 + 1;
        if (
          days > 20000 ||
          requests.length >= 128 ||
          start < "1981-01-01" ||
          end > plus(versions.context.assessedOn, -120)
        )
          throw new WorkflowFailure("PLANNING_LIMIT_EXCEEDED");
        requests.push({
          ...powerSite(versions.context.location),
          startDate: start,
          endDate: end,
          variables: climateVariables,
        });
        start = plus(end, 1);
      }
    return requests;
  }
  async fail(id: string, code: string, lease?: string) {
    await this.pool.query(
      "UPDATE planning_runs SET status='failed',stage='failed',error_code=$2,completed_at=clock_timestamp(),updated_at=clock_timestamp(),lease_id=null,lease_until=null WHERE request_id=$1 AND status IN ('queued','running') AND ($3::uuid IS NULL OR lease_id=$3)",
      [id, code, lease ?? null],
    );
  }
  async retry(id: string, lease: string) {
    await this.pool.query(
      "UPDATE planning_runs SET status='queued',stage='awaiting_processing',lease_id=null,lease_until=null,updated_at=clock_timestamp() WHERE request_id=$1 AND lease_id=$2 AND status='running'",
      [id, lease],
    );
  }
  async maintain() {
    const rows = (
      await this.pool.query<{ request_id: string; queue_job_id: string }>(
        "SELECT p.request_id,r.queue_job_id FROM planning_runs p JOIN plan_requests r ON r.id=p.request_id WHERE p.status IN ('queued','running') ORDER BY p.updated_at LIMIT 100",
      )
    ).rows;
    for (const row of rows)
      await withTransaction(this.pool, async (client) => {
        const p = (
          await client.query<{ status: string; attempts: number }>(
            "SELECT status,attempts FROM planning_runs WHERE request_id=$1 FOR UPDATE",
            [row.request_id],
          )
        ).rows[0];
        if (!p || !["queued", "running"].includes(p.status)) return;
        const [job] = await this.boss.findJobs(PLANNING_QUEUE, {
          id: row.queue_job_id,
          db: queueTransaction(client),
        });
        if (!job || ["failed", "cancelled", "completed"].includes(job.state))
          await client.query(
            "UPDATE planning_runs SET status='failed',stage='failed',error_code=$2,completed_at=clock_timestamp(),lease_id=null,lease_until=null,updated_at=clock_timestamp() WHERE request_id=$1",
            [
              row.request_id,
              job?.state === "failed"
                ? "RETRIES_EXHAUSTED"
                : "QUEUE_TERMINAL_WITHOUT_RESULT",
            ],
          );
        else if (
          ["created", "retry"].includes(job.state) &&
          p.status === "running"
        )
          await client.query(
            "UPDATE planning_runs SET status='queued',stage='awaiting_processing',lease_id=null,lease_until=null,updated_at=clock_timestamp() WHERE request_id=$1",
            [row.request_id],
          );
      });
  }
}
