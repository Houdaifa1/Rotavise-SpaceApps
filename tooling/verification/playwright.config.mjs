import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { chooseBrowserPorts } from "../../tests/support/browser-ports.mjs";
const root = fileURLToPath(new URL("../..", import.meta.url));
// Free ports keep browser checks independent of other local servers.
const ports = await chooseBrowserPorts();
export default defineConfig({
  testDir: `${root}/tests/e2e`,
  outputDir: `${root}/.artifacts/playwright/test-results`,
  workers: 1,
  fullyParallel: false,
  timeout: 30000,
  use: { baseURL: ports.webOrigin, headless: true },
  webServer: {
    cwd: root,
    command: `node apps/web/node_modules/vite/bin/vite.js apps/web --host 127.0.0.1 --port ${ports.web}`,
    url: ports.webOrigin,
    env: { API_PROXY_TARGET: ports.apiOrigin },
    reuseExistingServer: false,
  },
  reporter: "list",
});
