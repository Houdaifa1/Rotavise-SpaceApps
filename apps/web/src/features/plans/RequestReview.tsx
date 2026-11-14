import type { BuilderInput } from "./builder.js";
import { CropLabel } from "./CropLabel.js";
import { ShortList } from "../../shared/ShortList.js";
import { useMessages } from "../../i18n/messages.js";
import { dimensions } from "../priorities/dimensions.js";
export function RequestReview({ input }: { input: BuilderInput }) {
  const { t } = useMessages();
  return (
    <div className="f5-stack">
      <details>
        <summary>{t("f5.crops")}</summary>
        <div className="f5-stack">
          <h3>{t("f5.considered_crop_ids")}</h3>
          <ShortList
            items={input.preferences.considered_crop_ids}
            render={(id) => <CropLabel id={id} />}
          />
          {!input.preferences.considered_crop_ids.length && (
            <p>{t("f5.suggestHint")}</p>
          )}
          <h3>{t("f5.excluded_crop_ids")}</h3>
          <ShortList
            items={input.preferences.excluded_crop_ids}
            render={(id) => <CropLabel id={id} />}
          />
        </div>
      </details>
      <details>
        <summary>{t("f5.rotation")}</summary>
        <div className="f5-stack">
          {input.current_rotation ? (
            <ShortList
              items={input.current_rotation.crop_ids}
              render={(id) => <CropLabel id={id} />}
            />
          ) : (
            <p>{t("f5.inferRotation")}</p>
          )}
        </div>
      </details>
      <details open>
        <summary>{t("f5.priorities")}</summary>
        <dl>
          {dimensions.map((dimension) => (
            <div className="f5-row" key={dimension}>
              <dt>{t(`f5.${dimension}`)}</dt>
              <dd>
                {input.preferences.priorities[dimension]} {t("f5.priorityUnit")}
              </dd>
            </div>
          ))}
          {input.preferences.income_weight !== undefined && (
            <div className="f5-row">
              <dt>{t("f5.income")}</dt>
              <dd>
                {input.preferences.income_weight} {t("f5.priorityUnit")}
              </dd>
            </div>
          )}
        </dl>
      </details>
    </div>
  );
}
