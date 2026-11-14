import { useMessages } from "../../i18n/messages.js";
import { Icon } from "../icons/index.js";
export function StepProgress({
  steps,
  current,
}: {
  steps: string[];
  current?: number;
}) {
  const { t } = useMessages();
  return (
    <ol className="rv-step-progress" aria-label={t("progress")}>
      {steps.map((step, i) => (
        <li key={step} aria-current={i === current ? "step" : undefined}>
          <span className="rv-step-dot" aria-hidden="true">
            {current !== undefined && i < current ? (
              <Icon name="check" />
            ) : (
              i + 1
            )}
          </span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  );
}
