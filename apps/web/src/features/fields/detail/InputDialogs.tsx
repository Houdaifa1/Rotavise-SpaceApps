import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fieldProfileSchema } from "@rotavise/contracts";
import { useApi, useBoot } from "../../../app/providers/Runtime.js";
import { getCropDetail } from "../../../api/catalog.js";
import { keys } from "../../../api/keys.js";
import {
  Button,
  DateField,
  NumberField,
  Select,
  TextField,
} from "../../../design/primitives/controls.js";
import { cropLabels } from "../../../design/primitives/crops.js";
import { useMessages } from "../../../i18n/messages.js";
import { useCropNameMode } from "../../../shared/cropNamePreference.js";
import { DataError } from "../../../shared/DataError.js";
import type { Field } from "../useFieldWorkspace.js";
import { EditValidation, ProfileDialog } from "./EditDialog.js";
import {
  healthWith,
  sameReport,
  soilWith,
  waterWith,
  type SoilReading,
  type HealthReport,
  type Availability,
} from "./inputBodies.js";

const CropPicker = lazy(() =>
  import("../../crops/index.js").then(({ CropPicker }) => ({
    default: CropPicker,
  })),
);

const metrics = ["ph", "organic_matter", "texture"] as const;
const availability = [
  "unknown",
  "rainfed",
  "irrigation_limited",
  "irrigation_available",
] as const;
const soilSources = ["farmer_observation", "laboratory_report"] as const;
const healthSources = [
  "farmer_report",
  "specialist_report",
  "laboratory_report",
] as const;
const methods = ["unknown", "water", "cacl2"] as const;
const dates = { min: "1900-01-01", max: "2100-12-31" };
type SoilMetric = SoilReading["metric"];
type DialogContext = {
  field: Field;
  restoreFocus: () => void;
  onClose: () => void;
};

