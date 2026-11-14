import { useMemo } from "react";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import {
  useApi,
  useBoot,
  useOffline,
  useSession,
} from "../../app/providers/Runtime.js";
import { ApiFailure } from "../../app/http.js";
import { getFieldBoundary } from "../../api/boundary.js";
import {
  getField,
  listFields,
  type getFieldResponseSchema,
} from "../../api/fields.js";
import { keys, stale } from "../../api/keys.js";
import type { listPlansResponseSchema } from "../../api/plans.js";
import { requestPool } from "../../shared/requestPool.js";
import type { z } from "zod";

export type Field = z.infer<typeof getFieldResponseSchema>;
export type PlanSummary = z.infer<
  typeof listPlansResponseSchema
>["items"][number];
type Boundary = NonNullable<
  Awaited<ReturnType<typeof getFieldBoundary>>["boundary"]
>;
export type MappedField = {
  field: Field;
  boundary: Boundary | null | undefined;
};

const boundaryRequests = requestPool(6);

export function useFieldWorkspace(id?: string) {
  const client = useApi();
  const { scope, account, signInRequired } = useSession();
  const { capabilities } = useBoot();
  const offline = useOffline();
  const enabled =
    capabilities.data?.plans === true &&
    account !== undefined &&
    !signInRequired;
  const fields = useInfiniteQuery({
    queryKey: keys.fieldPages(scope),
    initialPageParam: "",
    queryFn: ({ pageParam, signal }) =>
      listFields(client, {
        signal,
        query: { limit: 20, ...(pageParam ? { cursor: pageParam } : {}) },
      }),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: stale.field,
    enabled: enabled && !offline,
  });
  const listed = useMemo(
    () =>
      Array.from(
        new Map(
          fields.data?.pages.flatMap((page) =>
            page.items.map((field) => [field.id, field] as const),
          ),
        ).values(),
      ),
    [fields.data],
  );
  const listedSelection = listed.find((field) => field.id === id);
  const detail = useQuery({
    queryKey: keys.field(scope, id ?? ""),
    queryFn: ({ signal }) => getField(client, { params: { id: id! }, signal }),
    staleTime: stale.field,
    enabled: enabled && !offline && !!id,
  });
  const selected =
    detail.data &&
    (!listedSelection || detail.data.version >= listedSelection.version)
      ? detail.data
      : listedSelection;
  const records = useMemo(
    () =>
      selected
        ? listedSelection
          ? listed.map((field) => (field.id === selected.id ? selected : field))
          : [...listed, selected]
        : listed,
    [selected, listedSelection, listed],
  );
  const outlines = useQueries({
    queries: records.map((field) => ({
      queryKey: keys.boundary(scope, field.id),
      queryFn: ({ signal }: { signal: AbortSignal }) =>
        boundaryRequests(signal, () =>
          getFieldBoundary(client, { params: { id: field.id }, signal }),
        ),
      enabled: enabled && !offline,
      staleTime: stale.field,
    })),
    combine: (results) => ({
      boundaries: results.map((result) => result.data?.boundary),
      error: results.find((result) => result.isError)?.error,
      pending: results.some((result) => result.isFetching),
      retry: () =>
        results
          .filter((result) => result.isError)
          .forEach((result) => void result.refetch()),
    }),
  });
  const mapped = useMemo<MappedField[]>(
    () =>
      records.map((field, index) => ({
        field,
        boundary: outlines.boundaries[index],
      })),
    [records, outlines.boundaries],
  );
  const plans = useQuery({
    queryKey: keys.latestFieldPlans(scope),
    enabled: enabled && !offline && records.length > 0,
    staleTime: stale.field,
    queryFn: async ({ signal }) => {
      const { listPlans } = await import("../../api/plans.js");
      const latest: Record<string, PlanSummary> = {};
      const seen = new Set<string>();
      let cursor: string | null = null;
      do {
        const page = await listPlans(client, {
          signal,
          query: { limit: 50, ...(cursor ? { cursor } : {}) },
        });
        for (const plan of page.items) {
          if (plan.fieldId && !latest[plan.fieldId])
            latest[plan.fieldId] = plan;
        }
        cursor = page.nextCursor;
        if (cursor && seen.has(cursor))
          throw new ApiFailure(0, "INVALID_SERVER_RESPONSE");
        if (cursor) seen.add(cursor);
      } while (cursor);
      return latest;
    },
  });
  return {
    fields,
    listed: mapped.slice(0, listed.length),
    mapped,
    outlines,
    selected: mapped.find(({ field }) => field.id === id),
    detail,
    plans,
    offline,
    enabled,
    unavailable: capabilities.data?.plans === false,
  };
}
