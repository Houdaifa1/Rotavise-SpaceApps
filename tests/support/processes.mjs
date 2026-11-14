import { spawn } from "node:child_process";
import { once } from "node:events";
import { TOKEN } from "./token.mjs";
import { poll, freePort } from "./polling.mjs";
export function processFor(entry, env) {
  const child = spawn(
    process.execPath,
    [`apps/server/dist/entrypoints/${entry}.main.js`],
    {
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  child.output = "";
  child.stdout.on("data", (data) => {
    child.output += data;
  });
  child.stderr.on("data", (data) => {
    child.output += data;
  });
  child.exited = once(child, "exit");
  return child;
}
export async function stop(child, signal = "SIGTERM") {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill(signal);
  let timer;
  const finished = await Promise.race([
    child.exited.then(() => true),
    new Promise((resolve) => {
      timer = setTimeout(() => resolve(false), 8000);
    }),
  ]);
  clearTimeout(timer);
  if (!finished) {
    child.kill("SIGKILL");
    await child.exited;
    throw new Error(`Process did not shut down gracefully: ${child.output}`);
  }
}
export function processEnv(db, extra = {}) {
  return {
    NODE_ENV: "test",
    DATABASE_URL: db.url,
    DEV_HARNESS_ENABLED: "true",
    DEV_HARNESS_TOKEN: TOKEN,
    TEST_WORKER_FAULT: "none",
    ...extra,
  };
}
export async function startApi(db, extra = {}) {
  const port = await freePort();
  const child = processFor(
    "api",
    processEnv(db, { API_PORT: String(port), ...extra }),
  );
  try {
    await poll(
      async () => {
        if (child.exitCode !== null) throw new Error(child.output);
        return (await fetch(`http://127.0.0.1:${port}/api/v1/health/live`)).ok;
      },
      { label: "API process" },
    );
  } catch (error) {
    await stop(child);
    throw error;
  }
  return { child, port, origin: `http://127.0.0.1:${port}` };
}
export async function startWorker(db, fault = "none") {
  const port = await freePort();
  const child = processFor(
    "worker",
    processEnv(db, { WORKER_PORT: String(port), TEST_WORKER_FAULT: fault }),
  );
  try {
    await poll(
      () =>
        child.output.includes("worker_ready") ||
        (child.exitCode !== null
          ? Promise.reject(new Error(child.output))
          : false),
      { label: "worker_ready" },
    );
  } catch (error) {
    await stop(child);
    throw error;
  }
  return { child, port };
}
