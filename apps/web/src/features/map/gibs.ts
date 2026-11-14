import { requestPool } from "../../shared/requestPool.js";

export type Product = "modis" | "hls";
export type Position = [longitude: number, latitude: number];
type Tile = { z: number; x: number; y: number };
export const products = {
  modis: {
    id: "MODIS_Terra_CorrectedReflectance_TrueColor",
    zoom: 9,
    extension: "jpeg",
  },
  hls: {
    id: "HLS_S30_Nadir_BRDF_Adjusted_Reflectance",
    zoom: 12,
    extension: "png",
  },
} as const;

const origin = "https://gibs.earthdata.nasa.gov";
export function tileUrl(product: Product, date: string, tile?: Tile) {
  const { id, zoom, extension } = products[product];
  const coordinates = tile ? `${tile.z}/${tile.y}/${tile.x}` : "{z}/{y}/{x}";
  return `${origin}/wmts/epsg3857/best/${id}/default/${date}/GoogleMapsCompatible_Level${zoom}/${coordinates}.${extension}`;
}
export function centreTile([lon, lat]: Position, z: number): Tile {
  const n = 2 ** z;
  const radians =
    (Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180;
  const x = Math.floor((((((lon + 180) % 360) + 360) % 360) / 360) * n);
  const y = Math.floor(((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * n);
  return { z, x, y: Math.max(0, Math.min(n - 1, y)) };
}

const day = 86_400_000;
export const utcToday = () => new Date().toISOString().slice(0, 10);
export function validDate(date: string) {
  const time = Date.parse(date);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(date) &&
    Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === date
  );
}
export function previousDays(end: string, count: number) {
  const time = Date.parse(end);
  return Array.from({ length: count }, (_, i) =>
    new Date(time - i * day).toISOString().slice(0, 10),
  );
}
export type TileCoverage = "present" | "partial" | "empty";
export function alphaCoverage(rgba: Uint8ClampedArray): TileCoverage {
  let visible = false;
  let clear = false;
  for (let index = 3; index < rgba.length; index += 4) {
    if (rgba[index]) visible = true;
    else clear = true;
    if (visible && clear) return "partial";
  }
  return visible ? "present" : "empty";
}
// MODIS JPEG cannot express transparent no-data. GIBS can return an opaque,
// entirely black tile before that day's imagery arrives (observed 2026-11-12).
// HLS retains its alpha-based admission, including legitimate dark pixels.
export function tileCoverage(
  rgba: Uint8ClampedArray,
  product: Product,
): TileCoverage {
  if (product === "modis") {
    let colored = false;
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3] && (rgba[i] || rgba[i + 1] || rgba[i + 2])) {
        colored = true;
        break;
      }
    }
    if (!colored) return "empty";
  }
  return alphaCoverage(rgba);
}
const runProbe = requestPool(8);
const session = new Map<string, TileCoverage>();
const cacheLimit = 2048;

export function probeTile(
  product: Product,
  date: string,
  tile: Tile,
  signal: AbortSignal,
) {
  const url = tileUrl(product, date, tile);
  return runProbe(signal, async () => {
    const cached = session.get(url);
    if (cached) return cached;
    const response = await fetch(url, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]),
      credentials: "omit",
      referrerPolicy: "no-referrer",
      redirect: "error",
    });
    if (response.status === 404) return remember(url, "empty");
    if (!response.ok) throw new Error("Tile probe failed");
    const bitmap = await createImageBitmap(await response.blob());
    try {
      signal.throwIfAborted();
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Tile pixels unavailable");
      context.drawImage(bitmap, 0, 0);
      return remember(
        url,
        tileCoverage(
          context.getImageData(0, 0, bitmap.width, bitmap.height).data,
          product,
        ),
      );
    } finally {
      bitmap.close();
    }
  });
}
function remember(url: string, value: TileCoverage) {
  if (session.size >= cacheLimit) {
    const oldest = session.keys().next().value;
    if (oldest) session.delete(oldest);
  }
  session.set(url, value);
  return value;
}
