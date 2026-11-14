import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";
import type { z } from "zod";
import type { ApiClient } from "./client.js";
import type { getPlanResponseSchema } from "./plans.js";
import { getObservation } from "./observations.js";
import { getExtraction } from "./extractions.js";
import { keys, stale, planInterval, nasaInterval } from "./keys.js";

// Feature hooks consume these options only while their route is mounted.
// TanStack pauses intervals in hidden tabs and refetches stale data on focus.
export function planQuery(
  client: ApiClient,
  scope: number,
  id: string,
): UseQueryOptions<z.infer<typeof getPlanResponseSchema>> {
  return {
    queryKey: keys.plan(scope, id),
    queryFn: async ({ signal }) => {
      const { getPlan } = await import("./plans.js");
      return getPlan(client, { params: { id }, signal });
    },
    staleTime: (query) =>
      query.state.data?.status === "completed" ? stale.completedPlan : 0,
    refetchInterval: (query) =>
      query.state.error
        ? false
        : planInterval(query.state.data?.status, query.state.data?.createdAt),
    refetchIntervalInBackground: false,
  };
}
export function observationQuery(
  client: ApiClient,
  scope: number,
  field: string,
  id: string,
) {
  return queryOptions({
    queryKey: keys.observation(scope, field, id),
    queryFn: ({ signal }) =>
      getObservation(client, {
        params: { id: field, observationId: id },
        signal,
      }),
    refetchInterval: (query) =>
      nasaInterval(query.state.data?.status, query.state.data?.createdAt),
    refetchIntervalInBackground: false,
  });
}
export function extractionQuery(
  client: ApiClient,
  scope: number,
  field: string,
  id: string,
) {
  return queryOptions({
    queryKey: keys.extraction(scope, field, id),
    queryFn: ({ signal }) =>
      getExtraction(client, {
        params: { id: field, extractionId: id },
        signal,
      }),
    refetchInterval: (query) =>
      nasaInterval(query.state.data?.status, query.state.data?.createdAt),
    refetchIntervalInBackground: false,
  });
}
