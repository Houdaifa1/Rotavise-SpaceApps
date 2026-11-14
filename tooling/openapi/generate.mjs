// Writes docs/api/openapi.json from the Zod contracts the routes parse with.
// `--check` fails instead of writing when the committed file is out of date.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiDocument } from "../../packages/contracts/dist/index.js";

const target = fileURLToPath(
  new URL("../../docs/api/openapi.json", import.meta.url),
);
const text = JSON.stringify(buildOpenApiDocument(), null, 2) + "\n";
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {
    // Missing counts as out of date.
  }
  if (current !== text) {
    console.error(
      "docs/api/openapi.json is out of date: run `pnpm openapi:generate`.",
    );
    process.exit(1);
  }
  console.log("docs/api/openapi.json is up to date.");
} else {
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, text);
  console.log(`Wrote ${target}`);
}
