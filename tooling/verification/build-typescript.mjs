import { rmSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
const root = realpathSync(fileURLToPath(new URL("../..", import.meta.url)));
const directory = realpathSync(process.cwd());
const ownedPackages = [
  "apps/server",
  "packages/contracts",
  "packages/catalog",
  "packages/domain",
  "packages/database",
].map((path) => resolve(root, path));
if (!ownedPackages.includes(directory))
  throw new Error("UNEXPECTED_BUILD_DIRECTORY");
// Delete only this package's generated output; moved source must not leave stale entry points.
rmSync(resolve(directory, "dist"), { recursive: true, force: true });
execFileSync(
  process.execPath,
  [resolve(root, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
  { stdio: "inherit" },
);
