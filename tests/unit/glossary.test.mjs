import { describe, test, expect } from "@jest/globals";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  constraintCodes,
  rotationReasonCodes,
  historicalReasonCodes,
  futureClimateReasons,
  nearTermReasons,
  glossaryGroups,
  glossaryLanguages,
  glossaryResponseSchema,
  candidateStatusSchema,
  benefitEffectCategories,
} from "../../packages/contracts/dist/index.js";
import {
  GLOSSARY,
  GLOSSARY_VERSION,
  glossaryFor,
  VEGETATION_GLOSSARY,
  VEGETATION_HISTORY_GLOSSARY,
} from "../../packages/domain/dist/index.js";

const codesIn = (group) =>
  new Set(GLOSSARY.filter((e) => e.group === group).map((e) => e.code));
const anyCode = new Set(GLOSSARY.map((e) => e.code));
const walk = (dir, files = []) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (name !== "glossary") walk(path, files);
    } else if (path.endsWith(".ts")) files.push(path);
  }
  return files;
};
const missing = (codes, group) =>
  [...new Set(codes)].filter((code) => !codesIn(group).has(code));

describe("glossary structure", () => {
  test("Darija is added alongside all existing languages for every code", () => {
    expect(glossaryLanguages).toEqual(["en", "fr", "ar", "ary"]);
    const darija = glossaryResponseSchema.parse(glossaryFor("ary"));
    expect(darija.languages).toEqual(["en", "fr", "ar", "ary"]);
    expect(darija.entries.map((e) => [e.group, e.code])).toEqual(
      GLOSSARY.map((e) => [e.group, e.code]),
    );
    for (const e of GLOSSARY) {
      expect(e.term.ary.trim().length).toBeGreaterThan(0);
      expect(e.meaning.ary.trim().length).toBeGreaterThan(0);
      expect([e.code, /[؀-ۿ]/.test(e.meaning.ary)]).toEqual([e.code, true]);
    }
  });
  test.each(["ar", "ary"])(
    "%s reads right to left and discloses machine translation",
    (lang) => {
      const doc = glossaryFor(lang);
      expect(doc.direction).toBe("rtl");
      expect(doc.provenance.text).toBe("model_translated_unreviewed");
      expect(doc.provenance.note.trim().length).toBeGreaterThan(0);
      expect(/[؀-ۿ]/.test(doc.provenance.note)).toBe(true);
    },
  );
  test("each group and code appears once", () => {
    const keys = GLOSSARY.map((e) => `${e.group}/${e.code}`);
    expect(keys.filter((k, i) => keys.indexOf(k) !== i)).toEqual([]);
    expect(new Set(GLOSSARY.map((e) => e.group))).toEqual(
      new Set(glossaryGroups),
    );
  });
  test("every entry has a term and a meaning in every language", () => {
    for (const e of GLOSSARY)
      for (const lang of glossaryLanguages) {
        expect([e.code, lang, typeof e.term[lang]]).toEqual([
          e.code,
          lang,
          "string",
        ]);
        expect(e.term[lang].trim().length).toBeGreaterThan(0);
        expect(e.meaning[lang].trim().length).toBeGreaterThan(20);
      }
  });
  test("Arabic text is Arabic and French text is not a copy of the English", () => {
    for (const e of GLOSSARY) {
      expect([e.code, /[؀-ۿ]/.test(e.meaning.ar)]).toEqual([e.code, true]);
      expect([e.code, /[؀-ۿ]/.test(e.meaning.fr)]).toEqual([e.code, false]);
      expect([e.code, e.meaning.fr === e.meaning.en]).toEqual([e.code, false]);
    }
  });
  test("each language parses against the response contract and says who wrote it", () => {
    for (const lang of glossaryLanguages) {
      const doc = glossaryResponseSchema.parse(glossaryFor(lang));
      expect(doc.version).toBe(GLOSSARY_VERSION);
      expect(doc.direction).toBe(["ar", "ary"].includes(lang) ? "rtl" : "ltr");
      expect(doc.provenance.text).toBe(
        lang === "en"
          ? "model_written_unreviewed"
          : "model_translated_unreviewed",
      );
      expect(doc.entries).toHaveLength(GLOSSARY.length);
    }
    const only = glossaryFor("fr", "error");
    expect(only.groups).toEqual(["error"]);
    expect(only.entries.every((e) => e.group === "error")).toBe(true);
  });
});

