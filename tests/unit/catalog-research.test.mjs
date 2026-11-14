import { test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
const old = await loadCatalogRelease("data/catalog/releases/0.13.0");
const catalog = await loadCatalogRelease("data/catalog/releases/0.14.0");
const sha = (v) => createHash("sha256").update(v).digest("hex");
const read = (p) => JSON.parse(readFileSync(p));
const entries = catalog.profiles.flatMap((p) => [
  ...p.research.income.facts,
  ...p.research.income.options,
  ...p.research.benefits.findings,
]);
test("0.14.0 is a strict additive superset; every existing entity, rule, name and source is unchanged", () => {
  expect(catalog.profiles).toHaveLength(old.profiles.length);
  for (const p of catalog.profiles) {
    const { research, ...previous } = p;
    expect(research.version).toBe("income-benefits-1");
    expect({ ...previous, version: old.version }).toEqual(
      old.profiles.find((o) => o.id === p.id),
    );
  }
  expect(catalog.sources.slice(0, old.sources.length)).toEqual(old.sources);
  for (const key of ["regions", "issues", "conflicts"])
    expect(catalog[key]).toEqual(old[key]);
  expect(prepareCatalogV2(catalog).sha256).toBe(
    "8a59fc79f0320a3033278a308e26507b090a06fe370008be64f42045abb8a43a",
  );
});
test("research coverage is exact: 654 numeric inputs, 6 options, 102 findings, explicit gaps for all 246 crops", () => {
  expect(
    catalog.profiles.reduce((n, p) => n + p.research.income.facts.length, 0),
  ).toBe(654);
  expect(
    catalog.profiles.reduce((n, p) => n + p.research.income.options.length, 0),
  ).toBe(6);
  expect(
    catalog.profiles.filter(
      (p) => p.research.income.facts.length || p.research.income.options.length,
    ),
  ).toHaveLength(67);
  expect(
    catalog.profiles.filter((p) => p.research.benefits.findings.length),
  ).toHaveLength(45);
  expect(
    catalog.profiles.reduce(
      (n, p) => n + p.research.benefits.findings.length,
      0,
    ),
  ).toBe(102);
  for (const p of catalog.profiles)
    expect(
      new Set([
        ...p.research.benefits.findings.map((f) => f.category),
        ...p.research.benefits.gaps.map((g) => g.category),
      ]).size,
    ).toBe(9);
});
test("every new citation is quote-checked and bound to research, original source and extract hashes", () => {
  const audit = read("data/catalog/releases/0.14.0/quote-check.json");
  const previous = read("data/catalog/releases/0.13.0/quote-check.json");
  expect(audit.checks.slice(0, previous.checks.length)).toEqual(
    previous.checks,
  );
  const extractPath =
    "data/catalog/releases/0.14.0/research-quote-extracts.json";
  const bytes = readFileSync(extractPath),
    extracts = JSON.parse(bytes);
  for (const [path, hash] of Object.entries(extracts.inputHashes))
    expect(sha(readFileSync(path))).toBe(hash);
  const checks = new Map(
    audit.checks.slice(previous.checks.length).map((c) => [c.where, c]),
  );
  const quotes = new Map(extracts.checks.map((c) => [c.where, c]));
  const citations = entries.flatMap((e) => e.citations);
  expect(citations).toHaveLength(1108);
  expect(checks.size).toBe(citations.length);
  expect(audit.matched).toBe(audit.citations);
  for (const c of citations) {
    const check = checks.get(c.quoteCheck),
      quote = quotes.get(c.quoteCheck);
    expect(check.matched).toBe(true);
    expect(check.quoteSha256).toBe(sha(c.quote));
    expect(check.extractSha256).toBe(sha(bytes));
    expect(quote.quote).toBe(c.quote);
    expect(quote.sourceSha256).toBe(c.sourceSha256);
    expect(
      catalog.sources.find((s) => s.id === c.sourceId).evidence.sha256,
    ).toBe(c.sourceSha256);
  }
});
test("runtime validation refuses dangling research citations, mismatched hashes and reversed numeric ranges", () => {
  for (const mutate of [
    (f) => {
      f.citations[0].sourceId = "missing-source";
    },
    (f) => {
      f.citations[0].sourceSha256 = "0".repeat(64);
    },
    (f) => {
      f.value = { min: 2, max: 1 };
    },
  ]) {
    const copy = structuredClone(catalog);
    mutate(
      copy.profiles.find((p) => p.research.income.facts.length).research.income
        .facts[0],
    );
    expect(() => prepareCatalogV2(copy)).toThrow("CATALOG_INVALID");
  }
});

test("every admitted value, unit, year, region, definition and locality is copied from its saved research record", () => {
  const income = [],
    benefits = [];
  for (let n = 1; n <= 10; n++) {
    const suffix = String(n).padStart(2, "0");
    income.push(
      ...read(
        `docs/evidence/catalog/2026-11-10/income/income-batch-${suffix}.json`,
      ).records,
    );
    benefits.push(
      ...read(
        `docs/evidence/catalog/2026-11-10/benefits/benefits-batch-${suffix}.json`,
      ).crops,
    );
  }
  for (const p of catalog.profiles) {
    const i = income.find((r) => r.cropId === p.id);
    for (const f of p.research.income.facts) {
      const original = i[f.kind].find((v) => v.id === f.id);
      for (const key of ["value", "unit", "currency", "year", "region"])
        expect(f[key]).toEqual(original[key]);
      expect(f.definition).toBe(
        original.costDefinition ??
          original.marginDefinition ??
          original.statistic,
      );
      expect(f.citations[0].quote).toBe(original.quote.original);
    }
    for (const f of p.research.benefits.findings) {
      const original = benefits
        .find((r) => r.cropId === p.id)
        .findings.find((v) => v.id === f.id);
      expect(f.nonLocal).toBe(original.regionApplicability.nonLocal);
      expect(f.region).toBe(original.regionApplicability.region);
      expect(f.conditions).toEqual(original.conditions);
      expect(f.magnitude).toEqual(original.magnitude);
      expect(f.rotationContext).toEqual(original.rotationContext);
      expect(f.citations[0].quote).toBe(original.quote.original);
    }
  }
});
