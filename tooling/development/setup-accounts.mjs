import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { randomBytes } from "node:crypto";
let content = readFileSync(".env", "utf8");
const defaults = {
  AUTH_SECRET: randomBytes(48).toString("base64url"),
  AUTH_BASE_URL: "http://127.0.0.1:5173",
  AUTH_TRUSTED_ORIGINS: "http://127.0.0.1:5173",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_TLS: "local",
  MAIL_FROM: "rotavise@example.invalid",
  WEATHER_INTERNAL_TOKEN: randomBytes(32).toString("hex"),
};
for (const [key, value] of Object.entries(defaults))
  if (!new RegExp(`^${key}=`, "m").test(content))
    content += `\n${key}=${value}`;
for (const key of [
  "AUTH_ENABLED",
  "PLANS_ENABLED",
  "PLANNING_ENABLED",
  "WEATHER_ENABLED",
]) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  content = pattern.test(content)
    ? content.replace(pattern, `${key}=true`)
    : content + `\n${key}=true`;
}
writeFileSync(".env", content.trimEnd() + "\n", { mode: 0o600 });
chmodSync(".env", 0o600);
console.log(
  "Enabled local accounts, weather and full planning; existing secrets/SMTP settings preserved. Start the local SMTP inbox before running the worker.",
);
