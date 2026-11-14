import { lazy, Suspense, useRef, useState } from "react";
import { Link } from "react-router";
import { useBoot, useOffline } from "../../../app/providers/Runtime.js";
import { Button } from "../../../design/primitives/controls.js";
import { CropName } from "../../../design/primitives/crops.js";
import { Skeleton } from "../../../design/primitives/feedback.js";
import { useMessages } from "../../../i18n/messages.js";
import { calendarDate, number } from "../../../i18n/format.js";
import { ShortList } from "../../../shared/ShortList.js";
import { useCropNameMode } from "../../../shared/cropNamePreference.js";
import type { Field } from "../useFieldWorkspace.js";
import type { SoilReading, HealthReport } from "./inputBodies.js";
const SoilEstimate = lazy(() => import("./SoilEstimate.js"));

const SoilDialog = lazy(() =>
  import("./InputDialogs.js").then(({ SoilDialog }) => ({
    default: SoilDialog,
  })),
);
const WaterDialog = lazy(() =>
  import("./InputDialogs.js").then(({ WaterDialog }) => ({
    default: WaterDialog,
  })),
);
const HealthDialog = lazy(() =>
  import("./InputDialogs.js").then(({ HealthDialog }) => ({
    default: HealthDialog,
  })),
);
type Form =
  | { kind: "soil"; reading?: SoilReading }
  | { kind: "water" }
  | { kind: "health"; report?: HealthReport };

export function Inputs({ field }: { field: Field }) {
  const { t, language } = useMessages();
  const { catalog, capabilities } = useBoot();
  const offline = useOffline();
  const [nameMode] = useCropNameMode();
  const [form, setForm] = useState<Form>();
  const [estimateOpen, setEstimateOpen] = useState(false);
  const trigger = useRef<HTMLElement | null>(null);
  const region = useRef<HTMLElement>(null);
  const profile = field.profile;
  const soil = profile.soil.status === "known" ? profile.soil.observations : [];
  const health =
    profile.crop_health.status === "reported"
      ? profile.crop_health.observations
      : [];
  const water =
    profile.water.status === "reported"
      ? profile.water.availability
      : "unknown";
  function open(next: Form, node: HTMLElement) {
    trigger.current = node;
    setForm(next);
  }
  function restore() {
    (trigger.current?.isConnected ? trigger.current : region.current)?.focus();
  }
  const dialog = {
    field,
    restoreFocus: restore,
    onClose: () => {
      setForm(undefined);
      requestAnimationFrame(restore);
    },
  };
  return (
    <section
      ref={region}
      className="f4-stack"
      aria-label={t("f4.inputs")}
      tabIndex={-1}
    >
      {offline && <p>{t("f4.offline")}</p>}
      <section className="f4-stack">
        <div className="f4-section-heading">
          <h3>{t("inputs.soil")}</h3>
          <Button
            size="small"
            disabled={offline || soil.length >= 3}
            onClick={(e) => open({ kind: "soil" }, e.currentTarget)}
          >
            {t("inputs.addSoil")}
          </Button>
        </div>
        <p>{t("inputs.soilHelp")}</p>
        {!!soil.length && (
          <ShortList
            items={soil}
            render={(reading) => (
              <Button
                size="small"
                variant="ghost"
                disabled={offline}
                onClick={(e) =>
                  open({ kind: "soil", reading }, e.currentTarget)
                }
              >
                {t(`inputs.metric.${reading.metric}`)} ·{" "}
                {reading.metric === "texture"
                  ? reading.classification
                  : `${number(reading.value, language)} ${reading.metric === "ph" ? "pH" : "%"}`}
              </Button>
            )}
          />
        )}
        <details
          onToggle={(event) => setEstimateOpen(event.currentTarget.open)}
        >
          <summary className="f4-evidence-summary">
            {t("inputs.estimate")}
          </summary>
          {estimateOpen && (
            <Suspense fallback={<Skeleton shape="row" />}>
              <SoilEstimate fieldId={field.id} />
            </Suspense>
          )}
        </details>
      </section>
      <section className="f4-stack">
        <div className="f4-section-heading">
          <h3>{t("inputs.water")}</h3>
          <Button
            size="small"
            disabled={offline}
            onClick={(e) => open({ kind: "water" }, e.currentTarget)}
          >
            {t("inputs.editWater")}
          </Button>
        </div>
        <p>{t(`inputs.water.${water}`)}</p>
        {(water === "irrigation_limited" ||
          water === "irrigation_available") && (
          <p>{t("inputs.allocationHelp")}</p>
        )}
      </section>
      <section className="f4-stack">
        <div className="f4-section-heading">
          <h3>{t("inputs.health")}</h3>
          <Button
            size="small"
            disabled={offline || !catalog.data || health.length >= 20}
            onClick={(e) => open({ kind: "health" }, e.currentTarget)}
          >
            {t("inputs.addHealth")}
          </Button>
        </div>
        {!!health.length ? (
          <ShortList
            items={health}
            render={(report) => {
              const crop = catalog.data?.crops.find(
                (item) => item.id === report.crop_id,
              );
              return (
                <Button
                  size="small"
                  variant="ghost"
                  className="f4-history-row"
                  disabled={offline}
                  onClick={(e) =>
                    open({ kind: "health", report }, e.currentTarget)
                  }
                >
                  {report.name} ·{" "}
                  <CropName
                    cropId={report.crop_id}
                    {...(crop ? { crop } : {})}
                    nameMode={nameMode}
                    compact
                  />
                  <small>
                    {calendarDate(report.observed_on, language)} ·{" "}
                    {t(`inputs.confirmation.${report.confirmation}`)}
                  </small>
                </Button>
              );
            }}
          />
        ) : (
          <p>{t("inputs.noHealth")}</p>
        )}
        <p>
          {t("inputs.healthHelp")}{" "}
          {capabilities.data?.cropHealth.available && (
            <Link to="/photo-check">{t("progress.photo")}</Link>
          )}
        </p>
      </section>
      {form && (
        <Suspense fallback={<Skeleton shape="row" />}>
          {form?.kind === "soil" && (
            <SoilDialog {...dialog} reading={form.reading} />
          )}
          {form?.kind === "water" && (
            <WaterDialog {...dialog} initial={water} />
          )}
          {form?.kind === "health" && (
            <HealthDialog {...dialog} report={form.report} />
          )}
        </Suspense>
      )}
    </section>
  );
}
