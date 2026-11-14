import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { expect, test } from "@jest/globals";
import { IntlMessageFormat } from "intl-messageformat";
import ts from "typescript";
import {
  dictionaries,
  message,
  storedLanguage,
  type MessageKey,
} from "../../apps/web/src/i18n/messages.js";
import {
  quantity,
  timestamp,
  monthDay,
  lossPoints,
} from "../../apps/web/src/i18n/format.js";
import { failureText } from "../../apps/web/src/api/errors.js";
import { ApiFailure } from "../../apps/web/src/app/http.js";
import {
  planInterval,
  nasaInterval,
  stale,
} from "../../apps/web/src/api/keys.js";
import { glossaryFor } from "../../packages/domain/dist/index.js";
import { checkImports } from "../../tooling/web/check-boundaries.mjs";
import { annotateContractSchemas } from "../../tooling/web/contract-treeshake.js";

test("French/English keys match, every message parses as ICU, missing keys throw", () => {
  expect(Object.keys(dictionaries.fr).sort()).toEqual(
    Object.keys(dictionaries.en).sort(),
  );
  for (const lang of ["fr", "en"] as const)
    for (const value of Object.values(dictionaries[lang]))
      expect(() => new IntlMessageFormat(value, lang)).not.toThrow();
  expect(() => message("fr", "missing.key" as MessageKey)).toThrow(
    "Missing translation",
  );
  expect(message("en", "boot.countdown", { seconds: 1 })).toContain(
    "1 second.",
  );
  expect(message("fr", "boot.countdown", { seconds: 2 })).toContain(
    "2 secondes.",
  );
  localStorage.clear();
  expect(storedLanguage()).toBe("fr");
  localStorage.setItem("rv.lang", "en");
  expect(storedLanguage()).toBe("en");
  localStorage.setItem("rv.lang", "ar");
  expect(storedLanguage()).toBe("fr");
  localStorage.clear();
});
test("every explicit schema message in plan-v2 has a French and English translation", () => {
  const source = ts.createSourceFile(
    "plan-v2.contract.ts",
    readFileSync("packages/contracts/src/plans/plan-v2.contract.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const messages = new Set<string>();
  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === "message" &&
      ts.isStringLiteral(node.initializer)
    )
      messages.add(node.initializer.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.getText(source).endsWith(".refine") ||
        node.expression.getText(source) === "issue")
    ) {
      const second = node.arguments[1];
      if (second && ts.isStringLiteral(second)) messages.add(second.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(messages.size).toBeGreaterThan(15);
  for (const text of messages)
    for (const lang of ["fr", "en"] as const)
      expect(
        message(lang, `validation.${text}` as MessageKey).length,
      ).toBeGreaterThan(0);
});
test("all glossary errors resolve in both languages and unknown codes stay private", () => {
  for (const lang of ["fr", "en"] as const) {
    const glossary = glossaryFor(lang);
    for (const entry of glossary.entries.filter((e) => e.group === "error"))
      expect(failureText(new ApiFailure(503, entry.code), lang, glossary)).toBe(
        entry.meaning,
      );
    expect(
      failureText(new ApiFailure(503, "UNKNOWN_BACKEND_CODE"), lang, glossary),
    ).toBe(message(lang, "error.generic"));
    expect(
      failureText(new ApiFailure(429, "RATE_LIMITED", 5), lang, glossary),
    ).toContain(message(lang, "error.wait", { seconds: 5 }));
  }
});
test("formatters preserve units, western digits and calendar days across time zones", () => {
  expect(quantity(12.5, "ha", "fr")).toBe("12,5\u00a0ha");
  expect(quantity(12.5, "mm", "en")).toBe("12.5\u00a0mm");
  expect(timestamp("2026-11-11T23:30:00Z", "en", "Pacific/Auckland")).toContain(
    "12 November 2026",
  );
  expect(monthDay("02-29", "fr")).toContain("29");
  expect(() => monthDay("02-31", "en")).toThrow();
  expect(lossPoints(0.255, "en")).toBe("26");
  expect(() => lossPoints(2, "fr")).toThrow();
});
test("polling slows at the specified elapsed times and stops at terminal states", () => {
  const created = "2026-11-11T00:00:00Z",
    start = Date.parse(created);
  expect(planInterval("queued", created, start + 29999)).toBe(2000);
  expect(planInterval("running", created, start + 30000)).toBe(5000);
  expect(nasaInterval("submitted", created, start + 599999)).toBe(30000);
  expect(nasaInterval("submitted", created, start + 600000)).toBe(120000);
  for (const status of ["completed", "failed"]) {
    expect(planInterval(status, created)).toBe(false);
    expect(nasaInterval(status, created)).toBe(false);
  }
  expect(stale.completedPlan).toBe(Infinity);
});
test("generated client matches current contract operations; browser imports reject engine internals", () => {
  expect(() =>
    execFileSync(
      process.execPath,
      ["tooling/web/generate-client.mjs", "--check"],
      { stdio: "pipe" },
    ),
  ).not.toThrow();
  expect(checkImports('import { x } from "@rotavise/domain";')).toEqual([
    "@rotavise/domain",
  ]);
  expect(
    checkImports('const x = import("../../packages/domain/src/index.js");'),
  ).toHaveLength(1);
  expect(checkImports('import { z } from "@rotavise/contracts";')).toEqual([]);
});
test("browser tree shaking marks construction only, preserving validation calls", () => {
  expect(
    annotateContractSchemas("export const emptySchema=z.strictObject({});"),
  ).toContain("/*#__PURE__*/ (() => (z.strictObject");
  expect(
    annotateContractSchemas(
      "export const checkedSchema=z.string().parse(input);",
    ),
  ).not.toContain("/*#__PURE__*/");
  expect(
    annotateContractSchemas("const value=existingSchema.safeParse(input);"),
  ).not.toContain("/*#__PURE__*/");
  expect(
    annotateContractSchemas(
      'export const openApiOperations=[body("Description")];',
    ),
  ).toContain("/*#__PURE__*/ (() =>");
});
