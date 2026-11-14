import { useSyncExternalStore } from "react";
import type { NameMode } from "../design/primitives/crops.js";

const nameModes = ["fr", "en", "ar", "ary", "all"] as const;
const storageKey = "rv.cropNames";
let mode: NameMode = "fr";
const listeners = new Set<() => void>();
try {
  mode =
    nameModes.find((name) => name === localStorage.getItem(storageKey)) ?? "fr";
} catch {
  /* Storage can be unavailable. */
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function useCropNameMode() {
  const nameMode = useSyncExternalStore(subscribe, () => mode);
  return [
    nameMode,
    (next: string) => {
      const selected = nameModes.find((name) => name === next);
      if (!selected) return;
      mode = selected;
      try {
        localStorage.setItem(storageKey, mode);
      } catch {
        /* In-memory preference still applies. */
      }
      listeners.forEach((listener) => listener());
    },
  ] as const;
}
