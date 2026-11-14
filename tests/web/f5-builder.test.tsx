import "../../apps/web/src/features/plans/messages.js";
import { expect, test } from "@jest/globals";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { fieldProfileSchema, planRequestV2Schema } from "@rotavise/contracts";
import {
  builderDraftSchema,
  buildPlanRequest,
  fieldPlanInput,
  newDraft,
  readDraft,
  saveDraft,
  submissionFor,
} from "../../apps/web/src/features/plans/builder.js";
import {
  issueMessage,
  issueTarget,
  schemaMessages,
} from "../../apps/web/src/features/plans/validation.js";
import { dictionaries } from "../../apps/web/src/i18n/messages.js";
import fixture from "../support/fixtures/f5-builder.json" with { type: "json" };
import { planInterval } from "../../apps/web/src/api/keys.js";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ShortList } from "../../apps/web/src/shared/ShortList.js";

test("a correction on a later page reveals its row and preserves seven-row pagination", async () => {
  const user = userEvent.setup();
  render(
    <ShortList
      initialPage={1}
      items={Array.from(
        { length: 12 },
        (_, index) => `History row ${index + 1}`,
      )}
      render={(row) => row}
    />,
  );
  expect(screen.getByText("History row 9")).toBeVisible();
  expect(screen.queryByText("History row 1")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Page précédente" }));
  expect(screen.getAllByRole("listitem")).toHaveLength(7);
  expect(screen.getByText("History row 1")).toBeVisible();
});

for (const { name, state, golden } of fixture.cases)
  test(`golden builder JSON: ${name}`, () => {
    const draft = builderDraftSchema.parse({
      version: 1,
      input: state,
      step: 0,
      historyAnswered: true,
      submission: null,
    });
    const request = buildPlanRequest(draft.input);
    expect(request).toEqual(golden);
    expect(planRequestV2Schema.parse(request)).toEqual(golden);
  });
test("v1 field conversion preserves measurement units, report provenance and exact dates", () => {
  const field = {
    id: fixture.cases[0]!.state.field_id,
    profile: fieldProfileSchema.parse({
      schema_version: "1",
      name: "Synthetic field",
      location: { latitude: 32.4, longitude: -6.55 },
      water: { status: "reported", availability: "rainfed" },
      soil: {
        status: "known",
        observations: [
          {
            metric: "ph",
            value: 0,
            unit: "pH",
            method: "cacl2",
            source: "laboratory_report",
            measured_on: null,
          },
          {
            metric: "organic_matter",
            value: 2,
            unit: "percent_mass",
            method: "Synthetic method",
            source: "laboratory_report",
            measured_on: "2025-02-01",
          },
          {
            metric: "texture",
            classification: "Synthetic class",
            classification_system: "Synthetic system",
            source: "farmer_observation",
            measured_on: null,
          },
        ],
      },
      crop_health: {
        status: "reported",
        observations: [
          {
            crop_id: "barley",
            kind: "disease",
            name: "Synthetic reported marks",
            observed_on: "2025-05-01",
            source: "farmer_report",
            confirmation: "reported",
          },
        ],
      },
    }),
  };
  const input = fieldPlanInput(field, [], "2026-11-13");
  const result = planRequestV2Schema.parse(buildPlanRequest(input));
  expect(result).toEqual({
    ...fixture.cases[0]!.golden,
    planning: {
      horizon_years: 3,
      earliest_start_date: "2027-09-01",
      latest_start_date: "2027-11-14",
    },
    soil: {
      status: "known",
      observations: [
        {
          metric: "ph",
          value: 0,
          method: "cacl2",
          source: "laboratory_report",
          measured_on: null,
        },
        {
          metric: "organic_matter",
          value_percent: 2,
          method: "Synthetic method",
          source: "laboratory_report",
          measured_on: "2025-02-01",
        },
        {
          metric: "texture",
          classification: "Synthetic class",
          classification_system: "Synthetic system",
          source: "farmer_observation",
          measured_on: null,
        },
      ],
    },
    water: { status: "reported", availability: "rainfed", allocation: null },
    crop_health: {
      status: "reported",
      observations: [
        {
          crop_id: "barley",
          issue: { other_name: "Synthetic reported marks" },
          observed_on: "2025-05-01",
          source: "farmer_report",
          confirmation: "reported",
        },
      ],
    },
  });
});
test("every explicit contract schema message has French and English copy", () => {
  const source = ts.createSourceFile(
    "plan-v2.contract.ts",
    readFileSync("packages/contracts/src/plans/plan-v2.contract.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const found = new Set<string>();
  function walk(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      if (
        ts.isIdentifier(node.expression) &&
        node.expression.text === "issue"
      ) {
        const arg = node.arguments[1];
        if (arg && ts.isStringLiteral(arg)) found.add(arg.text);
      }
      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === "refine"
      ) {
        const arg = node.arguments[1];
        if (arg && ts.isStringLiteral(arg)) found.add(arg.text);
      }
    }
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === "message" &&
      ts.isStringLiteral(node.initializer)
    )
      found.add(node.initializer.text);
    ts.forEachChild(node, walk);
  }
  walk(source);
  expect([...found].sort()).toEqual(Object.keys(schemaMessages).sort());
  for (const value of found)
    for (const language of ["fr", "en"] as const)
      expect(
        dictionaries[language][issueMessage({ message: value })],
      ).toBeTruthy();
});
test("schema issues point to the responsible step, section and history or health row", () => {
  expect(
    issueTarget({ path: ["planning"], message: "Invalid first-sowing range" }),
  ).toEqual({ step: 0, control: "dates" });
  expect(
    issueTarget({
      path: ["preferences"],
      message: "Considered crop is excluded",
    }),
  ).toEqual({ step: 1, control: "crops" });
  expect(
    issueTarget({ path: ["cultivars"], message: "One cultivar per crop" }),
  ).toEqual({ step: 1, control: "cultivars" });
  expect(
    issueTarget({
      path: ["history", "entries", 3],
      message: "Reversed crop dates",
    }),
  ).toEqual({ step: 3, control: "history", row: 3 });
  expect(
    issueTarget({
      path: ["crop_health", "observations", 2],
      message: "Duplicate health observation",
    }),
  ).toEqual({ step: 3, control: "health", row: 2 });
  expect(
    issueTarget({ path: ["soil"], message: "Duplicate soil metric" }),
  ).toEqual({ step: 3, control: "soil" });
  expect(
    issueTarget({
      path: ["preferences", "priorities"],
      message: "At least one priority",
    }),
  ).toEqual({ step: 3, control: "priorities" });
});
test("invalid combinations fail before transport with the mapped message", () => {
  const input = planRequestV2Schema.parse(fixture.cases[0]!.state);
  for (const [patch, message] of [
    [
      {
        preferences: {
          ...input.preferences,
          priorities: { climate: 0, water: 0, soil_health: 0, crop_health: 0 },
        },
      },
      "At least one priority",
    ],
    [
      { planning: { ...input.planning, latest_start_date: "2027-01-01" } },
      "Invalid first-sowing range",
    ],
    [
      {
        preferences: {
          ...input.preferences,
          mode: "consider",
          considered_crop_ids: ["barley"],
          excluded_crop_ids: ["barley"],
        },
      },
      "Considered crop is excluded",
    ],
  ] as const) {
    const result = planRequestV2Schema.safeParse({ ...input, ...patch });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(
        result.error.issues.some((issue) => issue.message === message),
      ).toBe(true);
  }
});
test("drafts are field-specific, unfinished drafts survive and malformed storage is ignored", () => {
  const input = builderDraftSchema.parse({
    version: 1,
    input: fixture.cases[0]!.state,
    step: 4,
    historyAnswered: true,
    submission: null,
  }).input;
  const draft = newDraft(input);
  draft.input.planning.earliest_start_date = "";
  draft.input.soil = {
    status: "known",
    observations: [
      {
        metric: "salinity",
        value_ds_per_m: -1,
        method: "unknown",
        measured_on: null,
        source: "farmer_observation",
      },
    ],
  };
  draft.input.water = {
    status: "reported",
    availability: "irrigation_limited",
    allocation: { amount_mm: 6000, period: "year" },
  };
  expect(
    planRequestV2Schema.safeParse(buildPlanRequest(draft.input)).success,
  ).toBe(false);
  const field = input.field_id!;
  expect(saveDraft(sessionStorage, field, draft)).toBe(true);
  expect(readDraft(sessionStorage, field)).toEqual(draft);
  expect(
    readDraft(sessionStorage, "01848ba0-762a-4a82-9000-0d0000000002"),
  ).toBeUndefined();
  expect(readDraft({ getItem: () => "{}" }, field)).toBeUndefined();
  expect(
    saveDraft(
      {
        setItem() {
          throw new Error("storage denied");
        },
      },
      field,
      draft,
    ),
  ).toBe(false);
});
test("ambiguous retries retain the idempotency key and changed requests get a new key", () => {
  const draft = newDraft(
    builderDraftSchema.parse({
      version: 1,
      input: fixture.cases[0]!.state,
      step: 0,
      historyAnswered: true,
      submission: null,
    }).input,
  );
  const first = submissionFor(
    draft,
    () => "01848ba0-762a-4a82-9000-0d0000000001",
  );
  draft.submission = first;
  expect(
    submissionFor(draft, () => {
      throw new Error("must reuse");
    }),
  ).toEqual(first);
  draft.input.planning.horizon_years = 4;
  expect(
    submissionFor(draft, () => "01848ba0-762a-4a82-9000-0d0000000002").key,
  ).not.toBe(first.key);
});
test("reload retains an ambiguous submission key despite schema property normalization", () => {
  const input = planRequestV2Schema.parse(fixture.cases[0]!.state);
  const { soil, water, crop_health, ...rest } = input;
  const draft = newDraft({ ...rest, soil, water, crop_health });
  draft.submission = submissionFor(
    draft,
    () => "01848ba0-762a-4a82-9000-0d0000000001",
  );
  saveDraft(sessionStorage, input.field_id!, draft);
  const reloaded = readDraft(sessionStorage, input.field_id!)!;
  expect(JSON.stringify(buildPlanRequest(reloaded.input))).not.toBe(
    JSON.stringify(buildPlanRequest(draft.input)),
  );
  expect(
    submissionFor(reloaded, () => {
      throw new Error("must reuse after reload");
    }),
  ).toEqual(draft.submission);
});
test("oversized saved history stays in the draft and blocks transport with an honest explanation", () => {
  const input = planRequestV2Schema.parse(fixture.cases[0]!.state);
  const draft = newDraft({
    ...input,
    history: {
      status: "known",
      completeness: "complete",
      entries: Array.from({ length: 41 }, (_, index) => ({
        crop_id: "barley",
        planted_on: `${1980 + index}-01-01`,
        harvested_on: `${1980 + index}-02-01`,
      })),
    },
  });
  const result = planRequestV2Schema.safeParse(buildPlanRequest(draft.input));
  expect(result.success).toBe(false);
  if (!result.success)
    expect(result.error.issues.map(issueMessage)).toContain("f5.historyLimit");
  saveDraft(sessionStorage, input.field_id!, draft);
  expect(readDraft(sessionStorage, input.field_id!)).toEqual(draft);
});
test("polling changes cadence and terminates for every terminal state", () => {
  expect(
    planInterval(
      "running",
      "2026-01-01T00:00:00Z",
      Date.parse("2026-01-01T00:00:29Z"),
    ),
  ).toBe(2000);
  expect(
    planInterval(
      "running",
      "2026-01-01T00:00:00Z",
      Date.parse("2026-01-01T00:00:30Z"),
    ),
  ).toBe(5000);
  expect(planInterval("failed", undefined)).toBe(false);
  expect(planInterval("completed", undefined)).toBe(false);
});

