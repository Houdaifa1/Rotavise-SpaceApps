import { Slider } from "../../design/primitives/selection.js";
import { type FarmerContext, type PriorityWeights } from "@rotavise/contracts";
import { Select, Button } from "../../design/primitives/controls.js";
import { GlossaryTerm } from "../glossary/GlossaryTerm.js";
import { useMessages, type MessageKey } from "../../i18n/messages.js";
import type { BuilderInput } from "../plans/builder.js";
import { dimensions } from "./dimensions.js";
import { number } from "../../i18n/format.js";
export function Priorities({
  input,
  onChange,
  error,
  applied,
}: {
  input: BuilderInput;
  onChange: (input: BuilderInput) => void;
  error?: string;
  applied?: PriorityWeights;
}) {
  const { t, language } = useMessages();
  const preferences = input.preferences;
  const context: FarmerContext = input.farmer_context ?? {
    equipment: "unknown",
    market_preference: "unknown",
    forage_need: "none",
    erosion_concern: "unknown",
  };
  const options = (values: readonly string[]) =>
    values.map((value) => ({
      value,
      label: t(`f5.option.${value}` as MessageKey),
    }));
  return (
    <section
      id="f5-priorities"
      className="f5-stack"
      aria-labelledby="f5-priorities-title"
    >
      <h3 id="f5-priorities-title">{t("f5.priorities")}</h3>
      <p>{t("f5.priorityMeaning")}</p>
      {dimensions.map((dimension) => (
        <div key={dimension}>
          <Slider
            label={t(`f5.${dimension}`)}
            {...(error ? { error } : {})}
            value={preferences.priorities[dimension]}
            onChange={(value) =>
              onChange({
                ...input,
                preferences: {
                  ...preferences,
                  priorities: { ...preferences.priorities, [dimension]: value },
                },
              })
            }
            unit={t("f5.priorityUnit")}
          />
          <small>{t(`f5.meaning.${dimension}`)}</small>{" "}
          <GlossaryTerm group="score" code={dimension} />
        </div>
      ))}
      {error && (
        <p className="rv-error-text" role="alert">
          {error}
        </p>
      )}
      {applied && (
        <p>
          {t("f5.applied")}
          {": "}
          {dimensions
            .map(
              (dimension) =>
                `${t(`f5.${dimension}`)} ${number(applied[dimension] * 100, language)} %`,
            )
            .join(" · ")}
        </p>
      )}
      <details>
        <summary>{t("f5.incomeEquipment")}</summary>
        <div className="f5-stack">
          <p>{t("f5.incomeGap")}</p>
          <Slider
            label={t("f5.income")}
            value={preferences.income_weight ?? 0}
            unit={t("f5.priorityUnit")}
            onChange={(income_weight) =>
              onChange({
                ...input,
                preferences: { ...preferences, income_weight },
              })
            }
          />
          <p>
            {t(
              preferences.income_weight === undefined
                ? "f5.incomeUntouched"
                : "f5.incomeIncluded",
            )}
          </p>
          {preferences.income_weight !== undefined && (
            <Button
              size="small"
              onClick={() => {
                const rest = { ...preferences };
                delete rest.income_weight;
                onChange({ ...input, preferences: rest });
              }}
            >
              {t("f5.omitIncome")}
            </Button>
          )}
          <Select
            label={t("f5.mechanisation")}
            value={preferences.equipment_limits?.mechanisation ?? ""}
            options={[
              { value: "", label: t("f5.option.unknown") },
              ...options(["none", "small", "medium", "large"]),
            ]}
            onChange={(value) => {
              const rest = { ...preferences };
              delete rest.equipment_limits;
              const operations =
                preferences.equipment_limits?.unavailable_operations;
              onChange({
                ...input,
                preferences: {
                  ...rest,
                  ...(value || operations
                    ? {
                        equipment_limits: {
                          ...(operations
                            ? { unavailable_operations: operations }
                            : {}),
                          ...(value
                            ? {
                                mechanisation: value as
                                  "none" | "small" | "medium" | "large",
                              }
                            : {}),
                        },
                      }
                    : {}),
                },
              });
            }}
          />
          <Select
            label={t("f5.marketAccess")}
            value={preferences.market_access ?? ""}
            options={[
              { value: "", label: t("f5.option.unknown") },
              ...options(["none", "local", "regional", "export"]),
            ]}
            onChange={(value) => {
              const rest = { ...preferences };
              delete rest.market_access;
              onChange({
                ...input,
                preferences: {
                  ...rest,
                  ...(value
                    ? {
                        market_access: value as
                          "none" | "local" | "regional" | "export",
                      }
                    : {}),
                },
              });
            }}
          />
        </div>
      </details>
      <details>
        <summary>{t("f5.context")}</summary>
        <div className="f5-stack">
          <p>{t("f5.contextMeaning")}</p>
          {(
            [
              ["equipment", ["unknown", "limited", "standard"]],
              [
                "market_preference",
                ["unknown", "household_food", "cash_income", "livestock_feed"],
              ],
              ["forage_need", ["none", "some", "high"]],
              ["erosion_concern", ["unknown", "low", "moderate", "high"]],
            ] as const
          ).map(([name, values]) => (
            <Select
              key={name}
              label={t(`f5.context.${name}`)}
              value={context[name]}
              options={options(values)}
              onChange={(value) =>
                onChange({
                  ...input,
                  farmer_context: { ...context, [name]: value },
                })
              }
            />
          ))}
        </div>
      </details>
    </section>
  );
}
