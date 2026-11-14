import { useNavigate } from "react-router";
import { useId, type ReactNode, type Ref } from "react";
import { Icon } from "../../design/icons/index.js";
import { Button, IconButton } from "../../design/primitives/controls.js";
import {
  Chip,
  Popover,
  ReminderBar,
  Skeleton,
} from "../../design/primitives/feedback.js";
import { useMessages, type MessageKey } from "../../i18n/messages.js";
import { quantity } from "../../i18n/format.js";
import { useBoot, useSession } from "../../app/providers/Runtime.js";
export { DataError } from "../../shared/DataError.js";
import type { MappedField, PlanSummary } from "./useFieldWorkspace.js";

export type FieldSort = "recent" | "name" | "area";
export const rowsPerPage = 7;
const modes = [
  "field.tap",
  "field.paint",
  "field.draw",
  "field.upload",
  "field.pin",
] as const;

export function AddField({ secondary = false }: { secondary?: boolean }) {
  const { t } = useMessages();
  const { capabilities } = useBoot();
  const navigate = useNavigate();
  const modeNames = ["tap", "paint", "draw", "upload", "pin"];
  return (
    <Popover
      title={t("field.add")}
      trigger={
        <Button variant={secondary ? "secondary" : "primary"} size="small">
          <Icon name="field-add" /> {t("field.add")}
        </Button>
      }
    >
      <ul className="f2-mode-list">
        {modes
          .filter(
            (key) =>
              key !== "field.tap" ||
              capabilities.data?.fieldBoundaries.available,
          )
          .map((key) => (
            <li key={key}>
              <button
                type="button"
                className="f3-mode-button"
                onClick={() =>
                  void navigate(
                    `/fields/new?mode=${modeNames[modes.indexOf(key)]}`,
                  )
                }
              >
                <Icon
                  name={
                    key === "field.upload"
                      ? "upload"
                      : key === "field.pin"
                        ? "locate"
                        : "fields"
                  }
                />
                <span>{t(key)}</span>
              </button>
            </li>
          ))}
        {!capabilities.data?.fieldBoundaries.available && (
          <li>
            <small>{t("field.detectionOff")}</small>
          </li>
        )}
      </ul>
    </Popover>
  );
}

export function Thumbnail({
  boundary,
}: {
  boundary:
    | { boundary: NonNullable<MappedField["boundary"]>["boundary"] }
    | null
    | undefined;
}) {
  const ring = boundary?.boundary.coordinates[0];
  if (!ring)
    return (
      <span className="f2-thumbnail" aria-hidden="true">
        <Icon name="locate" />
      </span>
    );
  const xs = ring.map(([x]) => x);
  const ys = ring.map(([, y]) => y);
  const left = Math.min(...xs);
  const top = Math.max(...ys);
  const longitudeScale = Math.cos((top * Math.PI) / 180);
  const width = (Math.max(...xs) - left) * longitudeScale;
  const height = top - Math.min(...ys);
  const scale = 26 / Math.max(width, height);
  const points = ring
    .map(([x, y]) =>
      [
        20 + ((x - left) * longitudeScale - width / 2) * scale,
        20 + (top - y - height / 2) * scale,
      ].join(","),
    )
    .join(" ");
  return (
    <span className="f2-thumbnail">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <polygon points={points} />
      </svg>
    </span>
  );
}

function Area({ boundary }: Pick<MappedField, "boundary">) {
  const { language, t } = useMessages();
  if (boundary === undefined) return null;
  if (!boundary) return t("field.noOutline");
  return t("field.areaValue", {
    area: quantity(boundary.hectares, "ha", language),
  });
}

function LatestPlan({ plan }: { plan: PlanSummary | undefined }) {
  const { t } = useMessages();
  const { glossary } = useBoot();
  if (!plan) return null;
  const state = glossary.data?.entries.find(
    ({ code, group }) => group === "status" && code === plan.status,
  )?.term;
  return (
    <Chip
      text={
        state
          ? t("field.planStatus", { status: state })
          : t("field.planUnknown")
      }
      icon="rotation"
    />
  );
}

