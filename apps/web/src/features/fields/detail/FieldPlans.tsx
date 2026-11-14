import { Button } from "../../../design/primitives/controls.js";
import { useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  useApi,
  useOffline,
  useSession,
} from "../../../app/providers/Runtime.js";
import { ApiFailure } from "../../../app/http.js";
import { keys, stale } from "../../../api/keys.js";
import { Skeleton } from "../../../design/primitives/feedback.js";
import { timestamp } from "../../../i18n/format.js";
import { useMessages } from "../../../i18n/messages.js";
import { ShortList } from "../../../shared/ShortList.js";
import { PlanState } from "./PlanState.js";
import { DataError } from "../../../shared/DataError.js";
import type { PlanSummary } from "../useFieldWorkspace.js";

export function useFieldPlans(id: string) {
  const client = useApi();
  const { scope } = useSession();
  const offline = useOffline();
  return useQuery({
    queryKey: keys.fieldPlans(scope, id),
    enabled: !offline,
    staleTime: stale.field,
    queryFn: async ({ signal }) => {
      const { listPlans } = await import("../../../api/plans.js");
      const items = new Map<string, PlanSummary>();
      const seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const page = await listPlans(client, {
          query: { limit: 50, ...(cursor ? { cursor } : {}) },
          signal,
        });
        for (const plan of page.items)
          if (plan.fieldId === id) items.set(plan.id, plan);
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
          throw new ApiFailure(0, "INVALID_SERVER_RESPONSE");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return [...items.values()];
    },
  });
}
export function FieldPlans({ id }: { id: string }) {
  const { t, language } = useMessages();
  const offline = useOffline();
  const plans = useFieldPlans(id);
  const navigate = useNavigate();
  return (
    <section className="f4-stack">
      <h3>{t("f4.plans")}</h3>
      <Button
        disabled={offline}
        onClick={() => void navigate(`/fields/${id}/plan/new`)}
      >
        {t("f4.newComparison")}
      </Button>
      {offline && <p>{t("f4.offline")}</p>}
      {plans.isFetching && !plans.data && <Skeleton shape="row" />}
      {plans.error && (
        <DataError
          error={plans.error}
          retry={() => void plans.refetch()}
          busy={plans.isFetching}
        />
      )}
      {plans.data &&
        (plans.data.length ? (
          <>
            <ShortList
              items={plans.data}
              render={(plan) => (
                <details>
                  <summary className="f4-evidence-summary">
                    {plan.label || timestamp(plan.createdAt, language)} ·{" "}
                    <PlanState plan={plan} />
                  </summary>
                  <p>
                    {t("f4.planDate", {
                      date: timestamp(plan.createdAt, language),
                    })}
                  </p>
                  {plan.horizonYears && (
                    <p>{t("crops.years", { count: plan.horizonYears })}</p>
                  )}
                  <Button onClick={() => void navigate(`/plans/${plan.id}`)}>
                    {t("details")}
                  </Button>
                </details>
              )}
            />
          </>
        ) : (
          <p>{t("f4.noPlans")}</p>
        ))}
    </section>
  );
}
