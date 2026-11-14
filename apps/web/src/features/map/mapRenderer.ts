import {
  Map as MapLibre,
  Marker,
  setWorkerUrl,
  setRTLTextPlugin,
  type GeoJSONSource,
  type RasterTileSource,
  type StyleSpecification,
} from "maplibre-gl";
import rtlUrl from "../../../node_modules/@mapbox/mapbox-gl-rtl-text/dist/mapbox-gl-rtl-text.js?url";
import { satellite, labels as orientation, type BaseLayer } from "./basemap.js";
import workerUrl from "maplibre-gl/dist/maplibre-gl-csp-worker.js?url";
import "maplibre-gl/dist/maplibre-gl.css";
import type { MappedField } from "../fields/index.js";
import { tileUrl, products, type Position } from "./gibs.js";

setWorkerUrl(workerUrl);
void setRTLTextPlugin(rtlUrl, true);
const initialView = { center: [-6.5, 31.8] as Position, zoom: 6 };
let previousView = initialView;
const source = "saved-fields";
const fill = "saved-fields-fill";
const casing = "saved-fields-casing";
const stroke = "saved-fields-stroke";
const pins = "saved-fields-pins";
type Dates = { modis: string; hls?: string | undefined; base?: BaseLayer };
type Options = {
  dates: Dates;
  interactive: boolean;
  camera?: typeof initialView;
  onCamera?: (view: typeof initialView) => void;
  onField?: (id: string) => void;
  onStatus?: (status: "ready" | "tiles-failed" | "context-lost") => void;
};

function colors() {
  const style = getComputedStyle(document.documentElement);
  return {
    surface: style.getPropertyValue("--surface").trim(),
    ink: style.getPropertyValue("--ink").trim(),
    selected: style.getPropertyValue("--map-selection").trim(),
  };
}

function mapStyle(dates: Dates): StyleSpecification {
  const color = colors();
  return {
    version: 8,
    glyphs: orientation.glyphs,
    sources: {
      satellite: {
        type: "raster",
        tiles: [satellite.tiles],
        tileSize: satellite.tileSize,
        maxzoom: satellite.maxzoom,
      },
      modis: {
        type: "raster",
        tiles: [tileUrl("modis", dates.modis)],
        tileSize: 256,
        maxzoom: products.modis.zoom,
      },
      hls: {
        type: "raster",
        tiles: [tileUrl("hls", dates.hls ?? "default")],
        tileSize: 256,
        maxzoom: products.hls.zoom,
      },
      [source]: {
        type: "geojson",
        promoteId: "fieldId",
        data: { type: "FeatureCollection", features: [] },
      },
    },
    layers: [
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        paint: { "raster-resampling": "linear", "raster-fade-duration": 0 },
      },
      {
        id: "modis",
        type: "raster",
        source: "modis",
        layout: {
          visibility:
            dates.base === "nasa" && !dates.hls && dates.modis !== "default"
              ? "visible"
              : "none",
        },
        paint: { "raster-resampling": "nearest", "raster-fade-duration": 0 },
      },
      {
        id: "hls",
        type: "raster",
        source: "hls",
        minzoom: 9,
        layout: {
          visibility: dates.base === "nasa" && dates.hls ? "visible" : "none",
        },
        paint: { "raster-resampling": "nearest", "raster-fade-duration": 0 },
      },
      {
        id: fill,
        type: "fill",
        source,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            color.selected,
            color.surface,
          ],
          "fill-opacity": 0.24,
        },
      },
      {
        id: casing,
        type: "line",
        source,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: { "line-color": color.surface, "line-width": 5 },
        layout: { "line-join": "round" },
      },
      {
        id: stroke,
        type: "line",
        source,
        filter: ["==", ["geometry-type"], "Polygon"],
        paint: {
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            color.selected,
            color.ink,
          ],
          "line-width": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            3,
            2,
          ],
        },
        layout: { "line-join": "round" },
      },
      {
        id: pins,
        type: "circle",
        source,
        filter: ["==", ["geometry-type"], "Point"],
        paint: {
          "circle-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            color.selected,
            color.ink,
          ],
          "circle-radius": 5,
          "circle-stroke-color": color.surface,
          "circle-stroke-width": 2,
        },
      },
    ],
  };
}

