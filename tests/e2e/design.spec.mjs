import { test, expect } from "../support/web-e2e.mjs";
import AxeBuilder from "../../apps/web/node_modules/@axe-core/playwright/dist/index.mjs";
import { scanDesignDom } from "../support/design-dom-scan.mjs";
for (const width of [390, 768, 1024, 1440]) {
  for (const language of ["fr", "en"]) {
    test(`F0 design ${language} at ${width}px`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 1000 });
      const errors = [];
      const origins = new Set();
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) =>
        origins.add(new URL(request.url()).origin),
      );
      await page.goto("/design");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (language === "en")
        await page
          .getByRole("button", { name: "English", exact: true })
          .click();
      await expect(page.locator("html")).toHaveAttribute("lang", language);
      await page.evaluate(() => document.fonts.ready);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBe(width);
      expect(await scanDesignDom(page)).toEqual([]);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await expect(page.locator(".rv-toast")).toHaveCount(0);
      const path = testInfo.outputPath(`design-${language}-${width}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach("design", { path, contentType: "image/png" });
      for (const chart of await page.locator(".rv-chart-plot").all()) {
        const boxes = await chart
          .locator("[data-axis-label]")
          .evaluateAll((labels) =>
            labels.map((label) => {
              const r = label.getBoundingClientRect();
              return { left: r.left, right: r.right };
            }),
          );
        for (let i = 1; i < boxes.length; i++)
          expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right + 10);
      }
      const fontInfo = await page
        .locator(".rv-workshop-main")
        .evaluate((el) => ({
          family: getComputedStyle(el).fontFamily,
          size: getComputedStyle(el).fontSize,
        }));
      expect(fontInfo.family).toContain("IBM Plex Sans");
      expect(fontInfo.size).toBe("14px");
      expect(errors).toEqual([]);
      expect([...origins]).toEqual([new URL(page.url()).origin]);
    });
  }
}
test("F0 keyboard, menus, dialogs, chart gaps, upload, and sheet detents", async ({
  page,
}) => {
  // This flow includes multiple axe scans and a real six-second toast expiry.
  // Preserve the individual assertions/timeouts while allowing the whole flow
  // to finish on the sandbox's remote browser.
  test.setTimeout(60000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design");
  await page.getByRole("button", { name: "English", exact: true }).click();
  const controls = page.locator("#controls");
  await controls.getByRole("button", { name: "Search All names" }).click();
  const search = page.getByRole("combobox", { name: "Search", exact: true });
  await search.fill("no match");
  await expect(page.getByText("No results for this search.")).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(await scanDesignDom(page)).toEqual([]);
  await page.keyboard.press("Escape");
  const overlays = page.locator("#overlays");
  const dialogTrigger = overlays
    .getByRole("button", { name: "Open", exact: true })
    .first();
  await dialogTrigger.click();
  await expect(
    page.getByRole("dialog", { name: "Check the information" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialogTrigger).toBeFocused();
  await overlays
    .getByRole("button", { name: "Mobile panel", exact: true })
    .click();
  await page.getByRole("button", { name: "Full height", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Full height", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Peek", exact: true }).click();
  await expect(page.locator(".rv-bottom-sheet .rv-reminder")).toBeInViewport();
  const handle = await page.locator(".rv-sheet-handle").boundingBox();
  await page.mouse.move(
    handle.x + handle.width / 2,
    handle.y + handle.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, 110, { steps: 15 });
  await page.mouse.up();
  await expect(
    page.getByRole("button", { name: "Full height", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  const compare = page.getByRole("slider", { name: /Compare views/ });
  await compare.focus();
  await page.keyboard.press("ArrowRight");
  await expect(compare).toHaveValue("51");
  await page
    .locator("#charts")
    .getByRole("radio", { name: "Partial data", exact: true })
    .click();
  const plot = page.locator(".rv-chart-plot").first();
  await plot.focus();
  await page.keyboard.press("Home");
  await expect(plot.getByRole("status")).toContainText("390 px");
  expect(await scanDesignDom(page)).toEqual([]);
  await page.locator('input[type="file"]').setInputFiles({
    name: "wrong.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.getByRole("alert")).toHaveText(
    "This format is not accepted.",
  );
  const photo = page.locator('input[type="file"]');
  await photo.setInputFiles("tests/support/fixtures/photos/tiny.jpg");
  await expect(page.locator(".rv-photo-preview img")).toBeVisible();
  await page.getByRole("button", { name: "Test the message" }).click();
  await expect(page.locator(".rv-toast")).toBeVisible();
  await expect(page.locator(".rv-toast")).toHaveCount(0, { timeout: 7500 });
});
