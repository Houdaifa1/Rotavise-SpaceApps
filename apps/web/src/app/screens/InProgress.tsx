import { Link, useParams } from "react-router";
import { fieldIdParamsSchema, planCropIdSchema } from "@rotavise/contracts";
import { useMessages, type MessageKey } from "../../i18n/messages.js";
import { useBoot } from "../providers/Runtime.js";
import { useRouteMeta } from "../AppShell.js";

export function NotFound() {
  const { t } = useMessages();
  return (
    <section className="f1-page">
      <h1>{t("error.notFound")}</h1>
      <p>{t("error.notFoundText")}</p>
      <Link to="/map">{t("common.back")}</Link>
    </section>
  );
}
export function Component() {
  const { t } = useMessages();
  const params = useParams();
  const meta = useRouteMeta();
  const boot = useBoot();
  if (
    params.id &&
    !(
      meta.title === "progress.crops"
        ? planCropIdSchema.safeParse(params.id)
        : fieldIdParamsSchema.safeParse({ id: params.id })
    ).success
  )
    return <NotFound />;
  if (
    params.strategyId &&
    !/^rotation-[a-z0-9-]+$|^[a-z0-9_-]{1,100}$/.test(params.strategyId)
  )
    return <NotFound />;
  if (
    params.tab &&
    ![
      "seasons",
      "water",
      "heat-frost",
      "land",
      "future",
      "sources",
      "grids",
    ].includes(params.tab)
  )
    return <NotFound />;
  const cap = boot.capabilities.data;
  let reason: MessageKey | undefined;
  if (meta.feature === "plans" && !cap?.plans)
    reason = cap ? "capability.plansOff" : "degraded.capabilities";
  if (meta.feature === "photo" && !cap?.cropHealth.available)
    reason = cap ? "capability.photoOff" : "degraded.capabilities";
  return (
    <section className="f1-page">
      <p className="f1-caption">{t("progress.title")}</p>
      <h1>{t(meta.title)}</h1>
      <p>{reason ? t(reason) : t("progress.text")}</p>
      {meta.title === "nav.map" && <p>{t("shell.noMap")}</p>}
      {meta.title === "progress.evidence" && cap && !cap.observations && (
        <p>{t("capability.observationsOff")}</p>
      )}
      {meta.title === "progress.evidence" &&
        cap &&
        !cap.climateScenarios &&
        params.tab === "future" && <p>{t("capability.climateOff")}</p>}
      {meta.title === "progress.field" &&
        cap &&
        !cap.fieldDetection.available && <p>{t("capability.detectionOff")}</p>}
      {meta.title === "progress.about" && (
        <>
          <p>{t("about.unreviewed")}</p>
          <Link to="/?welcome=1">{t("welcome.revisit")}</Link>
        </>
      )}
      <div className="f1-route-links">
        {cap?.plans && boot.catalog.data && (
          <Link to="/legacy/planner">{t("nav.planner")}</Link>
        )}
        {cap?.weather && <Link to="/legacy/weather">{t("nav.weather")}</Link>}
        <Link to="/glossary">{t("nav.glossary")}</Link>
      </div>
    </section>
  );
}