test("saved-profile edits refresh the source inputs and retain plan-only water and salinity", async () => {
  const { refreshSavedInputs } =
    await import("../../apps/web/src/features/plans/builder.js");
  const draft = newDraft(
    builderDraftSchema.parse({
      version: 1,
      input: fixture.cases[0]!.state,
      step: 0,
      historyAnswered: true,
      submission: null,
    }).input,
  );
  draft.input.water = {
    status: "reported",
    availability: "irrigation_available",
    allocation: { amount_mm: 15, period: "season" },
  };
  draft.input.soil = {
    status: "known",
    observations: [
      {
        metric: "salinity",
        value_ds_per_m: 1,
        method: "unknown",
        measured_on: null,
        source: "farmer_observation",
      },
    ],
  };
  const saved = {
    ...draft.input,
    water: {
      status: "reported" as const,
      availability: "irrigation_limited" as const,
      allocation: null,
    },
    soil: { status: "unknown" as const },
    history: {
      status: "known" as const,
      completeness: "partial" as const,
      entries: [
        {
          crop_id: "barley",
          planted_on: "2025-01-01",
          harvested_on: "2025-06-01",
        },
      ],
    },
  };
  const refreshed = refreshSavedInputs(draft, saved);
  expect(refreshed.input.water).toEqual({
    status: "reported",
    availability: "irrigation_limited",
    allocation: { amount_mm: 15, period: "season" },
  });
  expect(refreshed.input.soil).toEqual(draft.input.soil);
  expect(refreshed.historyAnswered).toBe(false);
});

