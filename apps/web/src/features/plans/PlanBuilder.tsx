import { StepProgress } from "../../design/primitives/progress.js";
import "./messages.js";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  fieldIdParamsSchema,
  planRequestV2Schema,
  type PriorityWeights,
} from "@rotavise/contracts";
import {
  useApi,
  useBoot,
  useOffline,
  useSession,
} from "../../app/providers/Runtime.js";
import { getField } from "../../api/fields.js";
import { keys, stale } from "../../api/keys.js";
import { ApiFailure } from "../../app/http.js";
import { failureText } from "../../api/errors.js";
import { Button } from "../../design/primitives/controls.js";
import { Skeleton } from "../../design/primitives/feedback.js";
import { useMessages } from "../../i18n/messages.js";
import { calendarDate } from "../../i18n/format.js";
import { DataError } from "../../shared/DataError.js";
import { useHistory } from "../fields/planning.js";
import {
  buildPlanRequest,
  fieldPlanInput,
  refreshSavedInputs,
  fromFailedPlan,
  newDraft,
  readDraft,
  saveDraft,
  sessionStorageOrUndefined,
  submissionFor,
  type BuilderDraft,
  type BuilderInput,
} from "./builder.js";
import { intakeDateIssues, issueMessage, issueTarget } from "./validation.js";
import { When } from "./When.js";
const RequestReview = lazy(() =>
  import("./BuilderSteps.js").then((module) => ({
    default: module.RequestReview,
  })),
);
const Crops = lazy(() =>
  import("./BuilderSteps.js").then((module) => ({ default: module.Crops })),
);
const Rotation = lazy(() =>
  import("./BuilderSteps.js").then((module) => ({ default: module.Rotation })),
);
const CheckInputs = lazy(() =>
  import("./CheckInputs.js").then((module) => ({
    default: module.CheckInputs,
  })),
);
import "./plans.css";

