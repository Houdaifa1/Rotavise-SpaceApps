import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { scaleLinear } from "d3-scale";
import { area, line } from "d3-shape";
import { useMessages } from "../../i18n/messages.js";
import { number } from "../../i18n/format.js";
import { Hatch } from "./data.js";

export type ChartPoint = {
  x: number;
  value: number | null;
  label: string;
  low?: number | null;
  high?: number | null;
  end?: number;
};
export type ChartSeries = {
  id: string;
  label: string;
  kind: "water" | "heat" | "vegetation" | "bare" | "caution";
  points: ChartPoint[];
  summary: {
    min: number | null;
    max: number | null;
    latest: number | null;
    trend: string;
  };
};
export type ChartType = "line" | "area" | "band" | "bars" | "timeline";
export type ChartBand = {
  start: number;
  end: number;
  kind: "vegetation" | "bare";
};
export type AxisLabel = { x: number; width: number; label: string };
// Widths are explicit and used as SVG textLength, making the boxes testable
// independently of a late font or a browser's text metric implementation.
export function layoutAxisLabels(labels: AxisLabel[], gap = 12): AxisLabel[] {
  const result: AxisLabel[] = [];
  for (const label of labels) {
    const last = result.at(-1);
    if (!last || last.x + last.width / 2 + gap <= label.x - label.width / 2)
      result.push(label);
  }
  return result;
}
export function SeriesChart({
  type,
  series,
  unit,
  title,
  source,
  partial = false,
  bands = [],
}: {
  type: ChartType;
  series: ChartSeries[];
  unit: string;
  title: string;
  source: ReactNode;
  partial?: boolean;
  bands?: ChartBand[];
}) {
  const { t, language } = useMessages();
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(480);
  const [cursor, setCursor] = useState<number | null>(null);
  const id = useId().replace(/:/g, "");
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(Math.max(220, w));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const allPoints = series.flatMap((s) => s.points);
  if (
    allPoints.some(
      (p) =>
        !Number.isFinite(p.x) ||
        (p.value !== null && !Number.isFinite(p.value)) ||
        (p.low != null && !Number.isFinite(p.low)) ||
        (p.high != null && !Number.isFinite(p.high)) ||
        (p.end !== undefined && (!Number.isFinite(p.end) || p.end < p.x)),
    )
  )
    throw new RangeError("Chart values must be finite with ordered intervals");
  const values = allPoints.flatMap((p) =>
    [p.value, p.low, p.high].filter((v): v is number => v != null),
  );
  const noData = values.length === 0;
  const labels = new Map(allPoints.map((point) => [point.x, point.label]));
  const xs = [...labels.keys()].sort((a, b) => a - b);
  const xmin = xs[0] ?? 0;
  const xmax = Math.max(xs.at(-1) ?? 1, ...allPoints.map((p) => p.end ?? p.x));
  const ymin = Math.min(0, ...values);
  const ymax = Math.max(0, ...values);
  const x = scaleLinear()
    .domain([xmin, xmax === xmin ? xmin + 1 : xmax])
    .range([44, width - 32]);
  const y = scaleLinear()
    .domain([ymin, ymin === ymax ? ymax + 1 : ymax])
    .nice(3)
    .range([166, 24]);
  const makeLine = line<ChartPoint>()
    .defined((p) => p.value !== null)
    .x((p) => x(p.x))
    .y((p) => y(p.value!));
  const makeArea = area<ChartPoint>()
    .defined((p) => p.value !== null)
    .x((p) => x(p.x))
    .y0(y(0))
    .y1((p) => y(p.value!));
  const makeBand = area<ChartPoint>()
    .defined((p) => p.low != null && p.high != null)
    .x((p) => x(p.x))
    .y0((p) => y(p.low!))
    .y1((p) => y(p.high!));
  const ticks = layoutAxisLabels(
    xs.map((value) => {
      const label = labels.get(value)!;
      return { x: x(value), label, width: Math.min(110, label.length * 6.5) };
    }),
  );
  const cursorX = cursor === null ? undefined : xs[cursor];
  const cursorPosition = cursorX === undefined ? undefined : x(cursorX);
  const barWidth = Math.max(
    2,
    Math.min(32, ((width - 76) / Math.max(1, xs.length)) * 0.55),
  );
  const chartHeight =
    type === "timeline" ? Math.max(210, series.length * 30 + 80) : 210;
  return (
    <figure className="rv-chart" ref={ref}>
      <figcaption id={`${id}-title`}>
        {title} <span className="rv-caption">({unit})</span>
      </figcaption>
      {partial && (
        <p className="rv-chart-note">
          <span className="rv-partial-sign" aria-hidden="true" />
          {t("partialText")}
        </p>
      )}
      {noData ? (
        <div className="rv-chart-empty" role="status">
          {t("noData")}
        </div>
      ) : (
        <div
          className="rv-chart-plot"
          role="group"
          tabIndex={0}
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-help`}
          onKeyDown={(e) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End", "Escape"].includes(
                e.key,
              )
            ) {
              e.preventDefault();
              if (e.key === "Escape") setCursor(null);
              else if (e.key === "Home") setCursor(0);
              else if (e.key === "End") setCursor(xs.length - 1);
              else
                setCursor((c) =>
                  Math.max(
                    0,
                    Math.min(
                      xs.length - 1,
                      (c ?? -1) + (e.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
                );
            }
          }}
          onBlur={() => setCursor(null)}
          onPointerLeave={() => setCursor(null)}
          onPointerMove={(e) => {
            const box = e.currentTarget.getBoundingClientRect();
            const at = x.invert(((e.clientX - box.left) / box.width) * width);
            setCursor(
              xs.reduce(
                (best, v, i) =>
                  Math.abs(v - at) < Math.abs(xs[best]! - at) ? i : best,
                0,
              ),
            );
          }}
        >
          <svg
            viewBox={`0 0 ${width} ${chartHeight}`}
            role="img"
            aria-labelledby={`${id}-title`}
          >
            <Hatch id={`${id}-gap`} />
            <defs>
              <clipPath id={`${id}-reveal`}>
                <rect
                  className="rv-chart-reveal"
                  width={width}
                  height={chartHeight - 30}
                />
              </clipPath>
            </defs>
            {bands
              .filter(({ start, end }) => end >= xmin && start <= xmax)
              .map(({ start, end, kind }, index) => (
                <rect
                  key={index}
                  x={x(Math.max(xmin, start))}
                  y={24}
                  width={Math.max(
                    0,
                    x(Math.min(xmax, end)) - x(Math.max(xmin, start)),
                  )}
                  height={142}
                  fill={`var(--${kind})`}
                  fillOpacity={0.12}
                  aria-hidden="true"
                />
              ))}
            {type !== "timeline" &&
              y.ticks(3).map((v) => (
                <g key={v}>
                  <line
                    x1={44}
                    x2={width - 32}
                    y1={y(v)}
                    y2={y(v)}
                    stroke="var(--line)"
                  />
                  <text
                    x="34"
                    y={y(v)}
                    dy=".35em"
                    textAnchor="end"
                    className="rv-axis-label"
                  >
                    {number(v, language)}
                  </text>
                </g>
              ))}
            <g clipPath={`url(#${id}-reveal)`}>
              {series.map((s, si) => (
                <g
                  key={s.id}
                  style={{ color: `var(--${s.kind})` }}
                  data-series={s.id}
                >
                  {type === "line" && (
                    <path
                      d={makeLine(s.points) ?? ""}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    />
                  )}
                  {type === "area" && (
                    <>
                      <path
                        d={makeArea(s.points) ?? ""}
                        fill="currentColor"
                        fillOpacity=".15"
                      />
                      <path
                        d={makeLine(s.points) ?? ""}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </>
                  )}
                  {type === "band" && (
                    <>
                      <path
                        d={makeBand(s.points) ?? ""}
                        fill="currentColor"
                        fillOpacity=".2"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                      <path
                        d={makeLine(s.points) ?? ""}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </>
                  )}
                  {type === "bars" &&
                    s.points.map((p) =>
                      p.value === null ? (
                        <rect
                          key={p.x}
                          x={x(p.x) - barWidth / 2}
                          y="24"
                          width={barWidth}
                          height="142"
                          fill={`url(#${id}-gap)`}
                        />
                      ) : (
                        <rect
                          key={p.x}
                          x={x(p.x) - barWidth / 2}
                          y={Math.min(y(0), y(p.value))}
                          width={barWidth}
                          height={Math.abs(y(p.value) - y(0))}
                          rx="2"
                          fill="currentColor"
                        />
                      ),
                    )}
                  {type === "timeline" &&
                    s.points.map((p) => (
                      <rect
                        key={p.x}
                        x={x(p.x)}
                        y={32 + si * 30}
                        width={Math.max(3, x(p.end ?? p.x) - x(p.x))}
                        height="20"
                        rx="3"
                        fill={
                          p.value === null ? `url(#${id}-gap)` : "currentColor"
                        }
                      />
                    ))}
                  {(type === "line" || type === "area" || type === "band") &&
                    s.points
                      .filter((p) => p.value !== null)
                      .map((p) => (
                        <circle
                          key={p.x}
                          cx={x(p.x)}
                          cy={y(p.value!)}
                          r="2.5"
                          fill="currentColor"
                        />
                      ))}
                </g>
              ))}
            </g>
            {ticks.map((tick) => (
              <text
                key={tick.x}
                x={tick.x}
                y={chartHeight - 16}
                textLength={tick.width}
                lengthAdjust="spacingAndGlyphs"
                textAnchor="middle"
                className="rv-axis-label"
                data-axis-label="true"
              >
                {tick.label}
              </text>
            ))}
            {cursorPosition !== undefined && (
              <line
                x1={cursorPosition}
                x2={cursorPosition}
                y1="20"
                y2={chartHeight - 40}
                stroke="var(--ink-soft)"
                strokeDasharray="3 3"
              />
            )}
          </svg>
          {cursorX !== undefined && (
            <div
              className="rv-chart-tooltip"
              role="status"
              style={{
                left: Math.max(0, Math.min(width - 170, cursorPosition! - 80)),
              }}
            >
              <strong>{allPoints.find((p) => p.x === cursorX)?.label}</strong>
              {series.map((s) => {
                const p = s.points.find((p) => p.x === cursorX);
                return (
                  <span key={s.id}>
                    {s.label}:{" "}
                    {p?.value != null
                      ? `${number(p.value, language)} ${unit}`
                      : t("noData")}
                    {type === "band" &&
                      p?.low != null &&
                      p.high != null &&
                      ` (${number(p.low, language)}–${number(p.high, language)} ${unit})`}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
      <p id={`${id}-help`} className="rv-sr">
        {t("chartHelp")}
      </p>
      <table className="rv-sr">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>{t("label")}</th>
            {(["minimum", "maximum", "latest", "trend"] as const).map((k) => (
              <th key={k}>{t(k)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr key={s.id}>
              <th>{s.label}</th>
              {(["min", "max", "latest"] as const).map((k) => (
                <td key={k}>
                  {s.summary[k] === null
                    ? t("noData")
                    : `${number(s.summary[k], language)} ${unit}`}
                </td>
              ))}
              <td>{s.summary.trend}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="rv-chart-legend">
        {series.map((s) => (
          <span key={s.id}>
            <i style={{ background: `var(--${s.kind})` }} />
            {s.label}
          </span>
        ))}
      </div>
      <p className="rv-source-line">
        {t("source")} : {source}
      </p>
    </figure>
  );
}