test("the installed intake date limits are checked in addition to the shared schema", async () => {
  const { intakeDateIssues } =
    await import("../../apps/web/src/features/plans/validation.js");
  const input = planRequestV2Schema.parse(fixture.cases[0]!.state);
  const issues = intakeDateIssues(input, "2026-11-13");
  expect(issues.map((issue) => issueMessage(issue))).toContain(
    "f5.intakeRange",
  );
  input.planning.latest_start_date = "2027-11-14";
  expect(intakeDateIssues(input, "2026-11-13")).toEqual([]);
  input.soil = {
    status: "known",
    observations: [
      {
        metric: "ph",
        value: 7,
        method: "unknown",
        measured_on: "2026-11-14",
        source: "farmer_observation",
      },
    ],
  };
  expect(
    intakeDateIssues(input, "2026-11-13").map(
      (issue) => issueTarget(issue).control,
    ),
  ).toEqual(["soil"]);
});

test("all lazy plan messages have matching French and English keys and valid ICU", async () => {
  const { default: fr } = await import(
    "../../apps/web/src/i18n/plans.fr.json",
    { with: { type: "json" } }
  );
  const { default: en } = await import(
    "../../apps/web/src/i18n/plans.en.json",
    { with: { type: "json" } }
  );
  const { default: progressFr } = await import(
    "../../apps/web/src/i18n/progress.fr.json",
    { with: { type: "json" } }
  );
  const { default: progressEn } = await import(
    "../../apps/web/src/i18n/progress.en.json",
    { with: { type: "json" } }
  );
  const { IntlMessageFormat } = await import("intl-messageformat");
  expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
  expect(Object.keys(progressFr).sort()).toEqual(
    Object.keys(progressEn).sort(),
  );
  expect(Object.keys(fr).some((key) => key in progressFr)).toBe(false);
  for (const [language, copy] of [
    ["fr", { ...fr, ...progressFr }],
    ["en", { ...en, ...progressEn }],
  ] as const)
    for (const text of Object.values(copy))
      expect(() => new IntlMessageFormat(text, language)).not.toThrow();
});
