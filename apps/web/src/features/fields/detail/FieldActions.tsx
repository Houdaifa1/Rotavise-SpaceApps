import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fieldProfileSchema } from "@rotavise/contracts";
import {
  useApi,
  useOffline,
  useSession,
  useToast,
} from "../../../app/providers/Runtime.js";
import { deleteField } from "../../../api/fields.js";
import { keys } from "../../../api/keys.js";
import { IconButton, TextField } from "../../../design/primitives/controls.js";
import { useMessages } from "../../../i18n/messages.js";
import type { Field, MappedField } from "../useFieldWorkspace.js";
import { DataError } from "../../../shared/DataError.js";
import { EditDialog } from "./EditDialog.js";
import { isConflict, useFieldWrite } from "./fieldData.js";

export function Rename({
  field,
  onClose,
  restoreFocus,
}: {
  field: Field;
  onClose: () => void;
  restoreFocus: () => void;
}) {
  const { t } = useMessages();
  const offline = useOffline();
  const write = useFieldWrite(field.id);
  const toast = useToast();
  const [base] = useState(field);
  const [name, setName] = useState(field.profile.name);
  const [invalid, setInvalid] = useState(false);
  const [latest, setLatest] = useState<Field>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>();
  const request = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => request.current?.abort(), []);
  async function save() {
    if (request.current || offline || latest) return;
    const parsed = fieldProfileSchema.safeParse({ ...base.profile, name });
    setInvalid(!parsed.success);
    if (!parsed.success) return;
    if (parsed.data.name === base.profile.name) {
      onClose();
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setError(undefined);
    setBusy(true);
    try {
      await write.save(base, { name }, controller.signal);
      if (controller.signal.aborted) return;
      toast(t("f4.saved"));
      onClose();
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (isConflict(failure)) {
        try {
          const current = await write.reload(controller.signal);
          if (!controller.signal.aborted) setLatest(current);
        } catch (reloadError) {
          if (!controller.signal.aborted) setError(reloadError);
        }
      } else setError(failure);
    } finally {
      request.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return latest ? (
    <EditDialog
      initial={latest}
      initialConflict
      title={t("f4.rename")}
      restoreFocus={restoreFocus}
      onClose={onClose}
      reload={write.reload}
      save={(current, signal) => write.save(current, { name }, signal)}
    >
      <p>{name}</p>
    </EditDialog>
  ) : (
    <form
      className="f4-rename"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <TextField
        autoFocus
        label={t("create.name")}
        maxLength={80}
        value={name}
        readOnly={busy || offline}
        {...(invalid ? { error: t("f4.nameInvalid") } : {})}
        onChange={(event) => {
          setName(event.target.value);
          setInvalid(false);
        }}
        onBlur={() => {
          if (name !== base.profile.name && !error) void save();
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (!busy) onClose();
          }
        }}
      />
      <IconButton
        icon="check"
        type="submit"
        label={t("save")}
        loading={busy}
        disabled={offline}
      />
      {error !== undefined && (
        <DataError
          error={error}
          busy={busy || offline}
          retry={() => void save()}
        />
      )}
    </form>
  );
}
export function DeleteField({
  entry,
  onCancel,
  onDelete,
  restoreFocus,
}: {
  entry: MappedField;
  onCancel: () => void;
  onDelete: () => void;
  restoreFocus: () => void;
}) {
  const { t } = useMessages();
  const client = useApi();
  const { scope } = useSession();
  const cache = useQueryClient();
  const deleted = useRef(false);
  return (
    <EditDialog
      initial={entry.field.id}
      title={t("f4.deleteField")}
      description="f4.deleteFieldBody"
      submit="delete"
      success="f4.fieldDeleted"
      restoreFocus={restoreFocus}
      onClose={() => {
        if (deleted.current) onDelete();
        else onCancel();
      }}
      save={async (id, signal) => {
        await deleteField(client, { params: { id }, signal });
        deleted.current = true;
        await cache.invalidateQueries({ queryKey: keys.fieldPages(scope) });
        cache.removeQueries({ queryKey: keys.field(scope, id), exact: true });
        cache.removeQueries({
          queryKey: keys.boundary(scope, id),
          exact: true,
        });
        cache.removeQueries({ queryKey: keys.history(scope, id), exact: true });
      }}
    >
      {null}
    </EditDialog>
  );
}
