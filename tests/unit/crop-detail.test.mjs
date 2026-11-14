import { createHash } from "node:crypto";
import { test, expect } from "@jest/globals";
import { readdirSync, readFileSync } from "node:fs";
import {
  prepareCatalog,
  prepareCatalogV2,
} from "../../packages/catalog/dist/index.js";
import {
  cropDetailSchema,
  cropDetailGapCodeSchema,
  cropDetailParamsSchema,
  cropDetailFactSchema,
  cropDetailNameSchema,
  cropDetailRuleSchema,
  glossaryLanguages,
  planRequestV2Schema,
} from "../../packages/contracts/dist/index.js";
import { glossaryFor } from "../../packages/domain/dist/index.js";
import { buildCropDetail } from "../../apps/server/dist/modules/catalog/application/crop-detail.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { rotationRequest } from "../support/rotation.mjs";

const release = await loadCatalogRelease("data/catalog/releases/0.13.0");
const current = { format: "2", ...prepareCatalogV2(release) };
const faba = buildCropDetail(current, "faba-bean");
const allRuleItems = (d) => [
  ...d.calendar.plantingWindows,
  ...d.calendar.durationRanges,
  ...d.rotationRules.predecessorFamilies,
  ...d.rotationRules.returnIntervals,
  ...d.rotationRules.healthBreaks,
];

// Every numeric leaf must have citation or model-recall ancestry. This walks
// nested ranges, stage windows and citations too, rather than checking one
// hand-picked value. Catalog identity/version/hash fields are textual.
function checkNumbers(value, hasEvidence = false, path = "response") {
  if (typeof value === "number") {
    if (!hasEvidence) throw new Error(`Number without provenance: ${path}`);
  } else if (Array.isArray(value))
    value.forEach((v, i) => checkNumbers(v, hasEvidence, `${path}[${i}]`));
  else if (value && typeof value === "object") {
    const recorded =
      hasEvidence ||
      !!value.citations?.length ||
      !!value.recall ||
      value.verification?.status === "model_recall" ||
      typeof value.sourceId === "string";
    for (const [key, child] of Object.entries(value))
      checkNumbers(child, recorded, `${path}.${key}`);
  }
}

test("all committed release profiles project without changing canonical identities; numeric values retain provenance", async () => {
  const legacy = JSON.parse(
    readFileSync(
      "tests/support/fixtures/crop-detail-legacy-hashes.json",
      "utf8",
    ),
  ).releases;
  let profiles = 0;
  for (const version of readdirSync("data/catalog/releases")) {
    const catalog = await loadCatalogRelease(
      `data/catalog/releases/${version}`,
    );
    const format = catalog.schemaVersion;
    const prepare = format === "2" ? prepareCatalogV2 : prepareCatalog;
    const prepared = prepare(catalog);
    const bytes = createHash("sha256");
    for (const profile of catalog.profiles) {
      const detail = buildCropDetail({ ...prepared, format }, profile.id);
      expect(cropDetailSchema.safeParse(detail).success).toBe(true);
      bytes.update(JSON.stringify(detail) + "\n");
      checkNumbers(detail);
      expect(Buffer.byteLength(JSON.stringify(detail))).toBeLessThanOrEqual(
        2 * 1024 * 1024,
      );
      expect(detail.catalogSha256).toBe(prepared.sha256);
      const sourceIds = new Set(detail.sources.map((s) => s.id));
      const checkSources = (node) => {
        if (Array.isArray(node)) node.forEach(checkSources);
        else if (node && typeof node === "object") {
          if (
            typeof node.sourceId === "string" &&
            // Catalog citations and checked research citations, rather than
            // opaque original research metadata with its own source-ID namespace.
            ("interpretation" in node || "quoteCheck" in node) &&
            !("url" in node)
          )
            expect(sourceIds.has(node.sourceId)).toBe(true);
          Object.values(node).forEach(checkSources);
        }
      };
      checkSources(detail);
      profiles++;
    }
    if (legacy[version]) expect(bytes.digest("hex")).toBe(legacy[version]);
    expect(prepare(catalog).canonicalJson).toBe(prepared.canonicalJson);
    expect(prepare(catalog).sha256).toBe(prepared.sha256);
  }
  expect(profiles).toBeGreaterThan(1000);
}, 90000);

