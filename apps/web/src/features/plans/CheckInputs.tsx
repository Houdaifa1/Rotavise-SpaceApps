import { SegmentedControl } from "../../design/primitives/segments.js";
import { useMessages } from "../../i18n/messages.js";
import type { BuilderProps as Props } from "./builderProps.js";
import { useNavigate } from "react-router";
import {
  Button,
  DateField,
  NumberField,
  Select,
} from "../../design/primitives/controls.js";
import { ShortList } from "../../shared/ShortList.js";
import { calendarDate, number } from "../../i18n/format.js";
import { Priorities } from "../priorities/Priorities.js";
import { CropLabel } from "./CropLabel.js";
import { useEffect } from "react";
import type { issueTarget } from "./validation.js";
export function CheckInputs({
  input,
  onChange,
  answered,
  onAnswer,
  error,
  correction,
  applied,
}: Props & {
  answered: boolean;
  onAnswer: () => void;
  error?: string;
  correction?: ReturnType<typeof issueTarget>;
}) {
  const { t, language } = useMessages();
  const navigate = useNavigate();
  const history = input.history;
  useEffect(() => {
    if (!correction) return;
    const frame = requestAnimationFrame(() => {
      const target = document.getElementById(
        `f5-${correction.control}${correction.row === undefined ? "" : `-${correction.row}`}`,
      );
      if (target) {
        target.tabIndex = -1;
        target.focus();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [correction]);
  const salinity =
    input.soil.status === "known"
      ? input.soil.observations.find((o) => o.metric === "salinity")
      : undefined;
  return (
    <div className="f5-stack">
      <h2>{t("f5.check")}</h2>
      <section id="f5-history" className="f5-stack">
        <h3>{t("f5.history")}</h3>
        {history.status === "known" ? (
          <>
            <ShortList
              key={
                correction?.control === "history" ? correction.row : "history"
              }
              initialPage={
                correction?.control === "history"
                  ? Math.floor((correction.row ?? 0) / 7)
                  : 0
              }
              items={history.entries}
              render={(entry, index) => (
                <div id={`f5-history-${index}`}>
                  <CropLabel id={entry.crop_id} />
                  <p>
                    {entry.planted_on &&
                      calendarDate(entry.planted_on, language)}{" "}
                    —{" "}
                    {entry.harvested_on &&
                      calendarDate(entry.harvested_on, language)}
                  </p>
                </div>
              )}
            />
            <p>{t("f5.historyQuestion")}</p>
            <SegmentedControl
              label={t("f5.historyQuestion")}
              value={answered ? history.completeness : ""}
              options={[
                { value: "complete", label: t("f5.complete") },
                { value: "partial", label: t("f5.partial") },
              ]}
              onChange={(value) => {
                onChange({
                  ...input,
                  history: {
                    ...history,
                    completeness: value as "complete" | "partial",
                  },
                });
                onAnswer();
              }}
            />
          </>
        ) : (
          <p>{t("f5.unknownEffect")}</p>
        )}
        <Button
          onClick={() => void navigate(`/fields/${input.field_id}/history`)}
        >
          {t("f5.editHistory")}
        </Button>
      </section>
      <section id="f5-soil">
        <h3>{t("f5.soil")}</h3>
        {input.soil.status === "known" ? (
          <ShortList
            items={input.soil.observations}
            render={(reading) => (
              <>
                <p>
                  {t(
                    reading.metric === "salinity"
                      ? "f5.salinity"
                      : `inputs.metric.${reading.metric}`,
                  )}{" "}
                  ·{" "}
                  {reading.metric === "texture"
                    ? reading.classification
                    : reading.metric === "ph"
                      ? `${number(reading.value, language)} pH`
                      : reading.metric === "salinity"
                        ? `${number(reading.value_ds_per_m, language)} dS/m`
                        : `${number(reading.value_percent, language)} %`}
                </p>
                <small>
                  {t(`inputs.source.${reading.source}`)}
                  {reading.measured_on
                    ? ` · ${calendarDate(reading.measured_on, language)}`
                    : ""}
                </small>
              </>
            )}
          />
        ) : (
          <p>{t("f5.unknownEffect")}</p>
        )}
        <Button
          onClick={() => void navigate(`/fields/${input.field_id}?tab=inputs`)}
        >
          {t("f5.editInputs")}
        </Button>
      </section>
      <section id="f5-water" className="f5-stack">
        <h3>{t("f5.water")}</h3>
        <p>
          {t(
            input.water.status === "reported"
              ? `inputs.water.${input.water.availability}`
              : "f5.unknownEffect",
          )}
        </p>
        {input.water.status === "reported" && (
          <>
            <NumberField
              label={t("f5.allocation")}
              unit="mm"
              min={0}
              max={5000}
              value={input.water.allocation?.amount_mm ?? ""}
              onChange={(e) => {
                if (input.water.status === "reported")
                  onChange({
                    ...input,
                    water: {
                      ...input.water,
                      allocation:
                        e.target.value === ""
                          ? null
                          : {
                              amount_mm: e.target.valueAsNumber,
                              period:
                                input.water.allocation?.period ?? "season",
                            },
                    },
                  });
              }}
            />
            <Select
              label={t("f5.allocationPeriod")}
              disabled={!input.water.allocation}
              value={input.water.allocation?.period ?? "season"}
              options={[
                { value: "season", label: t("f5.season") },
                { value: "year", label: t("f5.year") },
              ]}
              onChange={(value) => {
                if (input.water.status === "reported" && input.water.allocation)
                  onChange({
                    ...input,
                    water: {
                      ...input.water,
                      allocation: {
                        ...input.water.allocation,
                        period: value as "season" | "year",
                      },
                    },
                  });
              }}
            />
          </>
        )}
      </section>
      <section id="f5-health">
        <h3>{t("f5.health")}</h3>
        {input.crop_health.status === "reported" ? (
          <ShortList
            key={correction?.control === "health" ? correction.row : "health"}
            initialPage={
              correction?.control === "health"
                ? Math.floor((correction.row ?? 0) / 7)
                : 0
            }
            items={input.crop_health.observations}
            render={(o, index) => (
              <div id={`f5-health-${index}`}>
                <CropLabel id={o.crop_id} />
                <p>
                  {"other_name" in o.issue
                    ? o.issue.other_name
                    : t("f5.savedInputs")}{" "}
                  · {calendarDate(o.observed_on, language)} ·{" "}
                  {t(`inputs.source.${o.source}`)} ·{" "}
                  {t(`inputs.confirmation.${o.confirmation}`)}
                </p>
              </div>
            )}
          />
        ) : (
          <p>{t("f5.unknownEffect")}</p>
        )}
      </section>
      <details>
        <summary>{t("f5.salinity")}</summary>
        <div className="f5-stack">
          <p>{t("f5.planOnly")}</p>
          <NumberField
            label={t("f5.salinity")}
            unit="dS/m"
            min={0}
            max={100}
            step="any"
            value={salinity?.value_ds_per_m ?? ""}
            onChange={(e) => {
              const rest =
                input.soil.status === "known"
                  ? input.soil.observations.filter(
                      (o) => o.metric !== "salinity",
                    )
                  : [];
              const observations = [
                ...rest,
                ...(e.target.value === ""
                  ? []
                  : [
                      {
                        metric: "salinity" as const,
                        value_ds_per_m: e.target.valueAsNumber,
                        method: salinity?.method ?? ("unknown" as const),
                        measured_on: salinity?.measured_on ?? null,
                        source:
                          salinity?.source ?? ("farmer_observation" as const),
                      },
                    ]),
              ];
              onChange({
                ...input,
                soil: observations.length
                  ? { status: "known", observations }
                  : { status: "unknown" },
              });
            }}
          />
          {salinity && (
            <>
              <Select
                label={t("f5.salinityMethod")}
                value={salinity.method}
                options={[
                  { value: "unknown", label: t("f5.option.unknown") },
                  { value: "saturated_paste_ece", label: t("f5.saturated") },
                ]}
                onChange={(value) => {
                  if (input.soil.status === "known")
                    onChange({
                      ...input,
                      soil: {
                        ...input.soil,
                        observations: input.soil.observations.map((o) =>
                          o.metric === "salinity"
                            ? {
                                ...o,
                                method: value as
                                  "unknown" | "saturated_paste_ece",
                              }
                            : o,
                        ),
                      },
                    });
                }}
              />
              <DateField
                label={t("f5.measuredOn")}
                value={salinity.measured_on ?? ""}
                min="1900-01-01"
                max="2100-12-31"
                onChange={(e) => {
                  if (input.soil.status === "known")
                    onChange({
                      ...input,
                      soil: {
                        ...input.soil,
                        observations: input.soil.observations.map((o) =>
                          o.metric === "salinity"
                            ? { ...o, measured_on: e.target.value || null }
                            : o,
                        ),
                      },
                    });
                }}
              />
              <Select
                label={t("f5.source")}
                value={salinity.source}
                options={[
                  { value: "farmer_observation", label: t("f5.farmer") },
                  { value: "laboratory_report", label: t("f5.laboratory") },
                ]}
                onChange={(value) => {
                  if (input.soil.status === "known")
                    onChange({
                      ...input,
                      soil: {
                        ...input.soil,
                        observations: input.soil.observations.map((o) =>
                          o.metric === "salinity"
                            ? {
                                ...o,
                                source: value as
                                  "farmer_observation" | "laboratory_report",
                              }
                            : o,
                        ),
                      },
                    });
                }}
              />
            </>
          )}
        </div>
      </details>
      <Priorities
        input={input}
        onChange={onChange}
        {...(applied ? { applied } : {})}
        {...(error ? { error } : {})}
      />
    </div>
  );
}
