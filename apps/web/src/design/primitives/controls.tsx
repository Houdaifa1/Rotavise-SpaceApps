import {
  useId,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { Icon, type IconName } from "../icons/index.js";
import { useMessages } from "../../i18n/messages.js";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "small" | "regular";
  loading?: boolean;
};
export function Button({
  variant = "secondary",
  size = "regular",
  loading = false,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  const { t } = useMessages();
  return (
    <button
      type="button"
      {...props}
      className={`rv-button rv-${variant} rv-size-${size} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && (
        <span className="rv-loading-mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
      )}
      <span>{children}</span>
      {loading && <span className="rv-sr">{t("loading")}</span>}
    </button>
  );
}
export function IconButton({
  icon,
  label,
  ...props
}: Omit<ButtonProps, "children"> & { icon: IconName; label: string }) {
  return (
    <Button
      {...props}
      aria-label={label}
      className={`rv-icon-button ${props.className ?? ""}`}
    >
      <Icon name={icon} />
    </Button>
  );
}
export type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  unit?: string;
  hint?: string;
  error?: string;
};
export function TextField({
  label,
  unit,
  hint,
  error,
  id,
  className = "",
  ...props
}: FieldProps) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div className={`rv-field ${className}`}>
      <label htmlFor={inputId}>{label}</label>
      <div className="rv-input-wrap">
        <input
          {...props}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={
            [hint && `${inputId}-hint`, error && `${inputId}-error`]
              .filter(Boolean)
              .join(" ") || undefined
          }
        />
        {unit && <span className="rv-unit">{unit}</span>}
      </div>
      {hint && <small id={`${inputId}-hint`}>{hint}</small>}
      {error && (
        <small id={`${inputId}-error`} className="rv-error-text">
          <Icon name="warning" />
          {error}
        </small>
      )}
    </div>
  );
}
export function NumberField(props: FieldProps & { unit: string }) {
  return <TextField {...props} type="number" inputMode="decimal" />;
}
export function DateField(props: FieldProps) {
  const { language } = useMessages();
  return <TextField {...props} type="date" lang={language} />;
}
export type Option = {
  value: string;
  label: string;
  disabled?: boolean;
  content?: ReactNode;
};
export function Select({
  label,
  options,
  value,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="rv-field">
      <label htmlFor={id}>{label}</label>
      <div className="rv-select-wrap">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          aria-describedby={hint ? `${id}-hint` : undefined}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevron-down" />
      </div>
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function SearchSelect({
  label,
  options,
  value,
  onChange,
  disabled = false,
  normalizeSearch = (value: string) => value.toLocaleLowerCase(),
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  normalizeSearch?: (value: string) => string;
}) {
  const { t } = useMessages();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [active, setActive] = useState(0);
  const filtered = options.filter((o) =>
    normalizeSearch(o.label).includes(normalizeSearch(search)),
  );
  const visible = filtered.slice(page * 7, page * 7 + 7);
  const select = (o: Option | undefined) => {
    if (!o || o.disabled) return;
    onChange(o.value);
    setOpen(false);
  };
  return (
    <div className="rv-field">
      <span id={`${id}-label`}>{label}</span>
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          setActive(0);
        }}
      >
        <PopoverPrimitive.Trigger asChild>
          <button
            type="button"
            className="rv-select-trigger"
            disabled={disabled}
            aria-labelledby={`${id}-label ${id}-value`}
          >
            <span id={`${id}-value`}>
              {options.find((o) => o.value === value)?.content ??
                options.find((o) => o.value === value)?.label ??
                t("choose")}
            </span>
            <Icon name="chevron-down" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            className="rv-ui rv-popover rv-search-select"
            onEscapeKeyDown={(event) => event.stopPropagation()}
            aria-label={label}
            sideOffset={8}
            align="start"
          >
            <label className="rv-sr" htmlFor={`${id}-search`}>
              {t("search")}
            </label>
            <input
              id={`${id}-search`}
              autoComplete="off"
              role="combobox"
              aria-expanded="true"
              aria-controls={`${id}-list`}
              aria-activedescendant={
                visible[active] ? `${id}-option-${active}` : undefined
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                  e.preventDefault();
                  setActive((i) =>
                    Math.max(
                      0,
                      Math.min(
                        visible.length - 1,
                        i + (e.key === "ArrowDown" ? 1 : -1),
                      ),
                    ),
                  );
                }
                if (e.key === "Enter") {
                  e.preventDefault();
                  select(visible[active]);
                }
              }}
            />
            <div id={`${id}-list`} role="listbox" aria-label={label}>
              {visible.map((o, i) => (
                <button
                  id={`${id}-option-${i}`}
                  type="button"
                  key={o.value}
                  role="option"
                  aria-selected={value === o.value}
                  aria-disabled={o.disabled}
                  tabIndex={-1}
                  data-active={i === active}
                  onPointerMove={() => setActive(i)}
                  onClick={() => select(o)}
                >
                  {o.content ?? o.label}
                  {value === o.value && <Icon name="check" />}
                </button>
              ))}
            </div>
            {!visible.length && <p role="status">{t("emptySearch")}</p>}
            {filtered.length > 7 && (
              <div className="rv-row">
                <Button
                  disabled={page === 0}
                  onClick={() => {
                    setPage((p) => p - 1);
                    setActive(0);
                  }}
                >
                  {t("previous")}
                </Button>
                <Button
                  disabled={(page + 1) * 7 >= filtered.length}
                  onClick={() => {
                    setPage((p) => p + 1);
                    setActive(0);
                  }}
                >
                  {t("more")}
                </Button>
              </div>
            )}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
export function Switch({
  label,
  checked,
  onChange,
  disabled = false,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="rv-switch-row">
      <label htmlFor={id}>{label}</label>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        className="rv-switch"
        onClick={() => onChange(!checked)}
      >
        <span />
      </button>
    </div>
  );
}
export function Tabs({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: (Option & { content: ReactNode })[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <TabsPrimitive.Root
      value={value}
      onValueChange={onChange}
      className="rv-tabs"
    >
      <TabsPrimitive.List aria-label={label}>
        {items.map((item) => (
          <TabsPrimitive.Trigger
            value={item.value}
            key={item.value}
            disabled={item.disabled}
          >
            {item.label}
          </TabsPrimitive.Trigger>
        ))}
      </TabsPrimitive.List>
      {items.map((item) => (
        <TabsPrimitive.Content value={item.value} key={item.value}>
          {item.content}
        </TabsPrimitive.Content>
      ))}
    </TabsPrimitive.Root>
  );
}
export function LanguageSwitch({
  value,
  onChange,
}: {
  value: "fr" | "en";
  onChange: (value: "fr" | "en") => void;
}) {
  const { t } = useMessages();
  return (
    <div className="rv-language" role="group" aria-label={t("language")}>
      {(["fr", "en"] as const).map((lang) => (
        <button
          type="button"
          key={lang}
          lang={lang}
          aria-pressed={value === lang}
          onClick={() => onChange(lang)}
        >
          {lang === "fr" ? "Français" : "English"}
        </button>
      ))}
    </div>
  );
}
