import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@jest/globals";
import { render, screen } from "@testing-library/react";
import { cropColor } from "../../apps/web/src/shared/cropColor.js";
import {
  cropLabels,
  CropName,
  evidenceKind,
  photoFileError,
} from "../../apps/web/src/design/primitives/index.js";
import {
  Icon,
  iconPaths,
  icons,
} from "../../apps/web/src/design/icons/index.js";
import { number, calendarDate } from "../../apps/web/src/i18n/format.js";
import fr from "../../apps/web/src/i18n/fr.json" with { type: "json" };
import en from "../../apps/web/src/i18n/en.json" with { type: "json" };
import crops from "../support/fixtures/design/crops.json" with { type: "json" };
import { checkContrast, contrast } from "../../tooling/design/contrast.mjs";
test("crop colours are deterministic and unique over all 246 release crops", () => {
  const dir = resolve("data/catalog/releases/0.15.0/profiles");
  const profiles = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf8")));
  expect(profiles).toHaveLength(246);
  const colors = profiles.map((p) => cropColor(p.id, p.identity.family));
  expect(new Set(colors).size).toBe(246);
  expect(
    [...profiles]
      .reverse()
      .map((p) => cropColor(p.id, p.identity.family))
      .reverse(),
  ).toEqual(colors);
  expect(cropColor("unlisted", "unknown")).toMatch(/^hsl\(/);
});
test("specimen crop identities exactly match the recorded catalogue", () => {
  for (const crop of crops) {
    const profile = JSON.parse(
      readFileSync(
        resolve(`data/catalog/releases/0.15.0/profiles/${crop.id}.json`),
        "utf8",
      ),
    );
    expect(crop.name).toBe(profile.identity.name);
    expect(crop.family).toBe(profile.identity.family);
    for (const name of crop.localNames)
      expect(profile.identity.localNames).toEqual(
        expect.arrayContaining([expect.objectContaining(name)]),
      );
  }
});
test("message dictionaries are complete, nonempty and contain no interpolation leaks", () => {
  expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  for (const dictionary of [fr, en])
    for (const value of Object.values(dictionary)) {
      expect(value.trim()).not.toBe("");
      expect(value).not.toMatch(/undefined|\{\{|TODO|Lorem/);
    }
});
test("every semantic contrast pair passes; checker detects failures", () => {
  const css = readFileSync(resolve("apps/web/src/design/tokens.css"), "utf8");
  expect(checkContrast(css).every((p) => p.ratio >= p.minimum)).toBe(true);
  expect(
    checkContrast(css.replace("--ink: #1c1c1e", "--ink: #ffffff")).some(
      (p) => p.ratio < p.minimum,
    ),
  ).toBe(true);
  expect(contrast("#ffffff", "#000000")).toBe(21);
});
test.each([
  [0, 0, 0, "missing"],
  [1, 0, 0, "sourced"],
  [0, 1, 0, "sourced"],
  [0, 0, 1, "recalled"],
  [1, 0, 1, "mixed"],
  [0, 1, 1, "mixed"],
] as const)(
  "evidence %s %s %s = %s",
  (double_checked, expert_reviewed, model_recall, expected) => {
    expect(
      evidenceKind({
        double_checked,
        expert_reviewed,
        model_recall,
        extracted: 5,
      }),
    ).toBe(expected);
  },
);
test("preferred names, four languages, Arabic fallback and low confidence survive display", () => {
  const crop = crops[0]!;
  expect(cropLabels(crop, "en")[0]!.name).toBe(crop.name);
  for (const mode of ["fr", "en", "ar", "ary"] as const)
    expect(cropLabels(crop, mode)[0]!.language).toBe(mode);
  const fallback = {
    ...crop,
    localNames: crop.localNames.filter((n) => n.language !== "ary"),
  };
  expect(cropLabels(fallback, "ary")[0]).toMatchObject({
    language: "ar",
    fallback: true,
  });
  const onlyEnglish = { ...crop, localNames: [] };
  expect(cropLabels(onlyEnglish, "fr")[0]!.name).toBe(crop.name);
  const { container } = render(
    <CropName cropId={crop.id} crop={crop} nameMode="ary" />,
  );
  expect(
    container.querySelector('.rv-name-primary bdi[lang="ar"][dir="auto"]'),
  ).toHaveTextContent(cropLabels(crop, "ary")[0]!.name);
  expect(container.querySelector(".rv-name-unconfirmed")).not.toBeNull();
});
test("all original SVG icons have uniform strokes and accessible name policy", () => {
  expect(Object.keys(iconPaths)).toHaveLength(42);
  expect(Object.keys(icons)).toEqual(Object.keys(iconPaths));
  const { container } = render(
    <>
      <Icon name="map" label="Map" />
      <Icon name="map" />
    </>,
  );
  expect(screen.getByRole("img", { name: "Map" })).toHaveAttribute(
    "stroke-width",
    "1.75",
  );
  expect(container.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
});
test("calendar dates are timezone-independent and invalid numbers are rejected", () => {
  expect(calendarDate("2026-11-11", "fr")).toBe("11 novembre 2026");
  expect(calendarDate("2026-11-11", "en")).toBe("11 November 2026");
  expect(() => calendarDate("2026-02-31", "en")).toThrow();
  expect(() => calendarDate("wrong", "fr")).toThrow();
  expect(() => number(NaN, "fr")).toThrow();
  expect(number(12.5, "fr")).toBe("12,5");
});
test("photo validates exact MIME types and byte limit", () => {
  expect(
    photoFileError(
      new File(["123"], "x.jpg", { type: "text/plain" }),
      ["image/jpeg"],
      10,
    ),
  ).toBe("photoInvalid");
  expect(
    photoFileError(
      new File(["123"], "x.jpg", { type: "image/jpeg" }),
      ["image/jpeg"],
      2,
    ),
  ).toBe("photoLarge");
  expect(
    photoFileError(
      new File(["123"], "x.jpg", { type: "image/jpeg" }),
      ["image/jpeg"],
      3,
    ),
  ).toBeUndefined();
});
