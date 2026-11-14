import { Slider } from "./selection.js";
import { useEffect, useId, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { Icon, type IconName } from "../icons/index.js";
import { Logo } from "../motif/Logo.js";
import { useMessages } from "../../i18n/messages.js";
import { calendarDate } from "../../i18n/format.js";
import { Button, IconButton } from "./controls.js";
import { ReminderBar, Skeleton, Tooltip } from "./feedback.js";

export type NavItem = {
  id: string;
  label: string;
  icon: IconName;
  badge?: string;
  onPress: () => void;
};
export function IconRail({
  items,
  active,
  label,
}: {
  items: NavItem[];
  active: string;
  label?: string;
}) {
  const { t } = useMessages();
  return (
    <nav className="rv-rail" aria-label={label ?? t("railNavigation")}>
      <Logo markOnly />
      {items.slice(0, 7).map((item) => (
        <Tooltip key={item.id} content={item.label}>
          <button
            type="button"
            aria-label={`${item.label}${item.badge ? ` ${item.badge}` : ""}`}
            aria-current={active === item.id ? "page" : undefined}
            onClick={item.onPress}
          >
            <Icon name={item.icon} />
            {item.badge && (
              <span className="rv-badge" aria-hidden="true">
                {item.badge}
              </span>
            )}
          </button>
        </Tooltip>
      ))}
    </nav>
  );
}
export function TabBar({
  items,
  active,
  label,
}: {
  items: NavItem[];
  active: string;
  label?: string;
}) {
  const { t } = useMessages();
  if (items.length !== 5) throw new RangeError("TabBar requires five items");
  return (
    <nav className="rv-tabbar" aria-label={label ?? t("tabNavigation")}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-current={active === item.id ? "page" : undefined}
          onClick={item.onPress}
        >
          <span>
            <Icon name={item.icon} />
            {item.badge && <span className="rv-badge">{item.badge}</span>}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
type PanelProps = {
  title: string;
  subtitle?: string;
  children?: ReactNode;
  onClose?: () => void;
  state?: "open" | "closing" | "loading";
};
export function Panel({
  title,
  subtitle,
  children,
  onClose,
  state = "open",
}: PanelProps) {
  const { t } = useMessages();
  const id = useId();
  return (
    <section
      className="rv-panel"
      data-state={state}
      aria-labelledby={id}
      aria-busy={state === "loading"}
    >
      <header>
        <div>
          <h3 id={id}>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {onClose && (
          <IconButton
            icon="close"
            label={t("close")}
            variant="ghost"
            onClick={onClose}
          />
        )}
      </header>
      <div className="rv-panel-body">
        {state === "loading" ? (
          <>
            <Skeleton shape="row" />
            <Skeleton shape="row" />
            <Skeleton shape="row" />
          </>
        ) : (
          children
        )}
      </div>
      <ReminderBar />
    </section>
  );
}
export function DetailPanel(props: PanelProps) {
  return (
    <div className="rv-detail-panel">
      <Panel {...props} />
    </div>
  );
}
export function AppShell({
  items,
  active,
  list,
  detail,
  children,
}: {
  items: NavItem[];
  active: string;
  list: ReactNode;
  detail?: ReactNode;
  children: ReactNode;
}) {
  const { t } = useMessages();
  return (
    <div className="rv-shell">
      <a className="rv-skip" href="#rv-shell-content">
        {t("skip")}
      </a>
      <div className="rv-shell-rail">
        <IconRail items={items} active={active} />
      </div>
      <div className="rv-shell-list">{list}</div>
      {detail && <div className="rv-shell-detail">{detail}</div>}
      <div id="rv-shell-content" className="rv-shell-content" tabIndex={-1}>
        {children}
      </div>
      <div className="rv-shell-tabbar">
        <TabBar items={items} active={active} />
      </div>
    </div>
  );
}
export type Detent = "peek" | "half" | "full";
export function BottomSheet({
  title,
  trigger,
  children,
  detents = ["peek", "half", "full"],
  detent,
  onDetent,
}: {
  title: string;
  trigger: ReactNode;
  children: ReactNode;
  detents?: Detent[];
  detent: Detent;
  onDetent: (value: Detent) => void;
}) {
  const { t } = useMessages();
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [height, setHeight] = useState(() => window.innerHeight * 0.88);
  const y = useMotionValue(0);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    const resize = () => setHeight(window.innerHeight * 0.88);
    query.addEventListener("change", change);
    window.addEventListener("resize", resize);
    return () => {
      query.removeEventListener("change", change);
      window.removeEventListener("resize", resize);
    };
  }, []);
  const visibleHeight = useTransform(() => Math.max(0, height - y.get() - 16));
  const offsets: Record<Detent, number> = {
    peek: Math.max(0, height - 240),
    half: height * 0.45,
    full: 0,
  };
  useEffect(() => {
    const control = animate(
      y,
      offsets[detent],
      reduced
        ? { duration: 0 }
        : { type: "spring", stiffness: 360, damping: 38 },
    );
    return () => control.stop();
  }, [detent, reduced, height, y]);
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="rv-overlay" />
        <DialogPrimitive.Content asChild>
          <motion.div
            className="rv-ui rv-bottom-sheet"
            style={{ y, height }}
            initial={false}
          >
            <motion.div
              className="rv-sheet-viewport"
              style={{ height: visibleHeight }}
            >
              <motion.div
                className="rv-sheet-handle"
                onPanStart={() => y.stop()}
                onPan={(_, info) =>
                  y.set(
                    Math.max(
                      0,
                      Math.min(
                        Math.max(0, height - 240),
                        y.get() + info.delta.y,
                      ),
                    ),
                  )
                }
                onPanEnd={(_, info) => {
                  const projected = y.get() + info.velocity.y * 0.15;
                  const nearest = [...detents].sort(
                    (a, b) =>
                      Math.abs(offsets[a] - projected) -
                      Math.abs(offsets[b] - projected),
                  )[0]!;
                  onDetent(nearest);
                  if (nearest === detent)
                    void animate(y, offsets[nearest], {
                      duration: reduced ? 0 : 0.22,
                    });
                }}
              >
                <span aria-hidden="true" />
              </motion.div>
              <header>
                <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
                <DialogPrimitive.Close asChild>
                  <IconButton icon="close" label={t("close")} variant="ghost" />
                </DialogPrimitive.Close>
              </header>
              <DialogPrimitive.Description className="rv-sr">
                {t("detent")}
              </DialogPrimitive.Description>
              <div className="rv-row" role="group" aria-label={t("detent")}>
                {detents.map((d) => (
                  <Button
                    key={d}
                    size="small"
                    aria-pressed={detent === d}
                    onClick={() => onDetent(d)}
                  >
                    {t(d)}
                  </Button>
                ))}
              </div>
              <div className="rv-sheet-body" tabIndex={0}>
                {children}
              </div>
              <ReminderBar />
            </motion.div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
export function FloatingChip({
  label,
  value,
  onPress,
  open = false,
  disabled = false,
}: {
  label: string;
  value?: string;
  onPress: () => void;
  open?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="rv-floating-chip"
      aria-expanded={open}
      disabled={disabled}
      onClick={onPress}
    >
      <Icon name="layers" />
      <span>
        {label}
        {value && <small>{value}</small>}
      </span>
      <Icon name="chevron-down" />
    </button>
  );
}
export function MapTools({
  items,
}: {
  items: {
    icon: IconName;
    label: string;
    onPress: () => void;
    pressed?: boolean;
    disabled?: boolean;
  }[];
}) {
  if (items.length > 4)
    throw new RangeError("MapTools allows at most four controls");
  return (
    <div className="rv-map-tools">
      {items.map((item) => (
        <IconButton
          key={item.label}
          icon={item.icon}
          label={item.label}
          disabled={item.disabled}
          aria-pressed={item.pressed}
          onClick={item.onPress}
        />
      ))}
    </div>
  );
}
export function LegendCard({
  title,
  items,
  open,
  onOpenChange,
}: {
  title: string;
  items: {
    label: string;
    kind: "water" | "heat" | "vegetation" | "bare" | "caution";
  }[];
  open: boolean;
  onOpenChange: (value: boolean) => void;
}) {
  return (
    <section className="rv-legend">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        {title}
        <Icon name="chevron-down" />
      </button>
      {open && (
        <ul>
          {items.slice(0, 7).map((item) => (
            <li key={item.label}>
              <span
                className={`rv-legend-mark rv-tone-${item.kind}`}
                aria-hidden="true"
              />
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
export function DateStepper({
  dates,
  value,
  onChange,
  status = "ready",
}: {
  dates: string[];
  value: string;
  onChange: (value: string) => void;
  status?: "ready" | "noImage" | "cloudy" | "loading";
}) {
  const { language, t } = useMessages();
  const index = dates.indexOf(value);
  return (
    <div className="rv-date-stepper">
      <div className="rv-row">
        <IconButton
          icon="chevron-left"
          label={t("previous")}
          disabled={index <= 0 || status === "loading"}
          onClick={() => onChange(dates[index - 1]!)}
        />
        <span>{value ? calendarDate(value, language) : t("noData")}</span>
        <IconButton
          icon="chevron-right"
          label={t("next")}
          disabled={
            index < 0 || index >= dates.length - 1 || status === "loading"
          }
          onClick={() => onChange(dates[index + 1]!)}
        />
      </div>
      {status !== "ready" && (
        <p role="status">
          {status === "loading" ? <Skeleton shape="line" /> : t(status)}
        </p>
      )}
    </div>
  );
}
export function CompareSlider({
  left,
  right,
  value,
  onChange,
}: {
  left: ReactNode;
  right: ReactNode;
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useMessages();
  return (
    <div className="rv-compare">
      <div className="rv-compare-views">
        <div>{left}</div>
        <div style={{ clipPath: `inset(0 0 0 ${value}%)` }}>{right}</div>
        <span
          className="rv-compare-rule"
          style={{ left: `${value}%` }}
          aria-hidden="true"
        />
      </div>
      <Slider
        label={t("compare")}
        min={0}
        max={100}
        value={value}
        unit="%"
        onChange={onChange}
      />
    </div>
  );
}
