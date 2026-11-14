import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBackendHealth } from "../api/health-client.js";
export function useBackendHealth() {
  const [state, setState] = useState<
    "loading" | "ready" | "unavailable" | "stale"
  >("loading");
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const hadReady = useRef(false);
  const active = useRef<AbortController | null>(null);
  const check = useCallback(async () => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setState("loading");
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const health = await fetchBackendHealth(controller.signal);
      if (active.current !== controller) return;
      hadReady.current = true;
      setCheckedAt(health.checkedAt);
      setState("ready");
    } catch {
      if (active.current === controller)
        setState(hadReady.current ? "stale" : "unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }, []);
  useEffect(() => {
    void check();
    const poll = setInterval(() => void check(), 5000);
    return () => {
      clearInterval(poll);
      active.current?.abort();
      active.current = null;
    };
  }, [check]);
  return { state, checkedAt, check };
}
