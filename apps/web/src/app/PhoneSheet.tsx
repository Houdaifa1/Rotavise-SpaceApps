import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconButton } from "../design/primitives/controls.js";
import { ReminderBar } from "../design/primitives/feedback.js";
import { useMessages } from "../i18n/messages.js";
type Detent = "peek" | "half" | "full";
export function PhoneSheet({
  title,
  initial,
  onClose,
  children,
  embedded = false,
  peekAction,
}: {
  title: string;
  initial: Detent;
  onClose: () => void;
  children: ReactNode;
  embedded?: boolean;
  peekAction?: ReactNode;
}) {
  const { t } = useMessages();
  const [detent, setDetent] = useState<Detent>(initial);
  const [height, setHeight] = useState(() => window.innerHeight - 150);
  const main = useRef<HTMLElement>(null),
    viewport = useRef<HTMLDivElement>(null);
  const offset = useRef(0),
    drag = useRef<{ y: number; time: number; velocity: number } | null>(null);
  const animation = useRef<{ stop: () => void } | null>(null);
  const animate = useRef<(typeof import("motion"))["animate"]>(undefined);
  useEffect(() => {
    // The sheet can render at its detent while the spring code downloads.
    void import("motion").then(
      (motion) => {
        animate.current = motion.animate;
      },
      () => {
        /* Detents still work if motion is unavailable. */
      },
    );
  }, []);
  const apply = useCallback(
    (y: number) => {
      offset.current = y;
      if (main.current) main.current.style.transform = `translateY(${y}px)`;
      if (viewport.current)
        viewport.current.style.height = `${Math.max(120, height - y)}px`;
    },
    [height],
  );
  const offsets = {
    peek: Math.max(0, height - (peekAction ? 144 : 120)),
    half: height / 2,
    full: 0,
  };
  const snap = useCallback(
    (target: number) => {
      animation.current?.stop();
      const spring = animate.current;
      if (
        !spring ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      )
        apply(target);
      else
        animation.current = spring(offset.current, target, {
          type: "spring",
          stiffness: 360,
          damping: 38,
          onUpdate: apply,
        });
    },
    [apply],
  );
  useEffect(() => {
    const parent = main.current?.parentElement;
    if (embedded && parent) {
      const resize = () =>
        setHeight(Math.max(120, Math.floor(parent.clientHeight * 0.66)));
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(parent);
      return () => observer.disconnect();
    }
    const resize = () => setHeight(window.innerHeight - 150);
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [embedded]);
  useEffect(() => {
    snap(offsets[detent]);
    return () => animation.current?.stop();
  }, [height, detent, snap]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !document.querySelector(".rv-dialog[data-state=open]")
      )
        onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const Element = embedded ? "section" : "main";
  return (
    <Element
      ref={main}
      id={embedded ? undefined : "main-content"}
      tabIndex={-1}
      aria-label={title}
      className="f1-sheet"
      data-detent={detent}
      style={{ height }}
    >
      {!embedded && detent === "peek" && <h1 className="rv-sr">{title}</h1>}
      <div ref={viewport} className="f1-sheet-viewport">
        <div
          className="f1-sheet-handle"
          aria-hidden="true"
          onPointerDown={(event) => {
            animation.current?.stop();
            event.currentTarget.setPointerCapture(event.pointerId);
            drag.current = {
              y: event.clientY,
              time: event.timeStamp,
              velocity: 0,
            };
          }}
          onPointerMove={(event) => {
            if (!drag.current) return;
            const delta = event.clientY - drag.current.y;
            const elapsed = Math.max(1, event.timeStamp - drag.current.time);
            apply(Math.max(0, Math.min(offsets.peek, offset.current + delta)));
            drag.current = {
              y: event.clientY,
              time: event.timeStamp,
              velocity: (delta / elapsed) * 1000,
            };
          }}
          onPointerUp={() => {
            if (!drag.current) return;
            const projected = offset.current + drag.current.velocity * 0.15;
            drag.current = null;
            const nearest = (["peek", "half", "full"] as const).reduce(
              (a, b) =>
                Math.abs(offsets[a] - projected) <
                Math.abs(offsets[b] - projected)
                  ? a
                  : b,
            );
            setDetent(nearest);
            snap(offsets[nearest]);
          }}
          onPointerCancel={() => {
            drag.current = null;
            snap(offsets[detent]);
          }}
        >
          <span />
        </div>
        {embedded && detent === "peek" && (
          <div className="f2-peek-header">
            <span className="f2-peek-title">{title}</span>
            {peekAction}
          </div>
        )}
        <div
          className="f1-sheet-controls"
          role="group"
          aria-label={t("detent")}
        >
          {(["peek", "half", "full"] as const).map((value) => (
            <button
              type="button"
              key={value}
              aria-pressed={value === detent}
              onClick={() => setDetent(value)}
            >
              {t(value)}
            </button>
          ))}
          <IconButton
            variant="ghost"
            icon="close"
            label={t("shell.closePanel")}
            onClick={onClose}
          />
        </div>
        <div className="f1-sheet-body" inert={detent === "peek"}>
          {children}
        </div>
        <ReminderBar text={t("shell.reminder")} />
      </div>
    </Element>
  );
}