describe("the glossary covers everything the engine and API can return", () => {
  test("every benefit effect, role and not-applicable code has all four languages", () => {
    expect(missing(benefitEffectCategories, "effect")).toEqual([]);
    expect(
      missing(
        ["nitrogen_fixing", "cover", "deep_rooting", "drought_tolerant"],
        "role",
      ),
    ).toEqual([]);
    expect(missing(["not_applicable"], "status")).toEqual([]);
  });
  test("sourced research codes and derived or conditional statuses have every translation", () => {
    expect(
      missing(
        [
          "HISTORICAL_GROSS_REVENUE",
          "NO_INCOME_DATA",
          "INCOME_SUPPORTED_PEERS_ONLY",
        ],
        "reason_code",
      ),
    ).toEqual([]);
    expect(missing(["derived", "conditional_context"], "status")).toEqual([]);
  });
  test("every constraint, rotation and climate reason code", () => {
    expect(missing(constraintCodes, "reason_code")).toEqual([]);
    expect(missing(rotationReasonCodes, "reason_code")).toEqual([]);
    expect(missing(historicalReasonCodes, "reason_code")).toEqual([]);
    expect(missing(futureClimateReasons, "reason_code")).toEqual([]);
    expect(missing(nearTermReasons, "reason_code")).toEqual([]);
  });
  test("every effect, status and rule strength", () => {
    expect(
      missing(
        ["pass", "condition", "failure", "gap", "deferred", "info"],
        "effect",
      ),
    ).toEqual([]);
    expect(missing(candidateStatusSchema.options, "status")).toEqual([]);
    expect(
      missing(
        [
          "comparisons_available",
          "no_feasible_rotation",
          "schedulable",
          "not_in_catalog",
          "unsupported_for_plan",
          "rejected",
          "queued",
          "running",
          "submitted",
          "completed",
          "failed",
          "complete",
          "baseline_unavailable",
          "insufficient_alternatives",
          "scored",
          "not_provided",
          "not_evaluable",
          "farmer_declared",
          "inferred_from_history",
          "engine_ranked",
          "current",
          "alternative",
          "reviewed",
          "pending",
          "available",
        ],
        "status",
      ),
    ).toEqual([]);
    expect(
      missing(
        [
          "extracted",
          "double_checked",
          "expert_reviewed",
          "model_recall",
          "sourced",
          "engineering_judgment",
          "reference",
          "soft",
          "hard",
        ],
        "evidence",
      ),
    ).toEqual([]);
  });
  test("every plan status and stage", () => {
    const found = new Set();
    for (const path of [
      "packages/contracts/src/plans/plan.contract.ts",
      "packages/contracts/src/plans/planning.contract.ts",
      "packages/contracts/src/plans/planning-v2.contract.ts",
    ])
      for (const block of readFileSync(path, "utf8").matchAll(
        /(?:status|stage): z\.enum\(\[([^\]]*)\]/g,
      ))
        for (const value of block[1].matchAll(/"([a-z_]+)"/g))
          found.add(value[1]);
    expect(found.size).toBeGreaterThan(8);
    expect(missing(found, "status")).toEqual([]);
  });
  test("every strategy note and baseline note code in the engine", () => {
    const found = new Set();
    for (const path of walk("packages/domain/src/rotation"))
      for (const match of readFileSync(path, "utf8").matchAll(
        /"((?:WHY|EVIDENCE|BENEFIT|GAP|RISK|REMINDER|PRIORITIES|BASELINE)_[A-Z0-9_]+)"/g,
      ))
        found.add(match[1]);
    expect(found.size).toBeGreaterThan(30);
    expect(missing(found, "strategy_note")).toEqual([]);
  });
  test("every code the domain package can put in a result", () => {
    // Everything uppercase that is not the argument of a thrown error. Thrown
    // errors are programming or input faults caught by the server, never part
    // of a result.
    const results = new Set();
    for (const path of walk("packages/domain/src")) {
      const source = readFileSync(path, "utf8").replace(
        /\w*Error\(\s*"[A-Z0-9_]+"/g,
        "",
      );
      for (const match of source.matchAll(/"([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)"/g))
        results.add(match[1]);
    }
    // Weather variable names and similar identifiers, not reason codes.
    for (const identifier of ["T2M_MIN", "T2M_MAX", "T2M"])
      results.delete(identifier);
    // Codes of input checks that throw before any result exists. The server
    // turns them into INVALID_INPUT or CALCULATION_FAILED.
    for (const identifier of [
      "ROTATION_INPUT_INVALID",
      "ROTATION_POLICY_INVALID",
      "ENGINE_INPUT_INVALID",
      "ENGINE_CONTEXT_INVALID",
      "CONTEXT_LOCATION_MISMATCH",
      "CONTEXT_OBSERVATION_INVALID",
      "CONTEXT_HISTORY_INVALID",
      "ENGINE_WORK_LIMIT",
      "ENGINE_SCHEDULE_LIMIT",
      "ENGINE_OUTPUT_LIMIT",
      "INVALID_GRID",
      "INVALID_RING",
      "INVALID_SERIES",
      "SERIES_TOO_SHORT",
    ])
      results.delete(identifier);
    const unexplained = [...results].filter((code) => !anyCode.has(code));
    expect(unexplained).toEqual([]);
  });
  test("every code the server puts in an error body or a failed plan", () => {
    const found = new Set();
    for (const path of [
      "apps/server/src/modules/plans/application/plan-policy.ts",
      "apps/server/src/modules/plans/plans.controller.ts",
      "apps/server/src/modules/fields/http/field.routes.ts",
      "apps/server/src/modules/catalog/http/catalog.routes.ts",
      "apps/server/src/modules/auth/http/auth.routes.ts",
      "apps/server/src/modules/weather/http/weather-public.routes.ts",
      "apps/server/src/modules/crop-health/crop-health.routes.ts",
      "apps/server/src/modules/crop-health/crop-health.service.ts",
      "apps/server/src/modules/crop-health/photo-image.ts",
    ]) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(
        /(?:code: |PlanError\(|CropHealthError\(|\| )"([A-Z][A-Z_]{3,})"/g,
      ))
        found.add(match[1]);
    }
    for (const path of [
      "packages/contracts/src/plans/plan.contract.ts",
      "packages/contracts/src/plans/planning.contract.ts",
      "packages/contracts/src/plans/planning-v2.contract.ts",
    ])
      for (const block of readFileSync(path, "utf8").matchAll(
        /error: z\s*\.strictObject\(\{\s*code: z\.enum\(\[([^\]]*)\]/g,
      ))
        for (const code of block[1].matchAll(/"([A-Z_]+)"/g))
          found.add(code[1]);
    // The observation, weather and scenario providers' own failure codes.
    for (const path of [
      "apps/server/src/modules/earth-observations/application/observation-store.ts",
      "apps/server/src/modules/earth-observations/application/extraction-store.ts",
      "apps/server/src/modules/earth-observations/providers/giovanni/giovanni.client.ts",
      "apps/server/src/modules/earth-observations/application/water-storage.service.ts",
      "apps/server/src/modules/earth-observations/application/canopy-biomass.service.ts",
    ])
      for (const match of readFileSync(path, "utf8").matchAll(
        /(?:ObservationError\(|reason: |\? |: |\bcode: )"((?:OBSERVATION|OBSERVATIONS|WATER_STORAGE|CANOPY_BIOMASS)_[A-Z_]+)"/g,
      ))
        found.add(match[1]);
    expect(found.size).toBeGreaterThan(25);
    const unexplained = [...found].filter(
      (code) =>
        !codesIn("error").has(code) && !codesIn("reason_code").has(code),
    );
    expect(unexplained).toEqual([]);
  });
  test("every explanation key returned with a satellite result", () => {
    const keys = new Set([
      ...Object.keys(VEGETATION_GLOSSARY),
      ...Object.keys(VEGETATION_HISTORY_GLOSSARY),
    ]);
    for (const path of [
      "apps/server/src/modules/earth-observations/application/extraction-store.ts",
      "apps/server/src/modules/earth-observations/application/water-storage.service.ts",
      "apps/server/src/modules/earth-observations/application/canopy-biomass.service.ts",
    ])
      for (const match of readFileSync(path, "utf8").matchAll(
        /"((?:terrain|ecostress|grace|gedi|modis)\.[a-z_]+)"/g,
      ))
        keys.add(match[1]);
    expect(keys.size).toBeGreaterThan(20);
    expect(missing(keys, "term")).toEqual([]);
  });
  test("the English text of the vegetation terms is the text the analysis returns", () => {
    const english = Object.fromEntries(
      GLOSSARY.filter((e) => e.group === "term").map((e) => [
        e.code,
        e.meaning.en,
      ]),
    );
    for (const [key, text] of Object.entries({
      ...VEGETATION_GLOSSARY,
      ...VEGETATION_HISTORY_GLOSSARY,
    }))
      expect(english[key]).toBe(text);
  });
});
