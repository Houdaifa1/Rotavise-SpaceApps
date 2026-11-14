import { test, expect } from "@jest/globals";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  prepareCatalogV2,
  canonicalCatalogV2Json,
} from "../../packages/catalog/dist/index.js";
import { benefitEffectCategories } from "../../packages/contracts/dist/index.js";
import { glossaryFor } from "../../packages/domain/dist/index.js";
const read = (p) => JSON.parse(readFileSync(p));
const sha = (v) => createHash("sha256").update(v).digest("hex");
const old = await loadCatalogRelease("data/catalog/releases/0.14.0");
const catalog = await loadCatalogRelease("data/catalog/releases/0.15.0");
const root = "docs/evidence/catalog/2026-11-11/benefits";
const records = catalog.profiles.flatMap((p) => p.research.benefits.records);
test("0.15.0 strictly preserves every 0.14.0 entity, income input and historical benefit/gap", () => {
  expect(catalog.profiles).toHaveLength(246);
  for (const p of catalog.profiles) {
    const previous = structuredClone(p);
    previous.version = old.version;
    expect(previous.research.benefits.version).toBe("benefits-2");
    delete previous.research.benefits.version;
    delete previous.research.benefits.records;
    expect(previous).toEqual(old.profiles.find((o) => o.id === p.id));
  }
  expect(catalog.sources.slice(0, old.sources.length)).toEqual(old.sources);
  for (const key of ["regions", "issues", "conflicts"])
    expect(catalog[key]).toEqual(old[key]);
  expect(prepareCatalogV2(old).sha256).toBe(
    "8a59fc79f0320a3033278a308e26507b090a06fe370008be64f42045abb8a43a",
  );
  expect(prepareCatalogV2(catalog).sha256).toBe(
    read(`${root}/benefits-verification.json`).catalogSha256,
  );
  expect(Buffer.byteLength(canonicalCatalogV2Json(catalog))).toBeLessThan(
    16 * 1024 * 1024,
  );
});
test("every crop/effect has explicit provenance; no search gap is passed off as not-applicable", () => {
  for (const p of catalog.profiles) {
    expect(new Set(p.research.benefits.records.map((f) => f.category))).toEqual(
      new Set(benefitEffectCategories),
    );
    for (const f of p.research.benefits.records) {
      expect(f.conditions.length).toBeGreaterThan(0);
      if (f.status === "sourced") expect(f.citations.length).toBeGreaterThan(0);
      else {
        expect(f.citations).toEqual([]);
        expect(f).not.toHaveProperty("quote");
        expect(f.recall).toMatchObject({
          recordedOn: "2026-11-11",
          valueKind: "model_recall_unverified",
          basis: expect.any(String),
          confidence: expect.stringMatching(/^(low|medium|high)$/),
        });
        if (f.status === "not_found") {
          expect(f.applicability).toBe("not_applicable");
          expect(f.reason.length).toBeGreaterThan(20);
          expect(f.reason).not.toMatch(/no.*source|search.*gap/i);
        }
      }
    }
  }
  expect(records.filter((f) => f.status === "sourced")).toHaveLength(184);
  expect(
    records.filter((f) => f.status === "model_recall").length,
  ).toBeGreaterThan(2500);
});
test("every new crop/role citation binds exact saved research, source hash, input hash and checked extract", () => {
  const prior = read("data/catalog/releases/0.14.0/quote-check.json"),
    audit = read("data/catalog/releases/0.15.0/quote-check.json");
  expect(audit.checks.slice(0, prior.checks.length)).toEqual(prior.checks);
  const extractPath =
      "data/catalog/releases/0.15.0/research-quote-extracts.json",
    bytes = readFileSync(extractPath),
    extracts = JSON.parse(bytes);
  for (const [p, hash] of Object.entries(extracts.inputHashes))
    expect(sha(readFileSync(p))).toBe(hash);
  const checks = new Map(
    audit.checks.slice(prior.checks.length).map((c) => [c.where, c]),
  );
  const quotes = new Map(extracts.checks.map((c) => [c.where, c]));
  const roles = read(`${root}/benefits-roles.json`).entries;
  const citations = [
    ...records.flatMap((f) => f.citations),
    ...roles.flatMap((r) => r.evidence.citations),
  ];
  expect(citations.length).toBe(audit.citations - prior.citations);
  for (const c of citations) {
    const check = checks.get(c.quoteCheck),
      quote = quotes.get(c.quoteCheck);
    expect(check).toMatchObject({
      matched: true,
      quoteSha256: sha(c.quote),
      extractSha256: sha(bytes),
      sourceSha256: c.sourceSha256,
    });
    expect(quote.quote).toBe(c.quote);
    expect(
      catalog.sources.find((s) => s.id === c.sourceId).evidence.sha256,
    ).toBe(c.sourceSha256);
  }
  for (const lang of ["en", "fr", "ar", "ary"]) {
    const served = glossaryFor(lang, "role");
    expect(served.entries).toHaveLength(4);
    for (const r of served.entries) {
      const saved = roles.find((s) => s.code === r.code);
      expect(r.evidence).toEqual(saved.evidence);
      expect(r.meaning).toBe(saved.meaning[lang]);
    }
    if (lang === "ar" || lang === "ary")
      expect(served.provenance.text).toBe("model_translated_unreviewed");
  }
});
test("runtime rejects missing effect coverage, mislabelled provenance, reversed ranges and unsourced sourced-records", () => {
  for (const mutate of [
    (p) => {
      p.research.benefits.records = p.research.benefits.records.filter(
        (f) => f.category !== "weed_break",
      );
    },
    (p) => {
      p.research.benefits.records.find(
        (f) => f.status === "model_recall",
      ).magnitude.status = "sourced";
    },
    (p) => {
      p.research.benefits.records.find(
        (f) => f.status === "model_recall",
      ).magnitude = { status: "model_recall", min: 2, max: 1, unit: "m" };
    },
    (p) => {
      p.research.benefits.records.find(
        (f) => f.status === "sourced",
      ).citations = [];
    },
    (p) => {
      p.research.benefits.records.find(
        (f) => f.status === "model_recall",
      ).citations = [records.find((f) => f.status === "sourced").citations[0]];
    },
  ]) {
    const copy = structuredClone(catalog);
    mutate(copy.profiles.find((p) => p.id === "barley"));
    expect(() => prepareCatalogV2(copy)).toThrow("CATALOG_INVALID");
  }
});
