import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { startWorker } from "../../apps/server/dist/app/create-worker.js";
import { installExtractionReplay } from "./fixtures/backend-e2e-transports.mjs";
installExtractionReplay();
const worker = await startWorker(loadConfig(process.env));
process.once("SIGTERM", () => void worker.stop());
process.once("SIGINT", () => void worker.stop());
