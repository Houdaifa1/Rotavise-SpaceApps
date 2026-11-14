import { expect, jest, test } from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "jest-axe";
import { I18nProvider, useMessages } from "../../apps/web/src/i18n/messages.js";
import { LanguageSwitch } from "../../apps/web/src/app/AppShell.js";
import {
  Provenance,
  Entry,
} from "../../apps/web/src/features/glossary/GlossaryTerm.js";
import { glossaryFor } from "../../packages/domain/dist/index.js";
import { DesignLanguage } from "../../apps/web/src/i18n/messages.js";
import { ScreenBoundary } from "../../apps/web/src/app/ErrorBoundary.js";
import { MemoryRouter } from "react-router";
import { act } from "@testing-library/react";
import {
  useOffline,
  createQueryClient,
} from "../../apps/web/src/app/providers/Runtime.js";
import { api, ApiFailure } from "../../apps/web/src/app/http.js";
import { z } from "zod";
import { RetryButton } from "../../apps/web/src/shared/RetryButton.js";
import { response, account } from "../support/fixtures/f1.js";
import { scanWebDom } from "../support/web-dom-scan.mjs";
function Sentence() {
  const { t } = useMessages();
  return <p>{t("welcome.title")}</p>;
}
test("language choice immediately changes copy, document language and safe persistence", async () => {
  localStorage.clear();
  const { container } = render(
    <I18nProvider>
      <LanguageSwitch />
      <Sentence />
    </I18nProvider>,
  );
  expect(screen.getByText("Votre terre a un plan.")).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: /English/ }));
  expect(screen.getByText("Your land has a plan.")).toBeVisible();
  await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  expect(localStorage.getItem("rv.lang")).toBe("en");
  expect((await axe(container)).violations).toEqual([]);
  localStorage.clear();
});
test("glossary card carries real meaning and honest provenance, code marked for advisers", async () => {
  const glossary = glossaryFor("fr");
  const entry = glossary.entries.find((e) => e.code === "ndvi")!;
  const { container } = render(
    <DesignLanguage language="fr">
      <Entry entry={entry} />
      <Provenance glossary={glossary} />
    </DesignLanguage>,
  );
  expect(screen.getByText(entry.meaning)).toBeVisible();
  expect(container.querySelector("[data-code]")).toHaveTextContent("ndvi");
  expect(screen.getByText(/n’ont pas été relus/)).toBeVisible();
  expect((await axe(container)).violations).toEqual([]);
});
test("render error is contained and the route can be retried", () => {
  let fail = true;
  function Broken() {
    if (fail) throw new Error("Controlled component failure");
    return <p>Recovered</p>;
  }
  const error = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    render(
      <MemoryRouter>
        <DesignLanguage language="en">
          <ScreenBoundary>
            <Broken />
          </ScreenBoundary>
        </DesignLanguage>
      </MemoryRouter>,
    );
    expect(screen.getByRole("alert")).toBeVisible();
    fail = false;
    fireEvent.click(screen.getByRole("button", { name: "Reload this screen" }));
    expect(screen.getByText("Recovered")).toBeVisible();
  } finally {
    error.mockRestore();
  }
});
test("two consecutive network failures show the offline bar state and success clears it", async () => {
  function Probe() {
    return <p>{useOffline() ? "offline" : "online"}</p>;
  }
  render(<Probe />);
  const original = globalThis.fetch;
  const mock = jest.fn<typeof fetch>();
  globalThis.fetch = mock;
  try {
    mock.mockRejectedValue(new Error("network"));
    await act(async () => {
      await api("/api/v1/health/ready", z.string()).catch(() => {});
    });
    expect(screen.getByText("online")).toBeVisible();
    await act(async () => {
      await api("/api/v1/health/ready", z.string()).catch(() => {});
    });
    expect(screen.getByText("offline")).toBeVisible();
    mock.mockResolvedValue(response("ready"));
    await act(async () => {
      await api("/api/v1/health/ready", z.string());
    });
    expect(screen.getByText("online")).toBeVisible();
  } finally {
    globalThis.fetch = original;
  }
});
test("retry-after disables a retry until its wait expires", () => {
  jest.useFakeTimers();
  const retry = jest.fn();
  try {
    render(
      <DesignLanguage language="en">
        <RetryButton
          error={new ApiFailure(429, "RATE_LIMITED", 2)}
          retry={retry}
        />
      </DesignLanguage>,
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(screen.getByRole("button", { name: "Try again" })).toBeDisabled();
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});
test("completed NASA jobs invalidate only the same owner's field analyses", async () => {
  const query = createQueryClient();
  const invalidate = jest.spyOn(query, "invalidateQueries");
  try {
    const key = ["private", 2, "observation", account.id, "request"];
    await query.fetchQuery({
      queryKey: key,
      queryFn: async () => ({ status: "queued" }),
    });
    expect(invalidate).not.toHaveBeenCalled();
    await query.fetchQuery({
      queryKey: key,
      queryFn: async () => ({ status: "completed" }),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["private", 2, "analysis", account.id],
    });
    await query.fetchQuery({
      queryKey: ["private", 3, "extraction", account.id, "other"],
      queryFn: async () => ({ status: "failed" }),
    });
    expect(invalidate).toHaveBeenCalledTimes(1);
  } finally {
    query.clear();
  }
});
test("DOM scan accepts a local image blob handle but still rejects visible UUID text", async () => {
  const rectangle = new DOMRect(0, 0, 20, 20);
  const rectangles = Object.assign([rectangle], { item: () => rectangle });
  const measure = jest
    .spyOn(Element.prototype, "getClientRects")
    .mockReturnValue(rectangles);
  try {
    render(
      <>
        <img
          src={`blob:${location.origin}/${account.id}`}
          alt="Selected photo"
        />
        <p>{account.id}</p>
      </>,
    );
    const violations = await scanWebDom({
      locator: () => ({
        evaluate: (scan: (body: HTMLElement) => string[]) =>
          scan(document.body),
      }),
    });
    expect(violations).toEqual([`P text: ${account.id}`]);
  } finally {
    measure.mockRestore();
  }
});
