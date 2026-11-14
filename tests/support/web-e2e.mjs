import { test as base, expect } from "@playwright/test";
import AxeBuilder from "../../apps/web/node_modules/@axe-core/playwright/dist/index.mjs";
import { scanWebDom } from "./web-dom-scan.mjs";

export async function checkScreen(page) {
  await page.locator("main").first().waitFor({ state: "visible" });
  expect(await scanWebDom(page)).toEqual([]);
  // Contrast is judged in the steady state: a hover transition caught mid-way blends two colours.
  await page.addStyleTag({
    content:
      "*,*::before,*::after{transition:none!important;animation:none!important}",
  });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
// Preserve the public Page/Locator APIs. Every navigation or user action is
// awaited, then scanned, so intermediate states get the same checks as finals.
export function checkedPage(page) {
  const cache = new WeakMap();
  const actions = new Set([
    "goto",
    "reload",
    "click",
    "fill",
    "selectOption",
    "check",
    "uncheck",
    "press",
    "setInputFiles",
  ]);
  function wrap(target) {
    if (cache.has(target)) return cache.get(target);
    const proxy = new Proxy(target, {
      get(object, key) {
        const value = Reflect.get(object, key, object);
        if (key === "keyboard") return wrap(value);
        if (typeof value !== "function") return value;
        return (...args) => {
          const result = Reflect.apply(value, object, args);
          if (actions.has(key))
            return Promise.resolve(result).then(async (outcome) => {
              await page.waitForTimeout(40);
              await checkScreen(page);
              return outcome;
            });
          if (
            result &&
            typeof result === "object" &&
            typeof result.getByRole === "function"
          )
            return wrap(result);
          return result;
        };
      },
    });
    cache.set(target, proxy);
    return proxy;
  }
  return wrap(page);
}
export const test = base.extend({
  page: async ({ page }, use) => {
    await use(checkedPage(page));
    if (!page.isClosed()) await checkScreen(page);
  },
});
export { expect };
