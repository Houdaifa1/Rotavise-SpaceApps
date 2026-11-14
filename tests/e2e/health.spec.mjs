import { test, expect, checkScreen } from "../support/web-e2e.mjs";
import { test as performanceTest } from "@playwright/test";
import { scanWebDom } from "../support/web-dom-scan.mjs";
import {
  disposable,
  processFor,
  processEnv,
  poll,
  stop,
  browserPorts,
} from "../support/index.mjs";
import { CatalogStore } from "../../apps/server/dist/modules/catalog/application/catalog-store.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
let db, api;
const ports = browserPorts();
const env = () =>
  processEnv(db, {
    API_PORT: String(ports.api),
    PLANS_ENABLED: "true",
    PLANNING_ENABLED: "true",
  });
async function start(overrides = {}) {
  api = processFor("api", { ...env(), ...overrides });
  await poll(
    async () => (await fetch(ports.apiOrigin + "/api/v1/health/live")).ok,
  );
}
test.beforeAll(async () => {
  db = await disposable();
  await new CatalogStore(db.pool).import(
    await loadCatalogRelease("data/catalog/releases/0.1.0"),
  );
  await start();
});
test.afterAll(async () => {
  if (api) await stop(api);
  if (db) await db.close();
});
test("S00 real API delay, unavailable, retry and recovery preserve the shell", async ({
  page,
}) => {
  const lock = await db.pool.connect();
  try {
    await lock.query("BEGIN");
    await lock.query("LOCK TABLE job_runs IN ACCESS EXCLUSIVE MODE");
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Votre terre a un plan." }),
    ).toBeVisible();
    await lock.query("COMMIT");
  } finally {
    lock.release();
  }
  await stop(api);
  await page.reload();
  const chip = page.getByRole("button", {
    name: "Services limités",
    exact: true,
  });
  await expect(chip).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Votre terre a un plan." }),
  ).toBeVisible();
  await checkScreen(page);
  await start();
  const recovered = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/health/live") &&
      response.status() === 200,
  );
  await page.locator(".fm-status-retry").click();
  await recovered;
  await page.locator(".fm-status-trigger").click();
  await expect(
    page.getByText("Rotavise ne peut pas joindre son serveur pour le moment.", {
      exact: true,
    }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Votre terre a un plan." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
});
test("S00 capabilities off is an honest state and creates no guest", async ({
  page,
}) => {
  await stop(api);
  await start({ PLANS_ENABLED: "false", PLANNING_ENABLED: "false" });
  await page.goto("/map");
  await expect(
    page
      .getByText(
        "Les comparaisons et les parcelles ne sont pas activées dans cette installation.",
      )
      .last(),
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("rotavise.guest.v1")),
  ).toBeNull();
  await page.goto("/account");
  await expect(
    page.getByText(
      "Les comptes ne sont pas disponibles ici. Vous pouvez continuer sans compte.",
    ),
  ).toBeVisible();
  await stop(api);
  await start();
});
test("S00 catalog unavailable leaves glossary available and pauses planning", async ({
  page,
}) => {
  await page.route("**/api/v1/catalog/options", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"code":"CATALOG_UNAVAILABLE"}',
    }),
  );
  await page.goto("/map");
  await page
    .getByRole("button", { name: "Services limités", exact: true })
    .click();
  await expect(
    page
      .getByText(
        "Le catalogue n’est pas disponible. La comparaison est suspendue ; vos autres outils restent accessibles.",
      )
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("link", { name: "Glossaire", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "Des mots pour comprendre" }),
  ).toBeVisible();
});
test("S00 valid unavailable readiness is explained without blocking the shell", async ({
  page,
}) => {
  const health = await (await page.request.get("/api/v1/health/ready")).json();
  await page.route("**/api/v1/health/ready", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ ...health, status: "unavailable" }),
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "État des services", exact: true })
    .click();
  await expect(
    page.getByText(
      "Certaines données ne sont pas encore disponibles. La carte reste utilisable.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Votre terre a un plan." }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Services limités", exact: true }),
  ).toBeVisible();
});
for (const endpoint of ["capabilities", "account", "glossary?lang=fr"])
  test(`S00 degraded ${endpoint} is explained without an uncaught error`, async ({
    page,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (endpoint === "account") {
      const cap = await (await page.request.get("/api/v1/capabilities")).json();
      await page.route("**/api/v1/capabilities", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ...cap, auth: { ...cap.auth, email: true } }),
        }),
      );
    }
    await page.route(`**/api/v1/${endpoint}`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: '{"code":"AUTH_UNAVAILABLE"}',
      }),
    );
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Votre terre a un plan." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Réessayer", exact: true }).first(),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
test("S01 first run, live language switch, persistence, return visit, no load toast", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Votre terre a un plan." }),
  ).toBeVisible();
  await expect(page.locator(".rv-toast")).toHaveCount(0);
  await page
    .getByRole("button", { name: /English/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Your land has a plan." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/map$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/map$/);
  expect(await page.evaluate(() => localStorage.getItem("rv.lang"))).toBe("en");
});
test("offline bar follows actual browser connectivity and recovers", async ({
  page,
  context,
}) => {
  await page.goto("/glossary");
  await expect(
    page.getByRole("heading", { name: "Des mots pour comprendre" }),
  ).toBeVisible();
  await context.setOffline(true);
  await expect(
    page.getByText(
      "Hors connexion. Les actions en ligne attendent le retour du réseau.",
    ),
  ).toBeVisible();
  await checkScreen(page);
  await context.setOffline(false);
  await expect(page.locator(".f1-offline")).toHaveCount(0);
});
for (const width of [390, 768, 1024, 1440])
  for (const language of ["fr", "en"])
    test(`S16 real glossary ${language} at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/glossary");
      if (language === "en")
        await page.getByRole("button", { name: /English/ }).click();
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await expect(
        page.getByRole("heading", {
          name:
            language === "fr"
              ? "Des mots pour comprendre"
              : "Words to understand",
        }),
      ).toBeVisible();
      await page
        .getByLabel(
          language === "fr"
            ? "Rechercher un terme ou une explication"
            : "Search terms and meanings",
        )
        .fill("NDVI");
      await expect(page.locator(".f1-entries article").first()).toBeVisible();
      await page.locator(".f1-entries .rv-term").first().click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      const screenshot = testInfo.outputPath(
        `glossary-${language}-${width}.png`,
      );
      await page.screenshot({ path: screenshot });
      await testInfo.attach("glossary", {
        path: screenshot,
        contentType: "image/png",
      });
      await page.goto("/glossary#ndvi");
      await expect(page.locator("#term-ndvi")).toBeVisible();
      await expect(page.locator(".rv-reminder").last()).toBeVisible();
    });
test("phone sheet has three detents and closes and reopens with keyboard", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/map");
  await expect(page.locator(".f1-sheet")).toHaveAttribute(
    "data-detent",
    "peek",
  );
  await page
    .getByRole("button", { name: "Pleine hauteur", exact: true })
    .click();
  await expect(page.locator(".f1-sheet")).toHaveAttribute(
    "data-detent",
    "full",
  );
  await page.getByRole("button", { name: "Mi-hauteur", exact: true }).click();
  await expect(page.locator(".f1-sheet")).toHaveAttribute(
    "data-detent",
    "half",
  );
  const handle = await page.locator(".f1-sheet-handle").boundingBox();
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, 110, { steps: 15 });
  await page.mouse.up();
  await expect(page.locator(".f1-sheet")).toHaveAttribute(
    "data-detent",
    "full",
  );
  await checkScreen(page);
  await page.keyboard.press("Escape");
  await expect(page.locator(".f1-sheet")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Ouvrir le panneau", exact: true })
    .click();
  await expect(page.locator(".f1-sheet")).toBeVisible();
});
test("language switch preserves glossary search and phone sheet height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/glossary");
  await page.getByLabel("Rechercher un terme ou une explication").fill("NDVI");
  await page.getByRole("button", { name: "Mi-hauteur", exact: true }).click();
  await page.getByRole("button", { name: /English/ }).click();
  await expect(page.getByLabel("Search terms and meanings")).toHaveValue(
    "NDVI",
  );
  await expect(page.locator(".f1-sheet")).toHaveAttribute(
    "data-detent",
    "half",
  );
});
test("invalid route identifiers never request a private resource", async ({
  page,
}) => {
  const privateRequests = [];
  page.on("request", (req) => {
    if (/\/api\/v1\/(fields|plans)\//.test(req.url()))
      privateRequests.push(req.url());
  });
  await page.goto("/fields/invalid");
  await expect(
    page.getByRole("heading", { name: "Cette page est introuvable." }),
  ).toBeVisible();
  expect(privateRequests).toEqual([]);
});

for (const language of ["fr", "en"])
  performanceTest(
    `F1 production boot performance ${language} on throttled phone`,
    async ({ page, context }, testInfo) => {
      test.setTimeout(90000);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.addInitScript((lang) => {
        localStorage.setItem("rv.lang", lang);
        window.f1Metrics = { lcp: 0, inputs: [] };
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.f1Metrics.lcp = entry.startTime;
            window.f1Metrics.element = entry.element?.textContent?.slice(
              0,
              100,
            );
          }
        }).observe({ type: "largest-contentful-paint", buffered: true });
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (entry.interactionId)
              window.f1Metrics.inputs.push(entry.duration);
        }).observe({ type: "event", buffered: true, durationThreshold: 16 });
      }, language);
      const session = await context.newCDPSession(page);
      try {
        await session.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await session.send("Network.enable");
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
        await page.goto("/");
        await expect(
          page.getByRole("heading", {
            name:
              language === "fr"
                ? "Votre terre a un plan."
                : "Your land has a plan.",
          }),
        ).toBeVisible();
        expect(await scanWebDom(page)).toEqual([]);
        await page.evaluate(() => document.fonts.ready);
        await page
          .getByRole("button", {
            name: language === "fr" ? /English/ : /Français/,
          })
          .first()
          .click();
        expect(await scanWebDom(page)).toEqual([]);
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const metrics = await page.evaluate(() => window.f1Metrics);
        console.log("F1_PERFORMANCE", language, JSON.stringify(metrics));
        console.log(
          "F1_RESOURCES",
          JSON.stringify(
            await page.evaluate(() =>
              performance.getEntriesByType("resource").map((e) => ({
                name: e.name.split("/").at(-1),
                duration: Math.round(e.duration),
                bytes: e.encodedBodySize,
              })),
            ),
          ),
        );
        await testInfo.attach("performance", {
          body: JSON.stringify({
            profile: "4x CPU, 150 ms RTT, 1.6 Mbps download",
            ...metrics,
            maximumObservedInputMs: Math.max(16, ...metrics.inputs),
          }),
          contentType: "application/json",
        });
        expect(metrics.lcp).toBeGreaterThan(0);
        expect(metrics.lcp).toBeLessThan(2500);
        expect(Math.max(16, ...metrics.inputs)).toBeLessThan(200);
        expect([...origins]).toEqual([new URL(page.url()).origin]);
        await checkScreen(page);
      } finally {
        // CDP throttling can outlive a page in a reused remote browser.
        await session.send("Emulation.setCPUThrottlingRate", { rate: 1 });
        await session.send("Network.disable");
        await session.detach();
      }
    },
  );
