#!/usr/bin/env node
// Single entry point for every operations command (see docs/operations/RUNBOOK.md).
import { spawn } from "node:child_process";
const usesLocalDatabase = (args) =>
  args.includes("--local-database") ||
  process.env.ROTAVISE_LOCAL_DATABASE === "rotavise";
async function runLocal(script, args = []) {
  const child = spawn(
    process.execPath,
    [
      `--env-file-if-exists=${process.env.ROTAVISE_CONFIG_ENV_FILE ?? ".env"}`,
      `tooling/operations/${script}.mjs`,
      ...args,
    ],
    { stdio: "inherit" },
  );
  process.exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}
const COMMANDS = {
  init: async () => (await import("./init.mjs")).main(),
  upgrade: async (args) =>
    (await import("./stack.mjs")).upgrade({
      allowDirty: args.includes("--allow-dirty"),
      tag: args.find((a) => a.startsWith("--tag="))?.slice(6) ?? null,
    }),
  up: async (args) =>
    (await import("./stack.mjs")).up({ recreate: args.includes("--recreate") }),
  down: async () => (await import("./stack.mjs")).down(),
  status: async (args) =>
    usesLocalDatabase(args)
      ? runLocal("db-check-complete")
      : (await import("./stack.mjs")).status(),
  logs: async (args) => (await import("./stack.mjs")).logs(args[0]),
  rollback: async (args) =>
    (await import("./stack.mjs")).rollback({
      tag: args.find((a) => !a.startsWith("--")),
      restore: args.find((a) => a.startsWith("--restore="))?.slice(10) ?? null,
    }),
  restore: async (args) => {
    const lib = await import("./lib.mjs");
    const config = lib.settings();
    const name = args.find((a) => !a.startsWith("--"));
    if (!name || !args.includes("--yes"))
      throw new Error(
        "USAGE: pnpm ops:restore <backup file name> --yes   (replaces the live database)",
      );
    const { current } = await lib.readState(config);
    await (
      await import("./stack.mjs")
    ).restoreLive({ file: `${config.backupDir}/${name}`, tag: current });
  },
  backup: async (args) =>
    usesLocalDatabase(args)
      ? runLocal("local-database-backup", args)
      : (await import("./backup.mjs")).main(),
  "restore-drill": async (args) =>
    usesLocalDatabase(args)
      ? runLocal("local-database-backup", ["--drill-only", ...args])
      : (await import("./restore-drill.mjs")).main(),
  monitor: async () => (await import("./monitor.mjs")).main(),
  schedule: async (args) => {
    const schedule = await import("./schedule.mjs");
    const action = args[0];
    if (action === "install") return schedule.install();
    if (action === "uninstall") return schedule.uninstall();
    if (action === "status") return schedule.scheduleStatus();
    throw new Error("USAGE: pnpm ops:schedule install|uninstall|status");
  },
  "security-check": async () => (await import("./security-check.mjs")).main(),
  loadtest: async () => (await import("./loadtest.mjs")).main(),
};

const [command, ...args] = process.argv.slice(2);
if (!COMMANDS[command]) {
  console.error(
    `Unknown command. Use one of: ${Object.keys(COMMANDS).join(", ")}`,
  );
  process.exit(2);
}
try {
  await COMMANDS[command](args);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
