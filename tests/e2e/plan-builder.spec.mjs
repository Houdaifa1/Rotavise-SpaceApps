import { test as performanceTest } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { test, expect, checkScreen } from "../support/web-e2e.mjs";
import {
  browserPorts,
  disposable,
  freePort,
  poll,
  processEnv,
  processFor,
  stop,
} from "../support/index.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { planRequestV2Schema } from "../../packages/contracts/dist/index.js";
const ports = browserPorts();
let db, api, worker, env, options;
const fixture = JSON.parse(
  readFileSync("tests/support/fixtures/bg-b0.synthetic.json"),
);
const failures = [
  "STORED_REQUEST_INVALID",
  "CATALOG_EVIDENCE_INVALID",
  "WEATHER_UNAVAILABLE",
  "PLANNING_LIMIT_EXCEEDED",
  "RETRIES_EXHAUSTED",
  "QUEUE_TERMINAL_WITHOUT_RESULT",
  "WORKFLOW_VERSION_UNSUPPORTED",
  "CALCULATION_FAILED",
];
test.beforeAll(async () => {
  db = await disposable();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.15.0"),
  );
  env = processEnv(db, {
    API_PORT: String(ports.api),
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
    ROTATION_CATALOG_VERSION: "0.15.0",
  });
  api = processFor("api", env);
  await poll(async () => {
    if (api.exitCode !== null) throw new Error(api.output);
    return (await fetch(`${ports.apiOrigin}/api/v1/health/ready`)).ok;
  });
  options = await (
    await fetch(`${ports.apiOrigin}/api/v1/catalog/options`)
  ).json();
});
test.beforeEach(async ({ page }) => {
  page.setDefaultTimeout(15000);
  await db.pool.query("TRUNCATE plan_quotas");
});
test.afterAll(async () => {
  if (worker) await stop(worker);
  if (api) await stop(api);
  if (db) await db.close();
});
async function seed(page, lang = "en", history = false) {
  await page.route("https://gibs.earthdata.nasa.gov/**", (route) =>
    route.fulfill({
      contentType: "image/jpeg",
      headers: { "access-control-allow-origin": "*" },
      body: readFileSync("tests/support/fixtures/gibs/modis.jpeg"),
    }),
  );
  const sessionResponse = await page.request.post("/api/v1/plan-sessions", {
    data: {},
  });
  expect(sessionResponse.status()).toBe(201);
  const session = await sessionResponse.json();
  const headers = { Authorization: `Bearer ${session.accessToken}` };
  const created = await page.request.post("/api/v1/fields", {
    headers,
    data: {
      ...fixture.profile,
      name: "Builder verification field",
      soil: {
        status: "known",
        observations: [
          {
            metric: "ph",
            value: 7,
            unit: "pH",
            method: "unknown",
            source: "farmer_observation",
            measured_on: null,
          },
        ],
      },
    },
  });
  expect(created.status()).toBe(201);
  const field = await created.json();
  if (history) {
    const saved = await page.request.post(
      `/api/v1/fields/${field.id}/history`,
      { headers, data: fixture.history[0] },
    );
    expect(saved.status()).toBe(201);
  }
  await page.addInitScript(
    ({ session, lang }) => {
      sessionStorage.setItem("rotavise.guest.v1", JSON.stringify(session));
      localStorage.setItem("rv.lang", lang);
    },
    { session, lang },
  );
  return { session, headers, field };
}
const button = (page, name) => page.getByRole("button", { name, exact: true });
async function next(page, language = "en") {
  await button(page, language === "en" ? "Next" : "Suivant").click();
}
async function pick(page, query) {
  const search = page.getByRole("combobox", {
    name: "Search crops",
    exact: true,
  });
  await search.fill(query);
  await search.press("ArrowDown");
  await search.press("Enter");
}
async function submitDirect(page, field, headers) {
  const from = new Date();
  from.setUTCFullYear(from.getUTCFullYear() + 1);
  const date = from.toISOString().slice(0, 10);
  const data = {
    schema_version: "2",
    field_id: field.id,
    location: field.profile.location,
    soil: { status: "unknown" },
    water: { status: "unknown" },
    crop_health: { status: "unknown" },
    history: { status: "unknown" },
    planning: {
      horizon_years: 3,
      earliest_start_date: date,
      latest_start_date: date,
    },
    cultivars: [],
    preferences: {
      mode: "consider",
      considered_crop_ids: ["olive"],
      excluded_crop_ids: [],
      priorities: { climate: 3, water: 3, soil_health: 3, crop_health: 3 },
    },
  };
  // The ID comes from this release. An unsupported crop is still a valid
  // request; the real worker must honestly finish with insufficient evidence.
  const release = await loadCatalogRelease("data/catalog/releases/0.15.0");
  const perennial = release.profiles.find(
    (profile) => profile.modelType === "orchard",
  );
  expect(perennial).toBeTruthy();
  data.preferences.considered_crop_ids = [perennial.id];
  const response = await page.request.post("/api/v1/plans", {
    headers: { ...headers, "Idempotency-Key": randomUUID() },
    data,
  });
  expect(response.status()).toBe(202);
  return { ...(await response.json()), input: data };
}

