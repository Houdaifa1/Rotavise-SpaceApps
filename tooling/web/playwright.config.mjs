import base from "../verification/playwright.config.mjs";
import { freePort } from "../../tests/support/polling.mjs";
// The existing farmer-workflow harness imports release 0.1.0. Select that
// recorded release explicitly instead of the deployment's changing default.
process.env.ROTATION_CATALOG_VERSION ??= "0.1.0";
const designOrigin = process.env.ROTAVISE_E2E_DESIGN_ORIGIN ?? base.use.baseURL;
process.env.ROTAVISE_E2E_DESIGN_ORIGIN = designOrigin;
const appPort = Number(process.env.ROTAVISE_E2E_APP_PORT ?? (await freePort()));
process.env.ROTAVISE_E2E_APP_PORT = String(appPort);
const appOrigin = `http://127.0.0.1:${appPort}`;
process.env.ROTAVISE_E2E_WEB_PORT = String(appPort);
// Optional local browser server for restricted macOS environments. The same
// tests, API, PostgreSQL containers and assertions run in both modes.
const use = {
  ...base.use,
  ...(process.env.ROTAVISE_BROWSER_WS
    ? {
        connectOptions: {
          wsEndpoint: process.env.ROTAVISE_BROWSER_WS,
          ...(process.env.ROTAVISE_E2E_BROWSER_FORWARDING === "direct"
            ? {}
            : { exposeNetwork: "<loopback>" }),
        },
      }
    : {}),
};
export default {
  ...base,
  use,
  projects: [
    {
      name: "design",
      testMatch: "design.spec.mjs",
      use: { ...use, baseURL: designOrigin },
    },
    {
      name: "app",
      testIgnore: "design.spec.mjs",
      use: { ...use, baseURL: appOrigin },
    },
  ],
  webServer: [
    base.webServer,
    {
      cwd: base.webServer.cwd,
      command: `node apps/web/node_modules/vite/bin/vite.js preview apps/web --host 127.0.0.1 --port ${appPort} --strictPort`,
      url: appOrigin,
      env: base.webServer.env,
      reuseExistingServer: false,
    },
  ],
};
