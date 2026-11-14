import { Outlet, useLocation } from "react-router";
import { AppShell, useRouteMeta } from "./AppShell.js";
import { BootProvider, useBootQueries } from "./providers/Runtime.js";
import { ScreenBoundary } from "./ErrorBoundary.js";

// A failed service check must not replace the independent map or app shell.
// Feature queries render their own errors; service details live in the header.
export function Boot() {
  const boot = useBootQueries();
  const { layout } = useRouteMeta();
  const location = useLocation();
  return (
    <BootProvider value={boot}>
      <AppShell>
        <ScreenBoundary
          resetKey={layout === "map" ? "map-workspace" : location.pathname}
        >
          <Outlet />
        </ScreenBoundary>
      </AppShell>
    </BootProvider>
  );
}
