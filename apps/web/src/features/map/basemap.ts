// EOX 2025: CC BY-NC-SA 4.0. This prototype is non-commercial.
// The public WMTS serves z15, but its Sentinel-2 pixels remain about 10 m.
// See docs/steps/15/fm-notes.md before changing provider or publishing.
export const satellite = {
  tiles:
    "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
  tileSize: 256,
  maxzoom: 15,
  year: 2025,
} as const;
export const labels = {
  url: "https://tiles.openfreemap.org/planet",
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
} as const;
export type BaseLayer = "satellite" | "nasa";
