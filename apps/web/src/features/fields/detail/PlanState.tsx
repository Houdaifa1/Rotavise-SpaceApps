import { useBoot } from "../../../app/providers/Runtime.js";
import { Chip } from "../../../design/primitives/feedback.js";
import { useMessages } from "../../../i18n/messages.js";
import type { PlanSummary } from "../useFieldWorkspace.js";

export function PlanState({ plan }: { plan: PlanSummary }) {
  const { glossary } = useBoot();
  const { t } = useMessages();
  return (
    <Chip
      icon="rotation"
      text={
        glossary.data?.entries.find(
          ({ group, code }) => group === "status" && code === plan.status,
        )?.term ?? t("field.planUnknown")
      }
    />
  );
}
