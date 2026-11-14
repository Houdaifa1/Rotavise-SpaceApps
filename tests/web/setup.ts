import "@testing-library/jest-dom";
import { afterEach, expect, jest } from "@jest/globals";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { TextEncoder, TextDecoder } from "node:util";
import { installLanguage } from "../../apps/web/src/i18n/messages.js";
import fr from "../../apps/web/src/i18n/fr.json" with { type: "json" };
import en from "../../apps/web/src/i18n/en.json" with { type: "json" };
installLanguage("fr", fr);
installLanguage("en", en);
Object.assign(globalThis, { TextEncoder, TextDecoder });
expect.extend(toHaveNoViolations);
afterEach(cleanup);
Object.defineProperty(window, "matchMedia", {
  value: (query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  }),
});
Object.defineProperty(window, "ResizeObserver", {
  value: class {
    observe() {}
    disconnect() {}
    unobserve() {}
  },
});
Object.defineProperty(window, "PointerEvent", { value: MouseEvent });
HTMLElement.prototype.scrollIntoView = jest.fn();
HTMLElement.prototype.hasPointerCapture = () => false;
HTMLElement.prototype.setPointerCapture = () => {};
HTMLElement.prototype.releasePointerCapture = () => {};
URL.createObjectURL = () => "blob:photo-specimen";
URL.revokeObjectURL = () => {};
