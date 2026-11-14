import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { parseEnv } from "node:util";
// Match Node --env-file: explicit shell settings take precedence over defaults.
const env = { ...parseEnv(readFileSync(".env", "utf8")), ...process.env };
// The Vite proxy follows the configured API port instead of assuming 3000.
env.API_PROXY_TARGET ??= `http://127.0.0.1:${env.API_PORT ?? "3000"}`;
const children = [
  spawn(process.execPath, ["apps/server/dist/entrypoints/api.main.js"], {
    env,
    stdio: "inherit",
  }),
  spawn(process.execPath, ["apps/server/dist/entrypoints/worker.main.js"], {
    env,
    stdio: "inherit",
  }),
  spawn(
    process.execPath,
    [
      "apps/web/node_modules/vite/bin/vite.js",
      "apps/web",
      "--host",
      "127.0.0.1",
    ],
    {
      env,
      stdio: "inherit",
    },
  ),
];
let closing = false;
function stop() {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
}
for (const child of children)
  child.on("exit", (code) => {
    if (!closing) {
      process.exitCode = code || 1;
      stop();
    }
  });
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
