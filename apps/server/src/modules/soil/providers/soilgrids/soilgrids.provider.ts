import type { SoilDepth, SoilProperty } from "@rotavise/contracts";

export const SOILGRIDS_ENDPOINT = "https://maps.isric.org/mapserv";
const CRS = "http://www.opengis.net/def/crs/EPSG/0/4326";
const MAX_BYTES = 65536;
const HALF_WINDOW = 0.005;
export class SoilProviderError extends Error {}
export type SoilProvider = {
  fetch(
    request: {
      latitude: number;
      longitude: number;
      property: SoilProperty;
      depth: SoilDepth;
    },
    signal: AbortSignal,
  ): Promise<Uint8Array>;
};
// One 0.01° window around the cell, so ISRIC never sees an exact position.
export function soilGridsUrl(request: {
  latitude: number;
  longitude: number;
  property: SoilProperty;
  depth: SoilDepth;
}) {
  const { latitude, longitude, property, depth } = request;
  const url = new URL(SOILGRIDS_ENDPOINT);
  const f = (v: number) => v.toFixed(3);
  url.search = new URLSearchParams({
    map: `/map/${property}.map`,
    SERVICE: "WCS",
    VERSION: "2.0.1",
    REQUEST: "GetCoverage",
    COVERAGEID: `${property}_${depth}_mean`,
    FORMAT: "GEOTIFF_INT16",
    SUBSETTINGCRS: CRS,
    OUTPUTCRS: CRS,
  }).toString();
  url.search += `&SUBSET=X(${f(longitude - HALF_WINDOW)},${f(longitude + HALF_WINDOW)})&SUBSET=Y(${f(latitude - HALF_WINDOW)},${f(latitude + HALF_WINDOW)})`;
  return url;
}
export class SoilGridsProvider implements SoilProvider {
  async fetch(
    request: Parameters<SoilProvider["fetch"]>[0],
    signal: AbortSignal,
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await fetch(soilGridsUrl(request), {
          signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
          redirect: "error",
        });
        if (!response.ok) throw new SoilProviderError("STATUS");
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length || bytes.length > MAX_BYTES)
          throw new SoilProviderError("SIZE");
        return bytes;
      } catch (error) {
        lastError = error;
        if (signal.aborted) break;
      }
    }
    throw lastError instanceof SoilProviderError
      ? lastError
      : new SoilProviderError("UNAVAILABLE");
  }
}
