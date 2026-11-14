import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { cpus, tmpdir, totalmem } from "node:os";
import { join } from "node:path";
import { initEnvironment } from "./init.mjs";
import {
  compose,
  composeInherit,
  containerId,
  docker,
  execInContainer,
  readState,
  repoRoot,
  sleep,
  settings,
} from "./lib.mjs";
import { waitHealthy } from "./stack.mjs";

const freePort = () =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });

function planInput() {
  const fixture = JSON.parse(
    readFileSync(
      join(repoRoot, "tests/support/fixtures/plans.synthetic.json"),
      "utf8",
    ),
  );
  if (fixture.synthetic !== true) throw new Error("MISSING_SYNTHETIC_LABEL");
  const input = structuredClone(fixture.input);
  const day = (n) =>
    new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
  input.planning = {
    cycles: 2,
    earliest_start_date: day(7),
    latest_start_date: day(14),
    search_end_date: day(730),
  };
  return input;
}

function machine() {
  const sysctl = (key) => {
    try {
      return execFileSync("sysctl", ["-n", key], { encoding: "utf8" }).trim();
    } catch {
      return null;
    }
  };
  return {
    cpu: sysctl("machdep.cpu.brand_string"),
    logicalCores: cpus().length,
    memoryGiB: Math.round(totalmem() / 1024 ** 3),
    docker: docker(
      "info",
      "--format",
      "{{.ServerVersion}}, {{.NCPU}} CPUs, {{(index .MemTotal)}} bytes for the Docker VM",
    ),
  };
}

// Starts a private copy of the production stack with every external provider
// switched off, drives it with synthetic farmers at each concurrency, then
// removes it. It measures intake, reads and the web app, not the planning
// engine (that needs live NASA data and is not exercised here).
export async function loadTest({
  tag,
  levels = [20, 50, 100, 200],
  seconds = 30,
} = {}) {
  const dir = await mkdtemp(join(tmpdir(), "rotavise-load-"));
  const port = await freePort();
  const envFile = join(dir, ".env.production");
  await initEnvironment({ file: envFile });
  let text = await readFile(envFile, "utf8");
  text = text
    .replace(/^PLANNING_ENABLED=.*$/m, "PLANNING_ENABLED=false")
    .replace(/^WEATHER_ENABLED=.*$/m, "WEATHER_ENABLED=false")
    .replace(
      /^CLIMATE_SCENARIOS_ENABLED=.*$/m,
      "CLIMATE_SCENARIOS_ENABLED=false",
    )
    .replace(/^SCIENCE_URL=.*\n/m, "")
    .replace(/^PROXY_PORT=.*$/m, `PROXY_PORT=${port}`);
  await writeFile(envFile, text, { mode: 0o600 });
  const config = settings({
    ROTAVISE_PROJECT: `rotavise-load-${randomUUID().slice(0, 6)}`,
    ROTAVISE_DATA_DIR: dir,
    ROTAVISE_ENV_FILE: envFile,
    PROXY_PORT: String(port),
  });
  const image = `rotavise-server:${tag}`;
  const script = await readFile(
    join(repoRoot, "tooling/operations/loadgen.mjs"),
    "utf8",
  );
  const results = [];
  try {
    composeInherit(config, tag, ["up", "-d", "--no-build"]);
    await waitHealthy(config, tag);
    const network = `${config.project}_internal`;
    for (const users of levels) {
      const generator = spawn(
        "docker",
        [
          "run",
          "--rm",
          "--network",
          network,
          "--read-only",
          "--tmpfs",
          "/tmp",
          "-e",
          "LOAD_API=http://api:3000",
          "-e",
          "LOAD_PROXY=http://proxy:8080",
          "-e",
          `LOAD_USERS=${users}`,
          "-e",
          `LOAD_SECONDS=${seconds}`,
          "-e",
          `LOAD_PLAN_INPUT=${JSON.stringify(planInput())}`,
          image,
          "node",
          "--input-type=module",
          "--eval",
          script,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let output = "";
      generator.stdout.on("data", (chunk) => (output += chunk));
      const finished = new Promise((done) => generator.on("close", done));
      // Container load is sampled in the middle of the run, under load.
      await sleep((seconds * 1000) / 2);
      const duringRun = {};
      for (const line of docker(
        "stats",
        "--no-stream",
        "--format",
        "{{.Name}} {{.CPUPerc}} {{.MemUsage}}",
      ).split("\n")) {
        const [name, cpu, mem] = line.split(" ");
        if (name?.startsWith(config.project))
          duringRun[name.slice(config.project.length + 1, -2)] = {
            cpu,
            memory: mem,
          };
      }
      await finished;
      const database = containerId(config, tag, "postgres");
      const waiting = async () =>
        Number(
          (
            await execInContainer(database, [
              "psql",
              "-U",
              "rotavise",
              "-d",
              "rotavise",
              "-At",
              "-c",
              "SELECT count(*) FROM pgboss.job WHERE state IN ('created','retry','active')",
            ])
          ).stdout.trim(),
        );
      const backlog = await waiting();
      const drainStarted = Date.now();
      let left = backlog;
      while (left > 0 && Date.now() - drainStarted < 180000) {
        await sleep(2000);
        left = await waiting();
      }
      const drainSeconds = (Date.now() - drainStarted) / 1000;
      results.push({
        ...JSON.parse(output),
        containerLoadDuringRun: duringRun,
        queue: {
          waitingWhenTrafficStopped: backlog,
          secondsToProcessThem: left === 0 ? Math.round(drainSeconds) : null,
          stillWaitingAfter180s: left,
          jobsPerSecondWhileDraining: Number(
            ((backlog - left) / Math.max(drainSeconds, 1)).toFixed(2),
          ),
        },
      });
    }
  } finally {
    try {
      compose(config, tag, ["down", "-v", "--remove-orphans"]);
    } catch {
      // best effort; the project name is unique to this run
    }
    await rm(dir, { recursive: true, force: true });
  }
  return {
    measuredOn: new Date().toISOString(),
    tag,
    machine: machine(),
    secondsPerLevel: seconds,
    results,
  };
}

export async function main() {
  const config = settings();
  const state = await readState(config);
  const tag =
    process.argv.find((a) => a.startsWith("--tag="))?.slice(6) ?? state.current;
  if (!tag)
    throw new Error("NOT_DEPLOYED: build images first with pnpm ops:upgrade");
  const levels = process.argv
    .find((a) => a.startsWith("--levels="))
    ?.slice(9)
    .split(",")
    .map(Number);
  const seconds = Number(
    process.argv.find((a) => a.startsWith("--seconds="))?.slice(10) ?? 30,
  );
  console.log(
    JSON.stringify(await loadTest({ tag, levels, seconds }), null, 2),
  );
}
