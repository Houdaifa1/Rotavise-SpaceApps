import { describe, expect, test } from "@jest/globals";
import { render, screen, fireEvent } from "@testing-library/react";
import { axe } from "jest-axe";
import {
  SeriesChart,
  layoutAxisLabels,
} from "../../apps/web/src/design/primitives/SeriesChart.js";
import { DesignLanguage } from "../../apps/web/src/i18n/messages.js";
import { widthSeries } from "../support/fixtures/design/specimens.js";
describe.each(["fr", "en"] as const)("charts in %s", (language) => {
  test.each(
    (["line", "area", "band", "bars", "timeline"] as const).flatMap((type) =>
      ["ready", "empty", "partial"].map((state) => ({ type, state })),
    ),
  )("$type $state", async ({ type, state }) => {
    const series =
      state === "empty"
        ? []
        : widthSeries("Width", "Rising", state === "partial");
    const { container } = render(
      <DesignLanguage language={language}>
        <main>
          <SeriesChart
            type={type}
            series={series}
            unit="px"
            title="Widths"
            source="Interface specification"
            partial={state === "partial"}
          />
        </main>
      </DesignLanguage>,
    );
    expect(container.innerHTML).not.toMatch(/NaN|undefined/);
    expect(screen.getByText(/Interface specification/)).toBeVisible();
    if (state !== "empty") {
      const chart = screen.getByRole("group");
      fireEvent.keyDown(chart, { key: "ArrowRight" });
      expect(screen.getByRole("status")).toHaveTextContent("390 px");
      fireEvent.keyDown(chart, { key: "End" });
      expect(screen.getByRole("status")).toHaveTextContent("1440 px");
      fireEvent.keyDown(chart, { key: "Escape" });
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(screen.getByRole("table", { hidden: true })).toHaveTextContent(
        "Rising",
      );
    }
    expect(await axe(container)).toHaveNoViolations();
  });
});
test("axis label boxes never intersect at the four widths", () => {
  for (const width of [390, 768, 1024, 1440]) {
    const labels = layoutAxisLabels(
      Array.from({ length: 24 }, (_, i) => ({
        label: `Label ${i}`,
        width: 70,
        x: 44 + (i * (width - 76)) / 23,
      })),
    );
    for (let i = 1; i < labels.length; i++)
      expect(labels[i]!.x - labels[i]!.width / 2).toBeGreaterThanOrEqual(
        labels[i - 1]!.x + labels[i - 1]!.width / 2 + 12,
      );
  }
});
test("missing values break SVG lines, and single-value domains remain finite", () => {
  const series = widthSeries("Width", "Rising", true);
  const { container, rerender } = render(
    <SeriesChart
      type="line"
      title="Width"
      source="Spec"
      unit="px"
      series={series}
    />,
  );
  expect(
    container
      .querySelector("g[data-series] path")!
      .getAttribute("d")!
      .match(/M/g),
  ).toHaveLength(2);
  series[0]!.points = [series[0]!.points[0]!];
  rerender(
    <SeriesChart
      type="band"
      title="Width"
      source="Spec"
      unit="px"
      series={series}
    />,
  );
  expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
});
test("chart rejects invalid numeric input instead of leaking it", () => {
  expect(() => SeriesChart).not.toThrow();
  const points = widthSeries("Width", "Rising");
  points[0]!.points[0]!.value = NaN;
  expect(() =>
    render(
      <SeriesChart
        type="line"
        title="Width"
        source="Spec"
        unit="px"
        series={points}
      />,
    ),
  ).toThrow("Chart values must be finite");
});
