import { lazy, Suspense, useRef, useState } from "react";
import type { CropHistoryEntry } from "@rotavise/contracts";
import { useBoot, useOffline } from "../../../app/providers/Runtime.js";
import { Button } from "../../../design/primitives/controls.js";
import {
  CropName,
  CropStrip,
  type CropSlot,
} from "../../../design/primitives/crops.js";
import { Skeleton } from "../../../design/primitives/feedback.js";
import { calendarDate } from "../../../i18n/format.js";
import { useMessages } from "../../../i18n/messages.js";
import { ShortList } from "../../../shared/ShortList.js";
import { useCropNameMode } from "../../../shared/cropNamePreference.js";
import { DataError } from "../../../shared/DataError.js";
import { useHistory, type HistoryRecord } from "./fieldData.js";

const SeasonDialog = lazy(() => import("./SeasonDialog.js"));
const day = 86400000;
export function History({ id }: { id: string }) {
  const { t, language } = useMessages();
  const { catalog } = useBoot();
  const offline = useOffline();
  const [nameMode] = useCropNameMode();
  const history = useHistory(id);
  const items = history.data ?? [];
  const [editing, setEditing] = useState<HistoryRecord | null>();
  const focus = useRef<HTMLElement | null>(null);
  const add = useRef<HTMLDivElement>(null);
  function open(item: HistoryRecord | null, trigger: HTMLElement) {
    focus.current = trigger;
    setEditing(item);
  }
  function restore() {
    const target = focus.current?.isConnected
      ? focus.current
      : add.current?.querySelector("button");
    target?.focus();
  }
  const crops = new Map(catalog.data?.crops.map((crop) => [crop.id, crop]));
  const range = (entry: CropHistoryEntry) =>
    t("f4.range", {
      start: calendarDate(entry.planted_on, language),
      end: calendarDate(entry.harvested_on, language),
    });
  const slots: CropSlot[] = [];
  let previousEnd: number | undefined;
  for (const { id: slot, entry } of items.slice(-4)) {
    const start = Date.parse(entry.planted_on),
      end = Date.parse(entry.harvested_on);
    if (previousEnd !== undefined && start - previousEnd > day)
      slots.push({
        id: `gap-${slot}`,
        duration: (start - previousEnd) / day - 1,
        label: t("history.gap"),
        inert: true,
      });
    previousEnd = Math.max(previousEnd ?? end, end);
    const crop = crops.get(entry.crop_id);
    slots.push({
      id: slot,
      cropId: entry.crop_id,
      ...(crop ? { crop } : {}),
      duration: (end - start) / day + 1,
      title: range(entry),
    });
  }
  return (
    <section className="f4-stack" aria-label={t("f4.history")}>
      <div className="f4-section-heading">
        <h3>{t("f4.history")}</h3>
        <div ref={add}>
          <Button
            size="small"
            variant="primary"
            disabled={offline || !history.data || !catalog.data}
            onClick={(event) => open(null, event.currentTarget)}
          >
            {t("history.add")}
          </Button>
        </div>
      </div>
      {offline && <p>{t("f4.offline")}</p>}
      {catalog.isError && !catalog.data && (
        <DataError
          error={catalog.error}
          busy={catalog.isFetching}
          retry={() => void catalog.refetch()}
        />
      )}
      {history.isFetching && !history.data && <Skeleton shape="row" />}
      {history.error && (
        <DataError
          error={history.error}
          busy={history.isFetching}
          retry={() => void history.refetch()}
        />
      )}
      {history.data &&
        (!items.length ? (
          <p>{t("history.empty")}</p>
        ) : (
          <>
            <CropStrip
              slots={slots}
              label={t("history.strip")}
              nameMode={nameMode}
              interactive={!offline}
              onSelect={(slot, trigger) => {
                const item = items.find((record) => record.id === slot);
                if (item) open(item, trigger);
              }}
            />
            <ShortList
              items={[...items].reverse()}
              render={(item) => {
                const crop = crops.get(item.entry.crop_id);
                return (
                  <Button
                    disabled={offline}
                    size="small"
                    className="f4-history-row"
                    variant="ghost"
                    onClick={(event) => open(item, event.currentTarget)}
                  >
                    <CropName
                      cropId={item.entry.crop_id}
                      {...(crop ? { crop } : {})}
                      nameMode={nameMode}
                      compact
                    />
                    <small>{range(item.entry)}</small>
                  </Button>
                );
              }}
            />
          </>
        ))}
      {editing !== undefined && (
        <Suspense fallback={<Skeleton shape="row" />}>
          <SeasonDialog
            id={id}
            item={editing}
            items={items}
            restoreFocus={restore}
            onClose={() => {
              setEditing(undefined);
              requestAnimationFrame(restore);
            }}
          />
        </Suspense>
      )}
    </section>
  );
}
