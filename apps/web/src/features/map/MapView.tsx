import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Icon } from "../../design/icons/index.js";
import { IconButton } from "../../design/primitives/controls.js";
import { Popover as PanelPopover } from "../../design/primitives/feedback.js";
import { useMessages } from "../../i18n/messages.js";
import { calendarDate, number } from "../../i18n/format.js";
import type { MappedField } from "../fields/index.js";
import { ImageryControls, LayerChip } from "./ImageryControls.js";
import type { MapRenderer } from "./mapRenderer.js";
import type { BaseLayer } from "./basemap.js";
import { previousDays, type Position, type Product } from "./gibs.js";
import { recentDays, today, useImagery } from "./useImagery.js";

type Status =
  "loading" | "ready" | "tiles-failed" | "context-lost" | "unavailable";
type Settings = {
  product: Product;
  end: string;
  requested: string;
  manual: string;
};
const initialSettings: Settings = {
  product: "hls",
  end: today,
  requested: "",
  manual: "",
};
const initialCamera = { center: [-6.5, 31.8] as Position, zoom: 6 };

export function MapView({
  fields,
  selected,
  onSelect,
  onSearch,
  onRenderer,
}: {
  fields: MappedField[];
  selected: MappedField | undefined;
  onSelect: (id: string) => void;
  onSearch: () => void;
  onRenderer?: (renderer: MapRenderer | undefined) => void;
}) {
  const { t, language } = useMessages();
  const mainHost = useRef<HTMLDivElement>(null);
  const compareHost = useRef<HTMLDivElement>(null);
  const [main, setMain] = useState<MapRenderer>();
  const [second, setSecond] = useState<MapRenderer>();
  const [camera, setCamera] = useState(initialCamera);
  const [status, setStatus] = useState<Status>("loading");
  const [engineAttempt, setEngineAttempt] = useState(0);
  const [layersOpen, setLayersOpen] = useState(false);
  const [base, setBase] = useState<BaseLayer>("satellite");
  const [settings, setSettings] = useState(initialSettings);
  const [attempt, setAttempt] = useState(0);
  const [comparing, setComparing] = useState(false);
  const [chosenComparison, setChosenComparison] = useState("");
  const [split, setSplit] = useState(50);
  const [locate, setLocate] = useState<"idle" | "pending" | "failed">("idle");
  const [compareFailed, setCompareFailed] = useState(false);
  const controlsId = useId();
  const keyboardId = useId();
  const layerTool = useRef<HTMLButtonElement>(null);
  const fromTool = useRef(false);
  const canvasLabel = t("map.surface");
  const current = useRef({ onSelect, canvasLabel });
  current.current = { onSelect, canvasLabel };
  const { product, end, requested, manual } = settings;
  const useHls = base === "nasa" && product === "hls" && camera.zoom >= 9;
  const modis = useImagery(
    "modis",
    camera.center,
    product === "modis" ? end : today,
    product === "modis" ? manual : "",
    !!main && base === "nasa" && (product === "modis" || !useHls),
    attempt,
    layersOpen || product === "modis" ? recentDays : 3,
  );
  const hls = useImagery(
    "hls",
    camera.center,
    product === "hls" ? end : today,
    product === "hls" ? manual : "",
    !!main && base === "nasa" && product === "hls" && (layersOpen || useHls),
    attempt,
  );
  const scan = product === "hls" ? hls : modis;
  const date = scan.dates.includes(requested) ? requested : scan.dates[0];
  const secondDate =
    scan.dates.includes(chosenComparison) && chosenComparison !== date
      ? chosenComparison
      : scan.dates.find((candidate) => candidate !== date);
  const compareDate =
    base === "nasa" && comparing && date && (product === "modis" || useHls)
      ? secondDate
      : undefined;
  const mainModis = (product === "modis" ? date : modis.dates[0]) ?? "default";
  const mainHls = useHls ? date : undefined;
  const compareModis =
    product === "modis" ? (compareDate ?? mainModis) : mainModis;
  const compareHls = product === "hls" ? compareDate : undefined;
  const showCompare = !!compareDate;

  useEffect(() => {
    let live = true;
    let renderer: MapRenderer | undefined;
    setStatus("loading");
    void import("./mapRenderer.js")
      .then(({ createRenderer }) => {
        if (!live || !mainHost.current) return;
        renderer = createRenderer(mainHost.current, {
          dates: { modis: "default", base: "satellite" },
          interactive: true,
          onCamera: setCamera,
          onField: (id) => current.current.onSelect(id),
          onStatus: setStatus,
        });
        renderer.canvas.setAttribute("aria-label", current.current.canvasLabel);
        renderer.canvas.setAttribute("aria-describedby", keyboardId);
        setCamera(renderer.camera());
        setMain(renderer);
      })
      .catch(() => {
        if (live) setStatus("unavailable");
      });
    return () => {
      live = false;
      renderer?.destroy();
      setMain(undefined);
    };
  }, [engineAttempt]);
  useEffect(() => {
    if (!main || !showCompare) return;
    let live = true;
    let renderer: MapRenderer | undefined;
    let unfollow: (() => void) | undefined;
    setCompareFailed(false);
    void import("./mapRenderer.js")
      .then(({ createRenderer }) => {
        if (!live || !compareHost.current) return;
        renderer = createRenderer(compareHost.current, {
          dates: { modis: compareModis, hls: compareHls, base: "nasa" },
          camera: main.camera(),
          interactive: false,
          onStatus: (state) => setCompareFailed(state !== "ready"),
        });
        unfollow = main.follow(renderer.jump);
        setSecond(renderer);
      })
      .catch(() => {
        if (live) setCompareFailed(true);
      });
    return () => {
      live = false;
      unfollow?.();
      renderer?.destroy();
      setSecond(undefined);
    };
  }, [main, showCompare]);
  useEffect(() => {
    if (!main || !mainHost.current) return;
    const resize = new ResizeObserver(() => {
      main.resize();
      second?.resize();
    });
    resize.observe(mainHost.current);
    return () => resize.disconnect();
  }, [main, second]);
  useEffect(() => {
    if (!main) return;
    main.canvas.setAttribute("aria-label", canvasLabel);
    main.canvas.setAttribute("aria-describedby", keyboardId);
  }, [main, canvasLabel, keyboardId]);
  useEffect(
    () => main?.setDates({ modis: mainModis, hls: mainHls, base }),
    [main, mainModis, mainHls, base],
  );
  useEffect(
    () =>
      second?.setDates({ modis: compareModis, hls: compareHls, base: "nasa" }),
    [second, compareModis, compareHls],
  );
  useEffect(() => {
    main?.setFields(fields);
    second?.setFields(fields);
  }, [main, second, fields]);
  useEffect(() => {
    onRenderer?.(main);
    return () => onRenderer?.(undefined);
  }, [main, onRenderer]);
  const selectedId = selected?.field.id;
  const selectedBoundary = selected?.boundary?.version;
  useEffect(() => {
    main?.select(selectedId);
    second?.select(selectedId);
  }, [main, second, selectedId]);
  useEffect(() => {
    if (main && selected) {
      main.resize();
      main.focus(selected);
    }
  }, [main, selectedId, selectedBoundary]);

  const locationRequest = useRef(0);
  useEffect(
    () => () => {
      locationRequest.current++;
    },
    [main],
  );
  function locateMe() {
    if (!main || !navigator.geolocation) {
      setLocate("failed");
      return;
    }
    const request = ++locationRequest.current;
    setLocate("pending");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (request !== locationRequest.current) return;
        main.locate([coords.longitude, coords.latitude]);
        setLocate("idle");
      },
      () => {
        if (request === locationRequest.current) setLocate("failed");
      },
      { timeout: 10000 },
    );
  }
  const displayDate =
    mainHls ?? (mainModis !== "default" ? mainModis : undefined);
  const title = t(base === "satellite" ? "map.satellite" : "map.nasa");
  const caption =
    base === "satellite"
      ? t("map.satelliteDetail")
      : displayDate
        ? calendarDate(displayDate, language)
        : t("map.latest");
  return (
    <section
      className="f2-map"
      aria-label={t("nav.map")}
      style={{ "--map-split": split + "%" } as CSSProperties}
    >
      <div className="f2-map-canvas" ref={mainHost} />
      {status === "loading" && (
        <div
          className="f2-map-skeleton"
          role="status"
          aria-label={t("map.loading")}
          aria-busy="true"
        />
      )}
      {showCompare && (
        <div
          className="f2-map-canvas f2-compare-canvas"
          ref={compareHost}
          aria-hidden="true"
        />
      )}
      <span id={keyboardId} className="rv-sr">
        {t("map.keyboard")}
      </span>
      <div className="f2-map-top">
        <Popover.Root open={layersOpen} onOpenChange={setLayersOpen}>
          <Popover.Trigger
            asChild
            onClick={() => {
              fromTool.current = false;
            }}
          >
            <LayerChip title={title} caption={caption} />
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              id={controlsId}
              sideOffset={8}
              align="start"
              collisionPadding={12}
              className="rv-ui rv-popover f2-layer-popover"
              aria-label={t("map.layers")}
              onEscapeKeyDown={(event) => event.stopPropagation()}
              onInteractOutside={(event) => {
                if (
                  event.target instanceof Node &&
                  layerTool.current?.contains(event.target)
                )
                  event.preventDefault();
              }}
              onCloseAutoFocus={(event) => {
                if (fromTool.current) {
                  event.preventDefault();
                  layerTool.current?.focus();
                }
              }}
            >
              <ImageryControls
                base={base}
                setBase={setBase}
                product={product}
                setProduct={(next) => {
                  setSettings({ ...initialSettings, product: next });
                  setChosenComparison("");
                }}
                date={date}
                choose={(value, typed) => {
                  setSettings((current) => ({
                    ...current,
                    requested: value,
                    manual: typed ? value : current.manual,
                  }));
                  if (typed && scan.coverage(value) === "error")
                    setAttempt((value) => value + 1);
                }}
                manual={manual}
                scan={scan}
                retry={() => setAttempt((value) => value + 1)}
                earlier={() =>
                  setSettings((current) => ({
                    ...current,
                    end: previousDays(current.end, recentDays + 1).at(-1)!,
                    requested: "",
                    manual: "",
                  }))
                }
                recent={
                  end !== today
                    ? () =>
                        setSettings((current) => ({
                          ...current,
                          end: today,
                          requested: "",
                          manual: "",
                        }))
                    : undefined
                }
                compare={secondDate}
                setCompare={setChosenComparison}
                comparing={comparing}
                setComparing={setComparing}
              />
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>
        <button
          type="button"
          className="f2-map-chip f2-search-chip"
          aria-label={t("map.search")}
          onClick={onSearch}
        >
          <Icon name="search" />
          {t("search")}
        </button>
      </div>
      <div className="f2-map-tools" role="group" aria-label={t("map.tools")}>
        <IconButton
          icon="zoom-in"
          label={t("map.zoomIn")}
          className="f2-map-chip"
          disabled={!main || camera.zoom >= 21}
          onClick={() => main?.zoom(1)}
        />
        <IconButton
          icon="zoom-out"
          label={t("map.zoomOut")}
          className="f2-map-chip"
          disabled={!main || camera.zoom <= 0}
          onClick={() => main?.zoom(-1)}
        />
        <IconButton
          icon="locate"
          label={t("map.locate")}
          className="f2-map-chip"
          disabled={!main || locate === "pending"}
          onClick={locateMe}
        />
        <button
          ref={layerTool}
          type="button"
          className="f2-map-chip"
          aria-label={t("map.layers")}
          title={t("map.layers")}
          aria-expanded={layersOpen}
          aria-controls={layersOpen ? controlsId : undefined}
          onClick={() => {
            fromTool.current = true;
            setLayersOpen(!layersOpen);
          }}
        >
          <Icon name="layers" />
        </button>
      </div>
      <div className="f2-map-feedback" aria-live="polite">
        {status !== "ready" && status !== "loading" && (
          <p>
            {t(status === "tiles-failed" ? "map.tileError" : "map.unavailable")}
            <>
              {" "}
              <button
                type="button"
                className="f2-inline"
                onClick={() => setEngineAttempt((value) => value + 1)}
              >
                {t("common.retry")}
              </button>
            </>
          </p>
        )}
        {locate !== "idle" && (
          <p>{t(locate === "pending" ? "map.locating" : "map.locateFailed")}</p>
        )}
        {compareFailed && showCompare && <p>{t("map.compareFailed")}</p>}
        {base === "nasa" && product === "hls" && layersOpen && !useHls && (
          <p>{t("map.hlsZoom")}</p>
        )}
      </div>
      {showCompare && (
        <div className="f2-comparison">
          <div className="f2-divider" aria-hidden="true" />
          <div className="f2-compare-controls">
            <span>
              {t("map.compareFirst", { date: calendarDate(date!, language) })}
            </span>
            <input
              type="range"
              min="0"
              max="100"
              value={split}
              onChange={(event) => setSplit(event.target.valueAsNumber)}
              aria-label={t("map.comparePosition")}
              aria-valuetext={t("map.compareValue", {
                percent: number(split, language, 0),
              })}
            />
            <span>
              {t("map.compareSecond", {
                date: calendarDate(compareDate, language),
              })}
            </span>
          </div>
        </div>
      )}
      <div className="f2-map-footer">
        <PanelPopover
          title={t("map.legend")}
          trigger={
            <button type="button" className="f2-map-chip f2-legend">
              <Icon name="layers" />
              {t("map.legend")}
            </button>
          }
        >
          <ul className="f2-legend-items">
            <li>
              <i />
              {t("map.legendField")}
            </li>
            <li>
              <i />
              {t("map.legendSelected")}
            </li>
            <li>
              <i />
              {t("map.legendPin")}
            </li>
          </ul>
        </PanelPopover>
        <div className="f2-map-attribution">
          {base === "nasa" && (
            <span>{t(mainHls ? "map.hlsOverzoom" : "map.modisOverzoom")}</span>
          )}
          {base === "nasa" &&
            mainHls &&
            scan.coverage(mainHls) === "partial" && (
              <span>{t("map.partial")}</span>
            )}
          <span>
            <a href="https://cloudless.eox.at">EOxCloudless</a> by EOX IT
            Services GmbH (Contains modified Copernicus Sentinel data 2025)
          </span>
          {base === "nasa" && (
            <span>{t(mainHls ? "map.creditHls" : "map.creditModis")}</span>
          )}
          <span>
            <a href="https://openfreemap.org">OpenFreeMap</a>{" "}
            <a href="https://openmaptiles.org">© OpenMapTiles</a>
            {" · "}
            <a href="https://www.openstreetmap.org/copyright">
              © OpenStreetMap contributors
            </a>
          </span>
        </div>
      </div>
    </section>
  );
}
