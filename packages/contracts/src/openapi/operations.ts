import { researchJsonSchema } from "../catalog/research.contract.js";
import { z } from "zod";
import { capabilitiesSchema } from "../health/capabilities.contract.js";
import {
  fieldBoundaryPointSchema,
  fieldBoundaryTileSchema,
  fieldBoundaryTileResponseSchema,
  fieldBoundaryAtResponseSchema,
} from "../fields/field-suggestions.contract.js";
import {
  planCreateRequestSchema,
  rotationPlanCreateRequestSchema,
  planLabelRequestSchema,
  planLabelResponseSchema,
} from "../plans/plan-metadata.contract.js";
import { planCropIdSchema, planLabelSchema } from "../plans/plan.contract.js";
import { healthSchema } from "../health/health.contract.js";
import {
  weatherCapabilitiesSchema,
  weatherRequestSchema,
  weatherResponseSchema,
} from "../weather/weather.contract.js";
import {
  catalogBundleSchema,
  catalogBundleV2Schema,
  catalogOptionsSchema,
  cropDetailSchema,
  cropDetailResearchSchema,
  cropDetailParamsSchema,
  catalogRuleSchema,
  catalogRuleV2Schema,
  cropDetailRuleSchema,
  cropDetailFactSchema,
  cropDetailNameSchema,
  cropDetailIssueSchema,
} from "../catalog/index.js";
import {
  ownerSessionSchema,
  planRequestSchema,
  planStatusSchema,
} from "../plans/plan.contract.js";
import {
  planRequestV2Schema,
  whatIfSchema,
} from "../plans/plan-v2.contract.js";
import {
  planningResultSchema,
  planningStatusSchema,
} from "../plans/planning.contract.js";
import {
  rotationAssessmentSchema,
  rotationContextSchema,
  rotationReasonSchema,
  rotationStrategySchema,
  rotationCandidateSchema,
  rotationCandidateV5Schema,
} from "../engine/rotation.contract.js";
import { constraintReasonSchema } from "../engine/sequence.contract.js";
import {
  historicalAssessmentSchema,
  historicalReasonSchema,
} from "../engine/climate.contract.js";
import { citationSchema } from "../catalog/source.contract.js";
import { rotationPlanningStatusSchema } from "../plans/planning-v2.contract.js";
import {
  cropHealthStatusSchema,
  cropPhotoRequestSchema,
  cropPhotoResultSchema,
  planExplanationRequestSchema,
} from "../plans/crop-health.contract.js";
import {
  cropHistoryEntrySchema,
  fieldProfileSchema,
} from "../fields/field.contract.js";
import { fieldBoundarySchema } from "../fields/boundary.contract.js";
import {
  boundaryUpdateRequestSchema,
  extractionRequestSchema,
  fieldExtractionParamsSchema,
  fieldHistoryParamsSchema,
  fieldIdParamsSchema,
  fieldObservationParamsSchema,
  fieldUpdateRequestSchema,
  fieldWithHistoryRequestSchema,
  fieldCreateRequestSchema,
  historyUpdateRequestSchema,
  observationRequestSchema,
  planClaimRequestSchema,
  planSessionRequestSchema,
} from "../fields/field-requests.contract.js";
import { observationStatusSchema } from "../observations/observation.contract.js";
import {
  vegetationAnalysisResponseSchema,
  rainSeriesResponseSchema,
} from "../observations/vegetation-analysis.contract.js";
import { vegetationHistoryResponseSchema } from "../observations/vegetation-history.contract.js";
import { canopyBiomassResponseSchema } from "../observations/gedi.contract.js";
import {
  extractionStatusSchema,
  waterStorageResultSchema,
} from "../observations/terrain-water.contract.js";
import {
  glossaryQuerySchema,
  glossaryResponseSchema,
} from "../glossary/glossary.contract.js";

// Shapes that routes return without a shared contract of their own. They are
// documented here and checked against real responses by the integration test.
export const errorBodySchema = z.strictObject({
  code: z.string().min(1).max(60),
});
const isoDateTime = z.iso.datetime();
const recordFields = {
  id: z.uuid(),
  version: z.number().int().positive(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
};
export const fieldRecordSchema = z.strictObject({
  ...recordFields,
  profile: fieldProfileSchema,
});
export const historyRecordSchema = z.strictObject({
  ...recordFields,
  entry: cropHistoryEntrySchema,
});
const page = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    items: z.array(item),
    nextCursor: z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,256}$/)
      .nullable(),
  });
