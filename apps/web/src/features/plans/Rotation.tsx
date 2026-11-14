import { useMessages } from "../../i18n/messages.js";
import type { BuilderProps as Props } from "./builderProps.js";
import { lazy, Suspense, useState } from "react";
import { Button } from "../../design/primitives/controls.js";
import { Dialog, Skeleton } from "../../design/primitives/feedback.js";
const CropPicker = lazy(() =>
  import("../crops/index.js").then((module) => ({
    default: module.CropPicker,
  })),
);
import { CropLabel } from "./CropLabel.js";
import { CropStrip } from "../../design/primitives/crops.js";
import { useBoot } from "../../app/providers/Runtime.js";
import { useCropNameMode } from "../../shared/cropNamePreference.js";
export function Rotation({ input, onChange }: Props) {
  const { t } = useMessages();
  const [picking, setPicking] = useState(false);
  const { catalog } = useBoot();
  const [nameMode] = useCropNameMode();
  const ids = input.current_rotation?.crop_ids ?? [];
  const recent =
    input.history.status === "known"
      ? [...new Set(input.history.entries.map((e) => e.crop_id))].slice(-6)
      : [];
  function update(crop_ids: string[]) {
    const rest = { ...input };
    delete rest.current_rotation;
    onChange({
      ...rest,
      ...(crop_ids.length ? { current_rotation: { crop_ids } } : {}),
    });
  }
  function move(index: number, delta: number) {
    const next = [...ids];
    [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
    update(next);
  }
  return (
    <div id="f5-rotation" className="f5-stack">
      <h2>{t("f5.rotation")}</h2>
      <p>{t("f5.rotationHint")}</p>
      {!!ids.length && (
        <CropStrip
          label={t("f5.rotation")}
          nameMode={nameMode}
          slots={ids.map((cropId, index) => {
            const crop = catalog.data?.crops.find((crop) => crop.id === cropId);
            return { id: String(index), cropId, ...(crop ? { crop } : {}) };
          })}
        />
      )}
      {ids.length ? (
        <ol className="f5-rotation-list">
          {ids.map((id, index) => (
            <li key={index}>
              <CropLabel id={id} />
              <div className="f5-row">
                <Button
                  size="small"
                  disabled={!index}
                  onClick={() => move(index, -1)}
                >
                  {t("f5.moveEarlier")}
                </Button>
                <Button
                  size="small"
                  disabled={index === ids.length - 1}
                  onClick={() => move(index, 1)}
                >
                  {t("f5.moveLater")}
                </Button>
                <Button
                  size="small"
                  onClick={() => update(ids.filter((_, i) => i !== index))}
                >
                  {t("remove")}
                </Button>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p>{t("f5.inferRotation")}</p>
      )}
      <Button disabled={ids.length >= 6} onClick={() => setPicking(true)}>
        {t("f5.addRotation")}
      </Button>
      <Button disabled={!recent.length} onClick={() => update(recent)}>
        {t("f5.useHistory")}
      </Button>
      <Button onClick={() => update([])}>{t("f5.noRotation")}</Button>
      {picking && (
        <Dialog
          open
          onOpenChange={setPicking}
          title={t("f5.addRotation")}
          body={
            <Suspense fallback={<Skeleton shape="row" />}>
              <CropPicker
                label={t("crops.search")}
                recent={recent}
                onChange={(id) => {
                  update([...ids, id]);
                  setPicking(false);
                }}
              />
            </Suspense>
          }
        />
      )}
    </div>
  );
}
