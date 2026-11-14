import { SegmentedControl } from "../../design/primitives/segments.js";
import { useMessages } from "../../i18n/messages.js";
import type { BuilderProps as Props } from "./builderProps.js";
import { DateField } from "../../design/primitives/controls.js";
export function When({ input, onChange, error }: Props & { error?: string }) {
  const { t } = useMessages();
  return (
    <div id="f5-dates" className="f5-stack">
      <h2>{t("f5.when")}</h2>
      <SegmentedControl
        label={t("f5.horizon")}
        value={String(input.planning.horizon_years)}
        options={[3, 4, 5].map((years) => ({
          value: String(years),
          label: t("crops.years", { count: years }),
        }))}
        onChange={(value) =>
          onChange({
            ...input,
            planning: { ...input.planning, horizon_years: Number(value) },
          })
        }
      />
      <p>{t("f5.dateHint")}</p>
      <DateField
        label={t("f5.earliest")}
        value={input.planning.earliest_start_date}
        min="1900-01-01"
        max="2100-12-31"
        {...(error ? { error } : {})}
        onChange={(e) =>
          onChange({
            ...input,
            planning: {
              ...input.planning,
              earliest_start_date: e.target.value,
            },
          })
        }
      />
      <DateField
        label={t("f5.latest")}
        value={input.planning.latest_start_date}
        min="1900-01-01"
        max="2100-12-31"
        {...(error ? { error } : {})}
        onChange={(e) =>
          onChange({
            ...input,
            planning: { ...input.planning, latest_start_date: e.target.value },
          })
        }
      />
    </div>
  );
}
