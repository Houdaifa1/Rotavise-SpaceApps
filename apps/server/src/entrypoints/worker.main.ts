import { installFatalErrorLogging } from "../common/logging/operations-log.js";
import { loadConfig } from "../config/environment.js";
import { startWorker } from "../app/create-worker.js";
installFatalErrorLogging();
async function main() {
  const worker = await startWorker(loadConfig());
  process.once("SIGTERM", () => void worker.stop());
  process.once("SIGINT", () => void worker.stop());
}
main().catch(() => {
  console.error("WORKER_START_FAILED");
  process.exit(1);
});
