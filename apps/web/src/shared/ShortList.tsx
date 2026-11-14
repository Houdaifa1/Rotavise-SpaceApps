import { useState, type ReactNode } from "react";
import { Button } from "../design/primitives/controls.js";
import { useMessages } from "../i18n/messages.js";

export function ShortList<T>({
  items,
  render,
  initialPage = 0,
}: {
  items: readonly T[];
  render: (item: T, index: number) => ReactNode;
  initialPage?: number;
}) {
  const { t } = useMessages();
  const [page, setPage] = useState(initialPage);
  const size = 7;
  const current = Math.min(
    page,
    Math.max(0, Math.ceil(items.length / size) - 1),
  );
  if (!items.length) return <p>{t("f4.noData")}</p>;
  return (
    <>
      <ul className="f4-short-list">
        {items
          .slice(current * size, (current + 1) * size)
          .map((item, index) => (
            <li key={current * size + index}>
              {render(item, current * size + index)}
            </li>
          ))}
      </ul>
      {(current > 0 || items.length > size) && (
        <div className="f4-actions">
          <Button
            size="small"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
          >
            {t("previous")}
          </Button>
          <Button
            size="small"
            disabled={(current + 1) * size >= items.length}
            onClick={() => setPage(current + 1)}
          >
            {t("next")}
          </Button>
        </div>
      )}
    </>
  );
}
