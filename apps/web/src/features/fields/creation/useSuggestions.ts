import { useEffect, useMemo, useState } from "react";
import type { FieldSuggestion } from "@rotavise/contracts";
import { getFieldBoundaryTile } from "../../../api/boundary.js";
import { useApi, useSession } from "../../../app/providers/Runtime.js";
import { requestPool } from "../../../shared/requestPool.js";
import type { MapRenderer } from "../../map/mapRenderer.js";
const pool = requestPool(6);
const sessionCaches = new WeakMap<
  ReturnType<typeof useApi>,
  { scope: number; tiles: Map<string, FieldSuggestion[]> }
>();
export function useSuggestions(
  renderer: MapRenderer | undefined,
  enabled: boolean,
) {
  const client = useApi(),
    { scope } = useSession();
  const cache = useMemo(() => {
    let entry = sessionCaches.get(client);
    if (!entry || entry.scope !== scope) {
      entry = { scope, tiles: new Map() };
      sessionCaches.set(client, entry);
    }
    return entry.tiles;
  }, [client, scope]);
  const [fields, setFields] = useState<FieldSuggestion[]>([]),
    [error, setError] = useState<unknown>(),
    [pending, setPending] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    setFields([]);
  }, [scope]);
  useEffect(() => {
    if (!renderer || !enabled) {
      setFields([]);
      setError(undefined);
      setPending(false);
      return;
    }
    const map = renderer.nativeMap;
    let controller: AbortController | undefined,
      live = true;
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      if (map.getZoom() < 12) {
        setFields([]);
        setError(undefined);
        setPending(false);
        return;
      }
      const bounds = map.getBounds(),
        n = 16384;
      const x = (lon: number) =>
        Math.max(0, Math.min(n - 1, Math.floor(((lon + 180) / 360) * n)));
      const y = (lat: number) =>
        Math.max(
          0,
          Math.min(
            n - 1,
            Math.floor(
              ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) /
                2) *
                n,
            ),
          ),
        );
      const tiles: { x: string; y: string; z: "14" }[] = [];
      for (
        let tx = Math.max(0, x(bounds.getWest()) - 1);
        tx <= Math.min(n - 1, x(bounds.getEast()) + 1);
        tx++
      )
        for (
          let ty = Math.max(0, y(bounds.getNorth()) - 1);
          ty <= Math.min(n - 1, y(bounds.getSouth()) + 1);
          ty++
        )
          tiles.push({ z: "14", x: String(tx), y: String(ty) });
      setPending(true);
      setError(undefined);
      // Cache whole suggestions by tile for the owner's session; deduplicate overlaps.
      const results = await Promise.allSettled(
        tiles.map((tile) =>
          pool(signal, async () => {
            const key = `${tile.x}/${tile.y}`;
            if (!cache.has(key)) {
              const response = await getFieldBoundaryTile(client, {
                params: tile,
                signal,
              });
              cache.set(key, response.features);
            }
            return cache.get(key)!;
          }),
        ),
      );
      if (!live || signal.aborted) return;
      const all = new Map<string, FieldSuggestion>();
      let failure: unknown;
      for (const result of results)
        if (result.status === "fulfilled")
          for (const field of result.value) all.set(field.properties.id, field);
        else failure = result.reason;
      setFields([...all.values()]);
      setError(failure);
      setPending(false);
    };
    void load();
    map.on("moveend", load);
    return () => {
      live = false;
      controller?.abort();
      map.off("moveend", load);
    };
  }, [renderer, enabled, client, scope, attempt, cache]);
  return { fields, error, pending, retry: () => setAttempt((n) => n + 1) };
}
