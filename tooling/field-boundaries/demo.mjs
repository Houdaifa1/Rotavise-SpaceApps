import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { disposable } from "../../tests/support/database.mjs";
import { createApi } from "../../apps/server/dist/app/create-api.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { cleanBoundary } from "../../apps/server/dist/modules/field-boundaries/application/clean-boundary.js";

const prefix = "tests/support/fixtures/field-boundaries/";
const features = readFileSync(prefix + "morocco-2025.ndjson", "utf8")
  .trim()
  .split("\n")
  .map(JSON.parse);
const points = JSON.parse(
  readFileSync(prefix + "interior-points.json", "utf8"),
);
const sample = features.find(
  (f) => cleanBoundary(f.geometry) && f.geometry.coordinates[0][0][0] > -7,
);
const [longitude, latitude] = points[sample.properties.id];
const db = await disposable();
let api;
try {
  // Exercise the actual CLI against only the database created by this demo.
  const imported = execFileSync(
    process.execPath,
    [
      "tooling/field-boundaries/import.mjs",
      prefix + "morocco-2025.manifest.json",
      prefix + "morocco-2025.ndjson",
      "--allow-sample",
    ],
    {
      env: { ...process.env, DATABASE_URL: db.url, NODE_ENV: "test" },
      encoding: "utf8",
    },
  );
  api = await createApi(
    loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: db.url,
      PLANS_ENABLED: "true",
      FIELD_BOUNDARIES_ENABLED: "true",
    }),
  );
  await api.app.getHttpAdapter().getInstance().ready();
  const session = (
    await api.app.inject({
      method: "POST",
      url: "/api/v1/plan-sessions",
      payload: {},
    })
  ).json();
  const response = await api.app.inject({
    method: "POST",
    url: "/api/v1/field-boundaries/at",
    headers: { authorization: `Bearer ${session.accessToken}` },
    payload: { latitude, longitude },
  });
  if (response.statusCode !== 200)
    throw new Error("BOUNDARY_DEMO_LOOKUP_FAILED");
  const found = response.json();
  const capability = (await api.app.inject("/api/v1/capabilities")).json()
    .fieldBoundaries;
  console.log(
    JSON.stringify(
      {
        disposableDatabase: true,
        realFixture: true,
        countryCoverage: false,
        import: JSON.parse(imported),
        capability,
        status: response.statusCode,
        field: found.field.properties,
        positions: found.field.geometry.coordinates[0].length,
        attribution: found.attribution,
        limitations: found.limitations,
      },
      null,
      2,
    ),
  );
} finally {
  await api?.close();
  await db.close();
}
