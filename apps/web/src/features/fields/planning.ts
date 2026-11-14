import { useQuery } from "@tanstack/react-query";
import { useApi, useOffline, useSession } from "../../app/providers/Runtime.js";
import { ApiFailure } from "../../app/http.js";
import { keys, stale } from "../../api/keys.js";
import { listFieldHistory } from "../../api/history.js";
import type { ApiClient } from "../../api/client.js";
export type HistoryRecord = Awaited<
  ReturnType<typeof listFieldHistory>
>["items"][number];
export async function readHistory(
  client: ApiClient,
  id: string,
  signal: AbortSignal,
) {
  const items = new Map<string, HistoryRecord>();
  const seen = new Set<string>();
  let cursor: string | null = null;
  do {
    const page = await listFieldHistory(client, {
      params: { id },
      query: { limit: 50, ...(cursor ? { cursor } : {}) },
      signal,
    });
    for (const item of page.items) items.set(item.id, item);
    cursor = page.nextCursor;
    if (cursor && seen.has(cursor))
      throw new ApiFailure(0, "INVALID_SERVER_RESPONSE");
    if (cursor) seen.add(cursor);
  } while (cursor);
  return [...items.values()].sort(
    (a, b) =>
      a.entry.planted_on.localeCompare(b.entry.planted_on) ||
      a.entry.harvested_on.localeCompare(b.entry.harvested_on),
  );
}
export function useHistory(id: string, enabled = true) {
  const client = useApi();
  const { scope } = useSession();
  const offline = useOffline();
  return useQuery({
    queryKey: keys.history(scope, id),
    enabled: enabled && !offline,
    staleTime: stale.history,
    queryFn: ({ signal }) => readHistory(client, id, signal),
  });
}
