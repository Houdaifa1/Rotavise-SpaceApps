import { test, expect } from "@jest/globals";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { loadConfig } from "../../apps/server/dist/config/environment.js";
import { buildCropDetail } from "../../apps/server/dist/modules/catalog/application/crop-detail.js";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
import { cropDetailSchema } from "../../packages/contracts/dist/index.js";
const old = await loadCatalogRelease("data/catalog/releases/0.15.0");
const catalog = await loadCatalogRelease("data/catalog/releases/0.16.0");
const prepared = prepareCatalogV2(catalog);
const root = "data/catalog/releases/0.16.0";
const evidence = "docs/evidence/catalog/2026-11-12";
const read = (p) => JSON.parse(readFileSync(p));
const sha = (v) => createHash("sha256").update(v).digest("hex");
const pairs = (p) => [
  [p.id, p.identity],
  ...p.cultivars.map((c) => [`${p.id}/${c.id}`, c]),
];
const count = (owners, lang) =>
  owners.filter((o) => o.localNames?.some((n) => n.language === lang)).length;

test("0.16.0 is a strict names-only superset of 0.15.0, preserving every old value and array position", () => {
  expect(catalog.profiles).toHaveLength(old.profiles.length);
  for (const [i, p] of catalog.profiles.entries()) {
    const previous = old.profiles[i];
    const restored = structuredClone(p);
    restored.version = previous.version;
    restored.identity.localNames = previous.identity.localNames;
    restored.cultivars.forEach((c, j) => {
      if (previous.cultivars[j].localNames === undefined) delete c.localNames;
      else c.localNames = previous.cultivars[j].localNames;
    });
    expect(restored).toEqual(previous);
    for (const [j, [id, o]] of pairs(p).entries()) {
      const oldOwner = pairs(previous)[j][1];
      expect([
        id,
        o.localNames.slice(0, oldOwner.localNames?.length ?? 0),
      ]).toEqual([id, oldOwner.localNames ?? []]);
    }
  }
  expect(catalog.sources.slice(0, old.sources.length)).toEqual(old.sources);
  expect(catalog.sources).toHaveLength(old.sources.length + 2);
  expect({
    ...catalog,
    version: old.version,
    profiles: old.profiles,
    sources: old.sources,
  }).toEqual(old);
  expect(
    loadConfig({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1/fixture",
    }).ROTATION_CATALOG_VERSION,
  ).toBe("0.15.0");
});

test("0.16.0 has 246 four-language crops and 1226 English / 148 Darija cultivars with primary-copy provenance", () => {
  expect(catalog.profiles).toHaveLength(246);
  const cultivars = catalog.profiles.flatMap((p) => p.cultivars);
  expect(cultivars).toHaveLength(1226);
  for (const language of ["en", "fr", "ar", "ary"])
    expect(
      count(
        catalog.profiles.map((p) => p.identity),
        language,
      ),
    ).toBe(246);
  expect(["en", "fr", "ar", "ary"].map((l) => count(cultivars, l))).toEqual([
    1226, 0, 123, 148,
  ]);
  for (const p of catalog.profiles)
    for (const [, o] of pairs(p)) {
      const en = o.localNames.filter((n) => n.language === "en");
      expect(en).toEqual([
        {
          language: "en",
          name: o.name,
          origin: "primary_name",
          preferred: true,
        },
      ]);
      for (const language of new Set(o.localNames.map((n) => n.language))) {
        const chosen = o.localNames.filter(
          (n) => n.language === language && n.preferred,
        );
        expect(chosen).toHaveLength(1);
        if (
          o.localNames.some(
            (n) => n.language === language && n.citations?.length,
          )
        )
          expect(chosen[0].citations?.length).toBeGreaterThan(0);
      }
    }
});

test("all 68 crop gap fills and 136 selected cultivar names carry dated unquoted recall and low-confidence review entries", () => {
  const log = read(`${evidence}/b8-names-log.json`),
    review = readFileSync(`${evidence}/names-for-native-review.md`, "utf8");
  const recalls = log.addedNames.filter((n) => n.purpose === "darija_recall");
  expect(recalls.filter((n) => n.scope === "crop")).toHaveLength(68);
  expect(recalls.filter((n) => n.scope === "cultivar")).toHaveLength(136);
  expect(log.summary.cultivarsWith.ary).toBe(148);
  for (const n of recalls) {
    expect(n.language).toBe("ary");
    expect(n.name).toMatch(/[\u0600-\u06ff]/u);
    expect(n.recall).toMatchObject({
      valueKind: "model_recall_unverified",
      recordedOn: "2026-11-12",
      confidence: expect.stringMatching(/^(low|medium|high)$/),
      basis: expect.any(String),
    });
    expect(n.recall.basis.length).toBeGreaterThan(60);
    expect(n.citations).toBeUndefined();
    expect(n.quote).toBeUndefined();
    expect(review).toContain(n.id);
    expect(review).toContain(n.name);
    const [crop, cultivar] = n.id.split("/");
    const p = catalog.profiles.find((v) => v.id === crop);
    const o = cultivar
      ? p.cultivars.find((c) => c.id === cultivar)
      : p.identity;
    expect(o.localNames).toContainEqual(
      Object.fromEntries(
        Object.entries(n).filter(
          ([k]) => !["scope", "id", "purpose"].includes(k),
        ),
      ),
    );
  }
  for (const n of log.addedNames.filter(
    (n) => (n.recall?.confidence ?? n.confidence) === "low",
  )) {
    expect(review).toContain(n.id);
    expect(review).toContain(n.name);
  }
});

