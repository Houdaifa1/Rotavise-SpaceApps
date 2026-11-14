import { useEffect, useState, type FormEvent } from "react";
import { timestamp } from "../../../i18n/format.js";
import { cropHistoryEntrySchema, type FieldProfile } from "@rotavise/contracts";
import { ApiFailure, errorMessage } from "../../../app/http.js";
import {
  authCapabilities,
  currentAccount,
  signup,
  login,
  logout,
  requestRecovery,
  resetPassword,
  deleteAccount,
  googleAuth,
  listFields,
  listHistory,
  saveHistory,
  listPlans,
  type Account,
  type SavedField,
  type SavedHistory,
  type SavedPlan,
} from "../api/account-client.js";

export function AccountPanel({
  account,
  onAccount,
  onUseField,
  onOpenPlan,
}: {
  account: Account | null | undefined;
  onAccount: (value: Account | null) => void;
  onUseField: (
    profile: FieldProfile,
    history: { crop_id: string; planted_on: string; harvested_on: string }[],
  ) => void;
  onOpenPlan: (item: SavedPlan) => void;
}) {
  const [capabilities, setCapabilities] = useState<{ google: boolean } | null>(
    null,
  );
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [name, setName] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [fields, setFields] = useState<SavedField[]>([]),
    [fieldCursor, setFieldCursor] = useState<string | null>(null);
  const [plans, setPlans] = useState<SavedPlan[]>([]),
    [planCursor, setPlanCursor] = useState<string | null>(null);
  const [selected, setSelected] = useState<SavedField | null>(null),
    [history, setHistory] = useState<SavedHistory[]>([]),
    [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [cropId, setCropId] = useState(""),
    [planted, setPlanted] = useState(""),
    [harvested, setHarvested] = useState("");
  useEffect(() => {
    const url = new URL(window.location.href);
    const token = url.searchParams.get("token");
    const auth = url.searchParams.get("auth");
    if (token) {
      setResetToken(token);
      setMode("recover");
    }
    if (auth === "verified")
      setMessage("Email verified. Sign in to save your work.");
    if (auth === "google")
      setMessage("Google returned. Checking your account session.");
    if (auth === "deleted")
      setMessage(
        "Account deletion link completed. Refresh account status below.",
      );
    if (token || auth || url.searchParams.has("error")) {
      url.searchParams.delete("token");
      url.searchParams.delete("auth");
      url.searchParams.delete("error");
      window.history.replaceState(
        null,
        "",
        url.pathname + url.search + url.hash,
      );
    }
    void authCapabilities()
      .then(setCapabilities)
      .catch(() => setCapabilities(null));
    void currentAccount()
      .then(onAccount)
      .catch((e: unknown) => {
        if (e instanceof ApiFailure && (e.status === 401 || e.status === 404))
          onAccount(null);
        else {
          setError(errorMessage(e));
        }
      });
  }, [onAccount]);
  useEffect(() => {
    if (!account) {
      setFields([]);
      setPlans([]);
      setSelected(null);
      return;
    }
    void Promise.all([listFields(), listPlans()])
      .then(([f, p]) => {
        setFields(f.items);
        setFieldCursor(f.nextCursor);
        setPlans(p.items);
        setPlanCursor(p.nextCursor);
      })
      .catch((e: unknown) => setError(errorMessage(e)));
  }, [account]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      if (resetToken) {
        await resetPassword(resetToken, password);
        setResetToken("");
        setPassword("");
        setMode("login");
        setMessage("Password changed. Sign in with the new password.");
      } else if (mode === "signup") {
        await signup(name, email, password);
        setPassword("");
        setMessage(
          "Check your email for a verification link before signing in. If an account already exists, check that inbox or use recovery.",
        );
      } else if (mode === "recover") {
        await requestRecovery(email);
        setMessage(
          "If that email has an account, a recovery link has been queued. Check the inbox.",
        );
      } else {
        await login(email, password);
        const me = await currentAccount();
        onAccount(me);
        setPassword("");
        setMessage(
          "Signed in. Your saved fields and plans are available below.",
        );
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function startGoogle(link: boolean) {
    setError("");
    setBusy(true);
    try {
      const response = await googleAuth(link);
      const url = new URL(response.url);
      if (!response.redirect || url.origin !== "https://accounts.google.com")
        throw new Error("GOOGLE_REDIRECT_INVALID");
      window.location.assign(url.href);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }
  async function chooseField(field: SavedField) {
    setSelected(field);
    setHistory([]);
    setHistoryCursor(null);
    setError("");
    try {
      const page = await listHistory(field.id);
      setHistory(page.items);
      setHistoryCursor(page.nextCursor);
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function addHistory(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const parsed = cropHistoryEntrySchema.safeParse({
      schema_version: "1",
      crop_id: cropId,
      planted_on: planted,
      harvested_on: harvested,
    });
    if (!parsed.success) {
      setError("Check the crop ID and planting/harvest dates.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await saveHistory(selected.id, parsed.data);
      setHistory([...history, saved]);
      setCropId("");
      setPlanted("");
      setHarvested("");
      setMessage(
        "Farmer-reported crop history saved. This does not verify the crop or change older plans.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-panel" aria-labelledby="account-title">
      <div className="section-heading">
        <p className="eyebrow">OPTIONAL ACCOUNT</p>
        <h2 id="account-title">Your account and history</h2>
      </div>
      <p>
        Planning works without an account. Sign in only if you want fields, crop
        history and plan results across visits and devices.
      </p>
      {account === undefined && <p role="status">Checking account session…</p>}
      {account === null && (
        <div className="account-box">
          <div className="tabs" role="group" aria-label="Account action">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                setResetToken("");
              }}
            >
              Sign in
            </button>
            <button
              className={mode === "signup" ? "active" : ""}
              onClick={() => {
                setMode("signup");
                setResetToken("");
              }}
            >
              Create account
            </button>
            <button
              className={mode === "recover" ? "active" : ""}
              onClick={() => setMode("recover")}
            >
              Recover access
            </button>
          </div>
          <form onSubmit={(e) => void submit(e)} className="form-stack">
            {resetToken ? (
              <p>Choose a new password for the account linked in your email.</p>
            ) : (
              <label>
                Email address
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
            )}
            {mode === "signup" && !resetToken && (
              <label>
                Your name
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  required
                />
              </label>
            )}
            {(mode !== "recover" || resetToken) && (
              <label>
                {resetToken ? "New password" : "Password"}
                <input
                  type="password"
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  minLength={mode === "login" ? 1 : 15}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </label>
            )}
            <button className="button-primary" disabled={busy}>
              {resetToken
                ? "Set new password"
                : mode === "signup"
                  ? "Create account"
                  : mode === "recover"
                    ? "Send recovery link"
                    : "Sign in"}
            </button>
          </form>
          {capabilities?.google && (
            <button
              className="button-secondary"
              disabled={busy}
              onClick={() => void startGoogle(false)}
            >
              Continue with Google
            </button>
          )}
          {!capabilities?.google && (
            <p className="muted">
              Google sign-in will appear when the Google OAuth client is
              configured.
            </p>
          )}
          <button
            className="button-text"
            onClick={() => {
              void logout()
                .then(() => setMessage("Old sign-in cookies cleared."))
                .catch((e: unknown) => setError(errorMessage(e)));
            }}
          >
            Clear an expired sign-in cookie
          </button>
        </div>
      )}
      {account && (
        <div className="result-stack">
          <div className="notice">
            <strong>{account.name}</strong> · {account.email}
            <br />
            Session expires {timestamp(account.sessionExpiresAt, "en")}
          </div>
          <div className="actions">
            <button
              className="button-secondary"
              onClick={() => {
                void logout()
                  .then(() => {
                    onAccount(null);
                    setSelected(null);
                    setMessage("Signed out.");
                  })
                  .catch((e: unknown) => setError(errorMessage(e)));
              }}
            >
              Sign out
            </button>
            {capabilities?.google && (
              <button
                className="button-secondary"
                disabled={busy}
                onClick={() => void startGoogle(true)}
              >
                Link Google to this account
              </button>
            )}
          </div>
          <section className="result-card">
            <h3>Saved fields</h3>
            {fields.length ? (
              <ul>
                {fields.map((field) => (
                  <li key={field.id}>
                    <strong>{field.profile.name}</strong> ·{" "}
                    {field.profile.location.latitude},{" "}
                    {field.profile.location.longitude}{" "}
                    <button
                      className="button-text"
                      onClick={() => void chooseField(field)}
                    >
                      History
                    </button>
                    <button
                      className="button-text"
                      onClick={() => {
                        void listHistory(field.id)
                          .then((page) => {
                            onUseField(
                              field.profile,
                              page.items.map((x) => x.entry),
                            );
                            setMessage(
                              "Field loaded into the planner. History is treated as partial until you confirm it.",
                            );
                          })
                          .catch((e: unknown) => setError(errorMessage(e)));
                      }}
                    >
                      Use in planner
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No fields saved yet. Use the planner to save one.</p>
            )}
            {fieldCursor && (
              <button
                className="button-secondary"
                onClick={() => {
                  void listFields(fieldCursor)
                    .then((page) => {
                      setFields([...fields, ...page.items]);
                      setFieldCursor(page.nextCursor);
                    })
                    .catch((e: unknown) => setError(errorMessage(e)));
                }}
              >
                Load more fields
              </button>
            )}
          </section>
          {selected && (
            <section className="result-card">
              <h3>History for {selected.profile.name}</h3>
              {history.length ? (
                <ul>
                  {history.map((item) => (
                    <li key={item.id}>
                      {item.entry.crop_id}: {item.entry.planted_on} –{" "}
                      {item.entry.harvested_on}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No dated crop history saved.</p>
              )}
              {historyCursor && (
                <button
                  className="button-secondary"
                  onClick={() => {
                    void listHistory(selected.id, historyCursor)
                      .then((page) => {
                        setHistory([...history, ...page.items]);
                        setHistoryCursor(page.nextCursor);
                      })
                      .catch((e: unknown) => setError(errorMessage(e)));
                  }}
                >
                  Load more history
                </button>
              )}
              <form onSubmit={(e) => void addHistory(e)} className="form-grid">
                <label>
                  Crop ID
                  <input
                    value={cropId}
                    onChange={(e) => setCropId(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Planted on
                  <input
                    type="date"
                    value={planted}
                    onChange={(e) => setPlanted(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Harvested on
                  <input
                    type="date"
                    value={harvested}
                    onChange={(e) => setHarvested(e.target.value)}
                    required
                  />
                </label>
                <button disabled={busy}>Save reported history</button>
              </form>
            </section>
          )}
          <section className="result-card">
            <h3>Saved plans</h3>
            {plans.length ? (
              <ul>
                {plans.map((item) => (
                  <li key={item.id}>
                    {item.createdAt.slice(0, 10)} · {item.status}{" "}
                    <button
                      className="button-text"
                      onClick={() => onOpenPlan(item)}
                    >
                      Open result
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No account plans yet.</p>
            )}
            {planCursor && (
              <button
                className="button-secondary"
                onClick={() => {
                  void listPlans(planCursor)
                    .then((page) => {
                      setPlans([...plans, ...page.items]);
                      setPlanCursor(page.nextCursor);
                    })
                    .catch((e: unknown) => setError(errorMessage(e)));
                }}
              >
                Load more plans
              </button>
            )}
          </section>
          <details className="result-card">
            <summary>Delete my account</summary>
            <p>
              Account deletion removes saved fields, crop history, sessions and
              owned plans. You will receive a confirmation link by email.
            </p>
            <button
              className="button-danger"
              onClick={() => {
                if (
                  window.confirm("Send an account deletion confirmation link?")
                )
                  void deleteAccount()
                    .then(() =>
                      setMessage("Check your email to confirm deletion."),
                    )
                    .catch((e: unknown) => setError(errorMessage(e)));
              }}
            >
              Send deletion confirmation
            </button>
          </details>
        </div>
      )}
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
