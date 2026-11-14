import { useQuery } from "@tanstack/react-query";
import {
  useApi,
  useOffline,
  useSession,
} from "../../../app/providers/Runtime.js";
import { keys } from "../../../api/keys.js";
import { useMessages, type MessageKey } from "../../../i18n/messages.js";
import { number } from "../../../i18n/format.js";
import { ShortList } from "../../../shared/ShortList.js";
import { DataError } from "../../../shared/DataError.js";
import { useFieldPlans } from "./FieldPlans.js";

export default function SoilEstimate({ fieldId }: { fieldId: string }) {
  const { t, language } = useMessages();
  const client = useApi();
  const { scope } = useSession();
  const offline = useOffline();
  const plans = useFieldPlans(fieldId);
  const completed = plans.data?.find((plan) => plan.status === "completed");
  const plan = useQuery({
    queryKey: keys.plan(scope, completed?.id ?? ""),
    enabled: !!completed && !offline,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const { getPlan } = await import("../../../api/plans.js");
      return getPlan(client, { params: { id: completed!.id }, signal });
    },
  });
  const result =
    plan.data?.status === "completed" && "result" in plan.data
      ? plan.data.result
      : undefined;
  const estimate =
    result && "soilEstimate" in result ? result.soilEstimate : undefined;
  return (
    <>
      {plans.error ? (
        <DataError
          error={plans.error}
          retry={() => void plans.refetch()}
          busy={plans.isFetching}
        />
      ) : plan.error ? (
        <DataError
          error={plan.error}
          retry={() => void plan.refetch()}
          busy={plan.isFetching}
        />
      ) : plans.isFetching || plan.isFetching ? (
        <p>{t("loading")}</p>
      ) : estimate ? (
        <>
          <p>{t("inputs.estimateHelp")}</p>
          <ShortList
            items={soilValues(estimate)}
            render={([label, value, unit]) => (
              <>
                {t(label)} ·{" "}
                {value === null
                  ? t("f4.noData")
                  : `${number(value, language)} ${unit}`}
              </>
            )}
          />
          <p>{estimate.attribution}</p>
        </>
      ) : (
        <p>
          {t(
            offline && !plans.data
              ? "f4.offline"
              : completed
                ? "f4.noData"
                : "inputs.estimateLater",
          )}
        </p>
      )}
    </>
  );
}

function soilValues(
  estimate: import("@rotavise/contracts").SoilEstimate,
): [MessageKey, number | null, string][] {
  return [
    ["inputs.metric.ph", estimate.phWater, "pH"],
    ["inputs.clay", estimate.clayPercent, "%"],
    ["inputs.sand", estimate.sandPercent, "%"],
    ["inputs.silt", estimate.siltPercent, "%"],
    ["inputs.organicCarbon", estimate.organicCarbonGPerKg, "g/kg"],
    ["inputs.bulkDensity", estimate.bulkDensityGPerCm3, "g/cm³"],
    ["inputs.cationExchange", estimate.cationExchangeCmolPerKg, "cmol/kg"],
    ["inputs.nitrogen", estimate.nitrogenGPerKg, "g/kg"],
  ];
}
