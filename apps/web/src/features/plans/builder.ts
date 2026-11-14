import { z } from "zod";
import {
  planRequestV2Schema,
  priorityWeightsSchema,
  type FieldProfile,
  type CropHistoryEntry,
  type PlanRequestV2,
} from "@rotavise/contracts";

// Drafts deliberately admit unfinished date ranges and all-zero sliders. The
// complete request schema is the last boundary before submission.
const savedSoil = planRequestV2Schema.shape.soil.options[1];
const soilReadings = savedSoil.shape.observations.element.options;
const savedWater = planRequestV2Schema.shape.water.options[1];
const draftInputSchema = z.strictObject({
  ...planRequestV2Schema.shape,
  history: z.discriminatedUnion("status", [
    planRequestV2Schema.shape.history.options[0],
    planRequestV2Schema.shape.history.options[1].extend({
      entries: z
        .array(
          planRequestV2Schema.shape.history.options[1].shape.entries.element,
        )
        .min(1)
        .max(500),
    }),
  ]),
  soil: z.discriminatedUnion("status", [
    planRequestV2Schema.shape.soil.options[0],
    savedSoil.extend({
      observations: z
        .array(
          z.discriminatedUnion("metric", [
            soilReadings[0],
            soilReadings[1].extend({
              value_ds_per_m: z.number().finite(),
              measured_on: z.string().max(10).nullable(),
            }),
            soilReadings[2],
            soilReadings[3],
          ]),
        )
        .min(1)
        .max(6),
    }),
  ]),
  water: z.discriminatedUnion("status", [
    planRequestV2Schema.shape.water.options[0],
    savedWater.extend({
      allocation: savedWater.shape.allocation
        .unwrap()
        .extend({ amount_mm: z.number().finite() })
        .nullable(),
    }),
  ]),
  planning: z.strictObject({
    horizon_years: z.number().int().min(3).max(5),
    earliest_start_date: z.string().max(10),
    latest_start_date: z.string().max(10),
  }),
  preferences: z.strictObject({
    ...planRequestV2Schema.shape.preferences.shape,
    priorities: z.strictObject(priorityWeightsSchema.shape),
  }),
});
export const builderDraftSchema = z.strictObject({
  version: z.literal(1),
  input: draftInputSchema,
  step: z.number().int().min(0).max(4),
  historyAnswered: z.boolean(),
  retryPlanId: z.uuid().optional(),
  submission: z.strictObject({ key: z.uuid(), json: z.string() }).nullable(),
});
export type BuilderDraft = z.infer<typeof builderDraftSchema>;
export type BuilderInput = BuilderDraft["input"];

export function fieldPlanInput(
  field: { id: string; profile: FieldProfile },
  history: readonly CropHistoryEntry[],
  today: string,
): BuilderInput {
  let year = Number(today.slice(0, 4));
  const last = history.reduce(
    (date, entry) => (entry.harvested_on > date ? entry.harvested_on : date),
    today,
  );
  while (`${year}-09-01` <= last && year < 2100) year++;
  const earliest = `${year}-09-01`;
  const serverLimit = new Date(Date.parse(today) + 366 * 86400000)
    .toISOString()
    .slice(0, 10);
  const latest = serverLimit < "2100-12-31" ? serverLimit : "2100-12-31";
  const profile = field.profile;
  return {
    schema_version: "2",
    field_id: field.id,
    location: profile.location,
    history: history.length
      ? {
          status: "known",
          completeness: "partial",
          entries: history.map(({ crop_id, planted_on, harvested_on }) => ({
            crop_id,
            planted_on,
            harvested_on,
          })),
        }
      : { status: "unknown" },
    soil:
      profile.soil.status === "unknown"
        ? { status: "unknown" }
        : {
            status: "known",
            observations: profile.soil.observations.map((reading) => {
              if (reading.metric === "texture") return reading;
              if (reading.metric === "ph") {
                return {
                  metric: reading.metric,
                  value: reading.value,
                  method: reading.method,
                  measured_on: reading.measured_on,
                  source: reading.source,
                };
              }
              return {
                metric: reading.metric,
                value_percent: reading.value,
                method: reading.method,
                measured_on: reading.measured_on,
                source: reading.source,
              };
            }),
          },
    water:
      profile.water.status === "unknown"
        ? { status: "unknown" }
        : { ...profile.water, allocation: null },
    crop_health:
      profile.crop_health.status === "unknown"
        ? { status: "unknown" }
        : {
            status: "reported",
            observations: profile.crop_health.observations.map((reading) => ({
              crop_id: reading.crop_id,
              observed_on: reading.observed_on,
              source: reading.source,
              confirmation: reading.confirmation,
              issue: { other_name: reading.name },
            })),
          },
    planning: {
      horizon_years: 3,
      earliest_start_date: earliest,
      latest_start_date: latest,
    },
    cultivars: [],
    preferences: {
      mode: "suggest",
      considered_crop_ids: [],
      excluded_crop_ids: [],
      priorities: { climate: 3, water: 3, soil_health: 3, crop_health: 3 },
    },
    farmer_context: {
      equipment: "unknown",
      market_preference: "unknown",
      forage_need: "none",
      erosion_concern: "unknown",
    },
  };
}

