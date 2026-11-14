import type { CropHistoryEntry } from "@rotavise/contracts";
import { useBoot } from "../../../app/providers/Runtime.js";
import { useMessages } from "../../../i18n/messages.js";
import {
  SearchSelect,
  DateField,
} from "../../../design/primitives/controls.js";
import { CropName, cropLabels } from "../../../design/primitives/crops.js";
import { normalizeCropSearch } from "../../crops/names.js";
export { normalizeCropSearch };
export function LastCrop({
  value,
  onChange,
  disabled,
}: {
  value: Partial<CropHistoryEntry>;
  onChange: (value: Partial<CropHistoryEntry>) => void;
  disabled: boolean;
}) {
  const { catalog } = useBoot(),
    { t, language } = useMessages();
  const crop = catalog.data?.crops.find((c) => c.id === value.crop_id);
  return (
    <div className="f3-last-crop">
      {!catalog.data && (
        <p>{t(catalog.isPending ? "loading" : "boot.catalogUnavailable")}</p>
      )}
      <SearchSelect
        label={t("create.lastCrop")}
        value={value.crop_id ?? ""}
        normalizeSearch={normalizeCropSearch}
        disabled={disabled || !catalog.data}
        onChange={(crop_id) => onChange({ ...value, crop_id })}
        options={(catalog.data?.crops ?? []).map((c) => ({
          value: c.id,
          content: <CropName cropId={c.id} crop={c} nameMode={language} />,
          label:
            cropLabels(c, language)
              .map((n) => n.name)
              .join(" · ") + (c.scientificName ? ` · ${c.scientificName}` : ""),
        }))}
      />
      {crop && <CropName cropId={crop.id} crop={crop} nameMode={language} />}
      <DateField
        label={t("create.planted")}
        value={value.planted_on ?? ""}
        disabled={disabled}
        min="1900-01-01"
        max="2100-12-31"
        onChange={(e) => onChange({ ...value, planted_on: e.target.value })}
      />
      <DateField
        label={t("create.harvested")}
        value={value.harvested_on ?? ""}
        disabled={disabled}
        min="1900-01-01"
        max="2100-12-31"
        onChange={(e) => onChange({ ...value, harvested_on: e.target.value })}
      />
    </div>
  );
}
