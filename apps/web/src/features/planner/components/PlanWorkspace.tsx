import { timestamp } from "../../../i18n/format.js";
import { useEffect, useState } from "react";
import type { CatalogOptions, PlanRequest } from "@rotavise/contracts";
import { errorMessage } from "../../../app/http.js";
import type { Account } from "../../account/index.js";
import {
  catalogOptions,
  catalogOptionsFor,
  createGuestSession,
  submitPlan,
  readPlan,
  claimPlan,
  loadGuest,
  saveGuest,
  loadActive,
  saveActive,
  clearActive,
  type ActivePlan,
  type AnyPlan,
} from "../api/planner-client.js";
import { PlanForm } from "./PlanForm.js";
import { PlanResult } from "./PlanResult.js";
import type { FieldProfile } from "@rotavise/contracts";

type Prefill = {
  profile: FieldProfile;
  history: { crop_id: string; planted_on: string; harvested_on: string }[];
};
export function PlanWorkspace({
  account,
  prefilling,
  opened,
}: {
  account: Account | null | undefined;
  prefilling: Prefill | null;
  opened: { id: string; expiresAt: string } | null;
}) {
  const [catalog, setCatalog] = useState<CatalogOptions | null>(null);
  const [displayCatalog, setDisplayCatalog] = useState<CatalogOptions | null>(
    null,
  );
  const [catalogError, setCatalogError] = useState("");
  const [active, setActive] = useState<ActivePlan | null>(() => loadActive());
  const [plan, setPlan] = useState<AnyPlan | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<{
    input: PlanRequest;
    key: string;
    token?: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(() => !loadActive());
  const [claiming, setClaiming] = useState(false);
  const [statusRetry, setStatusRetry] = useState(0);
  useEffect(() => {
    if (!opened) return;
    const value = { id: opened.id, expiresAt: opened.expiresAt };
    saveActive(value);
    setActive(value);
    setPlan(null);
    setEditing(false);
  }, [opened]);
  function reloadCatalog() {
    const controller = new AbortController();
    void catalogOptions(controller.signal)
      .then((v) => {
        setCatalog(v);
        setCatalogError("");
      })
      .catch((e: unknown) => {
        if (!controller.signal.aborted) setCatalogError(errorMessage(e));
      });
    return () => controller.abort();
  }
  useEffect(reloadCatalog, []);
  useEffect(() => {
    setPlan(null);
    setDisplayCatalog(null);
    if (
      !active ||
      account === undefined ||
      (!!active.guestToken && !!account) ||
      (!active.guestToken && !account)
    )
      return;
    let closed = false,
      timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const check = async () => {
      try {
        const status = await readPlan(
          active.id,
          active.guestToken,
          controller.signal,
        );
        if (closed) return;
        let pinned = catalog;
        if (
          status.status === "completed" &&
          "intakeEvidence" in status &&
          status.intakeEvidence
        ) {
          const evidence = status.intakeEvidence;
          if (
            !pinned ||
            pinned.catalogId !== evidence.catalogId ||
            pinned.catalogVersion !== evidence.catalogVersion ||
            pinned.catalogSha256 !== evidence.catalogSha256
          ) {
            pinned = await catalogOptionsFor(
              evidence.catalogId,
              evidence.catalogVersion,
              controller.signal,
            );
          }
          if (pinned.catalogSha256 !== evidence.catalogSha256)
            throw new Error("CATALOG_EVIDENCE_MISMATCH");
        }
        if (closed) return;
        setDisplayCatalog(pinned);
        setPlan(status);
        setError("");
        if (status.status === "queued" || status.status === "running")
          timer = setTimeout(() => void check(), 3000);
      } catch (e) {
        if (!closed && !controller.signal.aborted) setError(errorMessage(e));
      }
    };
    void check();
    return () => {
      closed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [active, account, statusRetry, catalog]);
  async function send(input: PlanRequest, key: string, existingToken?: string) {
    setBusy(true);
    setError("");
    let token = existingToken;
    try {
      if (!account) {
        if (!token) {
          let guest = loadGuest();
          if (!guest) {
            guest = await createGuestSession();
            saveGuest(guest);
          }
          token = guest.accessToken;
        }
      }
      setPending({ input, key, ...(token ? { token } : {}) });
      const accepted = await submitPlan(input, key, token);
      const value: ActivePlan = {
        id: accepted.id,
        expiresAt: accepted.expiresAt,
        ...(token ? { guestToken: token } : {}),
      };
      saveActive(value);
      setActive(value);
      setPending(null);
      setPlan(null);
      setEditing(false);
    } catch (e) {
      setError(
        errorMessage(e) +
          " Retry uses the same request key to avoid a duplicate plan.",
      );
      throw e;
    } finally {
      setBusy(false);
    }
  }
  async function claim() {
    if (!active?.guestToken || !account) return;
    setClaiming(true);
    setError("");
    try {
      await claimPlan(active.id, active.guestToken);
      const owned = await readPlan(active.id);
      const value = { id: active.id, expiresAt: owned.expiresAt };
      saveActive(value);
      setActive(value);
      setPlan(owned);
    } catch (e) {
      setError(
        errorMessage(e) +
          " A recent login and the live guest session are required.",
      );
    } finally {
      setClaiming(false);
    }
  }
  return (
    <div className="workspace-grid">
      <div>
        {catalog && account !== undefined ? (
          <PlanForm
            catalog={catalog}
            account={!!account}
            prefilling={prefilling}
            onSubmit={(input) => send(input, crypto.randomUUID())}
          />
        ) : catalog ? (
          <section className="feature-panel">
            <h2>Planner</h2>
            <p role="status">Checking your account session…</p>
          </section>
        ) : (
          <section className="feature-panel">
            <h2>Crop options</h2>
            <p role="status">{catalogError || "Loading the real catalog…"}</p>
            {catalogError && (
              <button onClick={reloadCatalog}>Retry catalog</button>
            )}
          </section>
        )}
      </div>
      <aside className="workspace-aside">
        <section className="feature-panel">
          <p className="eyebrow">PROCESS</p>
          <h2>Current assessment</h2>
          {!active && (
            <p>
              Review and submit the form to start a private, durable assessment.
            </p>
          )}
          {active && (
            <>
              <p>Expires {timestamp(active.expiresAt, "en")}</p>
              <p>
                {active.guestToken
                  ? "Private guest request, held in this browser session."
                  : "Saved to your account."}
              </p>
            </>
          )}
          {active?.guestToken && !!account && (
            <div className="notice">
              <p>
                Sign-in does not automatically move a guest request. Claim it
                explicitly with your recent account login.
              </p>
              <button disabled={claiming} onClick={() => void claim()}>
                {claiming ? "Claiming…" : "Claim this guest plan"}
              </button>
            </div>
          )}
          {active && !active.guestToken && !account && (
            <p>Sign in to view this account-owned plan.</p>
          )}
          {active &&
            !plan &&
            !error &&
            !(
              (!!active.guestToken && !!account) ||
              (!active.guestToken && !account)
            ) && <p role="status">Loading saved progress…</p>}
          {plan && (
            <p role="status">
              {plan.status} · {plan.stage.replaceAll("_", " ")}
            </p>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          {active && error && !pending && (
            <button
              className="button-secondary"
              onClick={() => setStatusRetry((value) => value + 1)}
            >
              Retry plan status
            </button>
          )}
          {pending && (
            <button
              disabled={busy}
              className="button-secondary"
              onClick={() =>
                void send(pending.input, pending.key, pending.token).catch(
                  () => {},
                )
              }
            >
              Retry same submission
            </button>
          )}
          {active && (
            <button
              className="button-text"
              onClick={() => {
                clearActive();
                setActive(null);
                setPlan(null);
                setEditing(true);
                setError("");
              }}
            >
              Start a new comparison
            </button>
          )}
        </section>
        <section className="feature-panel compact">
          <h2>What this app can say</h2>
          <ul>
            <li>
              Every considered crop is assessed and missing evidence stays
              visible.
            </li>
            <li>Historical NASA weather is not a forecast.</li>
            <li>
              Irrigation sufficiency and measured soil improvement are not
              claimed.
            </li>
          </ul>
        </section>
      </aside>
      {active && !editing && displayCatalog && plan && (
        <div className="full-width">
          <PlanResult plan={plan} catalog={displayCatalog} />
          <button className="button-secondary" onClick={() => setEditing(true)}>
            Change inputs and compare again
          </button>
        </div>
      )}
    </div>
  );
}
