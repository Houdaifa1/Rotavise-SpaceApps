import { randomBytes } from "node:crypto";
import { readFile, writeFile, mkdir, chmod } from "node:fs/promises";
import { join } from "node:path";
import { repoRoot, settings } from "./lib.mjs";

const secret = (bytes) => randomBytes(bytes).toString("base64url");

// Creates the production settings file with fresh secrets. It never overwrites:
// the "wx" flag fails if the file exists, even when two runs race.
export async function initEnvironment({
  file = settings().envFile,
  template = join(repoRoot, "infra/production/env.template"),
} = {}) {
  const text = (await readFile(template, "utf8"))
    .replaceAll("{{POSTGRES_PASSWORD}}", secret(32))
    .replaceAll("{{WEATHER_INTERNAL_TOKEN}}", secret(32))
    .replaceAll("{{AUTH_SECRET}}", secret(48));
  if (text.includes("{{")) throw new Error("TEMPLATE_PLACEHOLDER_UNFILLED");
  try {
    await writeFile(file, text, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (error.code === "EEXIST")
      throw new Error(`ENV_FILE_EXISTS: ${file} was not changed`);
    throw error;
  }
  await chmod(file, 0o600);
  return file;
}

export async function main() {
  const config = settings();
  const file = await initEnvironment({
    file: config.envFile,
    template: config.templateFile,
  });
  await mkdir(config.dataDir, { recursive: true, mode: 0o700 });
  console.log(`Created ${file} (mode 600) with new random secrets.`);
  console.log(
    "Leave it as is to run Rotavise without accounts, email or Claude. See docs/operations/RUNBOOK.md.",
  );
}
