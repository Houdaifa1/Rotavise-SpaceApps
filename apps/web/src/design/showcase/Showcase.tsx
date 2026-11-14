import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import {
  DesignLanguage,
  useMessages,
  type Language,
} from "../../i18n/messages.js";
import * as P from "../primitives/index.js";
import { Icon, iconPaths, type IconName } from "../icons/index.js";
import { Logo } from "../motif/Logo.js";
import { preloadFonts } from "../fonts.js";
import tokenSource from "../tokens.css?raw";
import crops from "../../../../../tests/support/fixtures/design/crops.json" with { type: "json" };
import {
  widthSeries,
  referenceDates,
  verificationWidths,
} from "../../../../../tests/support/fixtures/design/specimens.js";
import "../tokens.css";
import "../fonts.css";
import "../primitives/primitives.css";
import "./showcase.css";

const specimenCrops = crops as P.CatalogueCrop[];
const sectionKeys = [
  "foundations",
  "controls",
  "navigation",
  "feedback",
  "crops",
  "charts",
  "overlays",
] as const;
function groups<T>(items: T[]): T[][] {
  return Array.from({ length: Math.ceil(items.length / 7) }, (_, index) =>
    items.slice(index * 7, index * 7 + 7),
  );
}
function Section({
  id,
  children,
}: {
  id: (typeof sectionKeys)[number];
  children: ReactNode;
}) {
  const { t } = useMessages();
  return (
    <section
      id={id}
      className="rv-showcase-section"
      aria-labelledby={`${id}-title`}
    >
      <header>
        <span className="rv-section-index rv-numeric">
          {String(sectionKeys.indexOf(id) + 1).padStart(2, "0")}
        </span>
        <h2 id={`${id}-title`}>{t(id)}</h2>
      </header>
      {children}
    </section>
  );
}
function Specimen({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`rv-specimen ${wide ? "rv-specimen-wide" : ""}`}>
      <h3>{title}</h3>
      <div className="rv-specimen-body">{children}</div>
    </div>
  );
}
function Foundations() {
  const { t } = useMessages();
  const tokens = [...tokenSource.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(
    ([, name, value]) => ({ name: name!, value: value!.trim() }),
  );
  const colorTokens = tokens.filter((token) =>
    /^#[\da-f]+$/i.test(token.value),
  );
  const otherTokens = tokens.filter((token) => !colorTokens.includes(token));
  return (
    <Section id="foundations">
      <Specimen title={t("signature")} wide>
        <div className="rv-signature">
          <Logo />
          <p>{t("signatureText")}</p>
          <div className="rv-signature-bars" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
      </Specimen>
      <Specimen title={t("colors")} wide>
        {groups(colorTokens).map((group, index) => (
          <div
            className="rv-color-tokens"
            key={index}
            role="group"
            aria-label={`${t("colors")} ${index + 1}`}
          >
            {group.map((token) => (
              <div key={token.name}>
                <span
                  style={{ background: `var(${token.name})` }}
                  aria-hidden="true"
                />
                <code data-code>{token.name}</code>
                <small data-code>{token.value}</small>
              </div>
            ))}
          </div>
        ))}
      </Specimen>
      <Specimen title={t("typography")} wide>
        <div className="rv-type-specimens">
          <div>
            <span className="rv-caption">Fraunces · 500</span>
            <p className="rv-display">{t("intro")}</p>
          </div>
          <div>
            <span className="rv-caption">IBM Plex Sans · 400 / 500</span>
            <p>{t("description")}</p>
            <strong>{t("signature")}</strong>
          </div>
          <div>
            <span className="rv-caption">IBM Plex Mono · 400</span>
            <p className="rv-numeric">390 · 768 · 1024 · 1440 px</p>
            <span className="rv-caption">IBM Plex Sans Arabic</span>
            <P.CropName
              cropId={specimenCrops[0]!.id}
              crop={specimenCrops[0]!}
              nameMode="ary"
            />
          </div>
        </div>
      </Specimen>
      <Specimen title={t("spacing")} wide>
        <div className="rv-space-ruler">
          {[
            "tight",
            "small",
            "control",
            "body",
            "group",
            "section",
            "page",
          ].map((s) => (
            <div key={s}>
              <i style={{ width: `var(--space-${s})` }} />
              <code data-code>--space-{s}</code>
            </div>
          ))}
        </div>
        <div className="rv-token-details">
          {Array.from({ length: Math.ceil(otherTokens.length / 7) }, (_, i) => (
            <details key={i}>
              <summary>
                {t("token")} {i * 7 + 1}–
                {Math.min(otherTokens.length, i * 7 + 7)}
              </summary>
              <dl>
                {otherTokens.slice(i * 7, i * 7 + 7).map((token) => (
                  <div key={token.name}>
                    <dt>
                      <code data-code>{token.name}</code>
                    </dt>
                    <dd data-code>{token.value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </div>
      </Specimen>
      <Specimen title={t("icons")} wide>
        {groups(Object.keys(iconPaths) as IconName[]).map((group, index) => (
          <div
            className="rv-icon-grid"
            key={index}
            role="group"
            aria-label={`${t("icons")} ${index + 1}`}
          >
            {group.map((name) => (
              <div key={name}>
                <Icon name={name} />
                <code data-code>{name}</code>
              </div>
            ))}
          </div>
        ))}
      </Specimen>
    </Section>
  );
}
function Controls() {
  const { t } = useMessages();
  const [variant, setVariant] = useState<
    "primary" | "secondary" | "ghost" | "danger"
  >("primary");
  const [buttonState, setButtonState] = useState("default");
  const [size, setSize] = useState<"small" | "regular">("regular");
  const [fieldState, setFieldState] = useState("default");
  const [name, setName] = useState("");
  const [value, setValue] = useState("all");
  const [checked, setChecked] = useState(true);
  const [slider, setSlider] = useState(3);
  const [segment, setSegment] = useState("details");
  const [tab, setTab] = useState("details");
  const [count, setCount] = useState(0);
  const options = (
    ["all", "ready", "partial", "loading", "disabled"] as const
  ).map((value) => ({
    value,
    label: t(value),
    disabled: value === "disabled",
  }));
  const fields = {
    disabled: fieldState === "disabled",
    readOnly: fieldState === "readonly",
    ...(fieldState === "error" ? { error: t("required") } : {}),
    "data-preview-state": fieldState,
  };
  return (
    <Section id="controls">
      <Specimen title="Button · IconButton" wide>
        <div className="rv-control-inspector">
          <P.Select
            label={t("appearance")}
            options={(["primary", "secondary", "ghost", "danger"] as const).map(
              (value) => ({ value, label: t(value) }),
            )}
            value={variant}
            onChange={(v) => setVariant(v as typeof variant)}
          />
          <P.Select
            label={t("status")}
            options={(
              [
                "default",
                "hover",
                "pressed",
                "focus",
                "loading",
                "disabled",
              ] as const
            ).map((value) => ({ value, label: t(value) }))}
            value={buttonState}
            onChange={setButtonState}
          />
          <P.Select
            label={t("value")}
            options={[
              { value: "small", label: t("small") },
              { value: "regular", label: t("regular") },
            ]}
            value={size}
            onChange={(v) => setSize(v as typeof size)}
          />
        </div>
        <div className="rv-button-stage">
          <P.Button
            variant={variant}
            size={size}
            loading={buttonState === "loading"}
            disabled={buttonState === "disabled"}
            data-preview-state={buttonState}
            onClick={() => setCount((c) => c + 1)}
          >
            {t("action")}
          </P.Button>
          <P.IconButton
            icon="save"
            label={t("save")}
            variant={variant === "primary" ? "secondary" : variant}
            size={size}
            loading={buttonState === "loading"}
            disabled={buttonState === "disabled"}
            data-preview-state={buttonState}
            onClick={() => setCount((c) => c + 1)}
          />
          <span className="rv-caption" role="status">
            {t("pressed")} : {count}
          </span>
        </div>
      </Specimen>
      <Specimen title="TextField · NumberField · DateField" wide>
        <P.SegmentedControl
          label={t("status")}
          options={(
            ["default", "focus", "error", "disabled", "readonly"] as const
          ).map((value) => ({ value, label: t(value) }))}
          value={fieldState}
          onChange={setFieldState}
        />
        <div className="rv-grid-three">
          <P.TextField
            label={t("name")}
            hint={t("hint")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            {...fields}
          />
          <P.NumberField label={t("quantity")} unit="ha" {...fields} />
          <P.DateField label={t("date")} {...fields} />
        </div>
      </Specimen>
      <Specimen title="Select · SearchSelect">
        <P.Select
          label={t("status")}
          options={options}
          value={value}
          onChange={setValue}
        />
        <P.SearchSelect
          label={t("search")}
          options={options}
          value={value}
          onChange={setValue}
        />
        <P.Select
          label={t("disabled")}
          options={options}
          value={value}
          onChange={setValue}
          disabled
        />
      </Specimen>
      <Specimen title="Switch · Slider">
        <P.Switch label={t("show")} checked={checked} onChange={setChecked} />
        <P.Switch label={t("off")} checked={false} onChange={setChecked} />
        <P.Switch
          label={t("disabled")}
          checked
          disabled
          onChange={setChecked}
        />
        <P.Slider
          label={t("priority")}
          value={slider}
          onChange={setSlider}
          unit="/ 5"
        />
        <P.Slider
          label={t("disabled")}
          value={0}
          disabled
          onChange={setSlider}
          unit="/ 5"
        />
      </Specimen>
      <Specimen title="SegmentedControl · Tabs" wide>
        <P.SegmentedControl
          label={t("details")}
          options={(["details", "sources", "disabled"] as const).map(
            (value) => ({
              value,
              label: t(value),
              disabled: value === "disabled",
            }),
          )}
          value={segment}
          onChange={setSegment}
        />
        <P.Tabs
          label={t("details")}
          items={[
            {
              value: "details",
              label: t("details"),
              content: t("description"),
            },
            { value: "sources", label: t("sources"), content: t("sourceSpec") },
            {
              value: "disabled",
              label: t("disabled"),
              content: t("disabled"),
              disabled: true,
            },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Specimen>
    </Section>
  );
}
function Navigation() {
  const { t } = useMessages();
  const [active, setActive] = useState("map");
  const [open, setOpen] = useState(false);
  const [legend, setLegend] = useState(true);
  const [date, setDate] = useState(referenceDates[0]!);
  const [dateState, setDateState] = useState("ready");
  const [compare, setCompare] = useState(50);
  const [pressed, setPressed] = useState(false);
  const nav = (["map", "fields", "plans", "crops", "account"] as const).map(
    (key, i) => ({
      id: key,
      label: t(key),
      icon: (["map", "fields", "rotation", "crop", "user"] as IconName[])[i]!,
      onPress: () => setActive(key),
      ...(key === "plans" ? { badge: "1" } : {}),
    }),
  );
  return (
    <Section id="navigation">
      <Specimen title="AppShell · IconRail · TabBar" wide>
        <P.AppShell
          items={nav}
          active={active}
          list={
            <P.Panel title={t("panel")} subtitle={t("design")}>
              <P.EmptyState title={t("empty")} text={t("emptyText")} />
            </P.Panel>
          }
          detail={
            <P.DetailPanel title={t("details")}>
              <P.ReminderBar />
              <P.CropStrip
                label={t("crops")}
                slots={specimenCrops.map((crop) => ({
                  id: crop.id,
                  cropId: crop.id,
                  crop,
                }))}
              />
            </P.DetailPanel>
          }
        >
          <span className="rv-caption">{t("appearance")}</span>
        </P.AppShell>
        <P.TabBar items={nav} active={active} label={t("appearance")} />
      </Specimen>
      <Specimen title="FloatingChip · MapTools">
        <div className="rv-row">
          <P.FloatingChip
            label={t("layers")}
            value={t("default")}
            open={open}
            onPress={() => setOpen(!open)}
          />
          <P.FloatingChip
            label={t("disabled")}
            disabled
            onPress={() => setOpen(!open)}
          />
        </div>
        <P.MapTools
          items={[
            {
              icon: "zoom-in",
              label: t("zoomIn"),
              onPress: () => setPressed(!pressed),
              pressed,
            },
            {
              icon: "zoom-out",
              label: t("zoomOut"),
              onPress: () => setPressed(!pressed),
            },
            {
              icon: "locate",
              label: t("locate"),
              onPress: () => setPressed(!pressed),
              disabled: true,
            },
            {
              icon: "layers",
              label: t("layers"),
              onPress: () => setOpen(!open),
            },
          ]}
        />
        {open && <P.StatusChip status="ready" />}
      </Specimen>
      <Specimen title="LegendCard · DateStepper">
        <P.LegendCard
          title={t("legend")}
          open={legend}
          onOpenChange={setLegend}
          items={(["water", "heat", "vegetation", "bare"] as const).map(
            (kind) => ({ kind, label: t(kind) }),
          )}
        />
        <P.Select
          label={t("status")}
          options={(["ready", "noImage", "cloudy", "loading"] as const).map(
            (value) => ({ value, label: t(value) }),
          )}
          value={dateState}
          onChange={setDateState}
        />
        <P.DateStepper
          dates={referenceDates}
          value={date}
          onChange={setDate}
          status={dateState as "ready" | "noImage" | "cloudy" | "loading"}
        />
      </Specimen>
      <Specimen title="CompareSlider" wide>
        <P.CompareSlider
          left={<span>{t("left")}</span>}
          right={<span>{t("right")}</span>}
          value={compare}
          onChange={setCompare}
        />
      </Specimen>
    </Section>
  );
}
function Feedback({ notify }: { notify: () => void }) {
  const { t } = useMessages();
  const [progress, setProgress] = useState(40);
  return (
    <Section id="feedback">
      <Specimen title="SourceChip · StatusChip · TermChip" wide>
        <div className="rv-row">
          {(["sourced", "mixed", "recalled", "missing"] as const).map(
            (kind) => (
              <P.SourceChip
                key={kind}
                kind={kind}
                onClick={notify}
                expertReviewed={kind === "sourced"}
              />
            ),
          )}
        </div>
        <div className="rv-row">
          {(["ready", "loading", "partial", "failed", "disabled"] as const).map(
            (status) => (
              <P.StatusChip key={status} status={status} />
            ),
          )}
        </div>
        <P.TermChip text={t("details")} onClick={notify} />
      </Specimen>
      <Specimen title="EmptyState">
        <P.EmptyState
          title={t("empty")}
          text={t("emptyText")}
          action={{ label: t("show"), onClick: notify }}
        />
      </Specimen>
      <Specimen title="ErrorState · PartialState">
        <P.ErrorState
          title={t("failed")}
          text={t("errorText")}
          action={{ label: t("retry"), onClick: notify }}
        />
        <P.PartialState
          title={t("partial")}
          text={t("partialText")}
          action={{ label: t("details"), onClick: notify }}
        />
      </Specimen>
      <Specimen title="Skeleton">
        <P.Skeleton shape="line" />
        <P.Skeleton shape="row" />
        <P.Skeleton shape="circle" />
        <P.Skeleton shape="chart" />
      </Specimen>
      <Specimen title="ProgressBar · StepProgress">
        <P.ProgressBar value={progress} label={t("progress")} />
        <P.Slider
          label={t("value")}
          value={progress}
          min={0}
          max={100}
          unit="%"
          onChange={setProgress}
        />
        <P.ProgressBar label={t("indeterminate")} />
        <P.StepProgress
          steps={[t("fields"), t("crops"), t("sources")]}
          current={1}
        />
        <P.StepProgress steps={[t("fields"), t("crops"), t("sources")]} />
      </Specimen>
      <Specimen title="ReminderBar · OfflineBar · Toast" wide>
        <P.ReminderBar />
        <P.OfflineBar />
        <P.Button onClick={notify}>{t("toastAction")}</P.Button>
      </Specimen>
    </Section>
  );
}
function Crops() {
  const { t } = useMessages();
  const [mode, setMode] = useState<P.NameMode>("fr");
  const [slot, setSlot] = useState(specimenCrops[0]!.id);
  return (
    <Section id="crops">
      <Specimen title="CropStrip" wide>
        <P.CropStrip
          label={t("crops")}
          interactive
          selected={slot}
          onSelect={setSlot}
          slots={[
            ...specimenCrops.map((crop) => ({
              id: crop.id,
              cropId: crop.id,
              crop,
            })),
            { id: "empty" },
            { id: "unknown", cropId: "unlisted" },
          ]}
        />
        <P.CropStrip
          label={t("crops")}
          size="small"
          slots={specimenCrops.map((crop) => ({
            id: crop.id,
            cropId: crop.id,
            crop,
          }))}
        />
      </Specimen>
      <Specimen title="CropName · CropSwatch" wide>
        <P.Select
          label={t("cropNames")}
          options={[
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
            { value: "ar", label: "العربية" },
            { value: "ary", label: "Darija" },
            { value: "all", label: t("all") },
          ]}
          value={mode}
          onChange={(value) => setMode(value as P.NameMode)}
        />
        <div className="rv-crop-rows">
          {specimenCrops.map((crop) => (
            <div key={crop.id}>
              <P.CropSwatch
                cropId={crop.id}
                family={crop.family}
                label={crop.name}
              />
              <P.CropName cropId={crop.id} crop={crop} nameMode={mode} />
            </div>
          ))}
          <div>
            <P.CropSwatch cropId="unlisted" label={t("unknownCrop")} />
            <P.CropName cropId="unlisted" />
          </div>
        </div>
      </Specimen>
    </Section>
  );
}
function Charts() {
  const { t } = useMessages();
  const [chartState, setChartState] = useState("ready");
  const [loss, setLoss] = useState<number | null>(null);
  const series =
    chartState === "empty"
      ? []
      : widthSeries(t("width"), t("rising"), chartState === "partial");
  return (
    <Section id="charts">
      <Specimen title="RangeBar · ScoreBar">
        <P.RangeBar
          min={390}
          max={1440}
          domain={[0, 1600]}
          unit="px"
          label={t("range")}
        />
        <P.RangeBar
          min={768}
          max={768}
          domain={[0, 1600]}
          unit="px"
          label={t("value")}
        />
        <P.RangeBar
          min={null}
          max={null}
          domain={[0, 1600]}
          unit="px"
          label={t("noData")}
        />
        <P.ScoreBar label={t("appearance")} loss={loss} />
        <P.Button onClick={() => setLoss((v) => (v === null ? 0.4 : null))}>
          {t("show")}
        </P.Button>
        <p className="rv-caption">{t("sourceSpec")}</p>
      </Specimen>
      <Specimen title="StatCard · DataTable">
        <P.StatCard
          label={t("statLabel")}
          value="1440 px"
          caption={t("statCaption")}
        />
        <P.DataTable
          label={t("width")}
          rows={verificationWidths.map((width) => ({
            id: String(width),
            width,
          }))}
          columns={[
            {
              key: "width",
              label: t("width"),
              compare: (a, b) => a.width - b.width,
              render: (row) => `${row.width} px`,
            },
          ]}
        />
        <P.DataTable
          label={t("empty")}
          rows={[] as { id: string; width: number }[]}
          columns={[{ key: "width", label: t("width") }]}
        />
      </Specimen>
      <Specimen title="SeriesChart" wide>
        <P.SegmentedControl
          label={t("status")}
          options={(["ready", "partial", "empty"] as const).map((value) => ({
            value,
            label: t(value),
          }))}
          value={chartState}
          onChange={setChartState}
        />
        <div className="rv-chart-grid">
          {(["line", "area", "band", "bars", "timeline"] as const).map(
            (type) => (
              <P.SeriesChart
                key={type}
                type={type}
                title={t(
                  (
                    {
                      line: "chartLine",
                      area: "chartArea",
                      band: "chartBand",
                      bars: "chartBars",
                      timeline: "chartTimeline",
                    } as const
                  )[type],
                )}
                series={series}
                unit="px"
                source={t("sourceSpec")}
                partial={chartState === "partial"}
              />
            ),
          )}
        </div>
      </Specimen>
    </Section>
  );
}
function Overlays({ notify }: { notify: () => void }) {
  const { t } = useMessages();
  const [detent, setDetent] = useState<P.Detent>("half");
  const [panelState, setPanelState] = useState("open");
  const [panelOpen, setPanelOpen] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  return (
    <Section id="overlays">
      <Specimen title="Dialog · ConfirmDialog · Tooltip · Popover" wide>
        <div className="rv-row">
          <P.Dialog
            trigger={<P.Button>{t("open")}</P.Button>}
            title={t("dialogTitle")}
            body={t("dialogText")}
          />
          <P.ConfirmDialog
            trigger={<P.Button variant="danger">{t("delete")}</P.Button>}
            title={t("confirmTitle")}
            body={t("confirmText")}
            onConfirm={notify}
          />
          <P.Tooltip content={t("tooltip")}>
            <P.IconButton icon="help" label={t("details")} />
          </P.Tooltip>
          <P.Popover
            title={t("details")}
            trigger={<P.Button>{t("details")}</P.Button>}
          >
            <p>{t("tooltip")}</p>
          </P.Popover>
          <P.GlossaryTerm
            entry={{
              code: "interface",
              group: "term",
              term: t("design"),
              meaning: t("description"),
            }}
          />
        </div>
      </Specimen>
      <Specimen title="Panel · DetailPanel">
        <P.Select
          label={t("status")}
          options={(["open", "closing", "loading"] as const).map((value) => ({
            value,
            label: t(value),
          }))}
          value={panelState}
          onChange={(v) => {
            setPanelState(v);
            setPanelOpen(true);
          }}
        />
        {panelOpen ? (
          <P.DetailPanel
            title={t("detailPanel")}
            subtitle={t("design")}
            state={panelState as "open" | "closing" | "loading"}
            onClose={() => setPanelOpen(false)}
          >
            <p>{t("description")}</p>
          </P.DetailPanel>
        ) : (
          <P.Button onClick={() => setPanelOpen(true)}>{t("open")}</P.Button>
        )}
      </Specimen>
      <Specimen title="BottomSheet">
        <P.BottomSheet
          title={t("sheet")}
          trigger={<P.Button>{t("sheet")}</P.Button>}
          detent={detent}
          onDetent={setDetent}
        >
          <P.EmptyState title={t("empty")} text={t("emptyText")} />
        </P.BottomSheet>
        <p className="rv-caption">{t("motion")}</p>
      </Specimen>
      <Specimen title="PhotoPicker">
        <P.PhotoPicker maxBytes={5_000_000} file={file} onChange={setFile} />
      </Specimen>
      <Specimen title="StepWizard">
        <P.StepWizard
          current={step}
          onCurrentChange={setStep}
          onComplete={notify}
          steps={[
            { id: "one", label: t("fields"), content: t("description") },
            { id: "two", label: t("crops"), content: t("signatureText") },
            { id: "three", label: t("sources"), content: t("sourceSpec") },
          ]}
        />
      </Specimen>
    </Section>
  );
}
function Workshop({
  language,
  setLanguage,
}: {
  language: Language;
  setLanguage: (value: Language) => void;
}) {
  const { t } = useMessages();
  const [toast, setToast] = useState(false);
  const dismiss = useCallback(() => setToast(false), []);
  const notify = useCallback(() => setToast(true), []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = `Rotavise · ${t("design")}`;
  }, [language, t]);
  return (
    <div className="rv-design rv-ui" lang={language}>
      <a className="rv-skip" href="#design-main">
        {t("skip")}
      </a>
      <header className="rv-workshop-header">
        <Logo />
        <span className="rv-header-caption">{t("design")}</span>
        <P.LanguageSwitch value={language} onChange={setLanguage} />
      </header>
      <aside className="rv-workshop-sidebar">
        <span className="rv-caption">{t("review")}</span>
        <nav aria-label={t("design")}>
          {sectionKeys.map((key, i) => (
            <a href={`#${key}`} key={key}>
              <span className="rv-numeric">
                {String(i + 1).padStart(2, "0")}
              </span>
              {t(key)}
            </a>
          ))}
        </nav>
        <div className="rv-sidebar-footer">
          <span>{t("light")}</span>
          <P.ReminderBar />
        </div>
      </aside>
      <main id="design-main" className="rv-workshop-main" tabIndex={-1}>
        <div className="rv-workshop-intro">
          <span className="rv-eyebrow">Rotavise / F0</span>
          <h1>{t("intro")}</h1>
          <p>{t("description")}</p>
          <div className="rv-intro-meta">
            <span>{t("light")}</span>
            <span>390 / 768 / 1024 / 1440 px</span>
          </div>
          <p className="rv-specimen-notice">{t("specimens")}</p>
        </div>
        <Foundations />
        <Controls />
        <Navigation />
        <Feedback notify={notify} />
        <Crops />
        <Charts />
        <Overlays notify={notify} />
        <footer className="rv-workshop-footer">
          <Logo />
          <p>{t("unreviewed")}</p>
          <P.ReminderBar />
        </footer>
      </main>
      {toast && <P.Toast message={t("toast")} onDismiss={dismiss} />}
    </div>
  );
}
function Showcase() {
  const [language, setLanguage] = useState<Language>("fr");
  return (
    <DesignLanguage language={language}>
      <Workshop language={language} setLanguage={setLanguage} />
    </DesignLanguage>
  );
}
export function mountDesign(element: HTMLElement) {
  preloadFonts();
  document.body.classList.add("rv-workshop-body");
  createRoot(element).render(<Showcase />);
}
