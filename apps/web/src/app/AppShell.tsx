import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useMatches } from "react-router";
import { Icon, type IconName } from "../design/icons/index.js";
import { Logo } from "../design/motif/Logo.js";
import { Button, IconButton } from "../design/primitives/controls.js";
import { Popover, ReminderBar } from "../design/primitives/feedback.js";
import { useMessages, type MessageKey } from "../i18n/messages.js";
import { useBoot, useOffline, useSession } from "./providers/Runtime.js";

import { ServiceStatus } from "./ServiceStatus.js";

const PhoneSheet = lazy(() =>
  import("./PhoneSheet.js").then((module) => ({ default: module.PhoneSheet })),
);

export type RouteMeta = {
  title: MessageKey;
  layout?: "page" | "detail" | "legacy" | "map" | "catalog";
  feature?: "plans" | "auth" | "weather" | "photo";
  slice?: string;
};
export function useRouteMeta(): RouteMeta {
  const matches = useMatches();
  return (matches.at(-1)?.handle ?? { title: "error.notFound" }) as RouteMeta;
}
const mainItems: { key: MessageKey; icon: IconName; href: string }[] = [
  { key: "nav.map", icon: "map", href: "/map" },
  { key: "nav.fields", icon: "fields", href: "/map?panel=fields" },
  { key: "nav.plans", icon: "rotation", href: "/plans" },
  { key: "nav.crops", icon: "crop", href: "/crops" },
  { key: "nav.account", icon: "user", href: "/account" },
];
export function LanguageSwitch() {
  const { language, setLanguage, t } = useMessages();
  return (
    <div className="f1-language" role="group" aria-label={t("language")}>
      {(["fr", "en"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          lang={lang}
          aria-label={lang === "fr" ? "FR (Français)" : "EN (English)"}
          aria-pressed={language === lang}
          onClick={() => setLanguage(lang)}
        >
          {lang.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
function ResourceLinks() {
  const { t } = useMessages();
  const { capabilities } = useBoot();
  const cap = capabilities.data;
  return (
    <nav aria-label={t("shell.tools")} className="f1-resource-links">
      <Link to="/glossary" aria-label={t("nav.glossary")}>
        <Icon name="source" />
        {t("nav.glossary")}
      </Link>
      {cap?.cropHealth.available && (
        <Link to="/photo-check" aria-label={t("nav.photo")}>
          <Icon name="camera" />
          {t("nav.photo")}
        </Link>
      )}
      {cap &&
        !cap.cropHealth.available &&
        cap.cropHealth.reason === "AI_NOT_CONFIGURED" && (
          <span
            className="f1-unavailable"
            role="link"
            aria-disabled="true"
            tabIndex={0}
            title={t("capability.photoOff")}
            aria-label={`${t("nav.photo")}. ${t("capability.photoOff")}`}
          >
            <Icon name="camera" />
            {t("nav.photo")}
            <small>{t("capability.photoOff")}</small>
          </span>
        )}
      <Link to="/about" aria-label={t("nav.about")}>
        <Icon name="info" />
        {t("nav.about")}
      </Link>
    </nav>
  );
}
function MainNavigation({ className }: { className: string }) {
  const location = useLocation();
  const { t } = useMessages();
  return (
    <nav className={className} aria-label={t("shell.navigation")}>
      {mainItems.map((item) => {
        const selected = item.href.includes("?")
          ? (location.pathname === "/map" &&
              location.search.includes("panel=fields")) ||
            location.pathname.startsWith("/fields/")
          : item.href === "/map"
            ? location.pathname === "/map" &&
              !location.search.includes("panel=fields")
            : location.pathname.startsWith(item.href);
        return (
          <Link
            key={item.key}
            to={item.href}
            aria-label={t(item.key)}
            title={t(item.key)}
            aria-current={selected ? "page" : undefined}
          >
            <Icon name={item.icon} />
            <span>{t(item.key)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useMessages();
  const meta = useRouteMeta();
  const location = useLocation();
  const offline = useOffline();
  const { account, recovered, signInRequired } = useSession();
  const [panel, setPanel] = useState(true);
  const [phone, setPhone] = useState(
    () => window.matchMedia("(max-width: 767px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const listener = () => setPhone(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  useEffect(() => {
    if (meta.layout === "map") return;
    setPanel(true);
    const frame = requestAnimationFrame(() =>
      document.getElementById("main-content")?.focus({ preventScroll: true }),
    );
    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.search]);
  return (
    <div className="rv-ui f1-app">
      <a className="rv-skip" href="#main-content">
        {t("skip")}
      </a>
      {offline && (
        <div className="f1-offline" role="status">
          <Icon name="info" />
          {t("shell.offline")}
        </div>
      )}
      <div
        className="fm-service-header"
        role="region"
        aria-label={t("shell.serviceDetails")}
      >
        <ServiceStatus />
      </div>
      <header className="f1-mobile-header">
        <Link to="/map" aria-label="Rotavise">
          <Logo />
        </Link>
        <LanguageSwitch />
        <Popover
          title={t("shell.tools")}
          trigger={
            <IconButton icon="help" label={t("shell.tools")} variant="ghost" />
          }
        >
          <ResourceLinks />
        </Popover>
      </header>
      <div className="f1-shell" data-layout={meta.layout ?? "page"}>
        <aside className="f1-rail" aria-label={t("railNavigation")}>
          <Link to="/map" aria-label="Rotavise">
            <Logo markOnly />
          </Link>
          <MainNavigation className="f1-rail-nav" />
          <div className="f1-rail-bottom">
            <ResourceLinks />
            <LanguageSwitch />
          </div>
        </aside>
        {meta.layout !== "map" && meta.layout !== "catalog" && (
          <aside className="f1-context" aria-label={t("shell.context")}>
            <header>
              <h2>{t("shell.context")}</h2>
              <p>{account ? account.name : t("shell.guest")}</p>
            </header>
            <div className="f1-context-body">
              <ContextLinks />
            </div>
            <ReminderBar text={t("shell.reminder")} />
          </aside>
        )}
        {meta.layout === "detail" && (
          <section className="f1-surface" aria-label={t("nav.map")}>
            <p>{t("shell.noMap")}</p>
          </section>
        )}
        {meta.layout === "map" ? (
          <main id="main-content" tabIndex={-1} className="f1-main f2-main">
            {children}
          </main>
        ) : phone &&
          meta.layout !== "legacy" &&
          meta.layout !== "catalog" &&
          location.pathname !== "/" ? (
          <>
            {!panel && (
              <main id="main-content" tabIndex={-1} className="f1-bare-main">
                <h1 className="rv-sr">{t(meta.title)}</h1>
                <Button
                  className="f1-open-sheet"
                  onClick={() => setPanel(true)}
                >
                  {t("shell.openPanel")}
                </Button>
                <div className="f1-bare-reminder">
                  <ReminderBar text={t("shell.reminder")} />
                </div>
              </main>
            )}
            {panel && (
              <Suspense
                fallback={
                  <main id="main-content" className="f1-main">
                    {children}
                  </main>
                }
              >
                <PhoneSheet
                  key={location.pathname + location.search}
                  title={t(meta.title)}
                  initial={location.pathname === "/map" ? "peek" : "full"}
                  onClose={() => {
                    setPanel(false);
                    requestAnimationFrame(() =>
                      document
                        .querySelector<HTMLButtonElement>(".f1-open-sheet")
                        ?.focus(),
                    );
                  }}
                >
                  {children}
                </PhoneSheet>
              </Suspense>
            )}
          </>
        ) : (
          <main id="main-content" tabIndex={-1} className="f1-main">
            {meta.layout === "detail" && (
              <Link
                className="f1-close-detail"
                to="/map"
                aria-label={t("close")}
              >
                <Icon name="close" />
              </Link>
            )}
            {children}
            <ReminderBar text={t("shell.reminder")} />
          </main>
        )}
      </div>
      {recovered && (
        <div className="f1-session-note" role="status">
          {t("shell.recovered")}
        </div>
      )}
      {signInRequired && (
        <div className="f1-session-note" role="alert">
          {t("shell.signInRequired")}{" "}
          <Link to="/account">{t("welcome.signIn")}</Link>
        </div>
      )}
      <MainNavigation className="f1-tabbar" />
    </div>
  );
}
function ContextLinks() {
  const { t } = useMessages();
  const { capabilities, catalog } = useBoot();
  const cap = capabilities.data;
  return (
    <nav className="f1-context-links" aria-label={t("shell.context")}>
      {cap?.plans && catalog.data ? (
        <Link to="/legacy/planner">
          <Icon name="rotation" />
          {t("nav.planner")}
        </Link>
      ) : (
        <p>
          {t(cap?.plans === false ? "capability.plansOff" : "degraded.catalog")}
        </p>
      )}
      {cap?.weather ? (
        <Link to="/legacy/weather">
          <Icon name="droplet" />
          {t("nav.weather")}
        </Link>
      ) : (
        cap && <p>{t("capability.weatherOff")}</p>
      )}
      <Link to="/account">
        <Icon name="user" />
        {t("nav.account")}
      </Link>
    </nav>
  );
}
