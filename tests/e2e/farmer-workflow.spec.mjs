import { test, expect } from "../support/web-e2e.mjs";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  disposable,
  processFor,
  processEnv,
  poll,
  stop,
  freePort,
  browserPorts,
} from "../support/index.mjs";
import { disposableMail } from "../support/accounts.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { WeatherService } from "../../apps/server/dist/modules/weather/application/weather.service.js";
import { normalizeNasa } from "../../apps/server/dist/modules/weather/providers/nasa-power/normalization.js";
import { WEATHER_REGISTRY } from "../../apps/server/dist/modules/weather/providers/nasa-power/parameters.js";

let db, inbox, api, worker;
const ports = browserPorts();
const origin = ports.webOrigin;
test.beforeAll(async () => {
  db = await disposable();
  inbox = await disposableMail();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  const env = processEnv(db, {
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
    WEATHER_ENABLED: "true",
    WEATHER_INTERNAL_TOKEN: "synthetic-e2e-internal-weather-token-08",
    AUTH_ENABLED: "true",
    AUTH_SECRET: "synthetic-e2e-auth-secret-08-very-long-and-private",
    AUTH_BASE_URL: origin,
    AUTH_TRUSTED_ORIGINS: origin,
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(inbox.smtpPort),
    SMTP_TLS: "local",
    MAIL_FROM: "rotavise@example.invalid",
    API_PORT: String(ports.api),
  });
  api = processFor("api", env);
  worker = processFor("worker", {
    ...env,
    WORKER_PORT: String(await freePort()),
  });
  await poll(
    async () =>
      (await (await fetch(ports.apiOrigin + "/api/v1/health/ready")).json())
        .dependenciesReady,
    { label: "farmer API ready" },
  );
  await poll(() => worker.output.includes("worker_ready"), {
    label: "farmer worker ready",
  });
});
test.afterAll(async () => {
  if (worker) await stop(worker);
  if (api) await stop(api);
  if (inbox) inbox.close();
  if (db) await db.close();
});

test("guest reviews a real catalog request, resumes a durable insufficient-evidence result and keeps its token private", async ({
  page,
}) => {
  test.setTimeout(90000);
  const requests = [];
  page.on("request", (request) => requests.push(request));
  await page.goto("/legacy/planner");
  await expect(
    page.getByRole("heading", { name: "Plan two crop cycles" }),
  ).toBeVisible();
  await expect(page.getByText("Local review pending").first()).toBeVisible();
  await page.getByLabel("Latitude (WGS84)").fill("32.3373");
  await page.getByLabel("Longitude (WGS84)").fill("-6.3498");
  await page.getByRole("button", { name: "Review plan request" }).click();
  await expect(
    page.getByRole("heading", { name: "Review before submitting" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit for assessment" }).click();
  await expect(page.getByRole("heading", { name: "Your result" })).toBeVisible({
    timeout: 60000,
  });
  await expect(
    page.getByText("No supported crop recommendation can be made yet."),
  ).toBeVisible();
  const token = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("rotavise.guest.v1")).accessToken,
  );
  expect(token).toBeTruthy();
  expect(page.url()).not.toContain(token);
  expect(requests.some((request) => request.url().includes(token))).toBe(false);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your result" })).toBeVisible({
    timeout: 20000,
  });
  const actualCatalog = await (
    await page.request.get("/api/v1/catalog/options")
  ).json();
  await page.route("**/api/v1/catalog/options", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...actualCatalog,
        catalogSha256: "0".repeat(64),
        crops: actualCatalog.crops.map((crop) => ({
          ...crop,
          name: `Synthetic replacement ${crop.id}`,
        })),
      }),
    }),
  );
  await page.reload();
  const resultRegion = page.getByRole("region", { name: "Your result" });
  await expect(resultRegion).toBeVisible();
  await expect(resultRegion.getByText(/Synthetic replacement/)).toHaveCount(0);
  await expect(resultRegion.getByText(/Durum wheat/).first()).toBeVisible();
  await page.unroute("**/api/v1/catalog/options");
  await page.route("**/api/v1/plans/*", (route) =>
    route.request().method() === "GET"
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: '{"code":"CONTROLLED_TEST_FAILURE"}',
        })
      : route.continue(),
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Retry plan status" }),
  ).toBeVisible();
  await page.unroute("**/api/v1/plans/*");
  await page.getByRole("button", { name: "Retry plan status" }).click();
  await expect(
    page.getByRole("heading", { name: "Your result" }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: ".artifacts/playwright/step08-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Change inputs and compare again" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Plan two crop cycles" }),
  ).toBeVisible();
});

