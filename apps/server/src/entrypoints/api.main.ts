import { installFatalErrorLogging } from "../common/logging/operations-log.js";
import { createApi } from "../app/create-api.js";
import { loadConfig } from "../config/environment.js";
installFatalErrorLogging();
async function main() {
  const config = loadConfig();
  const api = await createApi(config);
  await api.app.listen(config.API_PORT, config.API_HOST);
  console.log(
    JSON.stringify({ event: "api_listening", port: config.API_PORT }),
  );
  let closing = false;
  const stop = async () => {
    if (closing) return;
    closing = true;
    await api.close();
    console.log(JSON.stringify({ event: "api_stopped" }));
  };
  process.once("SIGTERM", () => void stop());
  process.once("SIGINT", () => void stop());
}
main().catch(() => {
  console.error("API_START_FAILED");
  process.exitCode = 1;
});
