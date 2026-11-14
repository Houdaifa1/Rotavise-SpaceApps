// Controlled process-death fixture. Never imported by runtime entry points.
import { readFileSync } from "node:fs";
import { createPool } from "../../../packages/database/dist/index.js";
import { WeatherService } from "../../../apps/server/dist/modules/weather/application/weather.service.js";
const pool = createPool(process.env.DATABASE_URL);
const manifest = JSON.parse(
  readFileSync("docs/evidence/weather/2026-09-26/manifest.json", "utf8"),
);
const s = manifest[0].sample;
const request = {
  latitude: s.latitude,
  longitude: s.longitude,
  startDate: s.start,
  endDate: s.end,
  variables: [
    "temperatureMin",
    "temperatureMax",
    "temperatureMean",
    "precipitation",
  ],
};
const service = new WeatherService(pool, {
  async fetch() {
    console.log("synthetic_weather_owner_claimed");
    await new Promise(() => {});
  },
});
await service.query(request);