export function SoilDialog({
  reading,
  ...dialog
}: DialogContext & { reading?: SoilReading | undefined }) {
  const { t } = useMessages();
  const available = metrics.filter((metric) =>
    reading
      ? reading.metric === metric
      : dialog.field.profile.soil.status === "unknown" ||
        !dialog.field.profile.soil.observations.some(
          (item) => item.metric === metric,
        ),
  );
  const [metric, setMetric] = useState<SoilMetric>(
    reading?.metric ?? available[0] ?? "ph",
  );
  const [value, setValue] = useState(
    reading && reading.metric !== "texture" ? String(reading.value) : "",
  );
  const [method, setMethod] = useState(
    reading && reading.metric !== "texture" ? reading.method : "",
  );
  const [classification, setClassification] = useState(
    reading?.metric === "texture" ? reading.classification : "",
  );
  const [system, setSystem] = useState(
    reading?.metric === "texture" ? reading.classification_system : "",
  );
  const [date, setDate] = useState(reading?.measured_on ?? "");
  const [source, setSource] = useState<SoilReading["source"]>(
    reading?.source ?? "farmer_observation",
  );
  const [remove, setRemove] = useState(false);
  const context = { measured_on: date || null, source };
  const amount = value === "" ? NaN : Number(value);
  const observation: SoilReading =
    metric === "texture"
      ? { metric, classification, classification_system: system, ...context }
      : metric === "ph"
        ? {
            metric,
            value: amount,
            unit: "pH",
            method: methods.find((item) => item === method) ?? "unknown",
            ...context,
          }
        : { metric, value: amount, unit: "percent_mass", method, ...context };
  const patch = (base: Field) => ({
    soil: soilWith(base.profile, metric, remove ? undefined : observation),
  });
  return (
    <ProfileDialog
      {...dialog}
      title={t(reading ? "inputs.editSoil" : "inputs.addSoil")}
      patch={patch}
      validate={() =>
        fieldProfileSchema.safeParse({
          ...dialog.field.profile,
          ...patch(dialog.field),
        }).success
          ? undefined
          : "inputs.invalidSoil"
      }
    >
      {remove ? (
        <p>{t("inputs.removeSoilBody")}</p>
      ) : (
        <>
          <Select
            label={t("inputs.measurement")}
            value={metric}
            onChange={(next) => {
              setMetric(available.find((item) => item === next) ?? "ph");
              setValue("");
              setMethod("");
            }}
            options={available.map((item) => ({
              value: item,
              label: t(`inputs.metric.${item}`),
            }))}
          />
          {metric === "texture" ? (
            <>
              <TextField
                required
                maxLength={120}
                label={t("inputs.classification")}
                value={classification}
                onChange={(e) => setClassification(e.target.value)}
              />
              <TextField
                required
                maxLength={120}
                label={t("inputs.classSystem")}
                value={system}
                onChange={(e) => setSystem(e.target.value)}
              />
            </>
          ) : (
            <>
              <NumberField
                required
                min={0}
                max={metric === "ph" ? 14 : 100}
                step={
                  metric === "ph" &&
                  (reading?.metric !== "ph" ||
                    Number.isInteger(reading.value * 10))
                    ? 0.1
                    : "any"
                }
                label={t(`inputs.metric.${metric}`)}
                unit={metric === "ph" ? "pH" : "%"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              {metric === "ph" ? (
                <Select
                  label={t("inputs.method")}
                  value={methods.find((item) => item === method) ?? "unknown"}
                  onChange={setMethod}
                  options={methods.map((item) => ({
                    value: item,
                    label: t(`inputs.method.${item}`),
                  }))}
                />
              ) : (
                <TextField
                  required
                  maxLength={120}
                  label={t("inputs.method")}
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                />
              )}
            </>
          )}
          <DateField
            {...dates}
            label={t("inputs.measured")}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <Select
            label={t("inputs.source")}
            value={source}
            onChange={(next) =>
              setSource(
                soilSources.find((item) => item === next) ??
                  "farmer_observation",
              )
            }
            options={soilSources.map((item) => ({
              value: item,
              label: t(`inputs.source.${item}`),
            }))}
          />
          {reading && (
            <Button variant="ghost" onClick={() => setRemove(true)}>
              {t("inputs.removeSoil")}
            </Button>
          )}
        </>
      )}
    </ProfileDialog>
  );
}
export function WaterDialog({
  initial,
  ...dialog
}: DialogContext & { initial: Availability }) {
  const { t } = useMessages();
  const [value, setValue] = useState(initial);
  return (
    <ProfileDialog
      {...dialog}
      title={t("inputs.editWater")}
      patch={() => ({ water: waterWith(value) })}
    >
      <fieldset className="f4-radios">
        <legend>{t("inputs.water")}</legend>
        {availability.map((option) => (
          <label key={option}>
            <input
              type="radio"
              name="water-availability"
              checked={value === option}
              onChange={() => setValue(option)}
            />
            {t(`inputs.water.${option}`)}
          </label>
        ))}
      </fieldset>
      {(value === "irrigation_limited" || value === "irrigation_available") && (
        <p>{t("inputs.allocationHelp")}</p>
      )}
    </ProfileDialog>
  );
}
export function HealthDialog({
  report,
  ...dialog
}: DialogContext & { report?: HealthReport | undefined }) {
  const { t } = useMessages();
  const { catalog } = useBoot();
  const client = useApi();
  const [mode] = useCropNameMode();
  const [draft, setDraft] = useState<HealthReport>(
    report ?? {
      crop_id: "",
      kind: "disease",
      name: "",
      observed_on: "",
      source: "farmer_report",
      confirmation: "reported",
    },
  );
  const [listed, setListed] = useState("");
  const [remove, setRemove] = useState(false);
  const crop = catalog.data?.crops.find(({ id }) => id === draft.crop_id);
  const catalogId = catalog.data?.catalogId ?? "",
    version = catalog.data?.catalogVersion ?? "";
  const detail = useQuery({
    queryKey: keys.cropDetail(catalogId, version, crop?.id ?? ""),
    enabled: !!crop,
    staleTime: Infinity,
    queryFn: ({ signal }) =>
      getCropDetail(client, {
        params: { catalogId, version, cropId: crop!.id },
        signal,
      }),
  });
  const issues =
    detail.data?.issues.filter(
      (issue) => issue.kind === "disease" || issue.kind === "pest",
    ) ?? [];
  const patch = (base: Field) => {
    const crop_health = healthWith(
      base.profile,
      report,
      remove ? undefined : { ...draft, name: draft.name.trim() },
    );
    const parsed = fieldProfileSchema.safeParse({
      ...base.profile,
      crop_health,
    });
    if (!parsed.success)
      throw new EditValidation(
        parsed.error.issues.some(
          (issue) => issue.message === "Duplicate observation",
        )
          ? "inputs.duplicateHealth"
          : "inputs.invalidHealth",
      );
    if (
      report &&
      base.version !== dialog.field.version &&
      (base.profile.crop_health.status !== "reported" ||
        !base.profile.crop_health.observations.some((item) =>
          sameReport(item, report),
        ))
    )
      throw new EditValidation("f4.conflictGone");
    return { crop_health: parsed.data.crop_health };
  };
  return (
    <ProfileDialog
      {...dialog}
      title={t(report ? "inputs.editHealth" : "inputs.addHealth")}
      patch={patch}
    >
      {remove ? (
        <p>{t("inputs.removeHealthBody")}</p>
      ) : (
        <>
          <Suspense fallback={<p role="status">{t("loading")}</p>}>
            <CropPicker
              label={t("crops.search")}
              value={draft.crop_id || undefined}
              onChange={(crop_id) => {
                if (draft.crop_id !== crop_id) {
                  setListed("");
                  setDraft({ ...draft, crop_id, name: "" });
                }
              }}
            />
          </Suspense>
          {detail.error && (
            <DataError
              error={detail.error}
              busy={detail.isFetching}
              retry={() => void detail.refetch()}
            />
          )}
          {!!issues.length && (
            <Select
              label={t("inputs.listedIssue")}
              value={listed}
              onChange={(id) => {
                setListed(id);
                const issue = issues.find(({ issue_id }) => issue_id === id);
                setDraft({
                  ...draft,
                  name: issue?.name ?? "",
                  kind: issue?.kind === "pest" ? "pest" : "disease",
                });
              }}
              options={[
                { value: "", label: t("inputs.otherIssue") },
                ...issues.map((issue) => ({
                  value: issue.issue_id,
                  label: cropLabels(
                    { name: issue.name, localNames: issue.names },
                    mode,
                  )
                    .map(({ name }) => name)
                    .join(" · "),
                })),
              ]}
            />
          )}
          {!listed && (
            <>
              <TextField
                required
                maxLength={120}
                label={t("inputs.whatYouSaw")}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
              <Select
                label={t("inputs.kind")}
                value={draft.kind}
                onChange={(kind) =>
                  setDraft({
                    ...draft,
                    kind: kind === "pest" ? "pest" : "disease",
                  })
                }
                options={(["disease", "pest"] as const).map((item) => ({
                  value: item,
                  label: t(`inputs.kind.${item}`),
                }))}
              />
            </>
          )}
          <DateField
            required
            {...dates}
            label={t("inputs.observed")}
            value={draft.observed_on}
            onChange={(e) =>
              setDraft({ ...draft, observed_on: e.target.value })
            }
          />
          <Select
            label={t("inputs.reporter")}
            value={draft.source}
            onChange={(next) => {
              const source =
                healthSources.find((item) => item === next) ?? "farmer_report";
              setDraft({
                ...draft,
                source,
                confirmation:
                  source === "farmer_report" ? "reported" : draft.confirmation,
              });
            }}
            options={healthSources.map((item) => ({
              value: item,
              label: t(`inputs.source.${item}`),
            }))}
          />
          <label className="f4-check">
            <input
              type="checkbox"
              disabled={draft.source === "farmer_report"}
              checked={draft.confirmation === "confirmed"}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  confirmation: e.target.checked ? "confirmed" : "reported",
                })
              }
            />
            {t("inputs.confirmation.confirmed")}
          </label>
          {draft.source === "farmer_report" && (
            <p>{t("inputs.farmerCannotConfirm")}</p>
          )}
          {report && (
            <Button variant="ghost" onClick={() => setRemove(true)}>
              {t("inputs.removeHealth")}
            </Button>
          )}
        </>
      )}
    </ProfileDialog>
  );
}
