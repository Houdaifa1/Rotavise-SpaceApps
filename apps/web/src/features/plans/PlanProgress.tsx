import { StepProgress } from "../../design/primitives/progress.js";
import "./progressMessages.js";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router";
import {
  fieldIdParamsSchema,
  type RotationPlanningStatus,
} from "@rotavise/contracts";
import {
  useApi,
  useBoot,
  useOffline,
  useSession,
} from "../../app/providers/Runtime.js";
import { planQuery } from "../../api/queries.js";
import { keys } from "../../api/keys.js";
import { failureText } from "../../api/errors.js";
import { Button } from "../../design/primitives/controls.js";
import { Dialog, Skeleton } from "../../design/primitives/feedback.js";
import { useMessages, type MessageKey } from "../../i18n/messages.js";
import { number, timestamp } from "../../i18n/format.js";
import { RetryButton } from "../../shared/RetryButton.js";
import { findTerm } from "../../shared/glossaryText.js";
import { DataError } from "../../shared/DataError.js";
import "./plans.css";
export const planStages = [
  "awaiting_processing",
  "verifying_evidence",
  "generating_sequences",
  "retrieving_weather",
  "calculating",
  "complete",
] as const;
export const planFailures = [
  "STORED_REQUEST_INVALID",
  "CATALOG_EVIDENCE_INVALID",
  "WEATHER_UNAVAILABLE",
  "PLANNING_LIMIT_EXCEEDED",
  "RETRIES_EXHAUSTED",
  "QUEUE_TERMINAL_WITHOUT_RESULT",
  "WORKFLOW_VERSION_UNSUPPORTED",
  "CALCULATION_FAILED",
] as const;
export function Component() {
  const { id } = useParams();
  const { t } = useMessages();
  const valid = fieldIdParamsSchema.safeParse({ id });
  return valid.success ? (
    <Progress id={valid.data.id} />
  ) : (
    <section className="f5-page">
      <h1>{t("error.notFound")}</h1>
    </section>
  );
}
function Progress({ id }: { id: string }) {
  const client = useApi();
  const { scope, account } = useSession();
  const { capabilities } = useBoot();
  const offline = useOffline();
  const query = useQuery({
    ...planQuery(client, scope, id),
    enabled: !!capabilities.data?.plans && account !== undefined && !offline,
  });
  const { t } = useMessages();
  if (!capabilities.data)
    return (
      <section className="f5-page">
        <h1>{t("f5.progressTitle")}</h1>
        <p>{t("degraded.capabilities")}</p>
      </section>
    );
  if (!capabilities.data.plans)
    return (
      <section className="f5-page">
        <h1>{t("f5.progressTitle")}</h1>
        <p>{t("capability.plansOff")}</p>
      </section>
    );
  return (
    <section className="f5-page">
      <h1>{t("f5.progressTitle")}</h1>
      {offline && <p>{t("f5.offline")}</p>}
      {query.error && (
        <DataError
          error={query.error}
          retry={() => void query.refetch()}
          busy={query.isFetching}
        />
      )}
      {!query.data && !query.error && !offline && <Skeleton shape="row" />}
      {query.data &&
        (query.data.input.schema_version === "2" &&
        "stage" in query.data &&
        "versions" in query.data ? (
          <ProgressBody plan={query.data as RotationPlanningStatus} />
        ) : (
          <p>{t("f5.olderPlan")}</p>
        ))}
    </section>
  );
}
export function ProgressBody({ plan }: { plan: RotationPlanningStatus }) {
  const { t, language } = useMessages();
  const { glossary } = useBoot();
  const offline = useOffline();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (plan.status === "failed" || plan.status === "completed") return;
    const timer = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [plan.status]);
  const stageText = (stage: string) =>
    findTerm(glossary.data, stage, "status")?.term ??
    t(`f5.stage.${stage}` as MessageKey);
  const elapsed = Math.max(
    0,
    Math.floor(
      ((plan.status === "failed" || plan.status === "completed"
        ? Date.parse(plan.updatedAt)
        : now) -
        Date.parse(plan.createdAt)) /
        1000,
    ),
  );
  const back = plan.input.field_id ? `/fields/${plan.input.field_id}` : "/map";
  const code = plan.error?.code;
  return (
    <div className="f5-stack">
      <div role="status" aria-live="polite">
        <p>{stageText(plan.stage)}</p>
      </div>
      {plan.status !== "failed" && (
        <StepProgress
          steps={planStages.map(stageText)}
          current={planStages.indexOf(
            plan.stage as (typeof planStages)[number],
          )}
        />
      )}
      <p>{t("f5.elapsed", { seconds: elapsed })}</p>
      <p>{t("f5.retention", { date: timestamp(plan.expiresAt, language) })}</p>
      {plan.status === "failed" && code && (
        <section className="f5-stack" role="alert">
          <h2>{t("f5.failed")}</h2>
          <p>
            {findTerm(glossary.data, code, "error")?.meaning ??
              t(`f5.failure.${code}`)}
          </p>
          <p>
            {t(
              code === "WEATHER_UNAVAILABLE"
                ? "f5.weatherHelp"
                : code === "PLANNING_LIMIT_EXCEEDED"
                  ? "f5.limitHelp"
                  : "f5.failureHelp",
            )}
          </p>
          {plan.input.field_id ? (
            <Button
              variant="primary"
              onClick={() =>
                void navigate(
                  `/fields/${plan.input.field_id}/plan/new?retry=${plan.id}`,
                )
              }
            >
              {t("f5.editResend")}
            </Button>
          ) : (
            <p>{t("f5.noSavedField")}</p>
          )}
        </section>
      )}
      {plan.status === "completed" && (
        <section className="f5-stack">
          <h2>{t("f5.completed")}</h2>
          {plan.result?.synthetic && <p role="alert">{t("f5.testData")}</p>}
          <p>{t("f5.resultsBoundary")}</p>
          {plan.result && "strategies" in plan.result && (
            <details>
              <summary>{t("f5.applied")}</summary>
              <dl>
                {(
                  ["water", "soil_health", "climate", "crop_health"] as const
                ).map((dimension) => (
                  <div className="f5-row" key={dimension}>
                    <dt>{t(`f5.${dimension}`)}</dt>
                    <dd>
                      {number(
                        plan.result && "strategies" in plan.result
                          ? plan.result.strategies.priorities.applied[
                              dimension
                            ] * 100
                          : 0,
                        language,
                      )}{" "}
                      %
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          )}
          {plan.input.field_id && (
            <Button
              variant="primary"
              disabled={offline}
              onClick={() =>
                void navigate(
                  `/fields/${plan.input.field_id}/plan/new?retry=${plan.id}`,
                )
              }
            >
              {t("f5.adjustPriorities")}
            </Button>
          )}
        </section>
      )}
      <div className="f5-row">
        <Button onClick={() => void navigate(back)}>{t("f5.backField")}</Button>
        <Delete
          id={plan.id}
          back={back}
          disabled={offline}
          terminal={plan.status === "failed" || plan.status === "completed"}
        />
      </div>
    </div>
  );
}
function Delete({
  id,
  back,
  disabled,
  terminal,
}: {
  id: string;
  back: string;
  disabled: boolean;
  terminal: boolean;
}) {
  const { t, language } = useMessages();
  const { glossary } = useBoot();
  const client = useApi();
  const { scope } = useSession();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function remove() {
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    try {
      const { deletePlan } = await import("../../api/plans.js");
      await deletePlan(client, { params: { id }, signal: controller.signal });
      cache.removeQueries({ queryKey: keys.plan(scope, id) });
      await cache.invalidateQueries({ queryKey: ["private", scope] });
      if (!controller.signal.aborted) void navigate(back, { replace: true });
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <>
      <Button variant="ghost" disabled={disabled} onClick={() => setOpen(true)}>
        {t(terminal ? "f5.delete" : "f5.cancelDelete")}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!busy) setOpen(value);
        }}
        title={t("f5.deleteTitle")}
        description={t("f5.deleteBody")}
        body={
          error ? (
            <div role="alert">
              <p>{failureText(error, language, glossary.data)}</p>
              <RetryButton
                error={error}
                busy={busy}
                retry={() => void remove()}
              />
            </div>
          ) : null
        }
        actions={
          <>
            <Button disabled={busy} onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={disabled || !!error}
              loading={busy}
              onClick={() => void remove()}
            >
              {t("f5.delete")}
            </Button>
          </>
        }
      />
    </>
  );
}