export const fieldPageSchema = page(fieldRecordSchema);
export const historyPageSchema = page(historyRecordSchema);
export const boundaryRecordSchema = z.strictObject({
  boundary: fieldBoundarySchema,
  version: z.number().int().positive(),
  updatedAt: isoDateTime,
  hectares: z.number().nonnegative(),
  // Points that can sample whole 30 m pixels; zero means too narrow.
  samplePoints: z.number().int().nonnegative(),
});
export const boundaryEnvelopeSchema = z.strictObject({
  boundary: boundaryRecordSchema.nullable(),
});
export const observationListSchema = z.strictObject({
  items: z.array(observationStatusSchema),
});
export const extractionListSchema = z.strictObject({
  items: z.array(extractionStatusSchema),
});
export const waterStorageResponseSchema = z.discriminatedUnion("available", [
  z.strictObject({
    available: z.literal(true),
    result: waterStorageResultSchema,
  }),
  z.strictObject({ available: z.literal(false), reason: z.string().max(80) }),
]);
export const liveSchema = z.strictObject({
  service: z.literal("rotavise-api"),
  status: z.literal("live"),
});
export const authCapabilitiesSchema = z.strictObject({
  email: z.boolean(),
  google: z.boolean(),
});
export const accountSchema = z.strictObject({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.literal(true),
  createdAt: isoDateTime,
  sessionExpiresAt: isoDateTime,
});
export const planSubmittedSchema = z.strictObject({
  id: z.uuid(),
  expiresAt: isoDateTime,
});
export const planListSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: z.uuid(),
      status: z.string(),
      createdAt: isoDateTime,
      expiresAt: isoDateTime,
      label: planLabelSchema.nullable(),
      parentPlanId: z.uuid().nullable(),
      fieldId: z.uuid().nullable(),
      fieldName: z.string().max(80).nullable(),
      cropIds: z.array(planCropIdSchema).min(1).max(6).nullable(),
      horizonYears: z.number().int().min(3).max(5).nullable(),
      topStrategyCropIds: z.array(planCropIdSchema).min(1).max(20).nullable(),
      whatIf: z.boolean(),
    }),
  ),
  nextCursor: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,256}$/)
    .nullable(),
});
export const planClaimedSchema = z.strictObject({
  id: z.uuid(),
  claimed: z.literal(true),
});
export const planExplanationSchema = z.strictObject({
  language: z.string(),
  text: z.string(),
  model: z.string(),
  reviewed: z.literal(false),
});

