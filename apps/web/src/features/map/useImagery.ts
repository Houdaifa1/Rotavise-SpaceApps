import { useEffect, useMemo, useState } from "react";
import {
  centreTile,
  previousDays,
  probeTile,
  products,
  utcToday,
  type Position,
  type Product,
  type TileCoverage,
} from "./gibs.js";

export const recentDays = 14;
type DateResult = { date: string; coverage: TileCoverage | "error" };
type Scan = { tile: string; dates: DateResult[] };

export function useImagery(
  product: Product,
  centre: Position,
  end: string,
  manual: string,
  enabled: boolean,
  attempt: number,
  count = recentDays,
) {
  const tile = centreTile(centre, products[product].zoom);
  const key = `${tile.z}/${tile.x}/${tile.y}`;
  const candidates = useMemo(
    () => [
      ...new Set([...previousDays(end, count), ...(manual ? [manual] : [])]),
    ],
    [end, manual, count],
  );
  const [scan, setScan] = useState<Scan>();
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void Promise.all(
        candidates.map(async (date): Promise<DateResult> => {
          try {
            return {
              date,
              coverage: await probeTile(product, date, tile, controller.signal),
            };
          } catch {
            return { date, coverage: "error" };
          }
        }),
      ).then((dates) => {
        if (!controller.signal.aborted) setScan({ tile: key, dates });
      });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, product, candidates, enabled, attempt]);
  const results = scan?.tile === key ? scan.dates : [];
  const present = results.filter(
    ({ coverage }) => coverage === "present" || coverage === "partial",
  );
  return {
    dates: present
      .map(({ date }) => date)
      .sort()
      .reverse(),
    coverage: (date: string) =>
      results.find((result) => result.date === date)?.coverage,
    pending:
      enabled &&
      candidates.some(
        (date) => !results.some((result) => result.date === date),
      ),
    failed: results.some((result) => result.coverage === "error"),
  };
}
export const today = utcToday();
