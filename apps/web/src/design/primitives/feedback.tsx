import { useEffect, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { GlossaryEntry } from "@rotavise/contracts";
import { useMessages } from "../../i18n/messages.js";
import { Icon, type IconName } from "../icons/index.js";
import { Button, IconButton } from "./controls.js";

export type EvidenceKind = "sourced" | "mixed" | "recalled" | "missing";
export function evidenceKind(evidence: {
  double_checked: number;
  expert_reviewed: number;
  model_recall: number;
  extracted?: number;
}): EvidenceKind {
  const sourced = evidence.double_checked + evidence.expert_reviewed;
  return evidence.model_recall > 0
    ? sourced > 0
      ? "mixed"
      : "recalled"
    : sourced > 0
      ? "sourced"
      : "missing";
}
export function Chip({
  kind = "neutral",
  text,
  icon = "info",
  onClick,
}: {
  kind?: "neutral" | "water" | "heat" | "vegetation" | "caution";
  text: string;
  icon?: IconName;
  onClick?: () => void;
}) {
  const content = (
    <>
      <Icon name={icon} />
      <span>{text}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={`rv-chip rv-tone-${kind}`}
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <span className={`rv-chip rv-tone-${kind}`}>{content}</span>
  );
}
export function SourceChip({
  kind,
  onClick,
  expertReviewed = false,
}: {
  kind: EvidenceKind;
  onClick?: () => void;
  expertReviewed?: boolean;
}) {
  const { t } = useMessages();
  return (
    <span className="rv-source-chips">
      <Chip
        kind={kind === "mixed" || kind === "recalled" ? "caution" : "neutral"}
        icon={
          kind === "sourced"
            ? "source"
            : kind === "missing"
              ? "info"
              : "warning"
        }
        text={t(kind)}
        {...(onClick ? { onClick } : {})}
      />
      {expertReviewed && <Chip text={t("expert")} icon="check" />}
    </span>
  );
}
export function StatusChip({
  status,
}: {
  status: "ready" | "loading" | "partial" | "failed" | "disabled";
}) {
  const { t } = useMessages();
  return (
    <Chip
      text={t(status)}
      icon={
        status === "ready"
          ? "check"
          : status === "failed" || status === "partial"
            ? "warning"
            : "info"
      }
      kind={status === "partial" || status === "failed" ? "caution" : "neutral"}
    />
  );
}
export function TermChip({
  text,
  onClick,
}: {
  text: string;
  onClick: () => void;
}) {
  return <Chip text={text} icon="help" onClick={onClick} />;
}
export function Skeleton({
  shape = "line",
  label,
}: {
  shape?: "line" | "row" | "chart" | "circle";
  label?: string;
}) {
  const { t } = useMessages();
  return (
    <span
      className={`rv-skeleton rv-skeleton-${shape}`}
      role="status"
      aria-label={label ?? t("loading")}
    />
  );
}
type StateProps = {
  title: string;
  text: string;
  action?: { label: string; onClick: () => void };
};
function State({
  title,
  text,
  action,
  icon,
  kind,
}: StateProps & { icon: IconName; kind: string }) {
  return (
    <section className={`rv-state rv-state-${kind}`}>
      <Icon name={icon} />
      <h3>{title}</h3>
      <p>{text}</p>
      {action && <Button onClick={action.onClick}>{action.label}</Button>}
    </section>
  );
}
export function EmptyState(props: StateProps) {
  return <State {...props} icon="field-add" kind="empty" />;
}
export function ErrorState(props: StateProps) {
  return <State {...props} icon="warning" kind="error" />;
}
export function PartialState(props: StateProps) {
  return <State {...props} icon="info" kind="partial" />;
}
export function ReminderBar({ text }: { text?: string }) {
  const { t } = useMessages();
  return (
    <p className="rv-reminder">
      <Icon name="info" />
      {text ?? t("reminder")}
    </p>
  );
}
export function OfflineBar() {
  const { t } = useMessages();
  return (
    <div className="rv-offline" role="status">
      <Icon name="info" />
      {t("offline")}
    </div>
  );
}
export function ProgressBar({
  value,
  label,
}: {
  value?: number;
  label: string;
}) {
  return (
    <div className="rv-progress-wrap">
      <span>{label}</span>
      <div
        className="rv-progress"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        {...(value === undefined
          ? {}
          : { "aria-valuenow": Math.max(0, Math.min(100, value)) })}
      >
        <span
          style={
            value === undefined
              ? undefined
              : { width: `${Math.max(0, Math.min(100, value))}%` }
          }
        />
      </div>
    </div>
  );
}
export function Toast({
  message,
  action,
  onDismiss,
}: {
  message: string;
  action?: { label: string; onClick: () => void };
  onDismiss: () => void;
}) {
  const { t } = useMessages();
  useEffect(() => {
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);
  return (
    <div className="rv-ui rv-toast" role="status">
      <Icon name="check" />
      <span>{message}</span>
      {action && (
        <Button variant="ghost" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      <IconButton
        icon="close"
        label={t("close")}
        variant="ghost"
        onClick={onDismiss}
      />
    </div>
  );
}
type DialogProps = {
  trigger?: ReactNode;
  description?: string;
  restoreFocus?: () => void;
  title: string;
  body: ReactNode;
  actions?: ReactNode;
  open?: boolean;
  onOpenChange?: (value: boolean) => void;
};
export function Dialog({
  trigger,
  title,
  body,
  description,
  restoreFocus,
  actions,
  open,
  onOpenChange,
}: DialogProps & { confirm?: boolean }) {
  const { t } = useMessages();
  return (
    <DialogPrimitive.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      {trigger && (
        <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      )}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rv-overlay" />
        <DialogPrimitive.Content
          className="rv-ui rv-dialog"
          onCloseAutoFocus={(event) => {
            if (restoreFocus) {
              event.preventDefault();
              restoreFocus();
            }
          }}
        >
          <header>
            <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton icon="close" label={t("close")} variant="ghost" />
            </DialogPrimitive.Close>
          </header>
          {description ? (
            <>
              <DialogPrimitive.Description>
                {description}
              </DialogPrimitive.Description>
              <div className="rv-dialog-description">{body}</div>
            </>
          ) : (
            <DialogPrimitive.Description asChild>
              <div className="rv-dialog-description">{body}</div>
            </DialogPrimitive.Description>
          )}
          <footer>
            {actions ?? (
              <DialogPrimitive.Close asChild>
                <Button>{t("close")}</Button>
              </DialogPrimitive.Close>
            )}
          </footer>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function ConfirmDialog({
  trigger,
  title,
  body,
  onConfirm,
}: {
  trigger: ReactNode;
  title: string;
  body: string;
  onConfirm: () => void;
}) {
  const { t } = useMessages();
  return (
    <Dialog
      trigger={trigger}
      title={title}
      body={body}
      actions={
        <>
          <DialogPrimitive.Close asChild>
            <Button autoFocus>{t("secondary")}</Button>
          </DialogPrimitive.Close>
          <DialogPrimitive.Close asChild>
            <Button variant="danger" onClick={onConfirm}>
              {t("delete")}
            </Button>
          </DialogPrimitive.Close>
        </>
      }
    />
  );
}
export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const [portal, setPortal] = useState<HTMLElement>();
  useEffect(() => setPortal(document.querySelector("main") ?? undefined), []);
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal container={portal}>
          <TooltipPrimitive.Content
            className="rv-ui rv-tooltip"
            role="tooltip"
            sideOffset={8}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
export function Popover({
  trigger,
  title,
  children,
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  title: string;
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { t } = useMessages();
  return (
    <PopoverPrimitive.Root
      {...(open === undefined ? {} : { open })}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="rv-ui rv-popover"
          onEscapeKeyDown={(event) => event.stopPropagation()}
          sideOffset={8}
          aria-label={title}
        >
          <div className="rv-popover-header">
            <strong>{title}</strong>
            <PopoverPrimitive.Close asChild>
              <IconButton variant="ghost" icon="close" label={t("close")} />
            </PopoverPrimitive.Close>
          </div>
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
export function GlossaryTerm({
  entry,
}: {
  entry: Pick<GlossaryEntry, "code" | "group" | "term" | "meaning">;
}) {
  return (
    <Popover
      title={entry.term}
      trigger={
        <button type="button" className="rv-term">
          {entry.term}
        </button>
      }
    >
      <p>{entry.meaning}</p>
    </Popover>
  );
}