export const stepKeys = [
  "f5.when",
  "f5.crops",
  "f5.rotation",
  "f5.check",
  "f5.review",
] as const;
export function Component() {
  const { id } = useParams();
  const valid = fieldIdParamsSchema.safeParse({ id });
  const { t } = useMessages();
  if (!valid.success)
    return (
      <section className="f5-page">
        <h1>{t("error.notFound")}</h1>
      </section>
    );
  return <LoadBuilder id={valid.data.id} />;
}
function LoadBuilder({ id }: { id: string }) {
  const client = useApi();
  const { scope, account } = useSession();
  const offline = useOffline();
  const { catalog, capabilities } = useBoot();
  const { t } = useMessages();
  const [search] = useSearchParams();
  const retryId = search.get("retry");
  const validRetry = fieldIdParamsSchema.safeParse({ id: retryId });
  const canRead =
    account !== undefined && !offline && capabilities.data?.plans === true;
  const field = useQuery({
    queryKey: keys.field(scope, id),
    enabled: canRead,
    queryFn: ({ signal }) => getField(client, { params: { id }, signal }),
    staleTime: stale.field,
  });
  const history = useHistory(id, canRead);
  const failed = useQuery({
    queryKey: keys.plan(scope, retryId ?? ""),
    queryFn: async ({ signal }) => {
      const { getPlan } = await import("../../api/plans.js");
      return getPlan(client, { params: { id: retryId! }, signal });
    },
    enabled: validRetry.success && canRead,
  });
  if (!capabilities.data)
    return (
      <section className="f5-page">
        <h1>{t("f5.title")}</h1>
        <p>{t("degraded.capabilities")}</p>
      </section>
    );
  if (!capabilities.data.plans)
    return (
      <section className="f5-page">
        <h1>{t("f5.title")}</h1>
        <p>{t("capability.plansOff")}</p>
      </section>
    );
  if (!catalog.data && catalog.isError)
    return (
      <section className="f5-page">
        <h1>{t("f5.title")}</h1>
        <p>{t("boot.catalogUnavailable")}</p>
        <DataError
          error={catalog.error}
          retry={() => void catalog.refetch()}
          busy={catalog.isFetching}
        />
      </section>
    );
  const error =
    field.error ?? history.error ?? (validRetry.success ? failed.error : null);
  if (error)
    return (
      <section className="f5-page">
        <h1>{t("f5.title")}</h1>
        <DataError
          error={error}
          busy={field.isFetching || history.isFetching || failed.isFetching}
          retry={() => {
            void field.refetch();
            void history.refetch();
            if (validRetry.success) void failed.refetch();
          }}
        />
      </section>
    );
  if (!field.data || !history.data || (validRetry.success && !failed.data))
    return (
      <section className="f5-page" aria-busy="true">
        <h1>{t("f5.title")}</h1>
        <Skeleton shape="row" />
      </section>
    );
  const retry =
    failed.data && "input" in failed.data
      ? planRequestV2Schema.safeParse(failed.data.input)
      : null;
  if (
    retryId &&
    (!validRetry.success || !retry?.success || retry.data.field_id !== id)
  )
    return (
      <section className="f5-page">
        <h1>{t("error.notFound")}</h1>
      </section>
    );
  const saved = fieldPlanInput(
    field.data,
    history.data.map((row) => row.entry),
    new Date().toISOString().slice(0, 10),
  );
  const stored = readDraft(sessionStorageOrUndefined(), id);
  const initial = retry?.success
    ? stored?.retryPlanId === retryId
      ? stored
      : fromFailedPlan(retry.data, retryId!)
    : stored
      ? refreshSavedInputs(stored, saved)
      : newDraft(saved);
  if (initial.step > 0 && !catalog.data)
    return (
      <section className="f5-page" aria-busy="true">
        <h1>{t("f5.title")}</h1>
        <Skeleton shape="row" />
      </section>
    );
  const applied =
    failed.data?.result && "strategies" in failed.data.result
      ? failed.data.result.strategies.priorities.applied
      : undefined;
  return (
    <Builder
      key={`${id}:${scope}:${retryId ?? ""}`}
      name={field.data.profile.name}
      initial={initial}
      {...(applied ? { applied } : {})}
    />
  );
}
function Builder({
  name,
  initial,
  applied,
}: {
  name: string;
  initial: BuilderDraft;
  applied?: PriorityWeights;
}) {
  const [draft, setDraft] = useState(initial);
  const [storageFailed, setStorageFailed] = useState(false);
  const [error, setError] = useState<unknown>();
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [correction, setCorrection] =
    useState<ReturnType<typeof issueTarget>>();
  const client = useApi();
  const offline = useOffline();
  const { glossary, catalog } = useBoot();
  const { t, language } = useMessages();
  const navigate = useNavigate();
  const pending = useRef<AbortController | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const id = draft.input.field_id!;
  const parsed = planRequestV2Schema.safeParse(buildPlanRequest(draft.input));
  const issues = [
    ...(parsed.success ? [] : parsed.error.issues),
    ...intakeDateIssues(draft.input, new Date().toISOString().slice(0, 10)),
  ];
  const currentIssues = issues.filter(
    (issue) => issueTarget(issue).step === draft.step,
  );
  const unanswered =
    draft.input.history.status === "known" && !draft.historyAnswered;
  const stepError = currentIssues[0];
  useEffect(() => {
    setStorageFailed(!saveDraft(sessionStorageOrUndefined(), id, draft));
  }, [id, draft]);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    if (content.current) content.current.scrollTop = 0;
  }, [draft.step]);
  useEffect(() => {
    if (wait > 0) {
      const timer = setTimeout(() => setWait(wait - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [wait]);
  function change(input: BuilderInput) {
    setDraft((old) => ({ ...old, input, submission: null }));
    setError(undefined);
  }
  function go(step: number, control?: string, row?: number) {
    setDraft((old) => ({ ...old, step }));
    setCorrection(control ? { step, control, row } : undefined);
    if (control)
      requestAnimationFrame(() =>
        document
          .getElementById(`f5-${control}`)
          ?.scrollIntoView({ block: "start" }),
      );
  }
  async function send() {
    if (
      !parsed.success ||
      issues.length ||
      unanswered ||
      busy ||
      offline ||
      wait
    )
      return;
    const submission = submissionFor(draft, () => crypto.randomUUID());
    const next = { ...draft, submission };
    setDraft(next);
    saveDraft(sessionStorageOrUndefined(), id, next);
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError(undefined);
    try {
      const { submitPlan } = await import("../../api/plans.js");
      const accepted = await submitPlan(client, {
        body: parsed.data,
        idempotencyKey: submission.key,
        signal: controller.signal,
      });
      // Keep field-specific edits for another comparison, but never reuse the
      // accepted request's key on the next deliberate submission.
      setDraft({ ...next, submission: null });
      saveDraft(sessionStorageOrUndefined(), id, { ...next, submission: null });
      if (!controller.signal.aborted)
        void navigate(`/plans/${accepted.id}`, { replace: true });
    } catch (failure) {
      if (controller.signal.aborted) return;
      setError(failure);
      if (failure instanceof ApiFailure) {
        setWait(
          failure.retryAfterSeconds ??
            ([502, 503, 504].includes(failure.status) ? 5 : 0),
        );
        if (failure.code === "IDEMPOTENCY_CONFLICT")
          setDraft((old) => ({ ...old, submission: null }));
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section className="f5-page" aria-busy={busy || undefined}>
      <header>
        <p>{name}</p>
        <h1 ref={heading} tabIndex={-1}>
          {t("f5.title")}
        </h1>
        <StepProgress
          steps={stepKeys.map((key) => t(key))}
          current={draft.step}
        />
      </header>
      <div className="f5-content" ref={content}>
        {catalog.isPending && <p role="status">{t("f5.catalogLoading")}</p>}
        {storageFailed && <p role="status">{t("f5.storageUnavailable")}</p>}
        <Suspense fallback={<Skeleton shape="row" />}>
          {draft.step === 0 && (
            <When
              input={draft.input}
              onChange={change}
              {...(stepError ? { error: t(issueMessage(stepError)) } : {})}
            />
          )}
          {draft.step === 1 && <Crops input={draft.input} onChange={change} />}
          {draft.step === 2 && (
            <Rotation input={draft.input} onChange={change} />
          )}
          {draft.step === 3 && (
            <CheckInputs
              input={draft.input}
              onChange={change}
              answered={draft.historyAnswered}
              {...(applied ? { applied } : {})}
              {...(correction ? { correction } : {})}
              onAnswer={() =>
                setDraft((old) => ({ ...old, historyAnswered: true }))
              }
              {...(stepError && issueTarget(stepError).control === "priorities"
                ? { error: t(issueMessage(stepError)) }
                : {})}
            />
          )}
          {draft.step === 4 && (
            <div className="f5-stack">
              <h2>{t("f5.review")}</h2>
              {parsed.success && (
                <p>
                  {t("f5.reviewSentence", {
                    years: parsed.data.planning.horizon_years,
                    start: calendarDate(
                      parsed.data.planning.earliest_start_date,
                      language,
                    ),
                    end: calendarDate(
                      parsed.data.planning.latest_start_date,
                      language,
                    ),
                  })}
                </p>
              )}
              <RequestReview input={draft.input} />
              <p>{t("f5.reviewCaveat")}</p>
              <nav className="f5-review-links" aria-label={t("f5.editReview")}>
                {stepKeys.slice(0, 4).map((key, index) => (
                  <Button key={key} onClick={() => go(index)}>
                    {t(key)}
                  </Button>
                ))}
              </nav>
              <p role="status">
                {t(
                  parsed.success && !issues.length && !unanswered
                    ? "f5.valid"
                    : "f5.invalid",
                )}
              </p>
              {issues.length > 0 && (
                <ul>
                  {issues.slice(0, 7).map((issue, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        className="f5-error-link"
                        onClick={() => {
                          const target = issueTarget(issue);
                          go(target.step, target.control, target.row);
                        }}
                      >
                        {t(issueMessage(issue))}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {unanswered && (
                <Button onClick={() => go(3, "history")}>
                  {t("f5.answerHistory")}
                </Button>
              )}
            </div>
          )}
        </Suspense>
        {stepError && draft.step !== 0 && (
          <p className="rv-error-text" role="alert">
            {t(issueMessage(stepError))}
          </p>
        )}
        {unanswered && draft.step === 3 && (
          <p role="status">{t("f5.answerHistory")}</p>
        )}
        {!!error && (
          <p role="alert">
            {error instanceof ApiFailure &&
            error.code === "IDEMPOTENCY_CONFLICT"
              ? t("f5.idempotencyConflict")
              : failureText(error, language, glossary.data)}
          </p>
        )}
        {wait > 0 && <p role="status">{t("error.wait", { seconds: wait })}</p>}
        {offline && <p role="status">{t("f5.offline")}</p>}
      </div>
      <footer className="f5-footer">
        <Button disabled={busy} onClick={() => void navigate(`/fields/${id}`)}>
          {t("common.cancel")}
        </Button>
        <div className="f5-row">
          {draft.step > 0 && (
            <Button disabled={busy} onClick={() => go(draft.step - 1)}>
              {t("back")}
            </Button>
          )}
          <Button
            variant="primary"
            loading={busy}
            disabled={
              !catalog.data ||
              (draft.step === 4
                ? !parsed.success ||
                  issues.length > 0 ||
                  unanswered ||
                  offline ||
                  wait > 0
                : currentIssues.length > 0 || (draft.step === 3 && unanswered))
            }
            onClick={() =>
              draft.step === 4 ? void send() : go(draft.step + 1)
            }
          >
            {t(draft.step === 4 ? "f5.send" : "next")}
          </Button>
        </div>
      </footer>
    </section>
  );
}