test("email account verifies through real SMTP and saves a named field", async ({
  page,
}) => {
  test.setTimeout(90000);
  const email = `${randomUUID().replaceAll("-", "")}@example.invalid`;
  await page.goto("/account");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Your name").fill("Synthetic E2E Farmer");
  await page.getByLabel("Password").fill("ExplicitlySyntheticPassword_08!");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .last()
    .click();
  await expect(
    page.getByText(/Check your email for a verification link/),
  ).toBeVisible();
  const mail = await poll(() => inbox.message(email), {
    label: "verification mail",
  });
  const link = mail.Text.match(/https?:\/\/[^\s]+/)[0];
  await page.goto(link);
  await expect(
    page.getByText("Email verified. Sign in to save your work."),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("ExplicitlySyntheticPassword_08!");
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await expect(page.getByText(email)).toBeVisible();
  await page.goto("/legacy/planner");
  await page.getByLabel("Latitude (WGS84)").fill("32.3373");
  await page.getByLabel("Longitude (WGS84)").fill("-6.3498");
  await page
    .getByLabel("Field name for saving (optional)")
    .fill("Synthetic test field");
  await page
    .getByRole("button", { name: "Save field and dated history" })
    .click();
  await expect(
    page.getByText(/Field saved with 0 dated history entries/),
  ).toBeVisible();
  await page.goto("/account");
  await expect(page.getByText("Synthetic test field")).toBeVisible();
});

test("weather explorer charts persisted recorded NASA evidence and validates input", async ({
  page,
}) => {
  test.setTimeout(90000);
  const raw = JSON.parse(
    readFileSync(
      "docs/evidence/weather/2026-09-26/nasa-power-beni-mellal-leap.json",
      "utf8",
    ),
  );
  const input = {
    latitude: 32.3373,
    longitude: -6.3498,
    startDate: "2024-02-27",
    endDate: "2024-03-02",
    variables: ["temperatureMean", "precipitation"],
  };
  for (const [variable, spec] of Object.entries(WEATHER_REGISTRY))
    if (!input.variables.includes(variable)) {
      delete raw.properties.parameter[spec.parameter];
      delete raw.parameters[spec.parameter];
    }
  raw.header.sources = ["POWER", "MERRA2"];
  const service = new WeatherService(db.pool, {
    async fetch(request) {
      // Recorded inside this POWER cell; POWER values are constant within a
      // cell, so the response is addressed to the requested cell centre.
      raw.geometry.coordinates = [
        request.longitude,
        request.latitude,
        raw.geometry.coordinates[2],
      ];
      const recorded = JSON.stringify(raw);
      return { raw: recorded, snapshot: normalizeNasa(recorded, request) };
    },
  });
  try {
    await service.query(input);
  } finally {
    await service.close();
  }
  await page.goto("/legacy/weather");
  await expect(
    page.getByRole("heading", { name: "Weather explorer" }),
  ).toBeVisible();
  expect(
    await page
      .getByLabel("Latitude", { exact: true })
      .evaluate((element) => element.validity.valueMissing),
  ).toBe(true);
  await page.getByLabel("Latitude", { exact: true }).fill("32.3373");
  await page.getByLabel("Longitude", { exact: true }).fill("-6.3498");
  await page.getByLabel("From", { exact: true }).fill("2024-02-27");
  await page.getByLabel("To", { exact: true }).fill("2024-03-02");
  await page.getByRole("button", { name: "Load weather" }).click();
  await expect(page.getByText(/NASA POWER · UTC/)).toBeVisible();
  await expect(
    page.getByRole("img", { name: /temperatureMean daily values/ }),
  ).toBeVisible();
  await page.getByText("Daily values and missing data table").click();
  await expect(page.getByRole("row", { name: /2024-02-29/ })).toBeVisible();
});
