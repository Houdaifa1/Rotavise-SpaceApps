import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "../../../design/primitives/controls.js";
import { Dialog } from "../../../design/primitives/feedback.js";
import { useMessages, type MessageKey } from "../../../i18n/messages.js";
import {
  useBoot,
  useOffline,
  useToast,
} from "../../../app/providers/Runtime.js";
import { failureText } from "../../../api/errors.js";
import { RetryButton } from "../../../shared/RetryButton.js";
import { isConflict, useFieldWrite, type FieldPatch } from "./fieldData.js";
import type { Field } from "../useFieldWorkspace.js";

export class EditValidation extends Error {
  constructor(readonly key: MessageKey) {
    super(key);
  }
}

export function EditDialog<T>({
  title,
  trigger,
  restoreFocus,
  initial,
  initialConflict = false,
  onClose,
  validate,
  save,
  reload,
  children,
  success = "f4.saved",
  submit = "save",
  description = "f4.editDescription",
}: {
  title: string;
  trigger?: ReactNode;
  restoreFocus?: () => void;
  initial: T;
  initialConflict?: boolean;
  onClose: () => void;
  validate?: () => MessageKey | undefined;
  save: (base: T, signal: AbortSignal) => Promise<void>;
  reload?: ((signal: AbortSignal) => Promise<T | undefined>) | undefined;
  children: ReactNode;
  success?: MessageKey;
  submit?: MessageKey;
  description?: MessageKey;
}) {
  const { t, language } = useMessages();
  const { glossary } = useBoot();
  const offline = useOffline();
  const toast = useToast();
  const form = useId();
  const request = useRef<AbortController | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [base, setBase] = useState(initial);
  const [conflict, setConflict] = useState(initialConflict);
  const [reloadFailed, setReloadFailed] = useState(false);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState<unknown>();
  const [invalid, setInvalid] = useState<MessageKey>();
  useEffect(() => () => request.current?.abort(), []);
  async function run(refresh: boolean) {
    if (request.current || offline || gone) return;
    const problem = !refresh && validate?.();
    setInvalid(problem || undefined);
    if (problem) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(undefined);
    setReloadFailed(false);
    try {
      if (refresh && reload) {
        const latest = await reload(controller.signal);
        if (controller.signal.aborted) return;
        if (latest === undefined) setGone(true);
        else setBase(latest);
      } else {
        await save(base, controller.signal);
        if (controller.signal.aborted) return;
        toast(t(success));
        onClose();
      }
    } catch (failure) {
      if (controller.signal.aborted) return;
      if (failure instanceof EditValidation) setInvalid(failure.key);
      else if (isConflict(failure) && reload && !refresh) {
        setConflict(true);
        try {
          const latest = await reload(controller.signal);
          if (controller.signal.aborted) return;
          if (latest === undefined) setGone(true);
          else setBase(latest);
        } catch (reloadError) {
          if (!controller.signal.aborted) {
            setReloadFailed(true);
            setError(reloadError);
          }
        }
      } else {
        setReloadFailed(refresh);
        setError(failure);
      }
    } finally {
      request.current = undefined;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  function submitForm(event: FormEvent) {
    event.preventDefault();
    if (error !== undefined) return;
    void run(false);
  }
  return (
    <Dialog
      open
      trigger={trigger}
      restoreFocus={restoreFocus ?? (() => {})}
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
      title={title}
      description={t(description)}
      body={
        <form id={form} className="f4-form" onSubmit={submitForm}>
          <fieldset
            disabled={busy || offline || gone}
            aria-describedby={invalid ? `${form}-error` : undefined}
          >
            {children}
          </fieldset>
          {offline && <p role="status">{t("f4.offline")}</p>}
          {conflict && (
            <p role="alert">{t(gone ? "f4.conflictGone" : "f4.conflict")}</p>
          )}
          {invalid && (
            <p id={`${form}-error`} role="alert" className="rv-error-text">
              {t(invalid)}
            </p>
          )}
          {error !== undefined && (
            <div role="status">
              <p>{failureText(error, language, glossary.data)}</p>
              <RetryButton
                error={error}
                busy={busy || offline}
                retry={() => void run(reloadFailed)}
              />
            </div>
          )}
        </form>
      }
      actions={
        <>
          <Button disabled={busy} onClick={onClose}>
            {t("secondary")}
          </Button>
          <Button
            type="submit"
            form={form}
            variant={submit === "delete" ? "danger" : "primary"}
            loading={busy}
            disabled={offline || gone || error !== undefined}
          >
            {t(conflict ? "f4.reapply" : submit)}
          </Button>
        </>
      }
    />
  );
}

export function ProfileDialog({
  field,
  title,
  onClose,
  restoreFocus,
  patch,
  validate,
  children,
}: {
  field: Field;
  title: string;
  onClose: () => void;
  restoreFocus: () => void;
  patch: (base: Field) => FieldPatch;
  validate?: () => MessageKey | undefined;
  children: ReactNode;
}) {
  const write = useFieldWrite(field.id);
  return (
    <EditDialog
      title={title}
      initial={field}
      onClose={onClose}
      restoreFocus={restoreFocus}
      reload={write.reload}
      validate={() => validate?.()}
      save={(base, signal) => {
        try {
          return write.save(base, patch(base), signal);
        } catch (error) {
          return Promise.reject(error);
        }
      }}
    >
      {children}
    </EditDialog>
  );
}
