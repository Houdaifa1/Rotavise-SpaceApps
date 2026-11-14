import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useBoot } from "../../app/providers/Runtime.js";
import { Select } from "../../design/primitives/controls.js";
import {
  CropName,
  cropLabels,
  type CatalogueCrop,
} from "../../design/primitives/crops.js";
import { Skeleton } from "../../design/primitives/feedback.js";
import { Icon } from "../../design/icons/index.js";
import { useMessages } from "../../i18n/messages.js";
import { cropColor } from "../../shared/cropColor.js";
import { RetryButton } from "../../shared/RetryButton.js";
import { cropMatches } from "./names.js";
import { useCropNameMode } from "../../shared/cropNamePreference.js";
import "./crops.css";

const rowHeight = 86;
const visibleRows = 4;
const viewportHeight = rowHeight * visibleRows;
const noRecent: string[] = [];

export function CropNameSetting() {
  const { t } = useMessages();
  const [nameMode, setNameMode] = useCropNameMode();
  return (
    <Select
      label={t("crops.nameLanguage")}
      value={nameMode}
      onChange={setNameMode}
      options={[
        { value: "fr", label: "Français" },
        { value: "en", label: "English" },
        { value: "ar", label: "العربية" },
        { value: "ary", label: "Darija" },
        { value: "all", label: t("crops.allNames") },
      ]}
    />
  );
}

export function CropPicker({
  value,
  onChange,
  recent = noRecent,
  label,
  disabled = false,
}: {
  value?: string | undefined;
  onChange: (id: string) => void;
  recent?: string[];
  label: string;
  disabled?: boolean;
}) {
  const { catalog } = useBoot();
  const { language, t } = useMessages();
  const [nameMode] = useCropNameMode();
  const id = useId();
  const viewport = useRef<HTMLDivElement>(null);
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("");
  const [offset, setOffset] = useState(0);
  const [active, setActive] = useState(-1);
  const { families, rows } = useMemo(() => {
    const crops = catalog.data?.crops ?? [];
    const compare = new Intl.Collator(language, { sensitivity: "base" })
      .compare;
    const order = new Map(recent.map((crop, index) => [crop, index]));
    const rank = (crop: CatalogueCrop) => order.get(crop.id) ?? recent.length;
    return {
      families: [...new Set(crops.map((crop) => crop.family))].sort(compare),
      rows: crops
        .filter(
          (crop) =>
            (!family || crop.family === family) && cropMatches(crop, search),
        )
        .sort(
          (a, b) =>
            rank(a) - rank(b) ||
            compare(
              cropLabels(a, nameMode)[0]!.name,
              cropLabels(b, nameMode)[0]!.name,
            ),
        ),
    };
  }, [catalog.data, family, language, nameMode, recent, search]);
  const first = Math.max(
    0,
    Math.min(rows.length - visibleRows, Math.floor(offset / rowHeight)),
  );
  const last = Math.min(rows.length, first + visibleRows + 1);
  function reset() {
    setActive(-1);
    setOffset(0);
    if (viewport.current) viewport.current.scrollTop = 0;
  }
  function move(next: number) {
    const index = Math.max(0, Math.min(rows.length - 1, next));
    setActive(index);
    const node = viewport.current;
    if (!node) return;
    const top = index * rowHeight;
    if (top < node.scrollTop) node.scrollTop = top;
    else if (top + rowHeight > node.scrollTop + node.clientHeight)
      node.scrollTop = top + rowHeight - node.clientHeight;
    setOffset(node.scrollTop);
  }
  function navigateResults(event: KeyboardEvent) {
    if (!rows.length || disabled) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      move(active + (event.key === "ArrowDown" ? 1 : -1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const crop = rows[active];
      if (crop) onChange(crop.id);
    }
  }
  if (!catalog.data)
    return catalog.isPending ? (
      <Skeleton shape="row" />
    ) : (
      <div role="status">
        <p>{t("boot.catalogUnavailable")}</p>
        <RetryButton
          error={catalog.error}
          busy={catalog.isFetching}
          retry={() => void catalog.refetch()}
        />
      </div>
    );
  const selected = catalog.data.crops.find((crop) => crop.id === value);
  return (
    <div className="f4-crop-picker">
      <div className="f4-crop-filters">
        <CropNameSetting />
        <Select
          label={t("crops.family")}
          value={family}
          onChange={(next) => {
            setFamily(next);
            reset();
          }}
          options={[
            { value: "", label: t("crops.allFamilies") },
            ...families.map((name) => ({ value: name, label: name })),
          ]}
        />
      </div>
      {value && (
        <p className="f4-picked">
          <Icon name="check" />{" "}
          <CropName
            cropId={value}
            {...(selected ? { crop: selected } : {})}
            nameMode={nameMode}
          />
        </p>
      )}
      <label htmlFor={`${id}-search`}>{label}</label>
      <div className="f4-crop-search">
        <Icon name="search" />
        <input
          id={`${id}-search`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={rows.length > 0}
          aria-controls={`${id}-options`}
          aria-activedescendant={
            active >= first && active < last ? `${id}-row-${active}` : undefined
          }
          disabled={disabled}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            reset();
          }}
          onKeyDown={navigateResults}
        />
      </div>
      <div
        id={`${id}-options`}
        role="listbox"
        aria-label={label}
        hidden={!rows.length}
        className="f4-crop-results"
        ref={viewport}
        tabIndex={disabled ? -1 : 0}
        aria-activedescendant={
          active >= first && active < last ? `${id}-row-${active}` : undefined
        }
        style={{ maxHeight: viewportHeight }}
        onScroll={(event) => setOffset(event.currentTarget.scrollTop)}
        onKeyDown={navigateResults}
      >
        <div style={{ height: rows.length * rowHeight, position: "relative" }}>
          {rows.slice(first, last).map((crop, position) => {
            const index = first + position;
            return (
              <div
                key={crop.id}
                id={`${id}-row-${index}`}
                role="option"
                aria-selected={value === crop.id}
                aria-posinset={index + 1}
                aria-setsize={rows.length}
                aria-disabled={disabled || undefined}
                data-active={index === active}
                className="f4-crop-row"
                style={{ top: index * rowHeight, height: rowHeight }}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  if (!disabled) {
                    setActive(index);
                    onChange(crop.id);
                  }
                }}
              >
                <i
                  aria-hidden="true"
                  style={{ background: cropColor(crop.id, crop.family) }}
                />
                <span>
                  <CropName cropId={crop.id} crop={crop} nameMode={nameMode} />
                  <small>
                    <i>{crop.scientificName}</i> · {crop.family} ·{" "}
                    {t("crops.varietyCount", {
                      count: crop.cultivars.length,
                    })}
                  </small>
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {!rows.length && <p role="status">{t("emptySearch")}</p>}
    </div>
  );
}
