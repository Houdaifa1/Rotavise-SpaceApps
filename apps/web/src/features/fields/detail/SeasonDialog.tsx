import { lazy, Suspense, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  cropHistoryEntrySchema,
  type CropHistoryEntry,
} from "@rotavise/contracts";
import { useApi, useBoot, useSession } from "../../../app/providers/Runtime.js";
import {
  createFieldHistoryEntry,
  deleteFieldHistoryEntry,
  updateFieldHistoryEntry,
} from "../../../api/history.js";
import { keys } from "../../../api/keys.js";
import {
  Button,
  DateField,
  Select,
} from "../../../design/primitives/controls.js";
import { cropLabels } from "../../../design/primitives/crops.js";
import { useMessages } from "../../../i18n/messages.js";
import { useCropNameMode } from "../../../shared/cropNamePreference.js";
import { overlaps, readHistory, type HistoryRecord } from "./fieldData.js";
import { EditDialog, EditValidation } from "./EditDialog.js";

const CropPicker = lazy(() =>
  import("../../crops/index.js").then(({ CropPicker }) => ({
    default: CropPicker,
  })),
);

export default function SeasonDialog({
  id,
  item,
  items,
  onClose,
  restoreFocus,
}: {
  id: string;
  item: HistoryRecord | null;
  items: HistoryRecord[];
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const { t } = useMessages();
  const client = useApi();
  const { catalog } = useBoot();
  const { scope } = useSession();
  const [nameMode] = useCropNameMode();
  const cache = useQueryClient();
  const [draft, setDraft] = useState<CropHistoryEntry>(
    item?.entry ?? {
      schema_version: "1",
      crop_id: "",
      planted_on: "",
      harvested_on: "",
    },
  );
  const [variety, setVariety] = useState("");
  const [deleting, setDeleting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const crop = catalog.data?.crops.find(({ id }) => id === draft.crop_id);
  const recent = [
    ...new Set([...items].reverse().map(({ entry }) => entry.crop_id)),
  ];
  const refresh = (entries: HistoryRecord[]) =>
    cache.setQueryData(keys.history(scope, id), entries);
  async function load(signal: AbortSignal) {
    const entries = await readHistory(client, id, signal);
    refresh(entries);
    return entries;
  }
  const invalidate = () =>
    cache.invalidateQueries({ queryKey: keys.history(scope, id) });
  if (deleting && item)
    return (
      <EditDialog
        key="delete"
        initial={item}
        title={t("history.delete")}
        description="history.deleteBody"
        submit="delete"
        success="history.deleted"
        restoreFocus={restoreFocus}
        onClose={onClose}
        save={async (base, signal) => {
          await deleteFieldHistoryEntry(client, {
            params: { id, entryId: base.id },
            signal,
          });
          await invalidate();
        }}
      >
        {null}
      </EditDialog>
    );
  return (
    <EditDialog
      key="edit"
      initial={item}
      title={t(item ? "history.edit" : "history.add")}
      restoreFocus={restoreFocus}
      onClose={onClose}
      validate={() =>
        !cropHistoryEntrySchema.safeParse(draft).success ||
        draft.harvested_on > today
          ? "history.invalid"
          : undefined
      }
      reload={
        item
          ? async (signal) =>
              (await load(signal)).find(({ id }) => id === item.id)
          : undefined
      }
      save={async (base, signal) => {
        const entry = cropHistoryEntrySchema.parse(draft);
        if (overlaps(entry, await load(signal), base?.id))
          throw new EditValidation("history.overlap");
        if (base)
          await updateFieldHistoryEntry(client, {
            params: { id, entryId: base.id },
            body: { expectedVersion: base.version, entry },
            signal,
          });
        else
          await createFieldHistoryEntry(client, {
            params: { id },
            body: entry,
            signal,
          });
        await invalidate();
      }}
    >
      <Suspense fallback={<p role="status">{t("loading")}</p>}>
        <CropPicker
          label={t("crops.search")}
          value={draft.crop_id || undefined}
          recent={recent}
          onChange={(crop_id) => {
            setDraft({ ...draft, crop_id });
            setVariety("");
          }}
        />
      </Suspense>
      {crop && crop.cultivars.length > 0 && (
        <Select
          label={t("history.variety")}
          hint={t("history.varietyHelp")}
          value={variety}
          onChange={setVariety}
          options={[
            { value: "", label: t("history.noVariety") },
            ...crop.cultivars.map((cultivar) => ({
              value: cultivar.id,
              label: cropLabels(cultivar, nameMode)
                .map(({ name }) => name)
                .join(" · "),
            })),
          ]}
        />
      )}
      <div className="f4-two-fields">
        <DateField
          required
          label={t("create.planted")}
          value={draft.planted_on}
          min="1900-01-01"
          max={today}
          onChange={(event) =>
            setDraft({ ...draft, planted_on: event.target.value })
          }
        />
        <DateField
          required
          label={t("create.harvested")}
          value={draft.harvested_on}
          min="1900-01-01"
          max={today}
          onChange={(event) =>
            setDraft({ ...draft, harvested_on: event.target.value })
          }
        />
      </div>
      {item && (
        <Button size="small" variant="ghost" onClick={() => setDeleting(true)}>
          {t("history.delete")}
        </Button>
      )}
    </EditDialog>
  );
}
