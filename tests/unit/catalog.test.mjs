import { test, expect, afterAll } from "@jest/globals";
import { readFileSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { catalogRuleSchema } from "../../packages/contracts/dist/index.js";
import {
  prepareCatalog,
  validateProductionCatalog,
  catalogReadiness,
  prepareCatalogV2,
} from "../../packages/catalog/dist/index.js";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import { containsPoint } from "../../packages/domain/dist/rotation/geometry.js";
const release = "data/catalog/releases/0.1.0";
const actual = await loadCatalogRelease(release);
test("explicit synthetic fixture is excluded from production import", () => {
  const fixture = JSON.parse(
    readFileSync("tests/support/fixtures/catalog.synthetic.json"),
  );
  expect(fixture.synthetic).toBe(true);
  expect(fixture.profiles.every((p) => p.synthetic)).toBe(true);
  expect(fixture.sources.every((s) => s.synthetic)).toBe(true);
  expect(() => prepareCatalog(fixture)).toThrow("CATALOG_SYNTHETIC_REJECTED");
});
const copies = [];
afterAll(async () => {
  await Promise.all(
    copies.map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function copyRelease() {
  const path = await mkdtemp(join(tmpdir(), "rotavise-catalog-unit-"));
  copies.push(path);
  await cp(release, path, { recursive: true });
  return path;
}
// Mutations below are explicit controlled corruption of real research evidence,
// used only to assert rejection. They never enter runtime catalog files.
function changed(change) {
  const value = structuredClone(actual);
  change(value);
  return value;
}
const planting = (value) =>
  value.profiles[0].knowledge.plantingWindows.rules[0];
const temperature = (value) =>
  value.profiles[0].knowledge.temperatureRequirements.rules[0];
test("actual release is three research candidates with eight traceable sources and explicit gaps", () => {
  expect(actual.profiles.map((p) => p.id)).toEqual([
    "durum-wheat",
    "faba-bean",
    "sugar-beet",
  ]);
  expect(actual.sources).toHaveLength(8);
  for (const p of actual.profiles) {
    expect(p.review.status).toBe("pending");
    expect(p.cultivar.status).toBe("unknown");
    expect(p.knowledge.duration.status).toBe("unknown");
    expect(p.knowledge.waterDemandClass.status).toBe("unknown");
    expect(catalogReadiness(actual, p.id, "beni-mellal-tadla").status).toBe(
      "insufficient_evidence",
    );
  }
});
test("committed Kew extracts bind exact bytes and taxonomy without treating HTTP 403 as evidence", () => {
  for (const source of actual.sources.filter(
    (s) => s.evidence.kind === "verified_extract",
  )) {
    const bytes = readFileSync(source.evidence.artifactPath);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      source.evidence.sha256,
    );
    expect(bytes.length).toBe(source.evidence.bytes);
    const extract = JSON.parse(bytes);
    const profile = actual.profiles.find((p) =>
      p.identity.citations.some((c) => c.sourceId === source.id),
    );
    expect(profile.identity.scientificName).toBe(
      extract.facts.acceptedScientificName,
    );
    expect(profile.identity.family).toBe(extract.facts.family);
    expect(source.evidence.captureNote).toContain("403");
  }
});
test("raw document hashes match successful retrievals, not failed requests or challenge responses", () => {
  const records = JSON.parse(
    readFileSync("docs/evidence/catalog/2026-09-27/retrievals.json"),
  );
  for (const source of actual.sources.filter(
    (s) => s.evidence.kind === "document_bytes",
  )) {
    expect(
      records.some(
        (r) =>
          r.status === 200 &&
          r.url === source.url &&
          r.sha256 === source.evidence.sha256 &&
          r.bytes === source.evidence.bytes,
      ),
    ).toBe(true);
  }
});
test("national, other-region and local rule scopes remain distinct; annual water is not seasonal mm", () => {
  const [wheat, faba, beet] = actual.profiles;
  expect(planting(actual).evidenceRegionIds).toEqual(["morocco-general"]);
  expect(faba.knowledge.plantingWindows.rules[0].evidenceRegionIds).toEqual([
    "rabat-sale-kenitra",
  ]);
  expect(beet.knowledge.plantingWindows.rules[0].evidenceRegionIds).toEqual([
    "beni-mellal-tadla",
  ]);
  expect(faba.knowledge.waterReference.rules[0]).toMatchObject({
    unit: "mm/year",
    inclusive: false,
    lowerBound: 350,
    severity: "reference",
  });
  expect(wheat.knowledge.waterReference.status).toBe("unknown");
});
test("unknown farmer crop and outside-pilot requests preserve identity and return explicit evidence gaps", () => {
  expect(catalogReadiness(actual, "farmer-chosen-crop", "any-region")).toEqual({
    cropId: "farmer-chosen-crop",
    status: "insufficient_evidence",
    gaps: [{ code: "CROP_NOT_IN_CATALOG", field: "identity" }],
  });
  const result = catalogReadiness(actual, "durum-wheat", "another-region");
  expect(result.status).toBe("insufficient_evidence");
  expect(result.gaps).toContainEqual({
    code: "NO_APPLICABLE_EVIDENCE",
    field: "applicability",
  });
});
test("readiness names measurement, cultivar, review, duration and crop-break gaps", () => {
  const result = catalogReadiness(actual, "durum-wheat", "beni-mellal-tadla");
  expect(result.gaps.map((g) => g.code)).toEqual(
    expect.arrayContaining([
      "CULTIVAR_UNSPECIFIED",
      "SPECIALIST_REVIEW_PENDING",
      "SOIL_METHOD_UNSPECIFIED",
      "MEASUREMENT_BASIS_INCOMPLETE",
      "RETURN_INTERVAL_UNESTABLISHED",
      "KNOWLEDGE_UNKNOWN",
    ]),
  );
});
test.each(["02-30", "04-31", "13-01", "00-15", "2-03"])(
  "impossible/noncanonical month-day %s is rejected",
  (date) => {
    expect(() =>
      validateProductionCatalog(
        changed((v) => {
          planting(v).start = date;
        }),
      ),
    ).toThrow("CATALOG_INVALID");
  },
);
test("leap month-day and a year-crossing recurring window remain valid calendar values", () => {
  expect(() =>
    validateProductionCatalog(
      changed((v) => {
        planting(v).start = "12-01";
        planting(v).end = "02-29";
      }),
    ),
  ).not.toThrow();
});
test.each([
  [
    "reversed numeric range",
    (v) => {
      temperature(v).min = 21;
    },
  ],
  [
    "nonfinite range",
    (v) => {
      temperature(v).max = Infinity;
    },
  ],
  [
    "wrong unit",
    (v) => {
      temperature(v).unit = "F";
    },
  ],
  [
    "unknown property",
    (v) => {
      v.profiles[0].advice = "invented";
    },
  ],
  [
    "unknown knowledge missing",
    (v) => {
      delete v.profiles[0].knowledge.duration;
    },
  ],
  [
    "duplicate source",
    (v) => {
      v.sources.push(v.sources[0]);
    },
  ],
  [
    "duplicate profile",
    (v) => {
      v.profiles.push(v.profiles[0]);
    },
  ],
  [
    "duplicate rule id",
    (v) => {
      v.profiles[0].knowledge.soilRequirements.rules[0].id = planting(v).id;
    },
  ],
  [
    "dangling citation",
    (v) => {
      planting(v).citations[0].sourceId = "missing-source";
    },
  ],
  [
    "dangling region",
    (v) => {
      planting(v).evidenceRegionIds = ["missing-region"];
    },
  ],
  [
    "wrong knowledge group",
    (v) => {
      v.profiles[0].knowledge.duration = {
        status: "sourced",
        rules: [planting(v)],
      };
    },
  ],
  [
    "context-only rule evidence",
    (v) => {
      planting(v).citations[0].interpretation = "context_only";
    },
  ],
  [
    "unreviewed hard rule",
    (v) => {
      planting(v).severity = "hard";
    },
  ],
  [
    "unsupported review claim",
    (v) => {
      planting(v).reviewStatus = "reviewed";
    },
  ],
  [
    "unreviewed local suitability",
    (v) => {
      v.profiles[0].applicability[0].status = "reviewed";
    },
  ],
  [
    "unknown production method",
    (v) => {
      planting(v).productionSystems = ["irrigated"];
    },
  ],
  [
    "malformed source URL",
    (v) => {
      v.sources[0].url = "not a URL";
    },
  ],
  [
    "credential-bearing URL",
    (v) => {
      v.sources[0].url = "https://user:password@example.invalid/evidence";
    },
  ],
  [
    "evidence traversal",
    (v) => {
      v.sources[0].evidence.artifactPath =
        "docs/evidence/catalog/../outside.json";
    },
  ],
  [
    "oversized profiles",
    (v) => {
      v.profiles = Array.from({ length: 51 }, () => v.profiles[0]);
    },
  ],
])("rejects %s", (_name, change) => {
  expect(() => validateProductionCatalog(changed(change))).toThrow(
    "CATALOG_INVALID",
  );
});
test("hard temperature/soil/calendar rules cannot use undefined averaging, soil method or approximate dates", () => {
  for (const rule of [
    temperature(actual),
    actual.profiles[0].knowledge.soilRequirements.rules[0],
    actual.profiles[2].knowledge.plantingWindows.rules[0],
  ])
    expect(
      catalogRuleSchema.safeParse({
        ...rule,
        severity: "hard",
        reviewStatus: "reviewed",
      }).success,
    ).toBe(false);
});
test("annual and seasonal water references cannot be promoted to hard or soft adequacy constraints", () => {
  for (const profile of actual.profiles.slice(1))
    for (const severity of ["hard", "soft"])
      expect(
        catalogRuleSchema.safeParse({
          ...profile.knowledge.waterReference.rules[0],
          severity,
        }).success,
      ).toBe(false);
});
test.each(["bundle", "profile", "source"])(
  "synthetic %s cannot enter a production catalog or readiness result",
  (level) => {
    const value = changed((v) => {
      if (level === "bundle") v.synthetic = true;
      else if (level === "profile") v.profiles[0].synthetic = true;
      else v.sources[0].synthetic = true;
    });
    expect(() => prepareCatalog(value)).toThrow("CATALOG_SYNTHETIC_REJECTED");
    expect(() =>
      catalogReadiness(value, "durum-wheat", "beni-mellal-tadla"),
    ).toThrow("CATALOG_SYNTHETIC_REJECTED");
  },
);
test("canonical hash survives object/identity array reordering but changes with a rule or evidence hash", () => {
  const first = prepareCatalog(actual);
  const reordered = changed((v) => {
    v.profiles.reverse();
    v.sources.reverse();
    v.regions.reverse();
  });
  const reverseKeys = (v) =>
    Array.isArray(v)
      ? v.map(reverseKeys)
      : v && typeof v === "object"
        ? Object.fromEntries(
            Object.entries(v)
              .reverse()
              .map(([k, x]) => [k, reverseKeys(x)]),
          )
        : v;
  expect(prepareCatalog(reverseKeys(reordered)).sha256).toBe(first.sha256);
  expect(
    prepareCatalog(
      changed((v) => {
        temperature(v).conditions += " revised";
      }),
    ).sha256,
  ).not.toBe(first.sha256);
  expect(
    prepareCatalog(
      changed((v) => {
        v.sources[0].evidence.sha256 = "0".repeat(64);
      }),
    ).sha256,
  ).not.toBe(first.sha256);
});
test("bounded importer rejects traversal manifests, duplicate files, oversized files and escaping symlinks", async () => {
  const directory = await copyRelease();
  const path = join(directory, "manifest.json");
  const manifest = JSON.parse(readFileSync(path));
  await writeFile(
    path,
    JSON.stringify({ ...manifest, profileFiles: ["../outside.json"] }),
  );
  await expect(loadCatalogRelease(directory)).rejects.toThrow();
  await writeFile(
    path,
    JSON.stringify({
      ...manifest,
      profileFiles: [manifest.profileFiles[0], manifest.profileFiles[0]],
    }),
  );
  await expect(loadCatalogRelease(directory)).rejects.toThrow();
  await writeFile(path, JSON.stringify(manifest));
  await writeFile(join(directory, "sources.json"), " ".repeat(1048577));
  await expect(loadCatalogRelease(directory)).rejects.toThrow(
    "CATALOG_FILE_LIMIT",
  );
  await rm(join(directory, "sources.json"));
  await symlink(
    join(process.cwd(), release, "sources.json"),
    join(directory, "sources.json"),
  );
  await expect(loadCatalogRelease(directory)).rejects.toThrow(
    "CATALOG_PATH_INVALID",
  );
});

// Release 0.3.0: real sourced rules. These checks need no local research
// snapshots: they test the committed files and their recorded quote check.
const v3Path = "data/catalog/releases/0.3.0";
const v3 = await loadCatalogRelease(v3Path);
const v3Json = (file) => JSON.parse(readFileSync(`${v3Path}/${file}`, "utf8"));
const quoteCheck = v3Json("quote-check.json");
function quotedCitations() {
  const manifest = v3Json("manifest.json");
  const out = [];
  const add = (citations, where) =>
    citations.forEach((c, i) => {
      if (c.quote !== undefined) out.push({ where: `${where}:${i}`, c });
    });
  for (const r of manifest.regions) add(r.citations, `region:${r.id}`);
  for (const i of manifest.issues) add(i.citations, `issue:${i.id}`);
  for (const file of manifest.profileFiles) {
    const p = v3Json(file);
    add(p.identity.citations, `${p.id}:identity`);
    for (const r of p.rules) add(r.citations, `${p.id}:${r.id}`);
    for (const c of p.cultivars) add(c.citations, `${p.id}:${c.id}`);
  }
  return out;
}
test("release 0.3.0 passes production validation with real, non-synthetic sources", () => {
  expect(v3.synthetic).toBe(false);
  expect(v3.version).toBe("0.3.0");
  expect(v3.profiles).toHaveLength(10);
  expect(v3.sources.every((s) => s.synthetic === false)).toBe(true);
  expect(v3.profiles.every((p) => p.synthetic === false)).toBe(true);
});
test("every quoted citation in release 0.3.0 was matched on its cited page by the recorded quote check", () => {
  const quoted = quotedCitations();
  expect(quoteCheck.citations).toBe(quoted.length);
  expect(quoteCheck.matched).toBe(quoted.length);
  expect(quoteCheck.checks.every((c) => c.matched)).toBe(true);
  expect(
    quoteCheck.checks.map((c) => [c.where, c.sourceId, c.page, c.quoteSha256]),
  ).toEqual(
    quoted.map(({ where, c }) => [
      where,
      c.sourceId,
      c.page,
      createHash("sha256").update(c.quote).digest("hex"),
    ]),
  );
});
test("every binding 0.3.0 rule is double-checked by quote match and cites a page and quote", () => {
  const binding = v3.profiles.flatMap((p) =>
    p.rules.filter((r) => r.severity !== "reference"),
  );
  expect(binding.length).toBeGreaterThan(25);
  for (const rule of binding) {
    expect(rule.verification).toMatchObject({
      status: "double_checked",
      method: "quote_match_and_second_reading",
    });
    expect(
      rule.citations.some((c) => c.quote !== undefined && c.page !== undefined),
    ).toBe(true);
  }
  // Reference-only crops stay extracted and never bind.
  for (const id of ["lentil", "chickpea"])
    expect(
      v3.profiles
        .find((p) => p.id === id)
        .rules.every(
          (r) =>
            r.severity === "reference" && r.verification.status === "extracted",
        ),
    ).toBe(true);
});
test("release 0.3.0 regions resolve Tadla, the rest of Morocco and nowhere else", () => {
  const regions = (lon, lat) =>
    v3.regions
      .filter((r) => r.boundary && containsPoint(r.boundary.geometry, lon, lat))
      .map((r) => r.id);
  expect(regions(-6.3498, 32.3373)).toEqual([
    "beni-mellal-tadla",
    "morocco-general",
  ]);
  expect(regions(-6.571, 31.961)).toEqual([
    "beni-mellal-tadla",
    "morocco-general",
  ]);
  expect(regions(-7.59, 33.57)).toEqual(["morocco-general"]);
  expect(regions(-3.7, 40.42)).toEqual([]);
  expect(regions(-11, 32)).toEqual([]);
  expect(regions(-6.906, 32.881)).toEqual(["morocco-general"]);
});
test("committed GBIF taxonomy responses match their recorded hashes", () => {
  for (const s of v3.sources.filter((x) => x.evidence.artifactPath)) {
    const bytes = readFileSync(s.evidence.artifactPath);
    expect(bytes.byteLength).toBe(s.evidence.bytes);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      s.evidence.sha256,
    );
  }
});

// Release 0.4.0: the same facts, usable across Morocco.
const v4 = await loadCatalogRelease("data/catalog/releases/0.4.0");
const v4Regions = (lon, lat) =>
  v4.regions
    .filter((r) => containsPoint(r.boundary.geometry, lon, lat))
    .map((r) => r.id)
    .sort();
test("release 0.4.0 resolves every Moroccan region and nothing abroad", () => {
  expect(v4.regions.filter((r) => r.id.startsWith("ma-"))).toHaveLength(12);
  for (const [lon, lat, region] of [
    [-5.55, 33.89, "ma-fez-meknes"],
    [-7.62, 33.0, "ma-casablanca-settat"],
    [-6.58, 34.26, "ma-rabat-sale-kenitra"],
    [-5.81, 35.76, "ma-tangier-tetouan-al-hoceima"],
    [-2.93, 35.17, "ma-oriental"],
    [-8.0, 31.63, "ma-marrakech-safi"],
    [-9.5, 30.45, "ma-souss-massa"],
    [-4.42, 31.93, "ma-draa-tafilalet"],
    [-10.06, 28.99, "ma-guelmim-oued-noun"],
    [-13.2, 27.15, "ma-laayoune-sakia-el-hamra"],
    [-15.935, 23.7, "ma-dakhla-oued-ed-dahab"],
    [-6.35, 32.34, "ma-beni-mellal-khenifra"],
  ]) {
    expect(v4Regions(lon, lat)).toContain(region);
    expect(v4Regions(lon, lat)).toContain("morocco-general");
  }
  expect(v4Regions(-3.7, 40.42)).toEqual([]);
  expect(v4Regions(3.05, 36.75)).toEqual([]);
});
test("release 0.4.0 extends national crops only and keeps the facts of 0.3.0", () => {
  const applies = (p) => p.applicability.map((a) => a.regionId);
  const national = v4.profiles
    .filter((p) => applies(p).includes("morocco-general"))
    .map((p) => p.id)
    .sort();
  expect(national).toEqual([
    "barley",
    "bread-wheat",
    "chickpea",
    "durum-wheat",
    "faba-bean",
    "lentil",
  ]);
  const beet = v4.profiles.find((p) => p.id === "sugar-beet");
  expect(applies(beet)).toEqual(["beni-mellal-tadla"]);
  for (const profile of v4.profiles)
    expect(profile.rules).toEqual(
      v3.profiles.find((p) => p.id === profile.id).rules,
    );
  const check = JSON.parse(
    readFileSync("data/catalog/releases/0.4.0/quote-check.json", "utf8"),
  );
  expect(check.matched).toBe(check.citations);
  expect(check.checks.some((c) => c.where.includes(":applicability:"))).toBe(
    true,
  );
});

// Release 0.7.0: more Moroccan crops, each rule still quote-checked.
const v7 = await loadCatalogRelease("data/catalog/releases/0.7.0");
test("release 0.7.0 adds five crops with a complete comparable profile", () => {
  for (const id of ["sunflower", "rapeseed", "potato", "onion", "tomato"]) {
    const metrics = new Set(
      v7.profiles
        .find((p) => p.id === id)
        .rules.filter((r) => r.severity !== "reference")
        .map((r) => r.metric),
    );
    for (const m of [
      "planting_window",
      "cycle_duration",
      "temperature",
      "crop_water_coefficient",
    ])
      expect(metrics.has(m)).toBe(true);
  }
  const check = JSON.parse(
    readFileSync("data/catalog/releases/0.7.0/quote-check.json", "utf8"),
  );
  expect(check.matched).toBe(check.citations);
});
test("sugar beet has sourced sowing in four regions and a rule's scope is its source's", () => {
  const beet = v7.profiles.find((p) => p.id === "sugar-beet");
  expect(beet.applicability.map((a) => a.regionId).sort()).toEqual([
    "beni-mellal-tadla",
    "ma-casablanca-settat",
    "ma-oriental",
    "ma-rabat-sale-kenitra",
  ]);
  const sunflower = v7.profiles.find((p) => p.id === "sunflower");
  expect(sunflower.applicability.map((a) => a.regionId)).toEqual([
    "ma-rabat-sale-kenitra",
  ]);
});

// Release 0.10.0 holds every crop's knowledge, with its provenance on each item.
const wide = await loadCatalogRelease("data/catalog/releases/0.10.0");
const wideQuotes = JSON.parse(
  readFileSync("data/catalog/releases/0.10.0/quote-check.json"),
);
const usable = (r) =>
  r.severity !== "reference" && r.verification.status !== "extracted";
const evaluable = (r) =>
  usable(r) &&
  r.metric === "temperature" &&
  r.medium === "air" &&
  (r.stage === "whole_cycle" || r.stageWindow !== null);
test("catalog 0.10.0 holds every crop, variety and problem with provenance", () => {
  expect(wide.version).toBe("0.10.0");
  expect(wide.profiles.length).toBeGreaterThanOrEqual(200);
  const ids = wide.profiles.map((p) => p.id);
  for (const id of ["strawberry", "cumin", "date-palm", "oat", "durum-wheat"])
    expect(ids).toContain(id);
  expect(wide.issues.length).toBeGreaterThanOrEqual(350);
  expect(
    wide.profiles.reduce((n, p) => n + p.cultivars.length, 0),
  ).toBeGreaterThan(500);
  for (const issue of wide.issues) {
    expect(issue.hostCropIds.every((id) => ids.includes(id))).toBe(true);
    // Problems carry names and symptoms only, never treatments.
    expect(
      `${issue.name} ${issue.visibleSymptoms ?? ""}`.match(
        /pesticid|fungicid|insecticid|herbicid|dose|spray|treatment/i,
      ),
    ).toBeNull();
  }
});
test("recalled knowledge is labelled and sourced knowledge keeps its quote check", () => {
  const checked = new Set(wideQuotes.checks.map((c) => c.where));
  let recalled = 0;
  for (const p of wide.profiles)
    for (const r of p.rules) {
      if (r.verification.status === "model_recall") {
        recalled++;
        expect(r.citations.every((c) => c.quote === undefined)).toBe(true);
        expect(r.verification.valueKind).toBe("model_recall_unverified");
        expect(["low", "medium", "high"]).toContain(r.verification.confidence);
      }
      if (r.verification.method === "quote_match_and_second_reading")
        expect([...checked].some((w) => w.startsWith(`${p.id}:${r.id}:`))).toBe(
          true,
        );
    }
  expect(recalled).toBeGreaterThan(500);
  expect(wideQuotes.matched).toBe(wideQuotes.citations);
});
test("every schedulable crop has what fair ranking and scheduling need", () => {
  const plannable = wide.profiles.filter(
    (p) => p.modelType === "annual" || p.modelType === "multi_year_stand",
  );
  expect(plannable.length).toBeGreaterThanOrEqual(140);
  for (const p of plannable) {
    const has = (m) => p.rules.some((r) => usable(r) && r.metric === m);
    expect([p.id, has("planting_window")]).toEqual([p.id, true]);
    expect([p.id, has("cycle_duration")]).toEqual([p.id, true]);
    const heat = p.rules.some(
      (r) =>
        evaluable(r) &&
        r.basis === "daily_maximum" &&
        r.upperDegC !== null &&
        r.lowerDegC === null,
    );
    const cold = p.rules.some(
      (r) =>
        evaluable(r) &&
        r.basis === "daily_minimum" &&
        r.lowerDegC !== null &&
        r.upperDegC === null,
    );
    expect([p.id, heat, cold]).toEqual([p.id, true, true]);
  }
  for (const p of wide.profiles.filter(
    (x) => x.modelType === "orchard" || x.modelType === "wild_harvested",
  ))
    expect(
      p.rules.some(
        (r) => r.metric === "planting_window" || r.metric === "cycle_duration",
      ),
    ).toBe(false);
});

// Release 0.11.0 only adds to 0.10.0: regions, water curves, soil limits,
// benefit classes, further crops, cultivars and problems, all recalled items
// carrying their provenance.
const wider = await loadCatalogRelease("data/catalog/releases/0.11.0");
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
test("catalog 0.11.0 removes nothing from 0.10.0 and adds crops, varieties and problems", () => {
  expect(wider.version).toBe("0.11.0");
  const widerIds = new Map(wider.profiles.map((p) => [p.id, p]));
  for (const old of wide.profiles) {
    const now = widerIds.get(old.id);
    expect(now).toBeDefined();
    for (const key of ["cultivars", "rules", "references", "applicability"])
      for (const item of old[key] ?? [])
        expect([
          old.id,
          key,
          (now[key] ?? []).some((x) => same(x, item)),
        ]).toEqual([old.id, key, true]);
  }
  for (const issue of wide.issues)
    expect(wider.issues.some((x) => same(x, issue))).toBe(true);
  expect(wider.profiles.length).toBeGreaterThanOrEqual(
    wide.profiles.length + 30,
  );
  expect(
    wider.profiles.reduce((n, p) => n + p.cultivars.length, 0),
  ).toBeGreaterThan(1200);
  expect(wider.issues.length).toBeGreaterThanOrEqual(wide.issues.length + 150);
  for (const issue of wider.issues) {
    expect(issue.hostCropIds.every((id) => widerIds.has(id))).toBe(true);
    expect(
      `${issue.name} ${issue.visibleSymptoms ?? ""}`.match(
        /pesticid|fungicid|insecticid|herbicid|dose|spray|treatment/i,
      ),
    ).toBeNull();
  }
});
test("catalog 0.11.0 gives every crop benefit classes, regions and, where schedulable, water and soil data", () => {
  const regionIds = new Set(wider.regions.map((r) => r.id));
  const topics = [
    "nitrogen_fixation",
    "rooting_depth",
    "organic_matter_contribution",
    "erosion_protection",
    "forage_value",
  ];
  let regional = 0;
  for (const p of wider.profiles) {
    for (const t of topics)
      expect([p.id, t, p.references.some((r) => r.topic === t)]).toEqual([
        p.id,
        t,
        true,
      ]);
    for (const a of p.applicability) {
      expect(regionIds.has(a.regionId)).toBe(true);
      if (a.regionId !== "morocco-general") regional++;
    }
    expect(p.applicability.length).toBeLessThanOrEqual(12);
  }
  expect(regional).toBeGreaterThan(600);
  const plannable = wider.profiles.filter(
    (p) => p.modelType === "annual" || p.modelType === "multi_year_stand",
  );
  for (const p of plannable) {
    const has = (m) => p.rules.some((r) => usable(r) && r.metric === m);
    expect([p.id, has("water_demand_class")]).toEqual([p.id, true]);
  }
  const annualsWithCurve = wider.profiles.filter(
    (p) =>
      p.modelType === "annual" &&
      p.rules.some((r) => r.metric === "crop_water_coefficient"),
  ).length;
  expect(annualsWithCurve).toBeGreaterThan(100);
  for (const p of wider.profiles)
    for (const r of p.rules)
      if (r.metric === "crop_water_coefficient") {
        expect(r.kcMid).toBeGreaterThanOrEqual(0.3);
        expect(r.kcMid).toBeLessThanOrEqual(1.5);
      }
});
test("every schedulable crop in catalog 0.11.0 still has what fair ranking and scheduling need", () => {
  const plannable = wider.profiles.filter(
    (p) => p.modelType === "annual" || p.modelType === "multi_year_stand",
  );
  expect(plannable.length).toBeGreaterThanOrEqual(wide.profiles.length - 100);
  for (const p of plannable) {
    const has = (m) => p.rules.some((r) => usable(r) && r.metric === m);
    expect([p.id, has("planting_window"), has("cycle_duration")]).toEqual([
      p.id,
      true,
      true,
    ]);
    const heat = p.rules.some(
      (r) =>
        evaluable(r) &&
        r.basis === "daily_maximum" &&
        r.upperDegC !== null &&
        r.lowerDegC === null,
    );
    const cold = p.rules.some(
      (r) =>
        evaluable(r) &&
        r.basis === "daily_minimum" &&
        r.lowerDegC !== null &&
        r.upperDegC === null,
    );
    expect([p.id, heat, cold]).toEqual([p.id, true, true]);
  }
});

// Release 0.12.0 only adds names: French, Modern Standard Arabic and Moroccan
// Arabic (Darija) for crops, and names for varieties that have a real one.
const named = await loadCatalogRelease("data/catalog/releases/0.12.0");
const arabicScript = /[؀-ۿ]/;
const withoutNames = (profile) => {
  const copy = structuredClone(profile);
  copy.version = "";
  delete copy.identity.localNames;
  for (const cultivar of copy.cultivars) delete cultivar.localNames;
  return JSON.stringify(copy);
};
test("catalog 0.12.0 removes nothing from 0.11.0 and changes only the name fields", () => {
  expect(named.version).toBe("0.12.0");
  expect(named.profiles.length).toBe(wider.profiles.length);
  const namedIds = new Map(named.profiles.map((p) => [p.id, p]));
  for (const old of wider.profiles) {
    const now = namedIds.get(old.id);
    expect(now).toBeDefined();
    expect([old.id, withoutNames(now) === withoutNames(old)]).toEqual([
      old.id,
      true,
    ]);
    // Every earlier name is still there, unchanged and in its place.
    old.identity.localNames.forEach((n, i) =>
      expect(same(now.identity.localNames[i], n)).toBe(true),
    );
    // Earlier releases never had names on varieties.
    for (const cultivar of old.cultivars)
      expect(cultivar.localNames).toBeUndefined();
  }
  expect(named.issues).toEqual(wider.issues);
  expect(named.regions).toEqual(wider.regions);
  expect(named.sources).toEqual(wider.sources);
});
test("catalog 0.12.0 names every crop in French and Arabic and most in Darija", () => {
  const has = (p, language) =>
    p.identity.localNames.some((n) => n.language === language);
  expect(named.profiles.filter((p) => !has(p, "fr")).map((p) => p.id)).toEqual(
    [],
  );
  expect(named.profiles.filter((p) => !has(p, "ar")).map((p) => p.id)).toEqual(
    [],
  );
  expect(named.profiles.filter((p) => has(p, "ary")).length).toBeGreaterThan(
    150,
  );
  expect(
    named.profiles.filter((p) => p.cultivars.some((c) => c.localNames?.length))
      .length,
  ).toBeGreaterThan(30);
  expect(
    named.profiles.reduce(
      (n, p) => n + p.cultivars.filter((c) => c.localNames?.length).length,
      0,
    ),
  ).toBeGreaterThan(120);
});
test("catalog 0.12.0 names are recalled, carry their own confidence and are written correctly", () => {
  const allNames = [];
  for (const p of named.profiles) {
    const languages = p.identity.localNames.map((n) => n.language);
    expect([p.id, new Set(languages).size]).toEqual([p.id, languages.length]);
    for (const n of p.identity.localNames) allNames.push([p.id, n]);
    for (const c of p.cultivars) {
      const cultivarLanguages = (c.localNames ?? []).map((n) => n.language);
      expect([c.id, new Set(cultivarLanguages).size]).toEqual([
        c.id,
        cultivarLanguages.length,
      ]);
      for (const n of c.localNames ?? []) allNames.push([c.id, n]);
    }
  }
  const added = allNames.filter(([, n]) => n.recall);
  expect(added.length).toBeGreaterThan(350);
  for (const [id, n] of added) {
    expect([id, n.recall.valueKind, n.recall.recordedOn]).toEqual([
      id,
      "model_recall_unverified",
      "2026-11-09",
    ]);
    expect(["low", "medium", "high"]).toContain(n.recall.confidence);
    if (n.language === "ar" || n.language === "ary")
      expect([id, arabicScript.test(n.name)]).toEqual([id, true]);
    if (n.language === "fr" || n.language === "en")
      expect([id, arabicScript.test(n.name)]).toEqual([id, false]);
    // A Darija name always asks for a native speaker's review.
    if (n.language === "ary") expect(n.recall.basis).toMatch(/native speaker/);
  }
  // Names stay separate from the ranking: no rule was added or changed.
  expect(named.profiles.reduce((n, p) => n + p.rules.length, 0)).toBe(
    wider.profiles.reduce((n, p) => n + p.rules.length, 0),
  );
});

// Release 0.13.0 adds sourced names; neither the original recall nor any
// agronomic value is edited. These checks use committed evidence, offline.
const sourcedNames = await loadCatalogRelease("data/catalog/releases/0.13.0");
const darijaEvidence = "docs/evidence/catalog/2026-11-09/codex";
const researchCrops = Array.from({ length: 10 }, (_, i) =>
  JSON.parse(
    readFileSync(
      `${darijaEvidence}/darija-batch-${String(i + 1).padStart(2, "0")}.json`,
      "utf8",
    ),
  ),
).flat();
const sourcedCrops = new Map(sourcedNames.profiles.map((p) => [p.id, p]));
const sourcedNameEntries = sourcedNames.profiles
  .flatMap((p) => [
    ...p.identity.localNames.map((n, i) => ({
      n,
      where: `${p.id}:identity:localName:${i}`,
    })),
    ...p.cultivars.flatMap((c) =>
      (c.localNames ?? []).map((n, i) => ({
        n,
        where: `${p.id}:cultivar:${c.id}:localName:${i}`,
      })),
    ),
  ])
  .filter(({ n }) => n.citations);
const hasSourcedDarija = (p) =>
  p.identity.localNames.some((n) => n.language === "ary" && n.citations);
test("catalog 0.13.0 removes nothing from 0.12.0 and changes only name lists and adds sources", () => {
  expect(sourcedNames.version).toBe("0.13.0");
  expect(sourcedNames.profiles).toHaveLength(named.profiles.length);
  for (const old of named.profiles) {
    const now = sourcedCrops.get(old.id);
    expect(now).toBeDefined();
    expect([old.id, withoutNames(now)]).toEqual([old.id, withoutNames(old)]);
    expect(
      now.identity.localNames.slice(0, old.identity.localNames.length),
    ).toEqual(old.identity.localNames);
    old.cultivars.forEach((c, i) => {
      expect(
        (now.cultivars[i].localNames ?? []).slice(0, c.localNames?.length ?? 0),
      ).toEqual(c.localNames ?? []);
    });
  }
  expect(sourcedNames.sources.slice(0, named.sources.length)).toEqual(
    named.sources,
  );
  expect({
    ...sourcedNames,
    version: named.version,
    sources: named.sources,
    profiles: named.profiles,
  }).toEqual(named);
  // Optional fields have no parse defaults: historical hashes stay unchanged.
  expect(prepareCatalogV2(named).sha256).toBe(
    "6c3df38643235a563c7b04470ce364bcbacd30127e0285749fb2fe0699ee5f9a",
  );
  expect(prepareCatalogV2(wider).sha256).toBe(
    "c5536dce6061c227ec1af2fe28fa861cbca965dbb9bd45b06163115cd290b8b3",
  );
});
test("catalog 0.13.0 has 157 crops with sourced Darija, 21 with recall only and 68 without", () => {
  expect(sourcedNames.profiles.filter(hasSourcedDarija)).toHaveLength(157);
  expect(
    sourcedNames.profiles.filter(
      (p) =>
        !hasSourcedDarija(p) &&
        p.identity.localNames.some((n) => n.language === "ary"),
    ),
  ).toHaveLength(21);
  expect(
    sourcedNames.profiles.filter(
      (p) => !p.identity.localNames.some((n) => n.language === "ary"),
    ),
  ).toHaveLength(68);
  expect(
    sourcedNames.profiles
      .flatMap((p) => p.identity.localNames)
      .filter((n) => n.citations),
  ).toHaveLength(258);
  expect(sourcedNameEntries).toHaveLength(261); // plus three cultivar names
  expect(sourcedNames.sources.length - named.sources.length).toBe(170);
  for (const p of sourcedNames.profiles.filter(hasSourcedDarija)) {
    const preferred = p.identity.localNames.filter(
      (n) => n.language === "ary" && n.preferred,
    );
    expect([p.id, preferred.length]).toEqual([p.id, 1]);
    expect(preferred[0].citations.length).toBeGreaterThan(0);
  }
  const carrot = sourcedCrops.get("carrot").identity.localNames;
  expect(carrot).toContainEqual(
    expect.objectContaining({ name: "الخيزو", recall: expect.any(Object) }),
  );
  expect(carrot).toContainEqual(
    expect.objectContaining({
      name: "زرودية",
      preferred: true,
      citations: expect.any(Array),
    }),
  );
});
test("catalog 0.13.0 leaves the 88 research gaps and every flagged identity unchanged", () => {
  const gaps = researchCrops.filter(
    (r) => !r.ary.some((n) => n.status === "confirmed" && n.quote),
  );
  expect(gaps).toHaveLength(88);
  for (const r of [
    ...gaps,
    researchCrops.find((r) => r.cropId === "lambs-lettuce"),
  ]) {
    const old = named.profiles.find((p) => p.id === r.cropId);
    expect({ ...sourcedCrops.get(r.cropId), version: old.version }).toEqual(
      old,
    );
  }
  const derbana = (catalog) =>
    catalog.profiles
      .find((p) => p.id === "prickly-pear")
      .cultivars.find((c) => c.id === "derbana");
  expect(derbana(sourcedNames)).toEqual(derbana(named));
});
test("every new name citation passes the recorded and reproducible extract quote check", () => {
  const quoteAudit = JSON.parse(
    readFileSync("data/catalog/releases/0.13.0/quote-check.json", "utf8"),
  );
  const oldAudit = JSON.parse(
    readFileSync("data/catalog/releases/0.12.0/quote-check.json", "utf8"),
  );
  expect(quoteAudit.checks.slice(0, oldAudit.checks.length)).toEqual(
    oldAudit.checks,
  );
  const newChecks = quoteAudit.checks.slice(oldAudit.checks.length);
  expect(newChecks).toHaveLength(273);
  expect(quoteAudit.matched).toBe(quoteAudit.citations);
  expect(quoteAudit.citations).toBe(quoteAudit.checks.length);
  const extractPath = `${darijaEvidence}/darija-0.13.0-quote-extracts.json`;
  const extractBytes = readFileSync(extractPath);
  const extractSha = createHash("sha256").update(extractBytes).digest("hex");
  const extracts = JSON.parse(extractBytes).extracts;
  const researchSources = JSON.parse(
    readFileSync(`${darijaEvidence}/darija-sources.json`, "utf8"),
  );
  const researchAudit = JSON.parse(
    readFileSync(`${darijaEvidence}/darija-verification.json`, "utf8"),
  );
  const squash = (s) => s.normalize("NFC").toLowerCase().replace(/\s+/g, "");
  let count = 0;
  for (const { n, where } of sourcedNameEntries) {
    expect(n.language).toBe("ary");
    expect(n.recall).toBeUndefined();
    expect(n.confidence).toBe("low");
    n.citations.forEach((citation, i) => {
      count++;
      const check = newChecks.find((c) => c.where === `${where}:${i}`);
      const extract = extracts.find((e) => e.where === check.where);
      const research = researchAudit.quoteChecks.find(
        (e) => e.where === extract.researchWhere,
      );
      const crop = researchCrops.find(
        (r) => r.cropId === extract.researchWhere.split(".")[0],
      );
      const record = extract.researchWhere.includes(".cultivars.")
        ? crop.cultivars.find(
            (c) => c.cultivarId === extract.researchWhere.split(".")[2],
          ).ary[Number(extract.researchWhere.split(".").at(-1))]
        : crop.ary[Number(extract.researchWhere.split(".").at(-1))];
      expect([record.status, record.name, record.quote]).toEqual([
        "confirmed",
        n.name,
        citation.quote,
      ]);
      expect(check).toMatchObject({
        sourceId: citation.sourceId,
        page: citation.page,
        matched: true,
        quoteSha256: createHash("sha256").update(citation.quote).digest("hex"),
        extractPath,
        extractSha256: extractSha,
      });
      expect(squash(extract.text).includes(squash(citation.quote))).toBe(true);
      expect(research).toMatchObject({
        present: true,
        quote: citation.quote,
        method: extract.researchMethod,
      });
      const originalSource = researchSources.find(
        (s) => s.id === research.sourceId,
      );
      const source = sourcedNames.sources.find(
        (s) => s.id === citation.sourceId,
      );
      expect(source.evidence.sha256).toBe(originalSource.sha256);
      expect(check.sourceSha256).toBe(originalSource.sha256);
      expect(extract.sourceSha256).toBe(originalSource.sha256);
      expect(source.url).toBe(originalSource.url);
      expect(source.title).toBe(originalSource.title);
      expect(source.accessedAt).toBe(
        new Date(originalSource.retrievedOn).toISOString(),
      );
      expect(source.rights.licence).toBe(originalSource.licence);
      expect(source.evidence.artifactPath).toBeNull();
    });
  }
  expect(count).toBe(newChecks.length);
  expect(
    extracts.filter((e) => e.method === "literal_source_text"),
  ).toHaveLength(226);
  expect(
    extracts.filter((e) => e.method === "research_visual_transcription"),
  ).toHaveLength(47);
});
test("sourced names reject missing sources, missing confidence and invalid preferences", () => {
  const corrupt = (change) => {
    const copy = structuredClone(sourcedNames);
    change(copy.profiles.find((p) => p.id === "carrot").identity.localNames);
    return () => prepareCatalogV2(copy);
  };
  expect(
    corrupt((names) => {
      names.find((n) => n.citations).citations[0].sourceId = "unknown-source";
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    corrupt((names) => {
      delete names.find((n) => n.citations).confidence;
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    corrupt((names) => {
      names.find((n) => n.citations).citations[0].quote = "";
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    corrupt((names) => {
      names.find((n) => n.recall && n.language === "ary").preferred = true;
    }),
  ).toThrow("CATALOG_INVALID");
  expect(
    corrupt((names) => {
      names
        .filter((n) => n.citations)
        .forEach((n) => {
          n.preferred = true;
        });
    }),
  ).toThrow("CATALOG_INVALID");
});