test("all four new citation occurrences bind source, PDF page, visual transcription, render and extract hashes", () => {
  const audit = read(`${root}/quote-check.json`),
    previous = read("data/catalog/releases/0.15.0/quote-check.json");
  expect(audit.checks.slice(0, previous.checks.length)).toEqual(
    previous.checks,
  );
  expect(audit.citations).toBe(previous.citations + 4);
  expect(audit.matched).toBe(audit.citations);
  const extractPath = `${root}/name-quote-extracts.json`,
    bytes = readFileSync(extractPath),
    extracts = JSON.parse(bytes);
  expect(extracts.sourceManifestSha256).toBe(
    sha(readFileSync(extracts.sourceManifest)),
  );
  const manifest = read(extracts.sourceManifest);
  const checks = audit.checks.slice(previous.checks.length);
  expect(checks).toHaveLength(4);
  let citations = 0;
  for (const p of catalog.profiles)
    for (const [id, o] of pairs(p))
      for (const [i, n] of o.localNames.entries())
        for (const c of n.citations ?? []) {
          if (!c.sourceId.startsWith("b8-")) continue;
          citations++;
          const where = `${p.id}:${id.includes("/") ? `cultivar:${id.split("/")[1]}` : "identity"}:localName:${i}`;
          const check = checks.find((v) => v.where === where),
            original = manifest.sources.find((s) => s.id === c.sourceId),
            source = catalog.sources.find((s) => s.id === c.sourceId);
          expect(check).toBeDefined();
          expect(check.matched).toBe(true);
          expect(check.sourceId).toBe(c.sourceId);
          expect(original.text).toContain(c.quote);
          expect(c.quote).toBe(n.name);
          expect(check.quoteSha256).toBe(sha(c.quote));
          expect(check.sourceSha256).toBe(source.evidence.sha256);
          expect(source.evidence.sha256).toBe(original.sourceSha256);
          expect(source.evidence.bytes).toBe(original.sourceBytes);
          expect(source.url).toBe(original.url);
          expect(c.page).toBe(original.pdfPage);
          expect(check.renderSha256).toBe(original.renderSha256);
          expect(check.method).toBe("visual_pdf_transcription");
          expect(check.extractSha256).toBe(sha(bytes));
          expect(check.extractPath).toBe(extractPath);
          expect(extracts.checks.find((q) => q.where === where).quote).toBe(
            c.quote,
          );
          expect(n.preferred).toBe(true);
          expect(n.recall).toBeUndefined();
          // A same-spelling recall remains a distinct, nonpreferred entry.
          expect(
            o.localNames.some(
              (r) => r.name === n.name && r.recall && !r.preferred,
            ),
          ).toBe(true);
        }
  expect(citations).toBe(4);
});

test("primary-name origin is runtime-validated and cannot disguise a translation, recall or source", () => {
  const bad = (change) => {
    const copy = structuredClone(catalog);
    change(copy.profiles.find((p) => p.id === "olive"));
    return () => prepareCatalogV2(copy);
  };
  expect(
    bad((p) => {
      p.identity.localNames.find((n) => n.origin).name = "Different name";
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    bad((p) => {
      p.identity.localNames.find((n) => n.origin).language = "fr";
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    bad((p) => {
      p.cultivars[0].localNames.find((n) => n.origin).name =
        "Different cultivar";
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    bad((p) => {
      p.identity.localNames.find((n) => n.origin).recall =
        p.identity.localNames.find((n) => n.recall).recall;
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    bad((p) => {
      const primary = p.identity.localNames.find((n) => n.origin);
      const sourced = p.identity.localNames.find((n) => n.citations);
      primary.citations = sourced.citations;
      primary.confidence = sourced.confidence;
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    bad((p) => {
      p.identity.localNames.push({
        ...p.identity.localNames.find((n) => n.language === "en"),
      });
    }),
  ).toThrow("CATALOG_INVALID");
});

test("every 0.16.0 crop detail projects English and Darija with preference and provenance preserved", () => {
  for (const p of catalog.profiles) {
    const detail = buildCropDetail({ ...prepared, format: "2" }, p.id);
    expect(cropDetailSchema.safeParse(detail).success).toBe(true);
    expect(detail.identity.names).toContainEqual(
      expect.objectContaining({
        language: "en",
        name: p.identity.name,
        origin: "primary_name",
        preferred: true,
        evidence: null,
        recall: null,
        citations: [],
      }),
    );
    expect(
      detail.identity.names.some((n) => n.language === "ary" && n.preferred),
    ).toBe(true);
    expect(
      detail.gaps.filter((g) =>
        ["identity.names.en", "identity.names.ary"].includes(g.path),
      ),
    ).toEqual([]);
    for (const c of detail.cultivars)
      expect(
        c.names.some(
          (n) =>
            n.language === "en" && n.preferred && n.origin === "primary_name",
        ),
      ).toBe(true);
  }
});
