import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ExtractionKind,
  ExtractionStatus,
  ObservationKind,
  ObservationStatus,
} from "@rotavise/contracts";
import {
  useApi,
  useBoot,
  useOffline,
  useSession,
} from "../../../app/providers/Runtime.js";
import {
  getObservation,
  listObservations,
  requestObservation,
} from "../../../api/observations.js";
import {
  getExtraction,
  listExtractions,
  requestExtraction,
} from "../../../api/extractions.js";
import { keys, nasaInterval, stale } from "../../../api/keys.js";
import { Button } from "../../../design/primitives/controls.js";
import { Skeleton } from "../../../design/primitives/feedback.js";
import { useMessages } from "../../../i18n/messages.js";
import { timestamp } from "../../../i18n/format.js";
import { findTerm } from "../../../shared/glossaryText.js";
import { DataError } from "../../../shared/DataError.js";

const Regional = lazy(() => import("./NasaRegional.js"));
const Analysis = lazy(() => import("./NasaAnalysis.js"));
type Job = ObservationStatus | ExtractionStatus;
type Kind = Job["kind"];
const observations = ["hls", "gpm", "smap"] as const;
const waiting = (job?: Job) =>
  job?.status === "queued" || job?.status === "submitted";
const isObservation = (kind: Kind): kind is ObservationKind =>
  observations.some((item) => item === kind);
const needsOutline = (kind: Kind) => kind !== "gpm" && kind !== "smap";

