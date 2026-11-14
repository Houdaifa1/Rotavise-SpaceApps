import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pipeline } from "node:stream/promises";

export const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../..",
);

// Every path and name the commands use comes from here, so tests and drills can
// run beside the real stack without touching it.
export function settings(env = process.env) {
  const environment = env.ROTAVISE_ENVIRONMENT ?? "production";
  if (!["production", "staging"].includes(environment))
    throw new Error("INVALID_ENVIRONMENT");
  const staging = environment === "staging";
  const dataDir = resolve(
    env.ROTAVISE_DATA_DIR ??
      join(homedir(), staging ? "Rotavise-staging-data" : "Rotavise-data"),
  );
  const config = {
    environment,
    repoRoot,
    project:
      env.ROTAVISE_PROJECT ?? (staging ? "rotavise-staging" : "rotavise-prod"),
    dataDir,
    backupDir: join(dataDir, "backups"),
    monitorDir: join(dataDir, "monitor"),
    logDir: join(dataDir, "logs"),
    stateFile: join(dataDir, "state.json"),
    envFile: resolve(
      env.ROTAVISE_ENV_FILE ??
        join(repoRoot, staging ? ".env.staging" : ".env.production"),
    ),
    composeFile: join(repoRoot, "infra/production/compose.yaml"),
    composeOverride: staging
      ? join(repoRoot, "infra/staging/compose.yaml")
      : null,
    templateFile: join(
      repoRoot,
      staging ? "infra/staging/env.template" : "infra/production/env.template",
    ),
    proxyPort: Number(env.PROXY_PORT ?? (staging ? 8089 : 8088)),
    retentionDays: Number(env.BACKUP_RETENTION_DAYS ?? 14),
  };
  if (
    !Number.isInteger(config.retentionDays) ||
    config.retentionDays < 1 ||
    !Number.isInteger(config.proxyPort) ||
    config.proxyPort < 1 ||
    config.proxyPort > 65535
  )
    throw new Error("INVALID_OPERATIONS_SETTINGS");
  if (
    staging &&
    (config.project === "rotavise-prod" ||
      config.dataDir === resolve(homedir(), "Rotavise-data") ||
      config.envFile === join(repoRoot, ".env.production") ||
      config.proxyPort === 8088)
  )
    throw new Error("STAGING_PRODUCTION_COLLISION");
  return config;
}

export function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  }).trim();
}

export const docker = (...args) => run("docker", args);

export function parseEnvText(text) {
  const values = {};
  for (const line of text.split("\n")) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (match) values[match[1]] = match[2];
  }
  return values;
}

export async function readEnvFile(file) {
  return parseEnvText(await readFile(file, "utf8"));
}

function composeEnv(config, tag) {
  return {
    ...process.env,
    COMPOSE_PROJECT_NAME: config.project,
    ROTAVISE_ENV_FILE: config.envFile,
    ROTAVISE_TAG: tag,
    PROXY_PORT: String(config.proxyPort),
  };
}

export function composeArgs(config, args) {
  return [
    "compose",
    "-p",
    config.project,
    "-f",
    config.composeFile,
    ...(config.composeOverride ? ["-f", config.composeOverride] : []),
    "--env-file",
    config.envFile,
    ...args,
  ];
}

export function compose(config, tag, args, options = {}) {
  return run("docker", composeArgs(config, args), {
    env: composeEnv(config, tag),
    cwd: config.repoRoot,
    ...options,
  });
}

export function composeInherit(config, tag, args) {
  execFileSync("docker", composeArgs(config, args), {
    env: composeEnv(config, tag),
    cwd: config.repoRoot,
    stdio: "inherit",
  });
}

export function containerId(config, tag, service) {
  return compose(config, tag, ["ps", "-q", service]).split("\n")[0] || null;
}

// The deployed tag is the git commit, so an image always maps to its source.
export function gitTag({ allowDirty = false } = {}) {
  const dirty = run("git", ["status", "--porcelain", "--untracked-files=no"], {
    cwd: repoRoot,
  });
  const commit = run("git", ["rev-parse", "--short=12", "HEAD"], {
    cwd: repoRoot,
  });
  if (!dirty) return commit;
  if (!allowDirty)
    throw new Error("WORKING_TREE_DIRTY: commit first or pass --allow-dirty");
  return `${commit}-dirty-${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}`;
}

export async function readState(config) {
  try {
    return JSON.parse(await readFile(config.stateFile, "utf8"));
  } catch {
    return { current: null, previous: null, history: [] };
  }
}

export async function writeState(config, state) {
  await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  const partial = `${config.stateFile}.partial`;
  await writeFile(partial, JSON.stringify(state, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(partial, config.stateFile);
}

export function sha256File(file) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256");
    createReadStream(file)
      .on("error", reject)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolveHash(hash.digest("hex")));
  });
}

export function imageExists(image) {
  try {
    docker("image", "inspect", image);
    return true;
  } catch {
    return false;
  }
}

export const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export async function waitFor(
  check,
  { timeoutMs = 180000, everyMs = 2000, label },
) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    try {
      const value = await check();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await sleep(everyMs);
  }
  throw new Error(`TIMEOUT: ${label}${last ? ` (${last.message})` : ""}`);
}

export function containerHealth(id) {
  return docker(
    "inspect",
    "--format",
    "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}",
    id,
  );
}

// Runs a command in a container and resolves with its exit code, stdout and
// stderr; stdin may be a stream.
export function execInContainer(container, args, { stdin, stdout } = {}) {
  return new Promise((resolveExec, reject) => {
    const child = spawn(
      "docker",
      ["exec", ...(stdin ? ["-i"] : []), container, ...args],
      { stdio: [stdin ? "pipe" : "ignore", stdout ? "pipe" : "pipe", "pipe"] },
    );
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => {
      if (!stdout) out += chunk;
    });
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("error", reject);
    const streamError = (error) => {
      child.kill();
      reject(error);
    };
    const outputDone = stdout
      ? pipeline(child.stdout, stdout)
      : Promise.resolve();
    void outputDone.catch(streamError);
    stdin?.on("error", streamError);
    child.on("close", (code) => {
      stdin?.off("error", streamError);
      void outputDone.then(
        () => resolveExec({ code, stdout: out, stderr: err }),
        reject,
      );
    });
    if (stdin) {
      child.stdin.on("error", () => {});
      stdin.pipe(child.stdin);
    }
  });
}

export { existsSync };
