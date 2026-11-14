import type { Map as MapLibre } from "maplibre-gl";
import { cellPoint, parseCell, type Cell, type Grid } from "./geometry.js";

/** The map's fill layer owns the settled selection. This canvas draws only
 * while editing so pointer events do not invalidate the WebGL tiles. */
export function paintPreview(map: MapLibre, color: string) {
  const host = document.createElement("div");
  host.className = "f3-paint-preview";
  host.setAttribute("aria-hidden", "true");
  host.hidden = true;
  const canvas = document.createElement("canvas");
  host.attachShadow({ mode: "closed" }).append(canvas);
  map.getCanvasContainer().append(host);
  const context = canvas.getContext("2d");
  const base = document.createElement("canvas");
  const baseContext = base.getContext("2d");
  const painted = new Set<string>();
  const corners = new Map<string, { x: number; y: number }[]>();
  function project(key: string, grid: Grid) {
    const cached = corners.get(key);
    if (cached) return cached;
    const [x, y] = parseCell(key);
    const cell: Cell[] = [
      [x, y],
      [x + 1, y],
      [x + 1, y + 1],
      [x, y + 1],
    ];
    const points = cell.map((point) => map.project(cellPoint(point, grid)));
    corners.set(key, points);
    return points;
  }
  function drawPath(
    target: CanvasRenderingContext2D,
    points: { x: number; y: number }[],
    scale: number,
  ) {
    const first = points[0]!,
      opposite = points[2]!;
    const x = (first.x + opposite.x) / 2;
    const y = (first.y + opposite.y) / 2;
    target.moveTo(x + (first.x - x) * scale, y + (first.y - y) * scale);
    for (let i = 1; i < points.length; i++) {
      const point = points[i]!;
      target.lineTo(x + (point.x - x) * scale, y + (point.y - y) * scale);
    }
    target.closePath();
  }
  return {
    available: !!context && !!baseContext,
    clearProjection() {
      corners.clear();
      painted.clear();
      baseContext?.clearRect(0, 0, base.width, base.height);
    },
    draw(
      cells: ReadonlySet<string>,
      grid: Grid,
      entering: Map<string, number>,
      time: number,
    ) {
      if (!context || !baseContext) return;
      const { clientWidth, clientHeight } = map.getCanvas();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.round(clientWidth * ratio);
      const height = Math.round(clientHeight * ratio);
      if (canvas.width !== width || canvas.height !== height) {
        corners.clear();
        painted.clear();
        base.width = width;
        base.height = height;
        canvas.width = width;
        canvas.height = height;
        canvas.style.width = `${clientWidth}px`;
        canvas.style.height = `${clientHeight}px`;
      }
      baseContext.setTransform(ratio, 0, 0, ratio, 0, 0);
      baseContext.fillStyle = color;
      baseContext.globalAlpha = 1;
      // Keep unchanged cells in a bitmap. A stroke updates only changed cells;
      // animation frames composite the bitmap instead of rebuilding 2,000 paths.
      for (const key of painted) {
        if (cells.has(key) && !entering.has(key)) continue;
        baseContext.globalCompositeOperation = "destination-out";
        baseContext.beginPath();
        drawPath(baseContext, project(key, grid), 1);
        baseContext.fill();
        painted.delete(key);
      }
      baseContext.globalCompositeOperation = "source-over";
      baseContext.beginPath();
      for (const key of cells) {
        if (entering.has(key) || painted.has(key)) continue;
        drawPath(baseContext, project(key, grid), 1);
        painted.add(key);
      }
      baseContext.fill();
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, width, height);
      context.globalAlpha = 0.45;
      context.drawImage(base, 0, 0);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.fillStyle = color;
      for (const [key, start] of entering) {
        const progress = Math.min(1, Math.max(0, (time - start) / 280));
        context.globalAlpha = progress * 0.45;
        context.beginPath();
        drawPath(
          context,
          project(key, grid),
          0.8 + 0.2 * (1 - (1 - progress) ** 3),
        );
        context.fill();
        if (progress >= 1) entering.delete(key);
      }
      host.hidden = false;
    },
    hide() {
      host.hidden = true;
      corners.clear();
      painted.clear();
      baseContext?.clearRect(0, 0, base.width, base.height);
    },
    destroy() {
      host.remove();
    },
  };
}
