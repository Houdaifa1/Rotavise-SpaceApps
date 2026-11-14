// Explicit live smoke test: source data, never agricultural advice.
import assert from "node:assert/strict";
import { createPool } from "../../packages/database/dist/index.js";
import { WeatherService } from "../../apps/server/dist/modules/weather/application/weather.service.js";
import { weatherCapabilities } from "../../apps/server/dist/modules/weather/application/weather-capabilities.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
const config = loadConfig();
const pool = createPool(config.DATABASE_URL);
pool.on("error", () => console.error("WEATHER_DEMO_DATABASE_UNAVAILABLE"));
const service = new WeatherService(pool);
try {
  await service.ready();
  const request = {
    latitude: 32.3373,
    longitude: -6.3498,
    startDate: "2024-02-27",
    endDate: "2024-03-02",
    variables: [
      "temperatureMin",
      "temperatureMax",
      "temperatureMean",
      "precipitation",
      "relativeHumidity",
      "windSpeed",
      "solarRadiation",
    ],
  };
  const first = await service.query(request);
  const again = await service.query(request);
  assert.equal(again.cache, "hit");
  assert.equal(first.snapshotId, again.snapshotId);
  console.log(
    JSON.stringify(
      {
        purpose: "historical-weather-infrastructure-demo-not-crop-advice",
        capabilities: weatherCapabilities(),
        first: {
          cache: first.cache,
          snapshotId: first.snapshotId,
          complete: first.snapshot.complete,
          days: first.snapshot.days.length,
          provenance: first.snapshot.provenance,
          sampleDay: first.snapshot.days[2],
          coverage: first.snapshot.coverage,
        },
        repeat: { cache: again.cache, snapshotId: again.snapshotId },
      },
      null,
      2,
    ),
  );
} finally {
  await service.close();
  await pool.end();
}
