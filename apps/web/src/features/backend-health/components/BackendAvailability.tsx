import { useBackendHealth } from "../hooks/useBackendHealth.js";
import "./BackendAvailability.css";
const labels = {
  loading: "Checking backend…",
  ready: "Backend ready",
  unavailable: "Backend unavailable",
  stale: "Backend unavailable — last successful check is stale",
};
export function BackendAvailability() {
  const { state, checkedAt, check } = useBackendHealth();
  return (
    <section className="backend-availability" aria-label="API availability">
      <h2>Backend availability</h2>
      <p role="status" aria-live="polite" data-state={state}>
        {labels[state]}
      </p>
      {checkedAt && (
        <p>
          Last successful check: <time dateTime={checkedAt}>{checkedAt}</time>
        </p>
      )}
      <button onClick={() => void check()}>Retry health check</button>
    </section>
  );
}