test("calendar and rotation summaries retain original rule scope, conditions, verification and values", () => {
  const profile = current.catalog.profiles.find((p) => p.id === "faba-bean");
  for (const item of allRuleItems(faba)) {
    const original = profile.rules.find((r) => r.id === item.rule.id);
    expect(item.rule).toEqual(original);
    expect(item.verification).toEqual(original.verification);
    expect(item.evidence).toBe(
      original.verification.status === "model_recall"
        ? "model_recall"
        : "sourced",
    );
  }
  expect(faba.calendar.durationRanges.length).toBeGreaterThan(0);
  expect(faba.rotationRules.predecessorFamilies.length).toBeGreaterThan(0);
  expect(faba.rotationRules.healthBreaks.length).toBeGreaterThan(0);
  expect(faba.benefits.every((b) => b.evidence === "model_recall")).toBe(true);
  expect(
    faba.facts.some((f) => f.evidence === "sourced" && f.verification === null),
  ).toBe(true);
  expect(faba.gaps).toContainEqual(
    expect.objectContaining({
      code: "CROP_DETAIL_CATALOG_GAP",
      path: "profile.cycle_duration",
    }),
  );
});

test("names preserve recalled and sourced homonyms, preferred spelling and recorded confidence without guessing language", () => {
  expect(faba.identity.names).toContainEqual(
    expect.objectContaining({
      language: "ary",
      name: "الفول",
      preferred: true,
      confidence: "low",
      evidence: "sourced",
    }),
  );
  expect(faba.identity.names).toContainEqual(
    expect.objectContaining({
      language: "ary",
      name: "الفول",
      preferred: null,
      confidence: "high",
      evidence: "model_recall",
    }),
  );
  expect(faba.identity.names).toContainEqual(
    expect.objectContaining({
      language: "fr",
      name: "Fève",
      preferred: null,
      confidence: null,
      evidence: null,
    }),
  );
  expect(faba.identity.names.some((n) => n.language === "en")).toBe(false);
  expect(faba.gaps.some((g) => g.path === "identity.names.en")).toBe(true);
});

test("listed issues are host-scoped, retain actual kinds, and can be selected using the plan contract", () => {
  expect(faba.issues.length).toBeGreaterThan(0);
  for (const issue of faba.issues) {
    const original = current.catalog.issues.find(
      (i) => i.id === issue.issue_id,
    );
    expect(original.hostCropIds).toContain("faba-bean");
    expect(issue.kind).toBe(original.kind);
    for (const field of ["scientificName", "visibleSymptoms"])
      if (issue[field] === null)
        expect(faba.gaps).toContainEqual(
          expect.objectContaining({
            code: "CROP_DETAIL_MISSING",
            path: `issues.${issue.issue_id}.${field}`,
          }),
        );
    expect(
      issue.names.map(({ language, name }) => ({ language, name })),
    ).toEqual(
      original.localNames.map(({ language, name }) => ({ language, name })),
    );
    expect(
      planRequestV2Schema.safeParse(
        rotationRequest({
          crop_health: {
            status: "reported",
            observations: [
              {
                crop_id: "faba-bean",
                issue: { issue_id: issue.issue_id },
                observed_on: "2026-10-01",
                source: "farmer_report",
                confirmation: "reported",
              },
            ],
          },
        }),
      ).success,
    ).toBe(true);
  }
  expect(faba.issues.some((i) => i.kind === "parasitic_plant")).toBe(true);
});

test("legacy catalog fields stay null or empty, with original limitations and explicit gaps", async () => {
  const old = await loadCatalogRelease("data/catalog/releases/0.1.0");
  const detail = buildCropDetail(
    { format: "1", ...prepareCatalog(old) },
    "faba-bean",
  );
  expect(detail.modelType).toBeNull();
  expect(detail.issues).toEqual([]);
  expect(detail.cultivars).toEqual([]);
  expect(detail.benefits).toEqual([]);
  expect(detail.calendar.durationRanges).toEqual([]);
  expect(detail.limitations).toEqual(
    old.profiles.find((p) => p.id === "faba-bean").limitations,
  );
  for (const path of [
    "modelType",
    "issues",
    "cultivars",
    "benefits",
    "calendar.durationRanges",
  ])
    expect(detail.gaps).toContainEqual(
      expect.objectContaining({ code: "CROP_DETAIL_MISSING", path }),
    );
});

