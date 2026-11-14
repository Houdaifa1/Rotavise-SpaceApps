import type { ComponentType } from "react";
import { createBrowserRouter } from "react-router";
import { Boot } from "./Boot.js";
import { RouteError } from "./ErrorBoundary.js";
import type { RouteMeta } from "./AppShell.js";
import { useMessages } from "../i18n/messages.js";

const progress = () => import("./screens/InProgress.js");
const legacy = () => import("../features/legacy/LegacyScreen.js");
const route = (
  path: string,
  title: RouteMeta["title"],
  slice: string,
  layout: RouteMeta["layout"] = "detail",
  feature?: RouteMeta["feature"],
  load: () => Promise<{ Component: ComponentType }> = progress,
) => ({
  path,
  lazy: load,
  ErrorBoundary: RouteError,
  handle: {
    title,
    slice,
    layout,
    ...(feature ? { feature } : {}),
  } satisfies RouteMeta,
});
function RouteLoading() {
  const { t } = useMessages();
  return (
    <main className="rv-ui f1-page" aria-busy="true">
      <h1>{t("boot.loading")}</h1>
    </main>
  );
}
export const routes = [
  {
    Component: Boot,
    HydrateFallback: RouteLoading,
    children: [
      {
        path: "/",
        lazy: () => import("../features/welcome/Welcome.js"),
        ErrorBoundary: RouteError,
        handle: { title: "welcome.title", layout: "page" } satisfies RouteMeta,
      },
      {
        lazy: () => import("../features/map/MapWorkspace.js"),
        ErrorBoundary: RouteError,
        children: [
          {
            path: "/fields/new",
            Component: () => null,
            handle: {
              title: "progress.field",
              layout: "map",
            } satisfies RouteMeta,
          },
          {
            path: "/map",
            Component: () => null,
            handle: { title: "nav.map", layout: "map" } satisfies RouteMeta,
          },
          {
            path: "/fields/:id/history",
            Component: () => null,
            handle: {
              title: "progress.history",
              layout: "map",
            } satisfies RouteMeta,
          },
          {
            path: "/fields/:id",
            Component: () => null,
            handle: {
              title: "progress.field",
              layout: "map",
            } satisfies RouteMeta,
          },
        ],
      },

      route(
        "/fields/:id/plan/new",
        "progress.builder",
        "F5",
        "catalog",
        "plans",
        () => import("../features/plans/PlanBuilder.js"),
      ),
      route("/plans", "progress.plans", "F10", "page", "plans"),
      route(
        "/plans/:id",
        "progress.results",
        "F5",
        "catalog",
        "plans",
        () => import("../features/plans/PlanProgress.js"),
      ),
      route(
        "/plans/:id/strategy/:strategyId",
        "progress.strategy",
        "F7",
        "detail",
        "plans",
      ),
      route(
        "/plans/:id/evidence/:tab",
        "progress.evidence",
        "F8",
        "detail",
        "plans",
      ),
      route("/plans/:id/what-if", "progress.whatif", "F9", "detail", "plans"),
      ...["/crops", "/crops/:id"].map((path) => ({
        path,
        lazy: () => import("../features/crops/CropsPage.js"),
        ErrorBoundary: RouteError,
        handle: { title: "nav.crops", layout: "catalog" } satisfies RouteMeta,
      })),
      {
        path: "/glossary",
        lazy: () => import("../features/glossary/GlossaryPage.js"),
        ErrorBoundary: RouteError,
        handle: { title: "nav.glossary", layout: "page" } satisfies RouteMeta,
      },
      route("/photo-check", "progress.photo", "F9", "page", "photo"),
      {
        path: "/account",
        lazy: legacy,
        ErrorBoundary: RouteError,
        handle: {
          title: "nav.account",
          layout: "legacy",
          feature: "auth",
        } satisfies RouteMeta,
      },
      route("/about", "progress.about", "F10", "page"),
      route("/demo", "progress.demo", "F10", "page"),
      {
        path: "/legacy/planner",
        lazy: legacy,
        ErrorBoundary: RouteError,
        handle: {
          title: "nav.planner",
          layout: "legacy",
          feature: "plans",
        } satisfies RouteMeta,
      },
      {
        path: "/legacy/weather",
        lazy: legacy,
        ErrorBoundary: RouteError,
        handle: {
          title: "nav.weather",
          layout: "legacy",
          feature: "weather",
        } satisfies RouteMeta,
      },
      {
        path: "*",
        lazy: async () => ({ Component: (await progress()).NotFound }),
        ErrorBoundary: RouteError,
        handle: { title: "error.notFound", layout: "page" } satisfies RouteMeta,
      },
    ],
  },
];
export const createRouter = () => createBrowserRouter(routes);