// Every schema that can appear in the document, by the name it gets under
// components/schemas. The document builder refuses a schema not listed here.
// Keep component keys literal while giving the registry a bounded public type.
// Individual contracts retain their full inferred TypeScript types.
const components = <K extends string>(schemas: Record<K, z.ZodType>) => schemas;
export const openApiComponents = components({
  ResearchMetadata: researchJsonSchema,
  ErrorBody: errorBodySchema,
  Health: healthSchema,
  Capabilities: capabilitiesSchema,
  FieldBoundaryPoint: fieldBoundaryPointSchema,
  FieldBoundaryTiles: fieldBoundaryTileResponseSchema,
  FieldBoundaryAt: fieldBoundaryAtResponseSchema,
  PlanCreateRequest: planCreateRequestSchema,
  RotationPlanCreateRequest: rotationPlanCreateRequestSchema,
  PlanLabelRequest: planLabelRequestSchema,
  PlanLabelResponse: planLabelResponseSchema,
  FieldCreateRequest: fieldCreateRequestSchema,
  Live: liveSchema,
  AuthCapabilities: authCapabilitiesSchema,
  Account: accountSchema,
  CatalogOptions: catalogOptionsSchema,
  CropDetail: cropDetailSchema,
  CropDetailResearch: cropDetailResearchSchema,
  CatalogRule: catalogRuleSchema,
  CatalogRuleV2: catalogRuleV2Schema,
  CropDetailRule: cropDetailRuleSchema,
  CropDetailFact: cropDetailFactSchema,
  CropDetailName: cropDetailNameSchema,
  CropDetailIssue: cropDetailIssueSchema,
  CatalogBundle: catalogBundleSchema,
  CatalogBundleV2: catalogBundleV2Schema,
  WeatherCapabilities: weatherCapabilitiesSchema,
  WeatherRequest: weatherRequestSchema,
  WeatherResponse: weatherResponseSchema,
  OwnerSession: ownerSessionSchema,
  PlanSessionRequest: planSessionRequestSchema,
  PlanRequest: planRequestSchema,
  PlanRequestV2: planRequestV2Schema,
  PlanSubmitted: planSubmittedSchema,
  Citation: citationSchema,
  ConstraintReason: constraintReasonSchema,
  RotationReason: rotationReasonSchema,
  HistoricalReason: historicalReasonSchema,
  RotationContext: rotationContextSchema,
  RotationCandidate: rotationCandidateSchema,
  RotationCandidateV5: rotationCandidateV5Schema,
  RotationStrategy: rotationStrategySchema,
  RotationAssessment: rotationAssessmentSchema,
  HistoricalAssessment: historicalAssessmentSchema,
  PlanningResult: planningResultSchema,
  PlanIntakeStatus: planStatusSchema,
  PlanningStatus: planningStatusSchema,
  RotationPlanningStatus: rotationPlanningStatusSchema,
  PlanList: planListSchema,
  PlanClaimRequest: planClaimRequestSchema,
  PlanWhatIfRequest: z.strictObject({ what_if: whatIfSchema }),
  PlanClaimed: planClaimedSchema,
  PlanExplanationRequest: planExplanationRequestSchema,
  PlanExplanation: planExplanationSchema,
  CropHealthStatus: cropHealthStatusSchema,
  CropPhotoRequest: cropPhotoRequestSchema,
  CropPhotoResult: cropPhotoResultSchema,
  FieldProfile: fieldProfileSchema,
  FieldRecord: fieldRecordSchema,
  FieldPage: fieldPageSchema,
  FieldWithHistoryRequest: fieldWithHistoryRequestSchema,
  FieldUpdateRequest: fieldUpdateRequestSchema,
  CropHistoryEntry: cropHistoryEntrySchema,
  HistoryRecord: historyRecordSchema,
  HistoryPage: historyPageSchema,
  HistoryUpdateRequest: historyUpdateRequestSchema,
  FieldBoundary: fieldBoundarySchema,
  BoundaryRecord: boundaryRecordSchema,
  BoundaryEnvelope: boundaryEnvelopeSchema,
  BoundaryUpdateRequest: boundaryUpdateRequestSchema,
  ObservationRequest: observationRequestSchema,
  ObservationStatus: observationStatusSchema,
  ObservationList: observationListSchema,
  ExtractionRequest: extractionRequestSchema,
  ExtractionStatus: extractionStatusSchema,
  ExtractionList: extractionListSchema,
  VegetationAnalysisResponse: vegetationAnalysisResponseSchema,
  RainSeriesResponse: rainSeriesResponseSchema,
  VegetationHistoryResponse: vegetationHistoryResponseSchema,
  CanopyBiomassResponse: canopyBiomassResponseSchema,
  WaterStorageResponse: waterStorageResponseSchema,
  GlossaryResponse: glossaryResponseSchema,
});
export type OpenApiComponent = keyof typeof openApiComponents;

export type OpenApiMethod = "get" | "post" | "put" | "delete";
type Ref = OpenApiComponent | readonly OpenApiComponent[];
export type OpenApiOperation = {
  operationId: string;
  method: OpenApiMethod;
  // OpenAPI form: `{id}` for a path parameter.
  path: string;
  tag: string;
  summary: string;
  description?: string;
  // none: open; owner: an account session or a guest bearer token; account:
  // an account session only; guest: a guest bearer token only; both: an
  // account session and a guest bearer token together.
  access: "none" | "owner" | "account" | "guest" | "both";
  // Settings that switch the route on. Absent means always registered.
  requires?: readonly string[];
  params?: z.ZodObject;
  query?: "page" | z.ZodObject;
  idempotencyKey?: boolean;
  conditionalEtag?: boolean;
  body?: Ref;
  responses: Record<string, { description: string; schema?: Ref }>;
};

const error = (description: string) => ({
  description,
  schema: "ErrorBody" as const,
});
const ownerErrorsNoNotFound = {
  "400": error("The request is not valid."),
  "401": error("Not signed in, or the session or token is no longer valid."),
  "429": error("A usage limit was reached; see the Retry-After header."),
  "503": error("A dependency is unavailable."),
};
const ownerErrors = {
  ...ownerErrorsNoNotFound,
  "404": error("Not found, or it belongs to someone else."),
};
const body = (description: string, schema?: Ref) =>
  schema === undefined ? { description } : { description, schema };
const field = (summary: string) => ({ tag: "fields", summary });

