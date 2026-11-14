import { queryOptions } from "@tanstack/react-query";
import type { ApiClient } from "./client.js";
import { getCatalogOptions, getCatalogOptionsVersion } from "./catalog.js";
import { getField, listFields } from "./fields.js";
import { listFieldHistory } from "./history.js";
import { getFieldBoundary } from "./boundary.js";
import {
  getVegetationAnalysis,
  getVegetationHistory,
  getRainAnalysis,
  getWaterStorage,
  getCanopyBiomass,
} from "./analysis.js";
import { listPlans } from "./plans.js";
import { keys, stale } from "./keys.js";

export const catalogQuery = (client: ApiClient) =>
  queryOptions({
    queryKey: keys.catalog(),
    queryFn: ({ signal }) => getCatalogOptions(client, { signal }),
    staleTime: stale.catalog,
  });
export const catalogVersionQuery = (
  client: ApiClient,
  catalogId: string,
  version: string,
) =>
  queryOptions({
    queryKey: keys.catalog(catalogId, version),
    queryFn: ({ signal }) =>
      getCatalogOptionsVersion(client, {
        params: { catalogId, version },
        signal,
      }),
    staleTime: Infinity,
  });
export const fieldQuery = (client: ApiClient, scope: number, id: string) =>
  queryOptions({
    queryKey: keys.field(scope, id),
    queryFn: ({ signal }) => getField(client, { params: { id }, signal }),
    staleTime: stale.field,
  });
export const fieldsQuery = (
  client: ApiClient,
  scope: number,
  cursor?: string,
) =>
  queryOptions({
    queryKey: keys.fields(scope, cursor),
    queryFn: ({ signal }) =>
      listFields(client, {
        query: { limit: 20, ...(cursor ? { cursor } : {}) },
        signal,
      }),
    staleTime: stale.field,
  });
export const historyQuery = (
  client: ApiClient,
  scope: number,
  id: string,
  cursor?: string,
) =>
  queryOptions({
    queryKey: keys.history(scope, id, cursor),
    queryFn: ({ signal }) =>
      listFieldHistory(client, {
        params: { id },
        query: { limit: 20, ...(cursor ? { cursor } : {}) },
        signal,
      }),
    staleTime: stale.history,
  });
export const boundaryQuery = (client: ApiClient, scope: number, id: string) =>
  queryOptions({
    queryKey: keys.boundary(scope, id),
    queryFn: ({ signal }) =>
      getFieldBoundary(client, { params: { id }, signal }),
    staleTime: stale.field,
  });
export const plansQuery = (client: ApiClient, scope: number, cursor?: string) =>
  queryOptions({
    queryKey: keys.plans(scope, cursor),
    queryFn: ({ signal }) =>
      listPlans(client, {
        query: { limit: 20, ...(cursor ? { cursor } : {}) },
        signal,
      }),
    staleTime: stale.field,
  });
const analysis = {
  vegetation: getVegetationAnalysis,
  "vegetation-history": getVegetationHistory,
  rain: getRainAnalysis,
  "water-storage": getWaterStorage,
  "canopy-biomass": getCanopyBiomass,
};
type Analysis = Awaited<ReturnType<(typeof analysis)[keyof typeof analysis]>>;
export const analysisQuery = (
  client: ApiClient,
  scope: number,
  id: string,
  kind: keyof typeof analysis,
) =>
  queryOptions<Analysis>({
    queryKey: keys.analysis(scope, id, kind),
    queryFn: ({ signal }) => analysis[kind](client, { params: { id }, signal }),
    staleTime: stale.analysis,
  });
