import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  CanopyBiomassResult,
  ExtractionResult,
  ObservationResult,
  WaterStorageResult,
} from "@rotavise/contracts";
import {
  getRainAnalysis,
  getVegetationAnalysis,
  getVegetationHistory,
} from "../../../api/analysis.js";
import { keys, stale } from "../../../api/keys.js";
import {
  useApi,
  useBoot,
  useOffline,
  useSession,
} from "../../../app/providers/Runtime.js";
import { Select } from "../../../design/primitives/controls.js";
import {
  SeriesChart,
  type ChartBand,
  type ChartPoint,
  type ChartSeries,
} from "../../../design/primitives/SeriesChart.js";
import { calendarDate, monthDay, number } from "../../../i18n/format.js";
import { useMessages, type MessageKey } from "../../../i18n/messages.js";
import { ShortList } from "../../../shared/ShortList.js";
import { findTerm } from "../../../shared/glossaryText.js";
import { GlossaryTerm } from "../../glossary/GlossaryTerm.js";
import { DataError } from "../../../shared/DataError.js";

type Result =
  | CanopyBiomassResult
  | ExtractionResult
  | ObservationResult
  | WaterStorageResult;
const sources = {
  hls: "hls",
  modis: "modis",
  gpm: "gpm",
  smap: "smap",
  ecostress: "ecostress",
  terrain: "nasadem",
  grace: "grace",
  gedi: "gedi",
} as const;

