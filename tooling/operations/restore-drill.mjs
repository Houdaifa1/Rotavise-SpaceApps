import { randomBytes, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { listBackups } from "./backup.mjs";
import {
  docker,
  execInContainer,
  readState,
  run,
  settings,
  sha256File,
  waitFor,
  repoRoot,
} from "./lib.mjs";

export const POSTGRES_IMAGE =
  "postgres:18.4-bookworm@sha256:882236b897e39051d2368c5ccc6cda944904723506b2dfc97f2a8f5bc9afa382";

export async function checksumMatches(dumpPath) {
  const recorded = (await readFile(`${dumpPath}.sha256`, "utf8"))
    .trim()
    .split(/\s+/)[0];
  return { recorded, actual: await sha256File(dumpPath) };
}

// Restores a backup into a throwaway database and proves it works by running
// the checks in restore-verify.mjs inside the production server image. The
// live database is never touched.
export async function restoreDrill({ dir, image, file = null }) {
  const backups = await listBackups(dir);
  const chosen = file ?? backups[0]?.name;
  if (!chosen) throw new Error("NO_BACKUP: run pnpm ops:backup first");
  const dumpPath = join(dir, chosen);
  const sums = await checksumMatches(dumpPath);
  const report = { backup: chosen, checks: [] };
  report.checks.push({
    name: "backup file matches its recorded checksum",
    ok: sums.recorded === sums.actual,
    detail: sums.actual,
  });
  if (sums.recorded !== sums.actual) return { ok: false, ...report };
  const manifest = JSON.parse(
    await readFile(`${dumpPath}.manifest.json`, "utf8"),
  );
  const id = randomUUID().slice(0, 8);
  const network = `rotavise-drill-net-${id}`;
  const dbName = `rotavise-drill-db-${id}`;
  const password = randomBytes(16).toString("hex");
  // With an image, the checks run inside it on a private network (the real
  // drill). Without one (automated tests), they run from the built server code
  // on this machine against a database published on 127.0.0.1 only.
  const hostMode = image === null;
  if (!hostMode) docker("network", "create", "--internal", network);
  try {
    docker(
      "run",
      "-d",
      "--name",
      dbName,
      ...(hostMode ? ["-p", "127.0.0.1::5432"] : ["--network", network]),
      "--label",
      "rotavise.drill=true",
      "-e",
      "POSTGRES_USER=rotavise",
      "-e",
      "POSTGRES_DB=rotavise",
      "-e",
      `POSTGRES_PASSWORD=${password}`,
      POSTGRES_IMAGE,
    );
    await waitFor(
      async () =>
        (
          await execInContainer(dbName, [
            "pg_isready",
            "-U",
            "rotavise",
            "-d",
            "rotavise",
            "-h",
            "127.0.0.1",
          ])
        ).code === 0,
      { label: "drill database ready", timeoutMs: 90000, everyMs: 1000 },
    );
    const restore = await execInContainer(
      dbName,
      [
        "pg_restore",
        "-U",
        "rotavise",
        "-d",
        "rotavise",
        "--no-owner",
        "--exit-on-error",
      ],
      { stdin: createReadStream(dumpPath) },
    );
    report.checks.push({
      name: "pg_restore completes without errors",
      ok: restore.code === 0,
      detail: restore.code === 0 ? "ok" : restore.stderr.trim().slice(0, 300),
    });
    if (restore.code !== 0) return { ok: false, ...report };
    const script = await readFile(
      join(repoRoot, "tooling/operations/restore-verify.mjs"),
      "utf8",
    );
    let verification;
    try {
      const databaseUrl = hostMode
        ? `postgresql://rotavise:${password}@127.0.0.1:${docker("port", dbName, "5432/tcp").split(":").at(-1)}/rotavise`
        : `postgresql://rotavise:${password}@${dbName}:5432/rotavise`;
      const output = hostMode
        ? run(process.execPath, ["--input-type=module", "--eval", script], {
            cwd: join(repoRoot, "apps/server"),
            env: {
              ...process.env,
              DATABASE_URL: databaseUrl,
              MANIFEST_JSON: JSON.stringify(manifest),
            },
          })
        : docker(
            "run",
            "--rm",
            "--network",
            network,
            "--read-only",
            "--tmpfs",
            "/tmp",
            "-e",
            `DATABASE_URL=${databaseUrl}`,
            "-e",
            `MANIFEST_JSON=${JSON.stringify(manifest)}`,
            image,
            "node",
            "--input-type=module",
            "--eval",
            script,
          );
      verification = JSON.parse(output);
    } catch (error) {
      const out = error.stdout ? String(error.stdout) : "";
      try {
        verification = JSON.parse(out);
      } catch {
        verification = {
          ok: false,
          checks: [
            {
              name: "verification script ran",
              ok: false,
              detail: String(error.stderr ?? error.message).slice(0, 400),
            },
          ],
        };
      }
    }
    report.checks.push(...verification.checks);
    return { ok: report.checks.every((check) => check.ok), ...report };
  } finally {
    try {
      docker("rm", "-f", dbName);
    } catch {
      // already gone
    }
    if (!hostMode) {
      try {
        docker("network", "rm", network);
      } catch {
        // already gone
      }
    }
  }
}

export async function main() {
  const config = settings();
  const state = await readState(config);
  if (!state.current)
    throw new Error("NOT_DEPLOYED: run pnpm ops:upgrade first");
  const file =
    process.argv.find((arg) => arg.startsWith("--file="))?.slice(7) ?? null;
  const result = await restoreDrill({
    dir: config.backupDir,
    image: `rotavise-server:${state.current}`,
    file,
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}
