import type { Map, ExpressionSpecification } from "maplibre-gl";
import { labels } from "./basemap.js";

// OpenMapTiles schema, OSM data (ODbL). Only orientation, no opaque basemap.
export function addOrientation(
  map: Map,
  color: { ink: string; surface: string },
) {
  if (map.getSource("orientation")) return;
  map.addSource("orientation", { type: "vector", url: labels.url });
  map.addLayer(
    {
      id: "orientation-roads",
      type: "line",
      source: "orientation",
      "source-layer": "transportation",
      minzoom: 9,
      filter: [
        "in",
        ["get", "class"],
        [
          "literal",
          ["motorway", "trunk", "primary", "secondary", "tertiary", "minor"],
        ],
      ],
      paint: {
        "line-color": color.surface,
        "line-opacity": 0.45,
        "line-width": ["interpolate", ["linear"], ["zoom"], 9, 0.5, 16, 2],
      },
    },
    "saved-fields-fill",
  );
  const french = [
    "coalesce",
    ["get", "name:fr"],
    ["get", "name_fr"],
    ["get", "name:latin"],
    ["get", "name:en"],
    ["get", "name_en"],
    ["get", "name"],
  ] as ExpressionSpecification;
  const arabic = [
    "coalesce",
    ["get", "name:ar"],
    ["get", "name_ar"],
    ["get", "name:nonlatin"],
    "",
  ] as ExpressionSpecification;
  for (const [id, sourceLayer, minzoom] of [
    ["places", "place", 3],
    ["streets", "transportation_name", 12],
  ] as const) {
    map.addLayer(
      {
        id: `orientation-${id}`,
        type: "symbol",
        source: "orientation",
        "source-layer": sourceLayer,
        minzoom,
        layout: {
          "symbol-placement": id === "streets" ? "line" : "point",
          "text-field": [
            "case",
            ["all", ["!=", arabic, ""], ["!=", french, arabic]],
            ["concat", french, "\n", arabic],
            french,
          ],
          "text-font": ["Noto Sans Regular"],
          "text-size": id === "streets" ? 12 : 14,
          "text-max-width": 12,
          "text-padding": 6,
        },
        paint: {
          "text-color": color.ink,
          "text-halo-color": color.surface,
          "text-halo-width": 2,
          "text-halo-blur": 0.5,
        },
      },
      "saved-fields-fill",
    );
  }
}