export function FieldList({
  rows,
  plans,
  selected,
  onSelect,
  onHide,
  searchRef,
  search,
  onSearch,
  sort,
  onSort,
  offline,
  unavailable,
  waiting,
  blank,
  footer,
  problem,
  reminder,
}: {
  rows: MappedField[];
  plans: Record<string, PlanSummary> | undefined;
  selected: string | undefined;
  onSelect: (id: string) => void;
  onHide: () => void;
  searchRef: Ref<HTMLInputElement>;
  search: string;
  onSearch: (value: string) => void;
  sort: FieldSort;
  onSort: (value: FieldSort) => void;
  offline: boolean;
  unavailable: boolean;
  waiting: boolean;
  blank: boolean;
  footer: ReactNode;
  problem?: ReactNode;
  reminder: boolean;
}) {
  const { t } = useMessages();
  const { account } = useSession();
  const heading = useId();
  const sortKeys: Record<FieldSort, MessageKey> = {
    recent: "field.sortRecent",
    name: "field.sortName",
    area: "field.sortArea",
  };
  return (
    <aside className="f2-panel f2-field-list" aria-labelledby={heading}>
      <header className="f2-panel-heading">
        <div>
          <h2 id={heading}>{t("field.mine")}</h2>
          <p>{account?.name ?? t("shell.guest")}</p>
        </div>
        <IconButton
          className="f2-desktop-hide"
          icon="chevron-left"
          label={t("shell.closePanel")}
          variant="ghost"
          onClick={onHide}
        />
      </header>
      <div className="f2-panel-body">
        {!unavailable && (
          <div className="f2-list-tools">
            <label className="f2-search-input">
              <Icon name="search" />
              <input
                ref={searchRef}
                type="search"
                aria-label={t("map.search")}
                placeholder={t("search")}
                value={search}
                onChange={(event) => onSearch(event.target.value)}
              />
            </label>
            <Popover
              title={t("field.sort")}
              trigger={
                <button type="button" className="f2-sort">
                  <Icon name="sort" />
                  {t("field.sort")}
                </button>
              }
            >
              <fieldset className="f2-sort-options">
                <legend className="rv-sr">{t("field.sort")}</legend>
                {(["recent", "name", "area"] as const).map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="field-sort"
                      checked={sort === value}
                      onChange={() => onSort(value)}
                    />
                    {t(sortKeys[value])}
                  </label>
                ))}
              </fieldset>
            </Popover>
          </div>
        )}
        {unavailable && <p>{t("capability.plansOff")}</p>}
        {offline && (
          <p role="status">
            {t(
              rows.length || blank
                ? "field.offlineCached"
                : "field.offlineEmpty",
            )}
          </p>
        )}
        {problem}
        {waiting && (
          <div
            className="f2-list-skeleton"
            role="status"
            aria-label={t("field.loading")}
          >
            <Skeleton shape="row" />
            <Skeleton shape="row" />
            <Skeleton shape="row" />
          </div>
        )}
        {blank && !offline && (
          <div className="f2-empty">
            <Icon name="field-add" />
            <h2>{t("field.emptyTitle")}</h2>
            <p>{t("field.emptyText")}</p>
            <AddField secondary={!!selected} />
          </div>
        )}
        {!!rows.length && (
          <ul className="f2-field-rows">
            {rows.map(({ field, boundary }) => (
              <li key={field.id}>
                <button
                  type="button"
                  className="f2-field-row"
                  aria-current={selected === field.id ? "true" : undefined}
                  onClick={() => onSelect(field.id)}
                >
                  <Thumbnail boundary={boundary} />
                  <span className="f2-row-text">
                    <strong>{field.profile.name}</strong>
                    <span>
                      <Area boundary={boundary} />
                    </span>
                    <LatestPlan plan={plans?.[field.id]} />
                  </span>
                  <Icon name="chevron-right" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {!rows.length && search && !blank && !unavailable && !waiting && (
          <p role="status">{t("emptySearch")}</p>
        )}
        {footer}
      </div>
      {!unavailable && !blank && !offline && !waiting && (
        <div className="f2-panel-action">
          <AddField secondary={!!selected} />
        </div>
      )}
      {reminder && <ReminderBar text={t("shell.reminder")} />}
    </aside>
  );
}
