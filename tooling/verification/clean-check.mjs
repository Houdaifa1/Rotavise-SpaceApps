import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
const target = mkdtempSync(join(tmpdir(), "rotavise-clean-"));
try {
  cpSync(process.cwd(), target, {
    recursive: true,
    filter: (path) =>
      ![
        "node_modules",
        "dist",
        ".git",
        ".env",
        ".artifacts",
        "test-results",
        "playwright-report",
      ].includes(basename(path)),
  });
  for (const args of [["install", "--frozen-lockfile"], ["build"]])
    execFileSync("pnpm", args, { cwd: target, stdio: "inherit" });
  console.log(
    "PASS clean copy: frozen install and complete build without generated artifacts",
  );
} finally {
  rmSync(target, { recursive: true, force: true });
}