export function Nasa({
  id,
  outline,
  evidence,
}: {
  id: string;
  outline: boolean | undefined;
  evidence: boolean;
}) {
  const client = useApi();
  const { scope } = useSession();
  const { capabilities } = useBoot();
  const { t } = useMessages();
  const offline = useOffline();
  const enabled = capabilities.data?.observations === true;
  const [regionalOpen, setRegionalOpen] = useState(false);
  const observed = useQuery({
    queryKey: keys.nasaJobs(scope, id, "observation"),
    enabled: enabled && !offline,
    queryFn: ({ signal }) =>
      listObservations(client, { params: { id }, signal }),
  });
  const extracted = useQuery({
    queryKey: keys.nasaJobs(scope, id, "extraction"),
    enabled: enabled && !offline,
    queryFn: ({ signal }) =>
      listExtractions(client, { params: { id }, signal }),
  });
  return (
    <section className="f4-stack" aria-label={t("nasa.title")}>
      <h3>{t("nasa.title")}</h3>
      {!enabled && <p>{t("capability.observationsOff")}</p>}
      {offline && <p>{t("f4.offline")}</p>}
      {enabled && (
        <>
          <p>{t("nasa.limit")}</p>
          {((observed.isFetching && !observed.data) ||
            (extracted.isFetching && !extracted.data)) && (
            <Skeleton shape="row" />
          )}
          {observed.error && (
            <DataError
              error={observed.error}
              busy={observed.isFetching}
              retry={() => void observed.refetch()}
            />
          )}
          {extracted.error && (
            <DataError
              error={extracted.error}
              busy={extracted.isFetching}
              retry={() => void extracted.refetch()}
            />
          )}
          <ul className="f4-nasa-jobs">
            {(
              ["hls", "modis", "gpm", "smap", "terrain", "ecostress"] as const
            ).map((kind) => {
              const list = isObservation(kind) ? observed.data : extracted.data;
              const unavailable = isObservation(kind)
                ? observed.isError
                : extracted.isError;
              return (
                list && (
                  <JobRow
                    key={kind}
                    id={id}
                    kind={kind}
                    outline={outline}
                    evidence={evidence}
                    listError={unavailable}
                    listed={list.items.find((item) => item.kind === kind)}
                  />
                )
              );
            })}
          </ul>
        </>
      )}
      <details onToggle={(event) => setRegionalOpen(event.currentTarget.open)}>
        <summary className="f4-evidence-summary">{t("nasa.regional")}</summary>
        {regionalOpen && (
          <Suspense fallback={<Skeleton shape="row" />}>
            <Regional id={id} evidence={evidence} />
          </Suspense>
        )}
      </details>
    </section>
  );
}
function JobRow({
  id,
  kind,
  listed,
  outline,
  evidence,
  listError,
}: {
  id: string;
  kind: Kind;
  listed: Job | undefined;
  outline: boolean | undefined;
  evidence: boolean;
  listError: boolean;
}) {
  const client = useApi();
  const { scope } = useSession();
  const { glossary } = useBoot();
  const { t, language } = useMessages();
  const offline = useOffline();
  const cache = useQueryClient();
  const observation = isObservation(kind);
  const listKey = keys.nasaJobs(
    scope,
    id,
    observation ? "observation" : "extraction",
  );
  const [error, setError] = useState<unknown>();
  const [sending, setSending] = useState(false);
  const request = useRef<AbortController | undefined>(undefined);
  const jobId = listed?.id ?? "";
  const jobKey = (idOfJob: string) =>
    observation
      ? keys.observation(scope, id, idOfJob)
      : keys.extraction(scope, id, idOfJob);
  const status = useQuery<Job>({
    queryKey: jobKey(jobId),
    queryFn: ({ signal }) =>
      observation
        ? getObservation(client, {
            params: { id, observationId: jobId },
            signal,
          })
        : getExtraction(client, {
            params: { id, extractionId: jobId },
            signal,
          }),
    enabled: !!jobId && !offline && (waiting(listed) || evidence),
    staleTime: (query) =>
      waiting(query.state.data ?? listed) ? 0 : stale.analysis,
    refetchOnWindowFocus: (query) =>
      waiting(query.state.data ?? listed) ? "always" : false,
    refetchInterval: (query) => {
      const job = query.state.data ?? listed;
      return nasaInterval(job?.status, job?.createdAt);
    },
    refetchIntervalInBackground: false,
  });
  const fresh =
    status.data && (!listed || status.data.updatedAt >= listed.updatedAt)
      ? status.data
      : undefined;
  const job = fresh ?? listed;
  useEffect(() => () => request.current?.abort(), []);
  async function ask() {
    if (
      request.current ||
      offline ||
      listError ||
      (needsOutline(kind) && !outline)
    )
      return;
    const controller = new AbortController();
    request.current = controller;
    setSending(true);
    setError(undefined);
    try {
      await cache.cancelQueries({ queryKey: listKey });
      const params = { id },
        signal = controller.signal;
      const next = isObservation(kind)
        ? await requestObservation(client, { params, signal, body: { kind } })
        : await requestExtraction(client, {
            params,
            signal,
            body: { kind: kind as ExtractionKind },
          });
      cache.setQueryData(jobKey(next.id), next);
      cache.setQueryData<{ items: Job[] }>(listKey, (data) => ({
        items: [
          next,
          ...(data?.items.filter(({ id }) => id !== next.id) ?? []),
        ],
      }));
    } catch (failure) {
      if (!controller.signal.aborted) setError(failure);
    } finally {
      request.current = undefined;
      if (!controller.signal.aborted) setSending(false);
    }
  }
  const pending = waiting(job);
  const title = t(`nasa.${kind}`);
  const failed = job?.status === "failed";
  const ready = job?.status === "completed";
  const state =
    ready && job.completedAt
      ? t("nasa.ready", { date: timestamp(job.completedAt, language) })
      : pending && job
        ? t("nasa.waiting", { date: timestamp(job.createdAt, language) })
        : failed
          ? (findTerm(glossary.data, job.error?.code ?? "", "error")?.meaning ??
            t("nasa.failed"))
          : ready
            ? t("nasa.complete")
            : t("nasa.notAsked");
  const action = t(pending ? "nasa.check" : failed ? "retry" : "nasa.ask");
  const disabled =
    offline ||
    (pending
      ? status.isFetching
      : listError || (needsOutline(kind) && !outline));
  return (
    <li className="f4-nasa-row">
      <div className="f4-section-heading">
        <div>
          <strong>{title}</strong>
          <p role="status">{state}</p>
        </div>
        {!ready && error === undefined && (
          <Button
            size="small"
            disabled={disabled}
            loading={sending}
            onClick={() => void (pending ? status.refetch() : ask())}
            aria-label={`${action} · ${title}`}
          >
            {action}
          </Button>
        )}
      </div>
      {pending && <p>{t("nasa.waitHelp")}</p>}
      {!job && needsOutline(kind) && outline === false && (
        <p>{t("nasa.outline")}</p>
      )}
      {error !== undefined && (
        <DataError
          error={error}
          busy={sending || offline}
          retry={() => void ask()}
        />
      )}
      {status.error && (
        <DataError
          error={status.error}
          busy={status.isFetching || offline}
          retry={() => void status.refetch()}
        />
      )}
      {evidence && ready && job.result && (
        <Suspense fallback={<Skeleton shape="row" />}>
          <Analysis id={id} result={job.result} />
        </Suspense>
      )}
      {evidence && ready && !job.result && <p>{t("f4.noData")}</p>}
    </li>
  );
}