export default function NasaAnalysis({
  id,
  result,
}: {
  id: string;
  result: Result;
}) {
  const { t, language } = useMessages();
  const fmt = (value: number | null, unit = "") =>
    value === null
      ? t("f4.noData")
      : `${number(value, language)}${unit ? ` ${unit}` : ""}`;
  const date = (value: string) => calendarDate(value, language);
  const month = (value: string) =>
    new Intl.DateTimeFormat(language, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}-01T12:00:00Z`));
  const range = (start: string, end: string) =>
    t("f4.range", { start: date(start), end: date(end) });
  const product =
    result.kind === "ecostress" ? result.products.join(" · ") : result.product;
  const source = `${product}${"period" in result ? ` · ${range(result.period.start, result.period.end)}` : ""}`;
  let body;
  switch (result.kind) {
    case "hls":
      body = <Vegetation id={id} source={source} />;
      break;
    case "modis":
      body = <Modis id={id} source={source} />;
      break;
    case "gpm":
      body = <Rain id={id} source={source} />;
      break;
    case "smap":
      body = (
        <>
          <p>{t("nasa.smapHelp")}</p>
          <Chart
            title="nasa.smap"
            unit="%"
            source={source}
            series={[
              [
                "nasa.percentile",
                "water",
                result.days.map((item) => [
                  date(item.date),
                  item.percentile,
                  Date.parse(item.date),
                ]),
              ],
            ]}
          />
          <Chart
            title="nasa.volumetric"
            unit="m³/m³"
            source={source}
            series={[
              [
                "nasa.volumetric",
                "water",
                result.days.map((item) => [
                  date(item.date),
                  item.volumetric,
                  Date.parse(item.date),
                ]),
              ],
            ]}
          />
        </>
      );
      break;
    case "terrain":
      body = (
        <>
          <p>
            {t("nasa.elevation")} · {fmt(result.elevation?.meanM ?? null, "m")}
          </p>
          {result.elevation && (
            <p>
              {t("f4.range", {
                start: fmt(result.elevation.minM, "m"),
                end: fmt(result.elevation.maxM, "m"),
              })}
            </p>
          )}
          <p>
            {t("nasa.slope")} · {fmt(result.slope?.meanPercent ?? null, "%")}
          </p>
          {result.slope && (
            <p>
              {t("nasa.slopeP90")} · {fmt(result.slope.p90Percent, "%")}
            </p>
          )}
          <p>
            {t("nasa.frost")} · {t(`nasa.frost.${result.frostPocket.status}`)}
          </p>
          {result.frostPocket.belowSurroundingM !== null && (
            <p>
              {t("nasa.frostBelow")} ·{" "}
              {fmt(result.frostPocket.belowSurroundingM, "m")}
            </p>
          )}
          {result.erosion && (
            <p>
              {t("nasa.erosion")} · {fmt(result.erosion.lsFactorMean)}
            </p>
          )}
          <p>{t("nasa.erosionGap")}</p>
        </>
      );
      break;
    case "ecostress":
      body = (
        <>
          <p>{t("nasa.ecostressHelp")}</p>
          <ShortList
            items={[...result.months].reverse()}
            render={(item) => (
              <>
                <strong>{month(item.month)}</strong>
                <p>
                  {t("nasa.temperatureMean")} · {fmt(item.lstMeanC, "°C")} ·{" "}
                  {t("nasa.temperatureMax")} · {fmt(item.lstMaxC, "°C")}
                </p>
                <p>
                  {t("nasa.esiMean")} · {fmt(item.esiMean)} · {t("nasa.esiMin")}{" "}
                  · {fmt(item.esiMin)}
                </p>
                <p>{t("nasa.scenes", { count: item.acquisitions })}</p>
              </>
            )}
          />
        </>
      );
      break;
    case "grace":
      body = (
        <>
          <p>{result.resolutionNote}</p>
          <p>{t("nasa.graceHelp")}</p>
          <p>
            {t("nasa.waterTrend")} · {t(`nasa.trend.${result.trend.direction}`)}{" "}
            · {fmt(result.trend.trendCmPerYear, t("nasa.cmPerYear"))}
          </p>
          <p>
            {t("nasa.trendInterval")} ·{" "}
            {t("f4.range", {
              start: fmt(
                result.trend.interval95CmPerYear[0],
                t("nasa.cmPerYear"),
              ),
              end: fmt(
                result.trend.interval95CmPerYear[1],
                t("nasa.cmPerYear"),
              ),
            })}
          </p>
          <p>
            {t("nasa.cellDistance")} · {fmt(result.cell.distanceKm, "km")}
          </p>
          <Chart
            title="nasa.grace"
            unit="cm"
            source={`${source} · ${t("f4.range", { start: month(result.trend.period.start), end: month(result.trend.period.end) })}`}
            series={[
              [
                "nasa.waterAnomaly",
                "water",
                result.recentMonths.map((item) => [
                  month(item.month),
                  item.anomalyCm,
                ]),
              ],
            ]}
          />
        </>
      );
      break;
    case "gedi":
      body = (
        <>
          <p>{result.resolutionNote}</p>
          <p>{t("nasa.gediHelp")}</p>
          <p>
            {t("nasa.fieldCell")} ·{" "}
            {fmt(result.fieldCell?.agbdMgHa ?? null, "Mg/ha")}
          </p>
          {result.fieldCell?.seMgHa != null && (
            <p>
              {t("nasa.standardError")} ·{" "}
              {fmt(result.fieldCell.seMgHa, "Mg/ha")}
            </p>
          )}
          <p>
            {t("nasa.nearbyMean", {
              radius: fmt(result.surroundings.radiusKm, "km"),
            })}{" "}
            · {fmt(result.surroundings.meanAgbdMgHa, "Mg/ha")}
          </p>
          <p>
            {t("nasa.nearbyRange")} ·{" "}
            {t("f4.range", {
              start: fmt(result.surroundings.minAgbdMgHa, "Mg/ha"),
              end: fmt(result.surroundings.maxAgbdMgHa, "Mg/ha"),
            })}
          </p>
          <p>{t("nasa.cells", { count: result.surroundings.cellsInRadius })}</p>
          <p>
            {range(
              result.observationPeriod.start,
              result.observationPeriod.end,
            )}
          </p>
        </>
      );
      break;
  }
  return (
    <details className="f4-evidence">
      <summary className="f4-evidence-summary">{t("nasa.details")}</summary>
      <GlossaryTerm
        code={`product.${sources[result.kind]}`}
        label={t("nasa.howToRead")}
      />
      <p className="f4-source">
        {t("source")} · <span data-code>{source}</span>
      </p>
      {body}
      <details>
        <summary className="f4-evidence-summary">{t("nasa.limits")}</summary>
        <ShortList items={result.limitations} render={(limit) => limit} />
      </details>
    </details>
  );
}

type Series = [
  MessageKey,
  ChartSeries["kind"],
  [string, number | null, number?][],
];
function Chart({
  title,
  series,
  unit,
  source,
  partial,
  bands,
  type = "line",
}: {
  title: MessageKey;
  series: Series[];
  unit: string;
  source: string;
  partial?: boolean;
  bands?: ChartBand[];
  type?: "line" | "bars";
}) {
  const { t } = useMessages();
  return (
    <SeriesChart
      type={type}
      {...(bands ? { bands } : {})}
      title={t(title)}
      unit={unit}
      source={<span data-code>{source}</span>}
      partial={partial ?? false}
      series={series.map(([key, kind, data]) => {
        const values = data.flatMap(([, value]) =>
          value === null ? [] : [value],
        );
        const points: ChartPoint[] = data.map(
          ([label, value, position], index) => ({
            x: position ?? index,
            label,
            value,
          }),
        );
        return {
          id: key,
          kind,
          label: t(key),
          points,
          summary: {
            min: values.length ? Math.min(...values) : null,
            max: values.length ? Math.max(...values) : null,
            latest: data.at(-1)?.[1] ?? null,
            trend: t("nasa.trendUnreported"),
          },
        };
      })}
    />
  );
}
function useAnalysis<T>(
  id: string,
  kind: string,
  fetch: (
    client: ReturnType<typeof useApi>,
    options: { params: { id: string }; signal: AbortSignal },
  ) => Promise<T>,
) {
  const client = useApi();
  const { scope } = useSession();
  const offline = useOffline();
  return useQuery({
    queryKey: keys.analysis(scope, id, kind),
    enabled: !offline,
    staleTime: stale.analysis,
    refetchOnMount: "always",
    queryFn: ({ signal }) => fetch(client, { params: { id }, signal }),
  });
}
function AnalysisState({
  query,
}: {
  query: {
    error: Error | null;
    isFetching: boolean;
    refetch: () => unknown;
    data:
      | { status: "ready" }
      | { status: "unavailable"; observation: string; error: string | null }
      | undefined;
  };
}) {
  const { t } = useMessages();
  const { glossary } = useBoot();
  if (query.error)
    return (
      <DataError
        error={query.error}
        busy={query.isFetching}
        retry={() => void query.refetch()}
      />
    );
  if (query.isFetching) return <p role="status">{t("loading")}</p>;
  const data = query.data;
  return (
    <p>
      {data?.status === "unavailable"
        ? ((data.error
            ? findTerm(glossary.data, data.error, "error")?.meaning
            : findTerm(glossary.data, data.observation, "status")?.meaning) ??
          t("f4.noData"))
        : t("f4.noData")}
    </p>
  );
}
function Vegetation({ id, source }: { id: string; source: string }) {
  const { t, language } = useMessages();
  const { glossary } = useBoot();
  const query = useAnalysis(id, "vegetation", getVegetationAnalysis);
  const [year, setYear] = useState("");
  if (query.data?.status !== "ready") return <AnalysisState query={query} />;
  const a = query.data.analysis;
  const selected =
    a.years.find((item) => String(item.year) === year) ??
    a.years.findLast((item) => item.timeline.length) ??
    a.years.at(-1);
  const date = (value: string) => calendarDate(value, language);
  return (
    <>
      {selected && (
        <>
          <Select
            label={t("nasa.year")}
            value={String(selected.year)}
            onChange={setYear}
            options={a.years.map((item) => ({
              value: String(item.year),
              label: String(item.year),
            }))}
          />
          <Chart
            title="nasa.hls"
            unit="NDVI"
            source={source}
            partial={selected.status === "partial"}
            bands={selected.periods.map((period) => ({
              start: Date.parse(period.start),
              end: Date.parse(period.end),
              kind: period.kind === "green" ? "vegetation" : "bare",
            }))}
            series={[
              [
                "nasa.hls",
                "vegetation",
                selected.timeline.map((item) => [
                  date(item.date),
                  item.ndvi,
                  Date.parse(item.date),
                ]),
              ],
            ]}
          />
          <ShortList
            items={selected.periods}
            render={(item) => (
              <>
                {t(`nasa.period.${item.kind}`)} ·{" "}
                {t("f4.range", {
                  start: date(item.start),
                  end: date(item.end),
                })}
                {item.peakDate && item.peakNdvi !== null && (
                  <p>
                    {t("nasa.peak")} · {date(item.peakDate)} ·{" "}
                    {number(item.peakNdvi, language)} NDVI
                  </p>
                )}
              </>
            )}
          />
        </>
      )}
      <p>{t("nasa.lowHelp")}</p>
      <strong>{t("nasa.usuallyLow")}</strong>
      <ShortList
        items={a.typicalLowGreenness?.windows ?? []}
        render={(item) => (
          <>
            {t("f4.range", {
              start: monthDay(item.start, language),
              end: monthDay(item.end, language),
            })}{" "}
            · {t("crops.years", { count: item.yearsLowMin })}
          </>
        )}
      />
      {a.anomalies.latest && (
        <p>
          {t("nasa.latest")} · {date(a.anomalies.latest.date)} ·{" "}
          {t(`nasa.flag.${a.anomalies.latest.flag}`)}
          {a.anomalies.latest.stale && ` · ${t("nasa.stale")}`}
        </p>
      )}
      <details>
        <summary className="f4-evidence-summary">{t("nasa.quality")}</summary>
        <p>
          {t("nasa.usableShare")} ·{" "}
          {number(a.uncertainty.usableShare * 100, language)} %
        </p>
        <p>
          {t("nasa.largestGap")} ·{" "}
          {t("crops.days", { count: a.uncertainty.largestGapDays })}
        </p>
        <ShortList
          items={a.explanations}
          render={(item) =>
            findTerm(glossary.data, item.key, "term")?.meaning ?? item.text
          }
        />
      </details>
    </>
  );
}
function Modis({ id, source }: { id: string; source: string }) {
  const { t, language } = useMessages();
  const { glossary } = useBoot();
  const query = useAnalysis(id, "vegetation-history", getVegetationHistory);
  if (query.data?.status !== "ready") return <AnalysisState query={query} />;
  const h = query.data.history;
  const md = (value: string) => monthDay(value, language);
  return (
    <>
      <Chart
        title="nasa.modis"
        unit="%"
        source={source}
        series={[
          [
            "nasa.period.low_greenness",
            "bare",
            h.bins.map((bin) => [
              md(bin.start),
              bin.lowShare === null ? null : bin.lowShare * 100,
            ]),
          ],
          [
            "nasa.period.green",
            "vegetation",
            h.bins.map((bin) => [
              md(bin.start),
              bin.greenShare === null ? null : bin.greenShare * 100,
            ]),
          ],
        ]}
      />
      <strong>{t("nasa.usuallyLow")}</strong>
      <ShortList
        items={h.usuallyLow.windows}
        render={(item) => (
          <>
            {t("f4.range", { start: md(item.start), end: md(item.end) })} ·{" "}
            {t("crops.years", { count: item.yearsMin })}
          </>
        )}
      />
      <strong>{t("nasa.usuallyGreen")}</strong>
      <ShortList
        items={h.usuallyGreen.windows}
        render={(item) => (
          <>
            {t("f4.range", { start: md(item.start), end: md(item.end) })} ·{" "}
            {t("crops.years", { count: item.yearsMin })}
          </>
        )}
      />
      <p>{h.source.note}</p>
      <p>
        {t("nasa.peakTrend")} ·{" "}
        {findTerm(glossary.data, h.peakTrend.direction, "status")?.term ??
          t("f4.noData")}
      </p>
      {h.peakTrend.slopePerDecade !== null && (
        <p>
          {t("nasa.peakRate")} · {number(h.peakTrend.slopePerDecade, language)}{" "}
          {t("nasa.perDecade")}
        </p>
      )}
      {h.hlsAgreement && (
        <p>
          {t("nasa.agreement")} ·{" "}
          {findTerm(glossary.data, h.hlsAgreement.status, "status")?.term ??
            t("f4.noData")}
        </p>
      )}
    </>
  );
}
function Rain({ id, source }: { id: string; source: string }) {
  const { language } = useMessages();
  const query = useAnalysis(id, "rain", getRainAnalysis);
  if (query.data?.status !== "ready") return <AnalysisState query={query} />;
  const rain = query.data.series;
  const label = (month: string) =>
    new Intl.DateTimeFormat(language, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${month}-01T12:00:00Z`));
  return (
    <>
      <Chart
        title="nasa.gpm"
        unit="mm"
        source={`${source} · ${rain.sources.power}`}
        partial={rain.months.some((item) => !item.bothComplete)}
        series={[
          [
            "nasa.imerg",
            "water",
            rain.months.map((item) => [label(item.month), item.imergMm]),
          ],
          [
            "nasa.power",
            "bare",
            rain.months.map((item) => [label(item.month), item.powerMm]),
          ],
        ]}
      />
      <p>{rain.planning}</p>
      <ShortList items={rain.limitations} render={(item) => item} />
    </>
  );
}