export const openApiOperations: readonly OpenApiOperation[] = [
  {
    operationId: "getFieldBoundaryTile",
    method: "get",
    path: "/api/v1/field-boundaries/tiles/{z}/{x}/{y}",
    tag: "fields",
    summary: "Suggested field outlines in a zoom-14 tile",
    access: "owner",
    requires: ["FIELD_BOUNDARIES_ENABLED", "AUTH_ENABLED or PLANS_ENABLED"],
    params: fieldBoundaryTileSchema,
    description:
      "Precomputed FTW 2025 suggestions, shared reference data. Whole polygons whose bounding boxes intersect a zoom-14 Web Mercator tile. No inference or upstream requests. 60 reads per owner per minute, plus 120 requests per IP per minute. Empty areas return an empty collection. Farmer must check outlines. Confidence is a rescaled 500 m cell score, not geometric accuracy. See attribution and limitations in every success response.",
    responses: {
      ...ownerErrorsNoNotFound,
      "200": body(
        "Suggested outlines; accuracy unmeasured.",
        "FieldBoundaryTiles",
      ),
    },
  },
  {
    operationId: "getFieldBoundaryAt",
    method: "post",
    path: "/api/v1/field-boundaries/at",
    tag: "fields",
    summary: "Find a suggested outline containing a point",
    access: "owner",
    requires: ["FIELD_BOUNDARIES_ENABLED", "AUTH_ENABLED or PLANS_ENABLED"],
    body: "FieldBoundaryPoint",
    description:
      "Strict interior lookup in the active imported dataset. Where suggestions overlap, returns the smallest area, then source id. No persisted taps and no automatic fallback. 20 requests per owner per hour, plus 120 requests per IP per minute. Cookie requests require a trusted Origin. No suggestion is an honest gap, not a claim that the land is not agricultural.",
    responses: {
      ...ownerErrorsNoNotFound,
      "200": body("Suggested outline; check it.", "FieldBoundaryAt"),
      "404": error("NO_FIELD_FOUND: no imported polygon contains this point."),
    },
  },
  {
    operationId: "getRootLive",
    method: "get",
    path: "/health/live",
    tag: "health",
    summary: "Liveness alias",
    access: "none",
    responses: { "200": body("The process is live.", "Live") },
  },
  {
    operationId: "getRootReady",
    method: "get",
    path: "/health/ready",
    tag: "health",
    summary: "Readiness and data completeness alias",
    access: "none",
    responses: {
      "200": body("Ready.", "Health"),
      "503": body("A dependency or required dataset is incomplete.", "Health"),
    },
  },
  {
    operationId: "getCapabilities",
    method: "get",
    path: "/api/v1/capabilities",
    tag: "health",
    summary: "Configured features and versions",
    access: "none",
    description:
      "Configuration discovery and database completeness (cached at most 60 seconds), not upstream provider availability. Catalog is the rotation catalog when planning is enabled, otherwise the intake catalog. Field detection defaults off until its service is installed.",
    responses: {
      "200": body("Configured capabilities.", "Capabilities"),
      "400": error("The request is not valid."),
    },
  },
  {
    operationId: "getLive",
    method: "get",
    path: "/api/v1/health/live",
    tag: "health",
    summary: "Liveness",
    description: "Says the API process is running. It checks nothing else.",
    access: "none",
    responses: { "200": body("The process is live.", "Live") },
  },
  {
    operationId: "getReady",
    method: "get",
    path: "/api/v1/health/ready",
    tag: "health",
    summary: "Readiness",
    description: "Checks the queue and the databases the API depends on.",
    access: "none",
    responses: {
      "200": body("Ready.", "Health"),
      "503": body("A dependency is unavailable.", "Health"),
    },
  },
  {
    operationId: "getGlossary",
    method: "get",
    path: "/api/v1/glossary",
    tag: "glossary",
    summary: "Plain-language meaning of every code",
    description:
      "Every reason code, status, evidence class, score, error code and satellite term the API returns, in English (en), French (fr), Standard Arabic (ar) or Moroccan Arabic / Darija (ary). Arabic and Darija read right to left. Text is model-written and not yet reviewed by a person; the provenance field says so.",
    access: "none",
    query: glossaryQuerySchema,
    responses: {
      "200": body("The glossary in one language.", "GlossaryResponse"),
      "304": body("Unchanged since the ETag you sent."),
      "400": error("Unknown language or group."),
    },
  },
  {
    operationId: "getOpenApi",
    method: "get",
    path: "/api/v1/openapi.json",
    tag: "glossary",
    summary: "This document",
    access: "none",
    responses: {
      "200": body("The OpenAPI 3.1 document of this API."),
      "304": body("Unchanged since the ETag you sent."),
    },
  },
  {
    operationId: "getAuthCapabilities",
    method: "get",
    path: "/api/v1/auth/capabilities",
    tag: "account",
    summary: "Which sign-in methods are switched on",
    access: "none",
    requires: ["AUTH_ENABLED"],
    responses: { "200": body("The methods.", "AuthCapabilities") },
  },
  {
    operationId: "getAccount",
    method: "get",
    path: "/api/v1/account",
    tag: "account",
    summary: "The signed-in account",
    access: "account",
    requires: ["AUTH_ENABLED"],
    responses: {
      "200": body("The account.", "Account"),
      "400": error("The request is not valid."),
      "401": error("Not signed in."),
      "429": error("A usage limit was reached."),
      "503": error("Sign-in is unavailable."),
    },
  },
  {
    operationId: "getCatalogOptions",
    method: "get",
    path: "/api/v1/catalog/options",
    tag: "catalog",
    summary: "Crops and sources of the current catalog",
    description:
      "Uses the rotation catalog when full planning is enabled, otherwise the intake catalog. At most 2 MiB, without truncation. Each request verifies the immutable store head even when its public serialization is cached.",
    access: "none",
    requires: ["PLANS_ENABLED"],
    responses: {
      "200": body("The crops and sources.", "CatalogOptions"),
      "400": error("The request is not valid."),
      "429": error("A usage limit was reached."),
      "503": error("The catalog is unavailable."),
    },
  },
  {
    operationId: "getCatalogOptionsVersion",
    method: "get",
    path: "/api/v1/catalog/options/{catalogId}/{version}",
    tag: "catalog",
    summary: "Crops and sources of one catalog version",
    access: "none",
    requires: ["PLANS_ENABLED"],
    params: z.strictObject({
      catalogId: z.string().regex(/^[a-z][a-z0-9-]{2,79}$/),
      version: z
        .string()
        .regex(/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/),
    }),
    responses: {
      "200": body("The crops and sources.", "CatalogOptions"),
      "400": error("The identifier or version is not valid."),
      "404": error("No such catalog version."),
      "429": error("A usage limit was reached."),
      "503": error("The catalog is unavailable."),
    },
  },
  {
    operationId: "getCropDetail",
    method: "get",
    path: "/api/v1/catalog/crops/{catalogId}/{version}/{cropId}",
    tag: "catalog",
    summary:
      "Crop detail and listed health issues from an immutable catalog version",
    description:
      "Includes BG-5 issues with issue_id, original catalog kinds, language-labelled names and evidence. Missing metadata is null or empty with explicit gaps. Primary names have no assumed language. Rules retain their exact scope, conditions, units and verification. Sourced reference facts without recorded verification return null verification. Releases with research also include all 12 benefit effects, original findings/records, nullable recorded confidence, cited income facts, no_data for absent kinds, and general role explanations in four languages (not crop-specific role assignments). Older release response bytes are unchanged. Only referenced catalog sources are included; role citations have their own URLs. Responses are limited to 2 MiB; an oversized response returns 503 without truncation. Public cache: max-age=3600, immutable; ETag hashes the response bytes. If-None-Match supports weak tags, lists and *; 304 has no body. Errors use no-store.",
    access: "none",
    requires: ["PLANS_ENABLED"],
    params: cropDetailParamsSchema,
    conditionalEtag: true,
    responses: {
      "200": body(
        "Crop identity, calendar, rotation rules, issues, cultivars, legacy facts, optional research and explicit gaps.",
        "CropDetail",
      ),
      "304": body("Unchanged since the ETag you sent."),
      "400": error("The identifiers or query are not valid."),
      "404": error("No such crop or catalog version."),
      "429": error("A usage limit was reached; Retry-After: 60."),
      "503": error(
        "The catalog cannot be verified or the response exceeds its limit.",
      ),
    },
  },
  {
    operationId: "getWeatherCapabilities",
    method: "get",
    path: "/api/v1/weather/capabilities",
    tag: "weather",
    summary: "What the weather service can return",
    access: "none",
    requires: ["WEATHER_ENABLED"],
    responses: {
      "200": body("Variables, limits and the source.", "WeatherCapabilities"),
      "400": error("The request is not valid."),
    },
  },
  {
    operationId: "queryWeather",
    method: "post",
    path: "/api/v1/weather/query",
    tag: "weather",
    summary: "Daily weather for a point and a period",
    description:
      "Needs a trusted Origin header and a JSON body. Limited to 12 requests an hour per address.",
    access: "none",
    requires: ["WEATHER_ENABLED"],
    body: "WeatherRequest",
    responses: {
      "200": body("The weather snapshots.", "WeatherResponse"),
      "400": error("The request is not valid."),
      "403": error("The origin or content type is not allowed."),
      "429": error("A usage limit was reached."),
      "502": error("The weather source sent invalid data."),
      "503": error("The weather service is unavailable."),
      "504": error("The weather source did not answer in time."),
    },
  },
  {
    operationId: "createPlanSession",
    method: "post",
    path: "/api/v1/plan-sessions",
    tag: "plans",
    summary: "Start a guest session",
    description:
      "Returns a bearer token for a guest who has no account. Use it as `Authorization: Bearer <token>`.",
    access: "none",
    requires: ["PLANS_ENABLED"],
    body: "PlanSessionRequest",
    responses: {
      "201": body("The token and its expiry.", "OwnerSession"),
      "400": error("The request is not valid."),
      "429": error("A usage limit was reached."),
      "503": error("A dependency is unavailable."),
    },
  },
  {
    operationId: "revokePlanSession",
    method: "delete",
    path: "/api/v1/plan-sessions/current",
    tag: "plans",
    summary: "End the guest session",
    access: "guest",
    requires: ["PLANS_ENABLED"],
    responses: {
      "204": body("The session was ended."),
      "401": error("The token is not valid."),
      "429": error("A usage limit was reached."),
      "503": error("A dependency is unavailable."),
    },
  },
  {
    operationId: "submitPlan",
    method: "post",
    path: "/api/v1/plans",
    tag: "plans",
    summary: "Ask for a rotation plan",
    description:
      'Format 2 requests (`schema_version` "2") give multi-year rotations; format 1 is the older two-cycle form. Resend the same Idempotency-Key to get the same plan back.',
    access: "owner",
    requires: ["PLANS_ENABLED"],
    idempotencyKey: true,
    body: ["RotationPlanCreateRequest", "PlanCreateRequest"],
    responses: {
      "202": body("Accepted; poll the Location address.", "PlanSubmitted"),
      ...ownerErrorsNoNotFound,
      "409": error("The key was used with a different request."),
    },
  },
  {
    operationId: "listPlans",
    method: "get",
    path: "/api/v1/plans",
    tag: "plans",
    summary: "Your plans, newest first",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    query: "page",
    responses: {
      "200": body("One page of plans.", "PlanList"),
      ...ownerErrors,
    },
  },
  {
    operationId: "getPlan",
    method: "get",
    path: "/api/v1/plans/{id}",
    tag: "plans",
    summary: "A plan and its result",
    description:
      "While the plan is queued or running `result` is null. A finished plan holds the ranked rotations, their evidence and reasons; explain each code with the glossary.",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body("The plan.", [
        "RotationPlanningStatus",
        "PlanningStatus",
        "PlanIntakeStatus",
      ]),
      ...ownerErrors,
    },
  },
  {
    operationId: "setPlanLabel",
    method: "put",
    path: "/api/v1/plans/{id}/label",
    tag: "plans",
    summary: "Rename a plan",
    access: "owner",
    description:
      "Idempotently replaces the label; null clears it. Does not alter accepted input, result hashes, or processing timestamps.",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    body: "PlanLabelRequest",
    responses: {
      "200": body("The saved label.", "PlanLabelResponse"),
      ...ownerErrors,
    },
  },
  {
    operationId: "deletePlan",
    method: "delete",
    path: "/api/v1/plans/{id}",
    tag: "plans",
    summary: "Delete a plan",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: { "204": body("Deleted."), ...ownerErrors },
  },
  {
    operationId: "submitWhatIf",
    method: "post",
    path: "/api/v1/plans/{id}/what-if",
    tag: "plans",
    summary: "Re-run a plan with a what-if change in climate",
    description:
      "Copies your stored plan request, adds the rainfall, temperature and sowing-date changes, and sends it through plan intake. The result is labelled as a what-if and is not a forecast. Resend the same Idempotency-Key to get the same plan back.",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    idempotencyKey: true,
    params: fieldIdParamsSchema,
    body: "PlanWhatIfRequest",
    responses: {
      "202": body("Accepted; poll the Location address.", "PlanSubmitted"),
      ...ownerErrors,
      "409": error("The key was used with a different request."),
    },
  },
  {
    operationId: "claimPlan",
    method: "post",
    path: "/api/v1/plans/{id}/claim",
    tag: "plans",
    summary: "Move a guest plan into your account",
    description:
      "Needs both the signed-in account session and the guest bearer token that owns the plan.",
    access: "both",
    requires: ["PLANS_ENABLED", "AUTH_ENABLED"],
    params: fieldIdParamsSchema,
    body: "PlanClaimRequest",
    responses: {
      "200": body("The plan now belongs to the account.", "PlanClaimed"),
      ...ownerErrors,
      "409": error("The plan cannot be claimed in its current state."),
    },
  },
  {
    operationId: "explainPlan",
    method: "post",
    path: "/api/v1/plans/{id}/explanation",
    tag: "crop-health",
    summary: "Plain-language explanation of a finished plan",
    description:
      "Written by an AI model from the plan's facts and checked against them. Needs the photo-check key to be set.",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    body: "PlanExplanationRequest",
    responses: {
      "200": body("The explanation.", "PlanExplanation"),
      ...ownerErrors,
      "409": error("The plan has no result yet."),
      "502": error("The explanation failed its check."),
    },
  },
  {
    operationId: "getCropHealthStatus",
    method: "get",
    path: "/api/v1/crop-health/status",
    tag: "crop-health",
    summary: "Whether the photo check is switched on",
    access: "none",
    requires: ["PLANS_ENABLED"],
    responses: { "200": body("The status.", "CropHealthStatus") },
  },
  {
    operationId: "checkCropPhoto",
    method: "post",
    path: "/api/v1/crop-health/photo",
    tag: "crop-health",
    summary: "Check a crop photo against the crop's known problems",
    description:
      "Gives possibilities to check, never a diagnosis. The photo is sent to the AI provider without its metadata and is not stored.",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    body: "CropPhotoRequest",
    responses: {
      "200": body("The assessment.", "CropPhotoResult"),
      ...ownerErrorsNoNotFound,
      "422": error("The photo or crop cannot be assessed."),
      "502": error("The provider rejected the request."),
    },
  },
  {
    ...field("Create a field"),
    operationId: "createField",
    method: "post",
    path: "/api/v1/fields",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    body: "FieldCreateRequest",
    responses: { "201": body("The field.", "FieldRecord"), ...ownerErrors },
  },
  {
    ...field("Create a field with its crop history"),
    operationId: "createFieldWithHistory",
    method: "post",
    path: "/api/v1/fields-with-history",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    body: "FieldWithHistoryRequest",
    responses: { "201": body("The field.", "FieldRecord"), ...ownerErrors },
  },
  {
    ...field("Your fields, newest first"),
    operationId: "listFields",
    method: "get",
    path: "/api/v1/fields",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    query: "page",
    responses: {
      "200": body("One page of fields.", "FieldPage"),
      ...ownerErrors,
    },
  },
  {
    ...field("One field"),
    operationId: "getField",
    method: "get",
    path: "/api/v1/fields/{id}",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: { "200": body("The field.", "FieldRecord"), ...ownerErrors },
  },
  {
    ...field("Change a field"),
    operationId: "updateField",
    method: "put",
    path: "/api/v1/fields/{id}",
    description:
      "Send the version you read. If someone changed the field since, the answer is 409.",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    body: "FieldUpdateRequest",
    responses: {
      "200": body("The updated field.", "FieldRecord"),
      ...ownerErrors,
      "409": error("The version is out of date."),
    },
  },
  {
    ...field("Delete a field"),
    operationId: "deleteField",
    method: "delete",
    path: "/api/v1/fields/{id}",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: { "204": body("Deleted."), ...ownerErrors },
  },
  {
    ...field("A field's saved outline"),
    operationId: "getFieldBoundary",
    method: "get",
    path: "/api/v1/fields/{id}/boundary",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body(
        "The outline, or null when none is saved.",
        "BoundaryEnvelope",
      ),
      ...ownerErrors,
    },
  },
  {
    ...field("Save or replace a field's outline"),
    operationId: "saveFieldBoundary",
    method: "put",
    path: "/api/v1/fields/{id}/boundary",
    description:
      "Send `expectedVersion` null to create the first outline, or the version you read to replace it.",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    body: "BoundaryUpdateRequest",
    responses: {
      "200": body("The saved outline.", "BoundaryRecord"),
      ...ownerErrors,
      "409": error("The version is out of date."),
    },
  },
  {
    ...field("Remove a field's outline"),
    operationId: "deleteFieldBoundary",
    method: "delete",
    path: "/api/v1/fields/{id}/boundary",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: { "204": body("Removed."), ...ownerErrors },
  },
  {
    ...field("A field's crop history"),
    operationId: "listFieldHistory",
    method: "get",
    path: "/api/v1/fields/{id}/history",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    query: "page",
    responses: {
      "200": body("One page of crops.", "HistoryPage"),
      ...ownerErrors,
    },
  },
  {
    ...field("Add a crop to the history"),
    operationId: "createFieldHistoryEntry",
    method: "post",
    path: "/api/v1/fields/{id}/history",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    body: "CropHistoryEntry",
    responses: { "201": body("The entry.", "HistoryRecord"), ...ownerErrors },
  },
  {
    ...field("Change a crop in the history"),
    operationId: "updateFieldHistoryEntry",
    method: "put",
    path: "/api/v1/fields/{id}/history/{entryId}",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldHistoryParamsSchema,
    body: "HistoryUpdateRequest",
    responses: {
      "200": body("The updated entry.", "HistoryRecord"),
      ...ownerErrors,
      "409": error("The version is out of date."),
    },
  },
  {
    ...field("Remove a crop from the history"),
    operationId: "deleteFieldHistoryEntry",
    method: "delete",
    path: "/api/v1/fields/{id}/history/{entryId}",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldHistoryParamsSchema,
    responses: { "204": body("Removed."), ...ownerErrors },
  },
  {
    operationId: "requestObservation",
    method: "post",
    path: "/api/v1/fields/{id}/observations",
    tag: "earth-observations",
    summary: "Ask NASA for HLS greenness, SMAP soil moisture or GPM rain",
    description:
      "Returns at once; NASA can take hours. Poll the observation until it is completed or failed.",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldIdParamsSchema,
    body: "ObservationRequest",
    responses: {
      "202": body(
        "The request, queued or already running.",
        "ObservationStatus",
      ),
      ...ownerErrors,
    },
  },
  {
    operationId: "listObservations",
    method: "get",
    path: "/api/v1/fields/{id}/observations",
    tag: "earth-observations",
    summary: "A field's satellite requests",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body("The requests.", "ObservationList"),
      ...ownerErrors,
    },
  },
  {
    operationId: "getObservation",
    method: "get",
    path: "/api/v1/fields/{id}/observations/{observationId}",
    tag: "earth-observations",
    summary: "One satellite request and its result",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldObservationParamsSchema,
    responses: {
      "200": body("The request.", "ObservationStatus"),
      ...ownerErrors,
    },
  },
  {
    operationId: "getVegetationAnalysis",
    method: "get",
    path: "/api/v1/fields/{id}/analysis/vegetation",
    tag: "earth-observations",
    summary:
      "Greenness timeline, green seasons and stress against the field's own history",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body(
        "The analysis, or why there is none yet.",
        "VegetationAnalysisResponse",
      ),
      ...ownerErrors,
    },
  },
  {
    operationId: "getRainAnalysis",
    method: "get",
    path: "/api/v1/fields/{id}/analysis/rain",
    tag: "earth-observations",
    summary: "Monthly satellite rain beside the weather data's rain",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body(
        "The series, or why there is none yet.",
        "RainSeriesResponse",
      ),
      ...ownerErrors,
    },
  },
  {
    operationId: "requestExtraction",
    method: "post",
    path: "/api/v1/fields/{id}/extractions",
    tag: "earth-observations",
    summary: "Ask NASA for terrain, ECOSTRESS or MODIS data",
    description: "Returns at once; NASA can take hours.",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldIdParamsSchema,
    body: "ExtractionRequest",
    responses: {
      "202": body(
        "The request, queued or already running.",
        "ExtractionStatus",
      ),
      ...ownerErrors,
    },
  },
  {
    operationId: "listExtractions",
    method: "get",
    path: "/api/v1/fields/{id}/extractions",
    tag: "earth-observations",
    summary: "A field's terrain, ECOSTRESS and MODIS requests",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body("The requests.", "ExtractionList"),
      ...ownerErrors,
    },
  },
  {
    operationId: "getExtraction",
    method: "get",
    path: "/api/v1/fields/{id}/extractions/{extractionId}",
    tag: "earth-observations",
    summary: "One extraction and its result",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldExtractionParamsSchema,
    responses: {
      "200": body("The request.", "ExtractionStatus"),
      ...ownerErrors,
    },
  },
  {
    operationId: "getVegetationHistory",
    method: "get",
    path: "/api/v1/fields/{id}/analysis/vegetation-history",
    tag: "earth-observations",
    summary: "Greenness since 2000 from MODIS, with usually-low windows",
    access: "owner",
    requires: ["PLANS_ENABLED", "OBSERVATIONS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body(
        "The history, or why there is none yet.",
        "VegetationHistoryResponse",
      ),
      ...ownerErrors,
    },
  },
  {
    operationId: "getCanopyBiomass",
    method: "get",
    path: "/api/v1/fields/{id}/canopy-biomass",
    tag: "earth-observations",
    summary: "GEDI woody-vegetation biomass around the field",
    description:
      "Woody vegetation near the field from a 1 km map. It is never an estimate of the crop's biomass.",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body(
        "The summary, or why there is none.",
        "CanopyBiomassResponse",
      ),
      ...ownerErrors,
    },
  },
  {
    operationId: "getWaterStorage",
    method: "get",
    path: "/api/v1/fields/{id}/water-storage",
    tag: "earth-observations",
    summary: "GRACE water-storage trend of the region",
    description:
      "Regional context over hundreds of kilometres, never the field's own water.",
    access: "owner",
    requires: ["PLANS_ENABLED"],
    params: fieldIdParamsSchema,
    responses: {
      "200": body("The trend, or why there is none.", "WaterStorageResponse"),
      ...ownerErrors,
    },
  },
];

// Fastify and Nest write `:id`; OpenAPI writes `{id}`.
export const toOpenApiPath = (route: string) =>
  route.replace(/:([A-Za-z0-9_]+)/g, "{$1}");
