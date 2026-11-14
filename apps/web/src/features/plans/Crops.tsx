import { useMessages } from "../../i18n/messages.js";
import type { BuilderProps as Props } from "./builderProps.js";
import { lazy, Suspense, useState } from "react";
import { useBoot } from "../../app/providers/Runtime.js";
import { Button, SearchSelect } from "../../design/primitives/controls.js";
import { Dialog, Skeleton } from "../../design/primitives/feedback.js";
import { CropName, cropLabels } from "../../design/primitives/crops.js";
const CropPicker = lazy(() =>
  import("../crops/index.js").then((module) => ({
    default: module.CropPicker,
  })),
);
import { ShortList } from "../../shared/ShortList.js";
import { useCropNameMode } from "../../shared/cropNamePreference.js";
import { CropLabel } from "./CropLabel.js";
export function Crops({ input, onChange }: Props) {
  const { t } = useMessages();
  const { catalog } = useBoot();
  const [mode] = useCropNameMode();
  const [picking, setPicking] = useState<
    "considered_crop_ids" | "excluded_crop_ids" | null
  >(null);
  const p = input.preferences;
  return (
    <div id="f5-crops" className="f5-stack">
      <h2>{t("f5.crops")}</h2>
      <p>{t("f5.suggestHint")}</p>
      {(["considered_crop_ids", "excluded_crop_ids"] as const).map((name) => (
        <section key={name} className="f5-stack">
          <h3>{t(`f5.${name}`)}</h3>
          <ShortList
            items={p[name]}
            render={(id) => (
              <div className="f5-row">
                <CropLabel id={id} />
                <Button
                  size="small"
                  onClick={() =>
                    onChange({
                      ...input,
                      preferences: {
                        ...p,
                        [name]: p[name].filter((value) => value !== id),
                      },
                      cultivars: input.cultivars.filter(
                        (c) => c.crop_id !== id,
                      ),
                    })
                  }
                >
                  {t("remove")}
                </Button>
              </div>
            )}
          />
          <Button
            size="small"
            disabled={
              p[name].length >= (name === "considered_crop_ids" ? 20 : 50)
            }
            onClick={() => setPicking(name)}
          >
            {t(
              name === "considered_crop_ids"
                ? "f5.addConsidered"
                : "f5.addExcluded",
            )}
          </Button>
        </section>
      ))}
      <section id="f5-cultivars">
        <h3>{t("f5.varieties")}</h3>
        <ShortList
          items={p.considered_crop_ids.filter(
            (id) =>
              catalog.data?.crops.find((c) => c.id === id)?.cultivars.length,
          )}
          render={(id) => {
            const crop = catalog.data!.crops.find((c) => c.id === id)!;
            return (
              <>
                <CropLabel id={id} />
                <SearchSelect
                  label={t("f5.variety")}
                  value={
                    input.cultivars.find((c) => c.crop_id === id)
                      ?.cultivar_id ?? ""
                  }
                  options={[
                    { value: "", label: t("f5.option.unknown") },
                    ...crop.cultivars.map((c) => ({
                      value: c.id,
                      content: (
                        <CropName cropId={c.id} crop={c} nameMode={mode} />
                      ),
                      label: cropLabels(c, mode)
                        .map((n) => n.name)
                        .join(" · "),
                    })),
                  ]}
                  onChange={(value) =>
                    onChange({
                      ...input,
                      cultivars: [
                        ...input.cultivars.filter((c) => c.crop_id !== id),
                        ...(value ? [{ crop_id: id, cultivar_id: value }] : []),
                      ],
                    })
                  }
                />
              </>
            );
          }}
        />
      </section>
      {picking && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPicking(null);
          }}
          title={t(`f5.${picking}`)}
          body={
            <Suspense fallback={<Skeleton shape="row" />}>
              <CropPicker
                label={t("crops.search")}
                recent={
                  input.history.status === "known"
                    ? input.history.entries.map((e) => e.crop_id)
                    : []
                }
                onChange={(id) => {
                  const other =
                    picking === "considered_crop_ids"
                      ? "excluded_crop_ids"
                      : "considered_crop_ids";
                  onChange({
                    ...input,
                    cultivars:
                      picking === "excluded_crop_ids"
                        ? input.cultivars.filter((c) => c.crop_id !== id)
                        : input.cultivars,
                    preferences: {
                      ...p,
                      [picking]: [...new Set([...p[picking], id])],
                      [other]: p[other].filter((c) => c !== id),
                    },
                  });
                  setPicking(null);
                }}
              />
            </Suspense>
          }
        />
      )}
    </div>
  );
}