export function fieldPosition({ field }: MappedField): Position {
  return [field.profile.location.longitude, field.profile.location.latitude];
}

export function createRenderer(element: HTMLElement, options: Options) {
  const probe = document.createElement("canvas").getContext("webgl2");
  if (!probe) throw new Error("WebGL unavailable");
  probe.getExtension("WEBGL_lose_context")?.loseContext();
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const map = new MapLibre({
    container: element,
    style: mapStyle(options.dates),
    ...(options.camera ?? previousView),
    attributionControl: false,
    interactive: options.interactive,
    minZoom: 0,
    fadeDuration: 0,
    maxTileCacheSize: 256,
    maxTileCacheZoomLevels: 5,
    cancelPendingTileRequestsWhileZooming: false,
    maxZoom: 21,
    zoomSnap: 0,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    renderWorldCopies: false,
    canvasContextAttributes: { antialias: false },
    transformRequest: (url) => ({ url, credentials: "same-origin" }),
  });
  map.touchZoomRotate.disableRotation();
  // MapLibre uses its trackpad rate for a single normalized wheel notch.
  map.scrollZoom.setZoomRate(1 / 320);
  map.scrollZoom.setWheelZoomRate(1 / 320);
  let destroyed = false;
  let loaded = false;
  let editing = false;
  let dates = options.dates;
  let fields: MappedField[] = [];
  let selected: string | undefined;
  const labels = new Map<string, { marker: Marker; node: HTMLElement }>();
  let clickTimer: ReturnType<typeof setTimeout> | undefined;
  const duration = (ms: number) => (reduced.matches ? 0 : ms);
  const camera = () => {
    const { lng, lat } = map.getCenter();
    return { center: [lng, lat] as Position, zoom: map.getZoom() };
  };
  const updateLabels = () => {
    const show = map.getZoom() >= 13;
    for (const { node } of labels.values()) node.hidden = !show;
  };
  const updateFields = () => {
    map.getSource<GeoJSONSource>(source)?.setData({
      type: "FeatureCollection",
      features: fields.map((entry) => ({
        type: "Feature",
        properties: { fieldId: entry.field.id },
        geometry: entry.boundary?.boundary ?? {
          type: "Point",
          coordinates: fieldPosition(entry),
        },
      })),
    });
    const keep = new Set(fields.map(({ field }) => field.id));
    for (const [id, { marker }] of labels) {
      if (!keep.has(id)) {
        marker.remove();
        labels.delete(id);
      }
    }
    for (const entry of fields) {
      let label = labels.get(entry.field.id);
      if (!label) {
        const node = document.createElement("span");
        node.className = "f2-field-label";
        node.setAttribute("aria-hidden", "true");
        const marker = new Marker({ element: node, offset: [0, -14] });
        label = { node, marker };
        labels.set(entry.field.id, label);
        marker.setLngLat(fieldPosition(entry)).addTo(map);
      }
      label.node.textContent = entry.field.profile.name;
      label.marker.setLngLat(fieldPosition(entry));
    }
    updateLabels();
  };
  const applyDates = (next: Dates) => {
    if (next.modis !== dates.modis)
      map
        .getSource<RasterTileSource>("modis")
        ?.setTiles([tileUrl("modis", next.modis)]);
    if (next.hls && next.hls !== dates.hls)
      map
        .getSource<RasterTileSource>("hls")
        ?.setTiles([tileUrl("hls", next.hls)]);
    map.setLayoutProperty(
      "modis",
      "visibility",
      next.base === "nasa" && !next.hls && next.modis !== "default"
        ? "visible"
        : "none",
    );
    map.setLayoutProperty(
      "hls",
      "visibility",
      next.base === "nasa" && next.hls ? "visible" : "none",
    );
    dates = next;
  };
  let desiredDates = dates;
  map.once("load", () => {
    loaded = true;
    applyDates(desiredDates);
    updateFields();
    if (selected)
      map.setFeatureState({ source, id: selected }, { selected: true });
    options.onStatus?.("ready");
    void import("./orientation.js")
      .then(({ addOrientation }) => {
        if (!destroyed) addOrientation(map, colors());
      })
      .catch(() => {
        if (!destroyed) options.onStatus?.("tiles-failed");
      });
  });
  map.on("error", (event) => {
    if (event.error.name !== "AbortError") options.onStatus?.("tiles-failed");
  });
  map.on("sourcedata", (event) => {
    if (
      loaded &&
      event.tile &&
      event.sourceId === "satellite" &&
      map.areTilesLoaded()
    )
      options.onStatus?.("ready");
  });
  map.on("webglcontextlost", () => options.onStatus?.("context-lost"));
  map.on("webglcontextrestored", () => options.onStatus?.("ready"));
  map.on("zoomend", updateLabels);
  if (options.interactive) {
    map.on("moveend", () => {
      previousView = camera();
      options.onCamera?.(previousView);
    });
    map.on("click", ({ point }) => {
      if (editing) return;
      const hit = map.queryRenderedFeatures(point, {
        layers: [pins, fill, stroke].filter((id) => map.getLayer(id)),
      })[0]?.id;
      if (typeof hit === "string") {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => options.onField?.(hit), 280);
      }
    });
    map.on("dblclick", () => clearTimeout(clickTimer));
    map.on("mousemove", ({ point }) => {
      if (editing) return;
      const hit =
        loaded &&
        map.queryRenderedFeatures(point, { layers: [pins, fill, stroke] })
          .length > 0;
      map.getCanvas().style.cursor = hit ? "pointer" : "";
    });
  } else {
    map.getCanvas().removeAttribute("tabindex");
  }
  return {
    camera,
    nativeMap: map,
    editing(value: boolean) {
      editing = value;
      clearTimeout(clickTimer);
    },
    canvas: map.getCanvas(),
    resize: () => map.resize(),
    follow(listener: (view: typeof initialView) => void) {
      const sync = () => listener(camera());
      map.on("move", sync);
      sync();
      return () => {
        map.off("move", sync);
      };
    },
    jump: (view: typeof initialView) => map.jumpTo(view),
    setDates(next: Dates) {
      desiredDates = next;
      if (loaded) applyDates(next);
    },
    setFields(next: MappedField[]) {
      fields = next;
      if (loaded) updateFields();
    },
    select(id?: string) {
      if (id === selected) return;
      if (loaded) {
        if (selected)
          map.removeFeatureState({ source, id: selected }, "selected");
        if (id) map.setFeatureState({ source, id }, { selected: true });
      }
      selected = id;
    },
    focus(entry: MappedField) {
      if (!entry.boundary) {
        map.flyTo({
          center: fieldPosition(entry),
          zoom: 14,
          duration: duration(600),
        });
        return;
      }
      const ring = entry.boundary.boundary.coordinates[0];
      const xs = ring.map(([x]) => x);
      const ys = ring.map(([, y]) => y);
      map.fitBounds(
        [
          [Math.min(...xs), Math.min(...ys)],
          [Math.max(...xs), Math.max(...ys)],
        ],
        {
          maxZoom: 17,
          padding: Math.min(52, map.getCanvas().clientWidth / 7),
          duration: duration(600),
          linear: false,
        },
      );
    },
    zoom(delta: number) {
      map.easeTo({ zoom: map.getZoom() + delta, duration: duration(300) });
    },
    locate(position: Position) {
      map.flyTo({
        center: position,
        zoom: Math.max(13, map.getZoom()),
        duration: duration(600),
      });
    },
    destroy() {
      clearTimeout(clickTimer);
      destroyed = true;
      for (const { marker } of labels.values()) marker.remove();
      map.remove();
    },
  };
}

export type MapRenderer = ReturnType<typeof createRenderer>;
