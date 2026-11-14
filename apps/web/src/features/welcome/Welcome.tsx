import { Link, Navigate, useLocation, useNavigate } from "react-router";
import { useState } from "react";
import { Logo } from "../../design/motif/Logo.js";
import { Button } from "../../design/primitives/controls.js";
import { useMessages } from "../../i18n/messages.js";
import { useSession } from "../../app/providers/Runtime.js";

export function hasWelcomed() {
  try {
    return localStorage.getItem("rv.welcomed") === "1";
  } catch {
    return false;
  }
}
export function Component() {
  const { t, language, setLanguage } = useMessages();
  const { account, guest } = useSession();
  const [welcomed, setWelcomed] = useState(hasWelcomed);
  const location = useLocation();
  const navigate = useNavigate();
  if (
    new URLSearchParams(location.search).has("auth") ||
    new URLSearchParams(location.search).has("token")
  )
    return <Navigate replace to={`/account${location.search}`} />;
  if (!location.search.includes("welcome=1") && (welcomed || account || guest))
    return <Navigate replace to="/map" />;
  return (
    <section className="f1-page f1-welcome">
      <Logo />
      <div
        className="f1-language-choice"
        role="group"
        aria-label={t("language")}
      >
        {(["fr", "en"] as const).map((lang) => (
          <Button
            key={lang}
            lang={lang}
            aria-pressed={language === lang}
            onClick={() => setLanguage(lang)}
          >
            {lang === "fr" ? "Français" : "English"}
          </Button>
        ))}
      </div>
      <h1>{t("welcome.title")}</h1>
      <p className="f1-lead">{t("welcome.purpose")}</p>
      <ol className="f1-welcome-lines">
        <li>{t("welcome.line1")}</li>
        <li>{t("welcome.line2")}</li>
        <li>{t("welcome.line3")}</li>
      </ol>
      <p className="f1-caption">{t("welcome.availability")}</p>
      <div className="rv-row">
        <Button
          variant="primary"
          onClick={() => {
            try {
              localStorage.setItem("rv.welcomed", "1");
            } catch {
              /* In-memory first run still works. */
            }
            setWelcomed(true);
            void navigate("/map");
          }}
        >
          {t("welcome.start")}
        </Button>
        <Link to="/account">{t("welcome.signIn")}</Link>
      </div>
    </section>
  );
}