// No agronomic calculation lives here: only explicit contract conversion and
// selection mode. Keep this one construction path for review and transport.
export function buildPlanRequest(input: BuilderInput) {
  return {
    ...input,
    preferences: {
      ...input.preferences,
      mode: input.preferences.considered_crop_ids.length
        ? ("consider" as const)
        : ("suggest" as const),
    },
  };
}
export function newDraft(input: BuilderInput): BuilderDraft {
  return {
    version: 1,
    input,
    step: 0,
    historyAnswered: input.history.status === "unknown",
    submission: null,
  };
}
export const draftKey = (field: string) => `rotavise.plan-draft.v1.${field}`;
export function readDraft(
  storage: Pick<Storage, "getItem"> | undefined,
  field: string,
) {
  try {
    const raw = storage?.getItem(draftKey(field));
    const result = raw ? builderDraftSchema.safeParse(JSON.parse(raw)) : null;
    return result?.success && result.data.input.field_id === field
      ? result.data
      : undefined;
  } catch {
    return undefined;
  }
}
export function saveDraft(
  storage: Pick<Storage, "setItem"> | undefined,
  field: string,
  draft: BuilderDraft,
) {
  try {
    storage?.setItem(draftKey(field), JSON.stringify(draft));
    return !!storage;
  } catch {
    return false;
  }
}
export function sessionStorageOrUndefined() {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}
export function submissionFor(
  draft: BuilderDraft,
  uuid: () => string,
): NonNullable<BuilderDraft["submission"]> {
  const json = JSON.stringify(
    planRequestV2Schema.parse(buildPlanRequest(draft.input)),
  );
  return draft.submission?.json === json
    ? draft.submission
    : { key: uuid(), json };
}
export function fromFailedPlan(input: PlanRequestV2, id?: string) {
  return { ...newDraft(input), ...(id ? { retryPlanId: id } : {}) };
}
export function refreshSavedInputs(
  draft: BuilderDraft,
  saved: BuilderInput,
): BuilderDraft {
  const salinity =
    draft.input.soil.status === "known"
      ? draft.input.soil.observations.filter((o) => o.metric === "salinity")
      : [];
  const readings = [
    ...(saved.soil.status === "known" ? saved.soil.observations : []),
    ...salinity,
  ];
  const history =
    saved.history.status === "known" && draft.input.history.status === "known"
      ? { ...saved.history, completeness: draft.input.history.completeness }
      : saved.history;
  const historyChanged =
    JSON.stringify(history) !== JSON.stringify(draft.input.history);
  return {
    ...draft,
    historyAnswered:
      history.status === "unknown" ||
      (!historyChanged && draft.historyAnswered),
    input: {
      ...draft.input,
      location: saved.location,
      history,
      soil: readings.length
        ? { status: "known", observations: readings }
        : { status: "unknown" },
      crop_health: saved.crop_health,
      water:
        saved.water.status === "reported"
          ? {
              ...saved.water,
              allocation:
                draft.input.water.status === "reported"
                  ? draft.input.water.allocation
                  : null,
            }
          : saved.water,
    },
  };
}
