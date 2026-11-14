// Creates a local .env for a new team machine: the same switches as the team's
// development setup, fresh random local tokens, and no personal accounts.
// Never overwrites an existing .env.
import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const token = () => randomBytes(32).toString("hex");
const lines = [
  "NODE_ENV=development",
  "DATABASE_URL=postgresql://rotavise:rotavise_local_only@127.0.0.1:54329/rotavise",
  "API_HOST=127.0.0.1",
  "API_PORT=3000",
  "WORKER_HOST=127.0.0.1",
  "WORKER_PORT=3001",
  "DEV_HARNESS_ENABLED=true",
  `DEV_HARNESS_TOKEN=${token()}`,
  "WEATHER_ENABLED=true",
  `WEATHER_INTERNAL_TOKEN=${token()}`,
  "PLANS_ENABLED=true",
  "PLANNING_ENABLED=true",
  "CLIMATE_SCENARIOS_ENABLED=true",
  "SCIENCE_URL=http://127.0.0.1:8090",
  "AUTH_ENABLED=true",
  `AUTH_SECRET=${token()}`,
  "AUTH_BASE_URL=http://127.0.0.1:5173",
  "AUTH_TRUSTED_ORIGINS=http://127.0.0.1:5173",
  "SMTP_HOST=127.0.0.1",
  "SMTP_PORT=1025",
  "SMTP_TLS=local",
  "MAIL_FROM=rotavise@example.invalid",
  "",
  "# Optional, personal: add only your own values, never commit them.",
  "# EARTHDATA_USERNAME=",
  "# EARTHDATA_PASSWORD=",
  "# OBSERVATIONS_ENABLED=true",
  "# GOOGLE_MAP_TILES_KEY=",
  "",
];

try {
  writeFileSync(".env", lines.join("\n"), { flag: "wx", mode: 0o600 });
  console.log("Created .env for this machine with fresh local tokens");
} catch (error) {
  if (error.code === "EEXIST") console.log("Existing .env kept unchanged");
  else throw error;
}
