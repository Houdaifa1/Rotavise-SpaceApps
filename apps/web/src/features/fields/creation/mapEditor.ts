import { Marker, type GeoJSONSource, type MapMouseEvent } from "maplibre-gl";
import type { FieldBoundary, FieldSuggestion } from "@rotavise/contracts";
import type { MapRenderer } from "../../map/mapRenderer.js";
import {
  cellAt,
  cellKey,
  cellPoint,
  gridFor,
  interpolate,
  type gridFeatures,
  type Grid,
  type Point,
  type Cell,
} from "./geometry.js";
import { paintPreview } from "./paintPreview.js";
import type { GeometryWorker } from "./workerClient.js";
export type Mode = "tap" | "paint" | "draw" | "upload" | "pin";
export type EditorState = {
  mode: Mode;
  boundaries: FieldBoundary[];
  pins: Point[];
  vertices: Point[];
  closed: boolean;
  snap: boolean;
  suggestions: FieldSuggestion[];
  locked: boolean;
};
type Callbacks = {
  onPoint: (point: Point) => void;
  onDraw: (vertices: Point[], closed: boolean) => void;
  onCells: (cells: string[], grid: Grid, finished: boolean) => void;
  onCount: (count: number) => void;
  onZoom: (zoom: number) => void;
  onError: (error: unknown) => void;
  vertexLabel: (index: number) => string;
  midpointLabel: (index: number) => string;
};
const blank: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
export function attachEditor(
  renderer: MapRenderer,
  worker: GeometryWorker,
  initial: EditorState,
  callbacks: Callbacks,
) {
  const map = renderer.nativeMap,
    canvas = renderer.canvas;
  const root = getComputedStyle(document.documentElement);
  const color = (name: string) => root.getPropertyValue(name).trim();
  let state = initial,
    dead = false,
    loaded = false,
    grid: Grid = gridFor(renderer.camera().center),
    gridVersion = 0;
  let cells = new Set<string>(),
    stroke: { previous: Cell; adding: boolean; pointer: number } | undefined;
  let cursor: Cell = cellAt(renderer.camera().center, grid),
    hover: Cell | undefined,
    suggestionHover: string | undefined;
  let markers: Marker[] = [];
  const brush = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  brush.classList.add("f3-brush-cursor");
  brush.setAttribute("aria-hidden", "true");
  const cursorOutline = document.createElementNS(brush.namespaceURI, "polygon");
  cursorOutline.setAttribute("fill", "none");
  cursorOutline.setAttribute("stroke", color("--surface"));
  cursorOutline.setAttribute("stroke-width", "2");
  brush.append(cursorOutline);
  map.getCanvasContainer().append(brush);
  function showBrushCursor(cell?: Cell) {
    hover = cell;
    if (!cell) {
      cursorOutline.removeAttribute("points");
      return;
    }
    const [x, y] = cell;
    const corners: Cell[] = [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
    ];
    cursorOutline.setAttribute(
      "points",
      corners
        .map((corner) => {
          const p = map.project(cellPoint(corner, grid));
          return `${p.x},${p.y}`;
        })
        .join(" "),
    );
  }
  const clearBrushCursor = () => showBrushCursor();

  let lastPaintUpdate = -Infinity,
    pendingFrame = 0,
    animationFrame = 0;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  const preview = paintPreview(map, color("--map-selection"));
  const entering = new Map<string, number>();
  const settled = new Set<string>();
  let previewActive = false;
  function syncFill() {
    if (!loaded || dead) return;
    for (const key of settled) {
      if (!cells.has(key)) {
        map.removeFeatureState(
          { source: "creation-grid", id: key },
          "selected",
        );
        settled.delete(key);
      }
    }
    for (const key of cells) {
      if (!settled.has(key)) {
        map.setFeatureState(
          { source: "creation-grid", id: key },
          { selected: true },
        );
        settled.add(key);
      }
    }
  }
  function stopPreview() {
    entering.clear();
    cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (!previewActive) return;
    previewActive = false;
    preview.hide();
    if (loaded && !dead)
      map.setLayoutProperty("creation-grid-fill", "visibility", "visible");
  }
  function drawPreview(time: number) {
    animationFrame = 0;
    if (dead || !previewActive) return;
    preview.draw(cells, grid, entering, time);
    if (entering.size) schedulePreview();
    else if (!stroke) {
      syncFill();
      stopPreview();
    }
  }
  function schedulePreview() {
    if (!animationFrame && previewActive)
      animationFrame = requestAnimationFrame(drawPreview);
  }
  function startPreview() {
    if (previewActive || !preview.available) return;
    previewActive = true;
    map.setLayoutProperty("creation-grid-fill", "visibility", "none");
  }
  function cameraMoved() {
    clearBrushCursor();
    preview.clearProjection();
    schedulePreview();
  }

  const source = (id: string) => map.getSource<GeoJSONSource>(id);
  const setData = (id: string, data: GeoJSON.FeatureCollection) =>
    source(id)?.setData(data);
  function refresh(updateSuggestions = true) {
    if (!loaded || dead) return;
    const polygons: GeoJSON.Feature[] = state.boundaries.map((geometry) => ({
      type: "Feature",
      properties: {},
      geometry,
    }));
    const draft = state.vertices;
    if (draft.length > 1)
      polygons.push({
        type: "Feature",
        properties: {},
        geometry: state.closed
          ? { type: "Polygon", coordinates: [[...draft, draft[0]!]] }
          : { type: "LineString", coordinates: draft },
      });
    for (const coordinates of state.pins)
      polygons.push({
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates },
      });
    setData("creation-drafts", {
      type: "FeatureCollection",
      features: polygons,
    });
    if (updateSuggestions) {
      setSuggestionHover(undefined);
      setData("creation-suggestions", {
        type: "FeatureCollection",
        features: state.suggestions,
      });
    }
    const focused =
      document.activeElement instanceof HTMLElement &&
      document.activeElement.classList.contains("f3-vertex")
        ? document.activeElement.getAttribute("aria-label")
        : null;
    for (const m of markers) m.remove();
    markers = [];
    if (state.mode === "draw") {
      const addMarker = (point: Point, index: number, midpoint = false) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `f3-vertex ${midpoint ? "f3-midpoint" : ""}`;
        button.setAttribute(
          "aria-label",
          midpoint
            ? callbacks.midpointLabel(index + 1)
            : callbacks.vertexLabel(index + 1),
        );
        button.disabled = state.locked;
        const marker = new Marker({
          element: button,
          draggable: !midpoint && !state.locked,
        })
          .setLngLat(point)
          .addTo(map);
        markers.push(marker);
        const apply = (p: Point) => {
          const points = [...state.vertices];
          if (midpoint) points.splice(index + 1, 0, p);
          else points[index] = p;
          callbacks.onDraw(points, state.closed);
        };
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          if (midpoint) apply(point);
          else if (index === 0 && !state.closed && state.vertices.length >= 3)
            callbacks.onDraw(state.vertices, true);
        });
        marker.on("dragend", () => {
          const p = marker.getLngLat();
          apply([p.lng, p.lat]);
        });
        button.addEventListener("keydown", (event) => {
          if (event.key === "Delete" || event.key === "Backspace") {
            event.preventDefault();
            callbacks.onDraw(
              state.vertices.filter((_, i) => i !== index),
              state.closed && state.vertices.length > 3,
            );
          }
          if (event.key.startsWith("Arrow")) {
            event.preventDefault();
            event.stopPropagation();
            const p = map.project(point);
            const dx =
                event.key === "ArrowLeft"
                  ? -1
                  : event.key === "ArrowRight"
                    ? 1
                    : 0,
              dy =
                event.key === "ArrowUp"
                  ? -1
                  : event.key === "ArrowDown"
                    ? 1
                    : 0;
            const ll = map.unproject([p.x + dx, p.y + dy]);
            apply([ll.lng, ll.lat]);
          }
        });
      };
      state.vertices.forEach((p, i) => addMarker(p, i));
      if (state.closed)
        state.vertices.forEach((p, i) => {
          const next = state.vertices[(i + 1) % state.vertices.length]!;
          addMarker([(p[0] + next[0]) / 2, (p[1] + next[1]) / 2], i, true);
        });
    }
    if (focused)
      for (const marker of markers) {
        const node = marker.getElement();
        if (node.getAttribute("aria-label") === focused) {
          node.focus({ preventScroll: true });
          break;
        }
      }
    map.doubleClickZoom[state.mode === "draw" ? "disable" : "enable"]();
    canvas.style.cursor = state.mode === "upload" ? "grab" : "crosshair";
    if (state.mode !== "paint") {
      stopPreview();
      clearBrushCursor();
      setData("creation-grid", blank);
      setData("creation-grid-lines", blank);
    }
  }
  async function updateGrid() {
    if (dead || !loaded) return;
    callbacks.onZoom(map.getZoom());
    if (state.mode !== "paint" || map.getZoom() < 15) {
      setData("creation-grid", blank);
      setData("creation-grid-lines", blank);
      return;
    }
    if (!cells.size) {
      grid = gridFor(renderer.camera().center);
      cursor = cellAt(renderer.camera().center, grid);
    }
    const bounds = map.getBounds(),
      version = ++gridVersion;
    try {
      const data = await worker.run<ReturnType<typeof gridFeatures>>({
        kind: "grid",
        bounds: [
          [bounds.getWest(), bounds.getSouth()],
          [bounds.getEast(), bounds.getNorth()],
        ],
        grid,
      });
      if (dead || version !== gridVersion) return;
      setData("creation-grid", data.cells);
      setData("creation-grid-lines", {
        type: "FeatureCollection",
        features: [{ type: "Feature", properties: {}, geometry: data.lines }],
      });
      if (!previewActive) syncFill();
    } catch (error) {
      if (!dead) callbacks.onError(error);
    }
  }
  function setup() {
    if (dead) return;
    loaded = true;
    for (const id of [
      "creation-grid",
      "creation-grid-lines",
      "creation-suggestions",
      "creation-drafts",
    ])
      map.addSource(id, {
        type: "geojson",
        data: blank,
        ...(id === "creation-suggestions" ? { promoteId: "id" } : {}),
      });
    map.addLayer({
      id: "creation-grid-fill",
      source: "creation-grid",
      type: "fill",
      minzoom: 15,
      paint: {
        "fill-color": color("--map-selection"),
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.45,
          0,
        ],
      },
    });
    map.addLayer({
      id: "creation-grid-lines",
      source: "creation-grid-lines",
      type: "line",
      minzoom: 15,
      paint: {
        "line-color": color("--surface"),
        "line-width": 0.5,
        "line-opacity": 0.22,
      },
    });
    map.addLayer({
      id: "creation-suggestions-hover",
      source: "creation-suggestions",
      type: "fill",
      minzoom: 12,
      paint: {
        "fill-color": color("--surface"),
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.22,
          0,
        ],
      },
    });
    map.addLayer({
      id: "creation-suggestions-line",
      source: "creation-suggestions",
      type: "line",
      minzoom: 12,
      paint: {
        "line-color": color("--surface"),
        "line-width": ["interpolate", ["linear"], ["zoom"], 12, 2, 15, 3],
      },
    });
    map.addLayer({
      id: "creation-drafts-fill",
      source: "creation-drafts",
      type: "fill",
      filter: ["==", ["geometry-type"], "Polygon"],
      paint: { "fill-color": color("--map-selection"), "fill-opacity": 0.25 },
    });
    map.addLayer({
      id: "creation-drafts-line",
      source: "creation-drafts",
      type: "line",
      filter: ["!=", ["geometry-type"], "Point"],
      paint: { "line-color": color("--map-selection"), "line-width": 3 },
    });
    map.addLayer({
      id: "creation-drafts-pin",
      source: "creation-drafts",
      type: "circle",
      filter: ["==", ["geometry-type"], "Point"],
      paint: {
        "circle-color": color("--map-selection"),
        "circle-radius": 6,
        "circle-stroke-width": 2,
        "circle-stroke-color": color("--surface"),
      },
    });
    refresh();
    void updateGrid();
  }
  const snap = (point: Point): Point => {
    if (!state.snap) return point;
    const p = map.project(point);
    let best = 12,
      result = point;
    for (const f of state.suggestions) {
      const ring = f.geometry.coordinates[0];
      for (let i = 0; i < ring.length - 1; i++) {
        const a = map.project(ring[i]!),
          b = map.project(ring[i + 1]!);
        const dx = b.x - a.x,
          dy = b.y - a.y,
          t = Math.max(
            0,
            Math.min(
              1,
              ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
            ),
          );
        const x = a.x + t * dx,
          y = a.y + t * dy,
          d = Math.hypot(x - p.x, y - p.y);
        if (d < best) {
          best = d;
          const ll = map.unproject([x, y]);
          result = [ll.lng, ll.lat];
        }
      }
    }
    return result;
  };
  function click(event: MapMouseEvent) {
    if (state.locked) return;
    const point: Point = [event.lngLat.lng, event.lngLat.lat];
    if (state.mode === "pin" || state.mode === "tap") callbacks.onPoint(point);
    if (state.mode === "draw" && !state.closed) {
      if (
        state.vertices.length >= 3 &&
        map.project(state.vertices[0]!).dist(event.point) <= 12
      )
        callbacks.onDraw(state.vertices, true);
      else if (
        !state.vertices.length ||
        map.project(state.vertices.at(-1)!).dist(event.point) > 2
      )
        callbacks.onDraw([...state.vertices, snap(point)], false);
    }
  }
  function close(event: MapMouseEvent) {
    if (state.mode === "draw") {
      event.preventDefault();
      if (state.vertices.length >= 3) callbacks.onDraw(state.vertices, true);
    }
  }
  function toggle(cell: Cell, adding: boolean) {
    const key = cellKey(cell);
    if (adding === cells.has(key)) return;
    if (adding) {
      cells.add(key);
      if (!reduced.matches && preview.available) {
        startPreview();
        entering.set(key, performance.now());
      }
    } else {
      cells.delete(key);
      entering.delete(key);
    }
    if (previewActive) schedulePreview();
    else syncFill();
  }

  function publish(finished = false) {
    callbacks.onCount(cells.size);
    if (!finished && performance.now() - lastPaintUpdate < 100) return;
    lastPaintUpdate = performance.now();
    cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(() => {
      callbacks.onCells([...cells], grid, finished);
    });
  }
  const pointFromEvent = (e: PointerEvent): Point => {
    const r = canvas.getBoundingClientRect(),
      p = map.unproject([e.clientX - r.left, e.clientY - r.top]);
    return [p.lng, p.lat];
  };
  function down(e: PointerEvent) {
    if (e.pointerType === "touch" && !e.isPrimary) {
      finish();
      return;
    }
    if (
      !loaded ||
      state.mode !== "paint" ||
      state.locked ||
      map.getZoom() < 15 ||
      e.button !== 0 ||
      e.altKey ||
      e.metaKey ||
      e.ctrlKey
    )
      return;
    e.preventDefault();
    e.stopImmediatePropagation();
    canvas.focus({ preventScroll: true });
    map.dragPan.disable();
    canvas.setPointerCapture(e.pointerId);
    const cell = cellAt(pointFromEvent(e), grid);
    stroke = {
      previous: cell,
      adding: !cells.has(cellKey(cell)),
      pointer: e.pointerId,
    };
    startPreview();
    toggle(cell, stroke.adding);
    publish();
  }
  function setSuggestionHover(id: string | undefined) {
    if (id === suggestionHover) return;
    if (suggestionHover)
      map.removeFeatureState(
        { source: "creation-suggestions", id: suggestionHover },
        "hover",
      );
    suggestionHover = id;
    if (id)
      map.setFeatureState(
        { source: "creation-suggestions", id },
        { hover: true },
      );
  }
  function moveSuggestion(event: MapMouseEvent) {
    if (!loaded || state.mode !== "tap" || state.locked || map.getZoom() < 12)
      return;
    const feature = map.queryRenderedFeatures(event.point, {
      layers: ["creation-suggestions-hover"],
    })[0];
    setSuggestionHover(
      typeof feature?.id === "string" ? feature.id : undefined,
    );
  }
  const leaveSuggestion = () => setSuggestionHover(undefined);
  function move(e: PointerEvent) {
    if (state.mode !== "paint" || map.getZoom() < 15) return;
    const cell = cellAt(pointFromEvent(e), grid);
    if (cell[0] !== hover?.[0] || cell[1] !== hover?.[1]) showBrushCursor(cell);
    if (!stroke || stroke.pointer !== e.pointerId) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    for (const c of interpolate(stroke.previous, cell))
      toggle(c, stroke.adding);
    stroke.previous = cell;
    cursor = cell;
    publish();
  }
  function finish() {
    if (stroke) {
      if (canvas.hasPointerCapture(stroke.pointer))
        canvas.releasePointerCapture(stroke.pointer);
      stroke = undefined;
      schedulePreview();
      map.dragPan.enable();
      publish(true);
    }
  }
  function key(event: KeyboardEvent) {
    if (state.locked) return;
    if (loaded && state.mode === "paint" && map.getZoom() >= 15) {
      const shifts: Record<string, Cell> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, 1],
        ArrowDown: [0, -1],
      };
      const shift = shifts[event.key];
      if (shift || event.key === " ") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (shift) {
          cursor = [cursor[0] + shift[0], cursor[1] + shift[1]];
          map.easeTo({ center: cellPoint(cursor, grid, true), duration: 0 });
        } else {
          toggle(cursor, !cells.has(cellKey(cursor)));
          publish(true);
        }
      }
    }
    if (state.mode === "draw") {
      if (event.key === "Backspace") {
        event.preventDefault();
        callbacks.onDraw(state.vertices.slice(0, -1), false);
      }
      if (event.key === "Enter") {
        event.preventDefault();
        if (event.shiftKey && state.vertices.length >= 3)
          callbacks.onDraw(state.vertices, true);
        else if (!state.closed)
          callbacks.onDraw(
            [...state.vertices, snap(renderer.camera().center)],
            false,
          );
      }
    }
    if (
      (state.mode === "pin" || state.mode === "tap") &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      callbacks.onPoint(renderer.camera().center);
    }
  }
  renderer.editing(true);
  // Editing depends on the style, not on slow or unavailable satellite tiles.
  // A map's `load` event only fires once; switching imagery can make
  // isStyleLoaded false again after that event has already happened.
  if (map.getLayer("modis")) setup();
  else map.once("style.load", setup);
  map.on("move", cameraMoved);
  map.on("moveend", updateGrid);
  map.on("click", click);
  map.on("mousemove", moveSuggestion);
  canvas.addEventListener("pointerleave", leaveSuggestion);
  canvas.addEventListener("pointerleave", clearBrushCursor);
  map.on("dblclick", close);
  canvas.addEventListener("pointerdown", down, true);
  canvas.addEventListener("pointermove", move, true);
  canvas.addEventListener("pointerup", finish, true);
  canvas.addEventListener("pointercancel", finish, true);
  canvas.addEventListener("keydown", key, true);
  return {
    update(next: EditorState) {
      const modeChanged = state.mode !== next.mode;
      const suggestionsChanged =
        state.suggestions !== next.suggestions || modeChanged;
      state = next;
      refresh(suggestionsChanged);
      if (modeChanged) {
        cells.clear();
        syncFill();
        gridVersion++;
        void updateGrid();
      }
    },
    setCells(next: string[]) {
      cells = new Set(next);
      for (const key of entering.keys())
        if (!cells.has(key)) entering.delete(key);
      if (previewActive) schedulePreview();
      else syncFill();
    },
    destroy() {
      dead = true;
      finish();
      cancelAnimationFrame(pendingFrame);
      cancelAnimationFrame(animationFrame);
      map.off("style.load", setup);
      brush.remove();
      preview.destroy();
      map.off("move", cameraMoved);
      map.off("moveend", updateGrid);
      map.off("click", click);
      map.off("mousemove", moveSuggestion);
      canvas.removeEventListener("pointerleave", leaveSuggestion);
      canvas.removeEventListener("pointerleave", clearBrushCursor);
      map.off("dblclick", close);
      canvas.removeEventListener("pointerdown", down, true);
      canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerup", finish, true);
      canvas.removeEventListener("pointercancel", finish, true);
      canvas.removeEventListener("keydown", key, true);
      for (const m of markers) m.remove();
      for (const id of [
        "creation-grid-fill",
        "creation-grid-lines",
        "creation-suggestions-hover",
        "creation-suggestions-line",
        "creation-drafts-fill",
        "creation-drafts-line",
        "creation-drafts-pin",
      ])
        if (map.getLayer(id)) map.removeLayer(id);
      for (const id of [
        "creation-grid",
        "creation-grid-lines",
        "creation-suggestions",
        "creation-drafts",
      ])
        if (map.getSource(id)) map.removeSource(id);
      map.dragPan.enable();
      map.doubleClickZoom.enable();
      canvas.style.cursor = "";
      renderer.editing(false);
    },
  };
}
