import { useId, useState, type ReactNode } from "react";
import { useMessages } from "../../i18n/messages.js";
import { number } from "../../i18n/format.js";
import { Button } from "./controls.js";
import { Icon } from "../icons/index.js";

export function Hatch({ id }: { id: string }) {
  return (
    <defs>
      <pattern id={id} width="6" height="6" patternUnits="userSpaceOnUse">
        <path
          d="M-1 1 1-1M0 6 6 0m-1 7 2-2"
          stroke="var(--ink-hint)"
          strokeWidth="1"
        />
      </pattern>
    </defs>
  );
}
export function RangeBar({
  min,
  max,
  domain,
  unit,
  label,
}: {
  min: number | null;
  max: number | null;
  domain: [number, number];
  unit: string;
  label: string;
}) {
  const { t, language } = useMessages();
  const id = useId().replace(/:/g, "");
  const valid =
    min !== null &&
    max !== null &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    domain[1] > domain[0] &&
    max >= min;
  const position = (v: number) =>
    Math.max(
      0,
      Math.min(100, ((v - domain[0]) / (domain[1] - domain[0])) * 100),
    );
  return (
    <div className="rv-range">
      <div className="rv-data-label">
        <span>{label}</span>
        <span className="rv-numeric">
          {valid
            ? `${number(min, language)}${max === min ? "" : `–${number(max, language)}`} ${unit}`
            : t("noData")}
        </span>
      </div>
      <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
        <Hatch id={id} />
        <rect
          width="100"
          height="8"
          rx="3"
          fill={valid ? "var(--app-bg)" : `url(#${id})`}
        />
        {valid &&
          (min === max ? (
            <rect
              x={position(min) - 0.7}
              width="1.4"
              height="8"
              fill="var(--water)"
            />
          ) : (
            <rect
              x={position(min)}
              width={position(max) - position(min)}
              height="8"
              rx="3"
              fill="var(--water)"
            />
          ))}
      </svg>
    </div>
  );
}
export function ScoreBar({
  loss,
  label,
}: {
  loss: number | null;
  label: string;
}) {
  const { t } = useMessages();
  const valid =
    loss !== null && Number.isFinite(loss) && loss >= 0 && loss <= 1;
  return (
    <div className="rv-score">
      <RangeBar
        min={valid ? 0 : null}
        max={valid ? Math.round(loss * 100) : null}
        domain={[0, 100]}
        label={label}
        unit="points"
      />
      <small>{t(valid ? "lowerBetter" : "notCompared")}</small>
    </div>
  );
}
export function StatCard({
  value,
  label,
  caption,
}: {
  value: string;
  label: string;
  caption: string;
}) {
  return (
    <div className="rv-stat">
      <span>{label}</span>
      <strong className="rv-numeric">{value}</strong>
      <small>{caption}</small>
    </div>
  );
}
export type Column<T> = {
  key: keyof T & string;
  label: string;
  render?: (row: T) => ReactNode;
  compare?: (a: T, b: T) => number;
};
export function DataTable<T extends { id: string }>({
  columns,
  rows,
  label,
}: {
  columns: Column<T>[];
  rows: T[];
  label: string;
}) {
  const { t } = useMessages();
  const [sort, setSort] = useState<{ key: string; direction: 1 | -1 }>();
  const [page, setPage] = useState(0);
  const sorted = [...rows];
  const column = columns.find((c) => c.key === sort?.key);
  if (column?.compare && sort)
    sorted.sort((a, b) => column.compare!(a, b) * sort.direction);
  const pages = Math.max(1, Math.ceil(rows.length / 7));
  const effectivePage = Math.min(page, pages - 1);
  return (
    <div className="rv-table-wrap">
      <table className="rv-table">
        <caption>{label}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                aria-sort={
                  sort?.key === c.key
                    ? sort.direction === 1
                      ? "ascending"
                      : "descending"
                    : undefined
                }
              >
                {c.compare ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSort({
                        key: c.key,
                        direction:
                          sort?.key === c.key && sort.direction === 1 ? -1 : 1,
                      });
                      setPage(0);
                    }}
                  >
                    {c.label}
                    <Icon name="sort" />
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            sorted
              .slice(effectivePage * 7, effectivePage * 7 + 7)
              .map((row) => (
                <tr key={row.id}>
                  {columns.map((c) => (
                    <td key={c.key}>
                      {c.render ? c.render(row) : String(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))
          ) : (
            <tr>
              <td colSpan={columns.length}>{t("noData")}</td>
            </tr>
          )}
        </tbody>
      </table>
      {pages > 1 && (
        <div className="rv-row">
          <Button
            disabled={effectivePage === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("previous")}
          </Button>
          <Button
            disabled={effectivePage + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("more")}
          </Button>
        </div>
      )}
    </div>
  );
}