test("contracts reject unproven facts/rules, misclassified evidence and fabricated preferred names", () => {
  const recalled = faba.benefits[0];
  expect(
    cropDetailFactSchema.safeParse({
      ...recalled,
      citations: [],
      recall: undefined,
      verification: null,
    }).success,
  ).toBe(false);
  expect(
    cropDetailFactSchema.safeParse({ ...recalled, evidence: "sourced" })
      .success,
  ).toBe(false);
  const rule = faba.calendar.durationRanges[0];
  expect(
    cropDetailRuleSchema.safeParse({ ...rule, unit: "calendar_year" }).success,
  ).toBe(false);
  expect(
    cropDetailRuleSchema.safeParse({ ...rule, verification: null }).success,
  ).toBe(false);
  const name = faba.identity.names.find((n) => n.evidence === null);
  expect(
    cropDetailNameSchema.safeParse({ ...name, preferred: true }).success,
  ).toBe(false);
  expect(
    cropDetailSchema.safeParse({
      ...faba,
      issues: Array(1501).fill(faba.issues[0]),
    }).success,
  ).toBe(false);
});

test("unknown crops are absent and path parameters are runtime bounded", () => {
  expect(buildCropDetail(current, "missing-crop")).toBeNull();
  for (const bad of [
    { cropId: "../faba-bean" },
    { cropId: "a".repeat(81) },
    { version: "0.13" },
    { version: "0".repeat(50) },
    { version: "0.13.0", extra: "x" },
  ])
    expect(
      cropDetailParamsSchema.safeParse({
        catalogId: current.catalog.id,
        version: "0.13.0",
        cropId: "faba-bean",
        ...bad,
      }).success,
    ).toBe(false);
});

test("every detail gap code has an explanation in en, fr, ar and ary", () => {
  for (const lang of glossaryLanguages) {
    const glossary = glossaryFor(lang);
    for (const code of cropDetailGapCodeSchema.options)
      expect(
        glossary.entries.find((e) => e.code === code)?.meaning.length,
      ).toBeGreaterThan(20);
  }
});

test.each(["0.14.0", "0.15.0"])(
  "%s research projection preserves every fact, quote, missing field and effect provenance",
  async (version) => {
    const catalog = await loadCatalogRelease(
      `data/catalog/releases/${version}`,
    );
    const prepared = { format: "2", ...prepareCatalogV2(catalog) };
    for (const profile of catalog.profiles) {
      const d = buildCropDetail(prepared, profile.id);
      expect(d.research.income).toEqual(profile.research.income);
      expect(d.research.benefits).toEqual(profile.research.benefits);
      const all = [
        ...profile.research.benefits.findings,
        ...(profile.research.benefits.records ?? []),
      ];
      for (const effect of d.research.benefitEffects) {
        const selected = all.filter((r) => effect.findingIds.includes(r.id));
        expect(selected).toHaveLength(effect.findingIds.length);
        if (effect.status === "sourced") {
          expect(selected.every((r) => r.citations.length > 0)).toBe(true);
          expect(effect.confidence).toBeNull();
        } else if (effect.status === "no_data") expect(selected).toEqual([]);
        else {
          expect(
            selected.every(
              (r) =>
                r.citations.length === 0 &&
                r.recall.confidence === effect.confidence,
            ),
          ).toBe(true);
          expect(
            selected.every(
              (r) =>
                r.status ===
                (effect.status === "not_applicable"
                  ? "not_found"
                  : "model_recall"),
            ),
          ).toBe(true);
        }
      }
      for (const f of d.research.incomeFields) {
        expect(f.factIds).toEqual(
          profile.research.income.facts
            .filter((v) => v.kind === f.kind)
            .map((v) => v.id),
        );
        expect(f.status).toBe(f.factIds.length ? "sourced" : "no_data");
      }
      for (const roles of d.research.roleExplanations) {
        expect(roles.entries).toHaveLength(4);
        expect(
          roles.entries.every(
            (e) =>
              e.evidence.status === "sourced" &&
              e.evidence.citations.every(
                (c) => c.quote && c.url && c.sourceSha256,
              ),
          ),
        ).toBe(true);
      }
    }
  },
  90000,
);