test("F-7 S08/S09 builds a real request, persists a field draft, validates priorities, and polls the production worker to completion", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  console.log("F5: builder with a saved field");
  const { field, headers } = await seed(page, "en", true);
  await page.goto(`/fields/${field.id}/plan/new`);
  await expect(
    page.getByRole("heading", { name: "Compare rotations", exact: true }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "4 years", exact: true }).click();
  const earliest = page.getByLabel("Earliest first sowing", { exact: true });
  const before = await earliest.inputValue();
  await page.reload();
  await expect(earliest).toHaveValue(before);
  await next(page);
  console.log("F5: crop selection");
  await button(page, "Choose a crop").click();
  const release = await loadCatalogRelease("data/catalog/releases/0.15.0");
  const perennial = release.profiles.find(
    (profile) => profile.modelType === "orchard",
  );
  const crop = options.crops.find((crop) => crop.id === perennial.id);
  await pick(page, crop.scientificName);
  await expect(
    page.locator(".f5-content").getByText(crop.name, { exact: true }).first(),
  ).toBeVisible();
  await next(page);
  await button(page, "Use my history").click();
  await next(page);
  await page.getByRole("radio", { name: "Yes, complete", exact: true }).click();
  for (const slider of [
    "Water",
    "Soil health",
    "Climate risk",
    "Crop health",
  ]) {
    const control = page.getByRole("slider", {
      name: new RegExp(`^${slider} `),
    });
    await control.press("Home");
  }
  await expect(button(page, "Next")).toBeDisabled();
  await page.getByRole("slider", { name: /^Water / }).press("ArrowRight");
  await next(page);
  await expect(
    page.getByText("The request meets the required format."),
  ).toBeVisible();
  for (const [language, heading] of [
    ["en", "Review and send"],
    ["fr", "Relire et envoyer"],
  ]) {
    await page
      .getByRole("button", {
        name: language === "en" ? /EN \(English\)/ : /FR \(Français\)/,
      })
      .first()
      .click();
    for (const width of [390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(
        page.getByRole("heading", { name: heading, exact: true }),
      ).toBeVisible();
      await checkScreen(page);
      const footer = await page.locator(".f5-footer").boundingBox();
      const content = await page.locator(".f5-content").boundingBox();
      const reminder = await page
        .locator(".f1-main > .rv-reminder")
        .boundingBox();
      expect(footer.y + footer.height).toBeLessThanOrEqual(reminder.y + 1);
      expect(content.y + content.height).toBeLessThanOrEqual(footer.y + 1);
      await page.screenshot({
        path: info.outputPath(`builder-review-${language}-${width}.png`),
      });
    }
  }
  await page
    .getByRole("button", { name: /EN \(English\)/ })
    .first()
    .click();
  console.log("F5: submitting validated request");
  const sent = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/plans" &&
      response.request().method() === "POST",
  );
  await button(page, "Compare rotations").click();
  const accepted = await sent;
  expect(accepted.status()).toBe(202);
  const request = accepted.request();
  const data = request.postDataJSON();
  expect(planRequestV2Schema.safeParse(data).success).toBe(true);
  expect(data.field_id).toBe(field.id);
  expect(data.history.completeness).toBe("complete");
  expect(data.preferences.priorities).toEqual({
    water: 1,
    soil_health: 0,
    climate: 0,
    crop_health: 0,
  });
  expect(request.headers()["idempotency-key"]).toMatch(/^[A-Za-z0-9_-]{8,80}$/);
  const plan = await accepted.json();
  await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}$`));
  worker = processFor("worker", {
    ...env,
    WORKER_PORT: String(await freePort()),
  });
  await poll(
    () =>
      worker.output.includes("worker_ready") ||
      (worker.exitCode !== null
        ? Promise.reject(new Error(worker.output))
        : false),
  );
  await expect(
    page.getByRole("heading", { name: "Calculation complete", exact: true }),
  ).toBeVisible({ timeout: 120000 });
  const status = await (
    await page.request.get(`/api/v1/plans/${plan.id}`, { headers })
  ).json();
  expect(status.status).toBe("completed");
  expect(status.result.kind).toBe("rotation_assessment");
  expect(status.input.field_id).toBe(field.id);
  expect(worker.output).toContain("planning_job_finished");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Calculation complete", exact: true }),
  ).toBeVisible();
  await stop(worker);
  worker = undefined;
  await button(page, "Delete comparison").click();
  await button(page.getByRole("dialog"), "Delete comparison").click();
  expect(
    (await page.request.get(`/api/v1/plans/${plan.id}`, { headers })).status(),
  ).toBe(404);
});

test("F-8 S10 reads every persisted stage and failure code in French and English at four widths, resumes failed input and deletes", async ({
  page,
}, info) => {
  test.setTimeout(240000);
  const { field, headers } = await seed(page);
  const plan = await submitDirect(page, field, headers);
  const stages = [
    "awaiting_processing",
    "verifying_evidence",
    "generating_sequences",
    "retrieving_weather",
    "calculating",
  ];
  for (const stage of stages) {
    if (stage !== "awaiting_processing")
      await db.pool.query(
        "UPDATE planning_runs SET status='running',stage=$2,lease_id=$3,lease_until=now()+interval '15 minutes',updated_at=now() WHERE request_id=$1",
        [plan.id, stage, randomUUID()],
      );
    await page.goto(`/plans/${plan.id}`);
    await expect(
      page.locator('[aria-current="step"]'),
      await page.locator("main").innerText(),
    ).toHaveCount(1);
    await checkScreen(page);
  }
  // Transition an unfinished stored run into each controlled terminal failure.
  // Never manufacture a completed result or bypass result integrity triggers.
  for (const code of failures) {
    const failure = await submitDirect(page, field, headers);
    await db.pool.query(
      "UPDATE planning_runs SET status='failed',stage='failed',error_code=$2,completed_at=now(),updated_at=now() WHERE request_id=$1",
      [failure.id, code],
    );
    for (const language of ["en", "fr"]) {
      await page.goto(`/plans/${failure.id}`);
      await page
        .getByRole("button", {
          name: language === "en" ? /EN \(English\)/ : /FR \(Français\)/,
        })
        .first()
        .click();
      await expect(
        page.getByRole("heading", {
          name:
            language === "en"
              ? "The comparison failed"
              : "La comparaison a échoué",
          exact: true,
        }),
      ).toBeVisible();
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await checkScreen(page);
      }
      if (code === "WEATHER_UNAVAILABLE")
        await page.screenshot({
          path: info.outputPath(`failure-${language}.png`),
        });
    }
    if (code === "PLANNING_LIMIT_EXCEEDED") {
      await page
        .getByRole("button", { name: /EN \(English\)/ })
        .first()
        .click();
      await button(page, "Edit and send again").click();
      await expect(
        page.getByLabel("Earliest first sowing", { exact: true }),
      ).toHaveValue(failure.input.planning.earliest_start_date);
    }
    // The intake quota is deliberately reset only in disposable infrastructure.
    await db.pool.query("TRUNCATE plan_quotas");
  }
});

test("S09 retains a submission key through rate limiting and starts a fresh key after a conflict", async ({
  page,
}) => {
  test.setTimeout(90000);
  const { field } = await seed(page);
  await page.goto(`/fields/${field.id}/plan/new`);
  await expect(
    page.getByLabel("Earliest first sowing", { exact: true }),
  ).toBeVisible();
  await next(page);
  await next(page);
  await next(page);
  await next(page);
  const keys = [];
  let attempts = 0;
  await page.route("**/api/v1/plans", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    keys.push(route.request().headers()["idempotency-key"]);
    attempts++;
    if (attempts <= 2)
      return route.fulfill({
        status: attempts === 1 ? 429 : 409,
        contentType: "application/json",
        headers: attempts === 1 ? { "Retry-After": "2" } : {},
        body: JSON.stringify({
          code: attempts === 1 ? "RATE_LIMITED" : "IDEMPOTENCY_CONFLICT",
        }),
      });
    return route.continue();
  });
  await page.context().setOffline(true);
  await expect(button(page, "Compare rotations")).toBeDisabled();
  await page.context().setOffline(false);
  await button(page, "Compare rotations").click();
  await expect(button(page, "Compare rotations")).toBeDisabled();
  await expect(button(page, "Compare rotations")).toBeEnabled({
    timeout: 5000,
  });
  await page.reload();
  await expect(button(page, "Compare rotations")).toBeEnabled();
  await button(page, "Compare rotations").click();
  await expect(
    page.getByText(/already sent with different details/),
  ).toBeVisible();
  const accepted = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/v1/plans" &&
      response.request().method() === "POST" &&
      response.status() === 202,
  );
  await button(page, "Compare rotations").click();
  expect((await accepted).status()).toBe(202);
  expect(keys).toHaveLength(3);
  expect(keys[0]).toBe(keys[1]);
  expect(keys[2]).not.toBe(keys[1]);
  await checkScreen(page);
});

for (const lang of ["fr", "en"])
  performanceTest(
    `F5 production builder and progress performance ${lang} on a throttled phone`,
    async ({ page, context }, info) => {
      performanceTest.setTimeout(120000);
      const { field, headers } = await seed(page, lang);
      const plan = await submitDirect(page, field, headers);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript(() => {
        window.f5Metrics = { lcp: 0, inputs: [] };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.f5Metrics.lcp = entry.startTime;
            window.f5Metrics.element = entry.element?.textContent?.slice(
              0,
              160,
            );
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (entry.interactionId)
              window.f5Metrics.inputs.push(entry.duration);
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      });
      const session = await context.newCDPSession(page);
      await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await session.send("Network.enable");
      await session.send("Network.setCacheDisabled", { cacheDisabled: true });
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        latency: 150,
        downloadThroughput: 200000,
        uploadThroughput: 100000,
      });
      const origins = new Set();
      page.on("request", (request) =>
        origins.add(new URL(request.url()).origin),
      );
      try {
        for (const [screen, path] of [
          ["builder", `/fields/${field.id}/plan/new`],
          ["progress", `/plans/${plan.id}`],
          ["retry", `/fields/${field.id}/plan/new?retry=${plan.id}`],
        ]) {
          await page.goto(path);
          if (screen !== "progress")
            await expect(
              page.getByLabel(
                lang === "fr"
                  ? "Premier semis au plus tôt"
                  : "Earliest first sowing",
                { exact: true },
              ),
            ).toBeVisible();
          else
            await expect(page.locator('[aria-current="step"]')).toHaveCount(1);
          await page.evaluate(() => document.fonts.ready);
          await page
            .getByRole("button", {
              name: lang === "fr" ? /EN \(English\)/ : /FR \(Français\)/,
            })
            .first()
            .click();
          await page.evaluate(
            () =>
              new Promise((resolve) =>
                requestAnimationFrame(() => requestAnimationFrame(resolve)),
              ),
          );
          const metrics = await page.evaluate(() => ({
            ...window.f5Metrics,
            resources: performance
              .getEntriesByType("resource")
              .filter((entry) => /\/api\/|PlanProgress|plans-/.test(entry.name))
              .map((entry) => ({
                path: new URL(entry.name).pathname,
                start: Math.round(entry.startTime),
                end: Math.round(entry.responseEnd),
              })),
          }));
          await info.attach(`${screen}-performance`, {
            body: JSON.stringify({
              profile: "4x CPU, 150 ms RTT, 1.6 Mbps download",
              ...metrics,
            }),
            contentType: "application/json",
          });
          console.log("F5_PERFORMANCE", lang, screen, JSON.stringify(metrics));
          expect(metrics.lcp).toBeGreaterThan(0);
          expect(metrics.lcp).toBeLessThan(2500);
          expect(Math.max(16, ...metrics.inputs)).toBeLessThan(200);
          await checkScreen(page);
        }
        expect([...origins]).toEqual([new URL(page.url()).origin]);
      } finally {
        await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        await session.send("Network.disable");
        await session.detach();
      }
    },
  );

test("S09 distinguishes off, unknown capabilities and unavailable catalog without losing the shell", async ({
  page,
}) => {
  const { field, headers } = await seed(page);
  const plan = await submitDirect(page, field, headers);
  const privateReads = [];
  page.on("request", (request) => {
    const path = new URL(request.url()).pathname;
    if (
      request.method() === "GET" &&
      (path.startsWith("/api/v1/fields/") || path.startsWith("/api/v1/plans/"))
    )
      privateReads.push(path);
  });
  const capabilities = await (
    await page.request.get("/api/v1/capabilities")
  ).json();
  await page.route("**/api/v1/capabilities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ...capabilities, plans: false }),
    }),
  );
  await page.goto(`/fields/${field.id}/plan/new?retry=${plan.id}`);
  await expect(
    page
      .locator(".f5-page")
      .getByText("Plans and fields are not switched on in this installation.", {
        exact: true,
      }),
  ).toBeVisible();
  expect(privateReads).toEqual([]);
  await page.unroute("**/api/v1/capabilities");
  await page.route("**/api/v1/capabilities", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "AUTH_UNAVAILABLE" }),
    }),
  );
  await page.reload();
  await expect(
    page
      .locator(".f5-page")
      .getByText(/Available services could not be checked/),
  ).toBeVisible();
  expect(privateReads).toEqual([]);
  await page.unroute("**/api/v1/capabilities");
  await page.route("**/api/v1/catalog/options", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "CATALOG_UNAVAILABLE" }),
    }),
  );
  await page.reload();
  await expect(
    page
      .locator(".f5-page")
      .getByText("The catalog is unavailable. Retry from the home screen.", {
        exact: true,
      }),
  ).toBeVisible();
  await page.unroute("**/api/v1/catalog/options");
  await page.reload();
  await expect(
    page.getByLabel("Earliest first sowing", { exact: true }),
  ).toBeVisible();
});

test("F5 recovers failed self-hosted language loading at startup and while editing", async ({
  page,
}) => {
  const { field } = await seed(page);
  let unavailable = true;
  await page.route("**/assets/en-*.json", (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page.goto(`/fields/${field.id}/plan/new`);
  await expect(page.getByRole("alert")).toHaveText(
    "The language could not be loaded. Try again.",
  );
  unavailable = false;
  await button(page, "Try again").click();
  await expect(
    page.getByLabel("Earliest first sowing", { exact: true }),
  ).toBeVisible();
  unavailable = true;
  await page.route("**/assets/fr-*.json", (route) =>
    unavailable
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: "{}",
        })
      : route.continue(),
  );
  await page
    .getByRole("button", { name: /FR \(Français\)/ })
    .first()
    .click();
  await expect(page.getByRole("alert")).toHaveText(
    /The language could not be loaded/,
  );
  await expect(
    page.getByLabel("Earliest first sowing", { exact: true }),
  ).toBeVisible();
  unavailable = false;
  await button(page.getByRole("alert"), "Try again").click();
  await expect(
    page.getByLabel("Premier semis au plus tôt", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test("F5 all five steps and expanded priorities fit four widths in French and English", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  const { field } = await seed(page, "en", true);
  await page.goto(`/fields/${field.id}/plan/new`);
  await expect(
    page.getByLabel("Earliest first sowing", { exact: true }),
  ).toBeVisible();
  for (let step = 0; step < 5; step++) {
    if (step === 3) {
      await page
        .getByRole("radio", { name: "No, partial", exact: true })
        .click();
      for (const summary of await page.locator(".f5-content summary").all())
        await summary.click();
    }
    for (const language of ["fr", "en"]) {
      await page
        .getByRole("button", {
          name: language === "fr" ? /FR \(Français\)/ : /EN \(English\)/,
        })
        .first()
        .click();
      for (const width of [390, 768, 1024, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await checkScreen(page);
        expect(
          await page
            .locator(".f5-content")
            .evaluate((node) => node.scrollWidth <= node.clientWidth),
        ).toBe(true);
        const content = await page.locator(".f5-content").boundingBox();
        const footer = await page.locator(".f5-footer").boundingBox();
        expect(content.y + content.height).toBeLessThanOrEqual(footer.y + 1);
        if (width === 390 || width === 1440)
          await page.screenshot({
            path: info.outputPath(`step-${step + 1}-${language}-${width}.png`),
          });
      }
    }
    if (step < 4) await next(page);
  }
});
