// Opt-in live check of the production AppEEARS and Giovanni clients with a
// tiny request (one public Tadla point, one week of SMAP L4; one month of
// GPM IMERG). Prints counts only, never credentials or tokens.
// Usage: pnpm build:server && node --env-file=.env tooling/earth-observations/live-check.mjs
import { setTimeout as delay } from "node:timers/promises";
import { AppeearsClient } from "../../apps/server/dist/modules/earth-observations/providers/appeears/appeears.client.js";
import { GiovanniClient } from "../../apps/server/dist/modules/earth-observations/providers/giovanni/giovanni.client.js";
import {
  normalizeGiovanni,
  normalizeSmap,
} from "../../apps/server/dist/modules/earth-observations/providers/normalization.js";

const user = process.env.EARTHDATA_USERNAME;
const password = process.env.EARTHDATA_PASSWORD;
const signal = AbortSignal.timeout(6 * 3600000);
const appeears = new AppeearsClient(user, password);
const started = Date.now();
const taskId = await appeears.submit(
  {
    task_type: "point",
    task_name: "rotavise-live-check",
    params: {
      dates: [{ startDate: "01-01-2024", endDate: "01-07-2024" }],
      layers: [
        { product: "SPL4SMGP.008", layer: "Geophysical_Data_sm_rootzone_pctl" },
        { product: "SPL4SMGP.008", layer: "Geophysical_Data_sm_rootzone" },
      ],
      coordinates: [
        { id: "f1", category: "field", latitude: 32.4, longitude: -6.55 },
      ],
    },
  },
  signal,
);
console.log(JSON.stringify({ step: "submitted" }));
let status;
while ((status = await appeears.status(taskId, signal)) !== "done") {
  if (status === "error") throw new Error("APPEEARS_TASK_ERROR");
  await delay(30000, undefined, { signal });
}
const bundle = await appeears.bundle(taskId, signal);
const file = bundle.find((f) => /-SPL4SMGP-008-results\.csv$/.test(f.name));
const smap = normalizeSmap(await appeears.download(taskId, file, signal));
await appeears.remove(taskId, signal);
console.log(
  JSON.stringify({
    step: "appeears",
    minutes: Math.round((Date.now() - started) / 60000),
    files: bundle.length,
    checksums: bundle.filter((f) => f.sha256).length,
    cell: smap.cell,
    days: smap.days.length,
    removed: true,
  }),
);
const giovanni = new GiovanniClient(user, password);
const rain = normalizeGiovanni(
  await giovanni.daily(32.4, -6.55, "2024-01-01", "2024-01-31", signal),
);
console.log(
  JSON.stringify({ step: "giovanni", cell: rain.cell, days: rain.days.length }),
);
