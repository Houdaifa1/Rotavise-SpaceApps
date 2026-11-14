import { lazy, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useApi,
  useBoot,
  useOffline,
  useSession,
} from "../../../app/providers/Runtime.js";
import { getCanopyBiomass, getWaterStorage } from "../../../api/analysis.js";
import { keys, stale } from "../../../api/keys.js";
import { Skeleton } from "../../../design/primitives/feedback.js";
import { useMessages } from "../../../i18n/messages.js";
import { findTerm } from "../../../shared/glossaryText.js";
import { DataError } from "../../../shared/DataError.js";

const Analysis = lazy(() => import("./NasaAnalysis.js"));
export default function NasaRegional({
  id,
  evidence,
}: {
  id: string;
  evidence: boolean;
}) {
  const { t } = useMessages();
  const client = useApi();
  const { scope } = useSession();
  const { glossary } = useBoot();
  const offline = useOffline();
  const grace = useQuery({
    queryKey: keys.analysis(scope, id, "water-storage"),
    enabled: !offline,
    staleTime: stale.analysis,
    queryFn: ({ signal }) =>
      getWaterStorage(client, { params: { id }, signal }),
  });
  const gedi = useQuery({
    queryKey: keys.analysis(scope, id, "canopy-biomass"),
    enabled: !offline,
    staleTime: stale.analysis,
    queryFn: ({ signal }) =>
      getCanopyBiomass(client, { params: { id }, signal }),
  });
  return (
    <div className="f4-stack">
      {(
        [
          ["grace", grace],
          ["gedi", gedi],
        ] as const
      ).map(([kind, query]) => (
        <div key={kind} className="f4-stack">
          <strong>{t(`nasa.${kind}`)}</strong>
          {!query.data && query.isFetching && <Skeleton shape="row" />}
          {query.error && (
            <DataError
              error={query.error}
              busy={query.isFetching || offline}
              retry={() => void query.refetch()}
            />
          )}
          {query.data &&
            (query.data.available ? (
              <>
                <p>{t("nasa.complete")}</p>
                {evidence && (
                  <Suspense fallback={<Skeleton shape="row" />}>
                    <Analysis id={id} result={query.data.result} />
                  </Suspense>
                )}
              </>
            ) : (
              <p>
                {findTerm(glossary.data, query.data.reason, "reason_code")
                  ?.meaning ?? t("f4.noData")}
              </p>
            ))}
        </div>
      ))}
    </div>
  );
}
