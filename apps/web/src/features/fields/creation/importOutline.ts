import proj4 from "proj4";
import { GeometryError, normalizePolygon } from "./geometry.js";
import type { FieldBoundary } from "@rotavise/contracts";
export type ImportedOutline = {
  boundary?: FieldBoundary;
  issue?: string;
  filled?: boolean;
  narrow?: boolean;
};
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export function polygonsFromGeoJSON(input: unknown): ImportedOutline[] {
  const out: ImportedOutline[] = [];
  let visited = 0;
  const visit = (value: unknown, depth = 0, inherited = "EPSG:4326") => {
    if (++visited > 1000 || depth > 8) throw new GeometryError("complex");
    if (!object(value)) {
      out.push({ issue: "invalid" });
      return;
    }
    // RFC 7946 is WGS84. Legacy named CRS is reprojected only when its
    // definition is known; unsupported names fail closed.
    let from = inherited;
    if (value.crs) {
      if (
        !object(value.crs) ||
        value.crs.type !== "name" ||
        !object(value.crs.properties) ||
        typeof value.crs.properties.name !== "string"
      )
        throw new GeometryError("invalid");
      const match = /(?:EPSG:|EPSG::|EPSG\/0\/)(\d+)$/i.exec(
        value.crs.properties.name,
      );
      const code = match ? Number(match[1]) : 0;
      if (code === 4326 || code === 3857) from = `EPSG:${code}`;
      else if (
        (code >= 32601 && code <= 32660) ||
        (code >= 32701 && code <= 32760)
      )
        from = `+proj=utm +zone=${code % 100} ${code >= 32700 ? "+south" : ""} +datum=WGS84 +units=m +no_defs`;
      else throw new GeometryError("invalid");
    }
    if (value.type === "FeatureCollection" && Array.isArray(value.features)) {
      value.features.forEach((v) => visit(v, depth + 1, from));
      return;
    }
    if (value.type === "Feature") {
      visit(value.geometry, depth + 1, from);
      return;
    }
    if (
      value.type === "GeometryCollection" &&
      Array.isArray(value.geometries)
    ) {
      value.geometries.forEach((v) => visit(v, depth + 1, from));
      return;
    }
    if (value.type === "MultiPolygon" && Array.isArray(value.coordinates)) {
      value.coordinates.forEach((c) =>
        visit({ type: "Polygon", coordinates: c }, depth + 1, from),
      );
      return;
    }
    try {
      let polygon = value;
      if (from !== "EPSG:4326") {
        if (value.type !== "Polygon" || !Array.isArray(value.coordinates))
          throw new GeometryError("invalid");
        const coordinates = value.coordinates.map((ring) => {
          if (!Array.isArray(ring) || ring.length > 50000)
            throw new GeometryError("complex");
          return ring.map((p) => {
            if (
              !Array.isArray(p) ||
              !Number.isFinite(p[0]) ||
              !Number.isFinite(p[1])
            )
              throw new GeometryError("invalid");
            return proj4(from, "EPSG:4326", [p[0] as number, p[1] as number]);
          });
        });
        polygon = { type: "Polygon", coordinates };
      }
      out.push(normalizePolygon(polygon));
    } catch (error) {
      out.push({
        issue: error instanceof GeometryError ? error.issue : "invalid",
      });
    }
  };
  if (Array.isArray(input)) input.forEach((v) => visit(v));
  else visit(input);
  if (!out.length) throw new GeometryError("invalid");
  return out;
}
// Inspect ZIP's central directory before decompression. Keeps malformed/huge archives
// away from the parser and requires a declared projection for every shapefile.
export function inspectShapeZip(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer),
    view = new DataView(buffer),
    decode = new TextDecoder();
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--)
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  if (end < 0) throw new GeometryError("invalid");
  const entries = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true),
    total = 0;
  if (entries > 1000) throw new GeometryError("complex");
  const names: string[] = [];
  for (let i = 0; i < entries; i++) {
    if (
      offset + 46 > bytes.length ||
      view.getUint32(offset, true) !== 0x02014b50
    )
      throw new GeometryError("invalid");
    total += view.getUint32(offset + 24, true);
    if (total > 40000000) throw new GeometryError("complex");
    const length = view.getUint16(offset + 28, true);
    names.push(
      decode
        .decode(bytes.subarray(offset + 46, offset + 46 + length))
        .toLowerCase(),
    );
    offset +=
      46 +
      length +
      view.getUint16(offset + 30, true) +
      view.getUint16(offset + 32, true);
  }
  const shapes = names.filter((n) => n.endsWith(".shp"));
  if (
    !shapes.length ||
    shapes.some((n) => !names.includes(n.slice(0, -4) + ".prj"))
  )
    throw new GeometryError("invalid");
}
export async function parseOutline(buffer: ArrayBuffer, extension: string) {
  if (buffer.byteLength > 10000000) throw new GeometryError("complex");
  if (extension === "zip") {
    inspectShapeZip(buffer);
    const { default: shp } = await import("shpjs");
    const data: unknown = await shp(buffer);
    return polygonsFromGeoJSON(data);
  }
  if (extension !== "geojson" && extension !== "json")
    throw new GeometryError("invalid");
  const data: unknown = JSON.parse(new TextDecoder().decode(buffer));
  return polygonsFromGeoJSON(data);
}
