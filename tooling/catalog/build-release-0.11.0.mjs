// Builds catalog release 0.11.0 from the committed release 0.10.0.
// Strictly additive: every crop, cultivar, rule, problem, quote and
// Ecocrop-derived value of 0.10.0 is carried over unchanged. 0.11.0 only adds
// recalled quality data (regions, FAO-56 water curves, soil limits, benefit
// classes), further crops, cultivars and crop problems. Recalled items keep
// their provenance record and are used by the engine like any other rule.
// Deterministic and offline. Usage: node tooling/catalog/build-release-0.11.0.mjs
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { format } from "prettier";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
import {
  REGIONS,
  ROOT_RANGES,
  ROWS as QUALITY_ROWS,
} from "./release-0.11.0.data.mjs";
import { NEW_CROPS, EXTRA_ROWS } from "./release-0.11.0.crops.mjs";
import { CULTIVARS } from "./release-0.11.0.cultivars.mjs";
import { ISSUES } from "./release-0.11.0.issues.mjs";

const VERSION = "0.11.0";
const TODAY = "2026-11-08";
const BASE = "data/catalog/releases/0.10.0";
const OUT = `data/catalog/releases/${VERSION}`;
const LOG_DIR = "docs/evidence/catalog/2026-11-08";
const NATIONAL = "morocco-general";

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));
const sha = (t) => createHash("sha256").update(t).digest("hex");
const norm = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
const slug = (s) => {
  const out = String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safe = /^[a-z]/.test(out) ? out : `x-${out}`;
  return safe.length <= 70
    ? safe
    : `${safe.slice(0, 60)}-${sha(safe).slice(0, 8)}`;
};
const recall = (item, basis, confidence = "low") => ({
  confidence,
  basis,
  valueKind: "model_recall_unverified",
  recordedOn: TODAY,
  researchItem: item.slice(0, 160),
});
const verification = (item, basis, confidence = "low") => ({
  status: "model_recall",
  ...recall(item, basis, confidence),
});
const scope = {
  regionIds: [NATIONAL],
  farmingSystems: "unspecified",
  cultivarIds: "unspecified",
};
const COND = "Recalled by the AI model; unverified.";

const baseManifest = await readJson(`${BASE}/manifest.json`);
const sources = await readJson(`${BASE}/sources.json`);
const quoteCheck = await readJson(`${BASE}/quote-check.json`);
const profiles = new Map();
for (const file of baseManifest.profileFiles)
  profiles.set(
    file.replace(/^profiles\/|\.json$/g, ""),
    structuredClone(await readJson(`${BASE}/${file}`)),
  );
const before = {
  crops: profiles.size,
  cultivars: [...profiles.values()].reduce((n, p) => n + p.cultivars.length, 0),
  problems: baseManifest.issues.length,
  rules: [...profiles.values()].reduce((n, p) => n + p.rules.length, 0),
  references: [...profiles.values()].reduce(
    (n, p) => n + (p.references?.length ?? 0),
    0,
  ),
  applicability: [...profiles.values()].reduce(
    (n, p) => n + p.applicability.length,
    0,
  ),
};
const log = { addedCrops: [], skipped: [], notes: [] };

// ---- 1. further crops ------------------------------------------------------
const NEW_FIELDS = 14;
for (const line of NEW_CROPS.trim().split("\n")) {
  if (!line.trim() || line.startsWith("#")) continue;
  const f = line.split("|").map((x) => x.trim());
  if (f.length !== NEW_FIELDS) {
    log.skipped.push({ row: line.slice(0, 80), reason: "bad crop row" });
    continue;
  }
  const [
    id,
    name,
    fr,
    ar,
    sci,
    family,
    product,
    type,
    win,
    cyc,
    cold,
    heat,
    ret,
    note,
  ] = f;
  if (profiles.has(id)) {
    log.skipped.push({ crop: id, reason: "already in 0.10.0" });
    continue;
  }
  const item = (k) => `C11.crop.${id}.${k}`;
  const basis = "General agronomy and botany recall; no source consulted.";
  const rule = (metric, extra, why) => ({
    id: `c11-${id}-${metric.replace(/_/g, "-")}`.slice(0, 80),
    citations: [],
    scope,
    severity: "soft",
    verification: verification(item(metric), basis),
    conditions: `${COND} ${why}`,
    metric,
    ...extra,
  });
  const rules = [];
  if (win !== "-") {
    const [s, e] = win.split("..");
    rules.push(
      rule(
        "planting_window",
        { start: s, end: e, precision: "approximate" },
        "Planting window as recalled.",
      ),
    );
  }
  if (cyc !== "-") {
    const [lo, hi] = cyc.split("-").map(Number);
    rules.push(
      rule(
        "cycle_duration",
        {
          basis:
            type === "multi_year_stand"
              ? "stand_lifetime"
              : "sowing_to_harvest",
          minDays: lo,
          maxDays: hi,
        },
        "Cycle length as recalled.",
      ),
    );
  }
  const temp = (kind, lower, upper, b) =>
    rules.push({
      ...rule(
        "temperature",
        {
          basis: b,
          medium: "air",
          stage: "whole_cycle",
          stageWindow: null,
          lowerDegC: lower,
          upperDegC: upper,
        },
        `${kind} damage limit as recalled (whole cycle).`,
      ),
      id: `c11-${id}-${kind}-temperature`.slice(0, 80),
    });
  if (cold !== "-") temp("cold", Number(cold), null, "daily_minimum");
  if (heat !== "-") temp("heat", null, Number(heat), "daily_maximum");
  if (ret !== "-")
    rules.push(
      rule(
        "minimum_return_interval",
        { years: Number(ret) },
        "Minimum years before the same crop or family returns.",
      ),
    );
  const localNames = [{ language: "fr", name: fr }];
  if (ar && ar !== "-") localNames.push({ language: "ar", name: ar });
  profiles.set(id, {
    id,
    version: VERSION,
    synthetic: false,
    identity: {
      name,
      localNames,
      scientificName: sci,
      family,
      citations: [],
      recall: recall(
        item("identity"),
        "Identity recalled by the AI model; names and family not checked against a source.",
      ),
    },
    harvestProduct: product,
    modelType: type,
    cultivars: [],
    applicability: [
      {
        regionId: NATIONAL,
        status: "candidate",
        citations: [],
        recall: recall(
          item("presence"),
          "Presence in Morocco recalled by the AI model; no source consulted.",
        ),
        note:
          note && note !== "-"
            ? note
            : "Candidate only: not validated for any region.",
      },
    ],
    rules,
    references: [],
    gaps: [
      {
        topic: "other",
        reason: "Every value was recalled by the AI model and is unverified.",
      },
    ],
    limitations: [
      "Added in 0.11.0 from AI recall; no source consulted; not expert reviewed.",
    ],
  });
  log.addedCrops.push(id);
}

// ---- 2. quality data per crop ----------------------------------------------
const FIELDS = 12;
const rowsByCrop = new Map();
for (const line of `${QUALITY_ROWS}\n${EXTRA_ROWS}`.trim().split("\n")) {
  if (!line.trim()) continue;
  const f = line.split("|").map((x) => x.trim());
  if (f.length !== FIELDS) {
    log.skipped.push({ row: line.slice(0, 80), reason: "bad quality row" });
    continue;
  }
  rowsByCrop.set(f[0], f);
}
const counts = {
  regions: 0,
  kc: 0,
  ph: 0,
  ece: 0,
  drainage: 0,
  water: 0,
  nfix: 0,
  rooting: 0,
  om: 0,
  erosion: 0,
  forage: 0,
};
const CLASS = ["", "low", "medium", "high"];
const WATER = { L: "low", M: "moderate", H: "high" };
const waterMethod =
  "Relative seasonal water demand class recalled from FAO-56 crop coefficients and cycle length; compared only between crops with this same method.";
for (const [id, p] of profiles) {
  const f = rowsByCrop.get(id);
  if (!f) {
    if (!log.addedCrops.includes(id))
      log.notes.push({ crop: id, note: "no quality row" });
    continue;
  }
  const [, regions, kc, ph, ece, drn, wat, nfx, root, om, ero, forage] = f;
  const has = (m) => p.rules.some((r) => r.metric === m);
  const addRule = (metric, extra, why, basis, conf = "low") =>
    p.rules.push({
      id: `c11-${id}-${metric.replace(/_/g, "-")}`.slice(0, 80),
      citations: [],
      scope,
      severity: "soft",
      verification: verification(`C11.${metric}.${id}`, basis, conf),
      conditions: `${COND} ${why}`,
      metric,
      ...extra,
    });
  // regions
  const present = new Set(p.applicability.map((a) => a.regionId));
  if (regions !== "-")
    for (const code of regions.split(/\s+/)) {
      const rid = REGIONS[code];
      if (!rid) throw new Error(`unknown region code ${code} for ${id}`);
      if (present.has(rid) || p.applicability.length >= 12) continue;
      p.applicability.push({
        regionId: rid,
        status: "candidate",
        citations: [],
        recall: recall(
          `C11.region.${id}.${code}`,
          "Regional presence recalled by the AI model; no source consulted.",
        ),
        note: "Candidate only: grown here according to recall; not validated.",
      });
      present.add(rid);
      counts.regions++;
    }
  const sched = p.modelType === "annual" || p.modelType === "multi_year_stand";
  if (
    kc !== "-" &&
    !has("crop_water_coefficient") &&
    p.modelType === "annual"
  ) {
    const [a, b, c, l1, l2, l3, l4] = kc.split(",").map(Number);
    addRule(
      "crop_water_coefficient",
      { kcIni: a, kcMid: b, kcEnd: c, stageLengths: [l1, l2, l3, l4] },
      "FAO-56 style crop coefficients and stage lengths in days, recalled for this crop or its crop group.",
      "FAO-56 Table 11 and 12 pattern recalled for the crop or its group; not checked against the tables.",
    );
    counts.kc++;
  }
  if (ph !== "-" && !has("soil_ph")) {
    const [lo, hi] = ph.split("-").map(Number);
    addRule(
      "soil_ph",
      { method: "unspecified", min: lo, max: hi },
      "Suitable soil pH range; the measurement method is unspecified.",
      "General agronomy recall of the usual pH range; not Moroccan guidance.",
    );
    counts.ph++;
  }
  if (ece !== "-" && !has("soil_salinity")) {
    addRule(
      "soil_salinity",
      { method: "saturated_paste_ece", maxDsPerM: Number(ece) },
      "Saturated-paste ECe at which yield loss begins.",
      "FAO Irrigation and Drainage Paper 29 salt-tolerance pattern recalled; not checked against the table.",
    );
    counts.ece++;
  }
  if (drn !== "-" && !has("soil_drainage")) {
    addRule(
      "soil_drainage",
      { value: drn === "A" ? "avoid_waterlogging" : "well_drained" },
      drn === "A" ? "Avoid waterlogged soil." : "Prefers well drained soil.",
      "General agronomy recall of drainage needs.",
    );
    counts.drainage++;
  }
  if (wat !== "-" && sched && !has("water_demand_class")) {
    addRule(
      "water_demand_class",
      { value: WATER[wat], comparisonMethod: waterMethod },
      "Relative water demand class.",
      "Relative seasonal water use recalled from FAO-56 crop coefficients and cycle length.",
    );
    counts.water++;
  }
  // benefit classes as references
  p.references ??= [];
  const hasTopic = (t) => p.references.some((r) => r.topic === t);
  const addRef = (topic, summary, unit, min, max, basis, ctr) => {
    if (hasTopic(topic)) return;
    p.references.push({
      id: `c11-${id}-${topic.replace(/_/g, "-")}`.slice(0, 80),
      topic,
      summary,
      value: { unit, min, max },
      citations: [],
      recall: recall(`C11.${topic}.${id}`, basis),
    });
    counts[ctr]++;
  };
  addRef(
    "nitrogen_fixation",
    nfx === "1"
      ? "Fixes atmospheric nitrogen through root symbiosis, which can reduce nitrogen needs of the next crop."
      : "Does not fix atmospheric nitrogen.",
    "flag (1 fixes nitrogen, 0 does not)",
    Number(nfx),
    Number(nfx),
    "Botany recall: symbiotic nitrogen fixation of the plant family or crop.",
    "nfix",
  );
  const [rlo, rhi] = ROOT_RANGES[root];
  addRef(
    "rooting_depth",
    `Rooting depth class ${{ S: "shallow", M: "medium", D: "deep", X: "very deep" }[root]} (about ${rlo} to ${rhi} m).`,
    "m (class range)",
    rlo,
    rhi,
    "General agronomy recall of the maximum effective rooting depth class.",
    "rooting",
  );
  addRef(
    "organic_matter_contribution",
    `Contribution of roots and residues to soil organic matter: ${CLASS[Number(om)]}.`,
    "class (1 low, 2 medium, 3 high)",
    Number(om),
    Number(om),
    "General agronomy recall of residue and root biomass.",
    "om",
  );
  addRef(
    "erosion_protection",
    `Soil cover and erosion protection: ${CLASS[Number(ero)]}.`,
    "class (1 low, 2 medium, 3 high)",
    Number(ero),
    Number(ero),
    "General agronomy recall of canopy cover and root holding of the soil.",
    "erosion",
  );
  addRef(
    "forage_value",
    Number(forage) === 0
      ? "No notable forage value."
      : `Forage value of the crop or its residues: ${CLASS[Number(forage)]}.`,
    "class (0 none, 1 low, 2 medium, 3 high)",
    Number(forage),
    Number(forage),
    "General agronomy recall of grazing, hay or residue use.",
    "forage",
  );
  if (!p.limitations.some((l) => l.startsWith("0.11.0 adds")))
    p.limitations.push(
      "0.11.0 adds regional presence, water, soil and benefit classes recalled by the AI model; unverified and not expert reviewed.",
    );
}

// ---- 3. further cultivars ---------------------------------------------------
let cultivarsAdded = 0;
for (const line of CULTIVARS.trim().split("\n")) {
  if (!line.trim() || line.startsWith("#")) continue;
  const [crop, rest] = line.split(":");
  const p = profiles.get(crop.trim());
  if (!p) {
    log.skipped.push({
      cultivarsFor: crop.trim(),
      reason: "crop not in catalog",
    });
    continue;
  }
  const seen = new Set([
    ...p.cultivars.map((c) => norm(c.name)),
    ...p.cultivars.map((c) => c.id),
  ]);
  for (const name of rest
    .split(";")
    .map((x) => x.trim())
    .filter(Boolean)) {
    const id = slug(name);
    if (seen.has(norm(name)) || seen.has(id) || id.length < 3) continue;
    if (p.cultivars.length >= 50) {
      log.skipped.push({
        crop: crop.trim(),
        cultivar: name,
        reason: "50 cultivar limit",
      });
      continue;
    }
    p.cultivars.push({
      id,
      name,
      registration: "unknown",
      citations: [],
      recall: recall(
        `C11.cultivar.${crop.trim()}.${id}`,
        "Cultivar or type name recalled by the AI model; existence and use in Morocco not checked.",
      ),
    });
    seen.add(norm(name));
    seen.add(id);
    cultivarsAdded++;
  }
}

// ---- 4. further crop problems ----------------------------------------------
const issues = structuredClone(baseManifest.issues);
const issueIds = new Set(issues.map((i) => i.id));
const issueSci = new Set(
  issues.map((i) => norm(i.scientificName ?? "")).filter(Boolean),
);
let breaks = 0;
for (const line of ISSUES.trim().split("\n")) {
  if (!line.trim() || line.startsWith("#")) continue;
  const f = line.split("|").map((x) => x.trim());
  if (f.length !== 8) {
    log.skipped.push({ row: line.slice(0, 80), reason: "bad issue row" });
    continue;
  }
  const [id, kind, name, fr, sci, hosts, symptoms, years] = f;
  const hostIds = hosts
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);
  const known = hostIds.filter((h) => profiles.has(h));
  if (issueIds.has(id) || (sci !== "-" && issueSci.has(norm(sci)))) {
    log.skipped.push({ issue: id, reason: "already in the catalog" });
    continue;
  }
  if (!known.length) {
    log.skipped.push({ issue: id, reason: "no host crop in the catalog" });
    continue;
  }
  issues.push({
    id,
    kind,
    name,
    scientificName: sci === "-" ? null : sci,
    localNames: fr && fr !== "-" ? [{ language: "fr", name: fr }] : [],
    hostCropIds: known,
    ...(symptoms && symptoms !== "-" ? { visibleSymptoms: symptoms } : {}),
    citations: [],
    recall: recall(
      `C11.issue.${id}`,
      "Organism, hosts and visible signs recalled by the AI model; Moroccan occurrence not checked. No treatment is recorded.",
    ),
    synthetic: false,
  });
  issueIds.add(id);
  if (sci !== "-") issueSci.add(norm(sci));
  if (years !== "-")
    for (const h of known) {
      const p = profiles.get(h);
      if (p.modelType !== "annual" && p.modelType !== "multi_year_stand")
        continue;
      p.rules.push({
        id: `c11-${h}-break-${id}`.slice(0, 80),
        citations: [],
        scope,
        severity: "soft",
        verification: verification(
          `C11.break.${h}.${id}`,
          "General plant pathology recall of the usual break without host crops.",
        ),
        conditions: `${COND} ${years} years without host crops after ${name}.`,
        metric: "crop_health_break",
        issueId: id,
        minimumBreakDays: Math.round(Number(years) * 365),
      });
      breaks++;
    }
}

// ---- assemble, validate, write ---------------------------------------------
const finalProfiles = [...profiles.values()]
  .map((p) => ({ ...p, version: VERSION }))
  .sort((a, b) => (a.id < b.id ? -1 : 1));
const manifest = {
  ...baseManifest,
  version: VERSION,
  issues,
  sourceFile: "sources.json",
  profileFiles: finalProfiles.map((p) => `profiles/${p.id}.json`),
};
const bundle = { ...manifest, sources, profiles: finalProfiles };
delete bundle.sourceFile;
delete bundle.profileFiles;
const prepared = prepareCatalogV2(bundle);

const json = (v) => format(JSON.stringify(v), { parser: "json" });
await mkdir(join(OUT, "profiles"), { recursive: true });
await mkdir(LOG_DIR, { recursive: true });
await writeFile(join(OUT, "sources.json"), await json(sources));
for (const p of finalProfiles)
  await writeFile(join(OUT, `profiles/${p.id}.json`), await json(p));
await writeFile(join(OUT, "manifest.json"), await json(manifest));
await writeFile(
  join(OUT, "quote-check.json"),
  await json({
    ...quoteCheck,
    method: `${quoteCheck.method} 0.11.0 carries every check forward unchanged and adds no quoted citation: all new items are recalled and have no quote.`,
  }),
);
const after = {
  crops: finalProfiles.length,
  cultivars: finalProfiles.reduce((n, p) => n + p.cultivars.length, 0),
  problems: issues.length,
  rules: finalProfiles.reduce((n, p) => n + p.rules.length, 0),
  references: finalProfiles.reduce(
    (n, p) => n + (p.references?.length ?? 0),
    0,
  ),
  applicability: finalProfiles.reduce((n, p) => n + p.applicability.length, 0),
};
// Additive check: every 0.10.0 crop, cultivar, rule, issue and reference is intact.
const lost = [];
const baseBundle = await readJson(`${BASE}/manifest.json`);
for (const file of baseBundle.profileFiles) {
  const old = await readJson(`${BASE}/${file}`);
  const now = profiles.get(old.id);
  if (!now) {
    lost.push(`crop ${old.id}`);
    continue;
  }
  for (const c of old.cultivars)
    if (!now.cultivars.some((x) => JSON.stringify(x) === JSON.stringify(c)))
      lost.push(`cultivar ${old.id}/${c.id}`);
  for (const r of old.rules)
    if (!now.rules.some((x) => JSON.stringify(x) === JSON.stringify(r)))
      lost.push(`rule ${old.id}/${r.id}`);
  for (const r of old.references ?? [])
    if (!now.references.some((x) => JSON.stringify(x) === JSON.stringify(r)))
      lost.push(`reference ${old.id}/${r.id}`);
  for (const a of old.applicability)
    if (!now.applicability.some((x) => JSON.stringify(x) === JSON.stringify(a)))
      lost.push(`applicability ${old.id}/${a.regionId}`);
}
for (const i of baseManifest.issues)
  if (!issues.some((x) => JSON.stringify(x) === JSON.stringify(i)))
    lost.push(`issue ${i.id}`);
if (lost.length) {
  console.error("NOT ADDITIVE:", lost.slice(0, 20), lost.length);
  process.exit(1);
}
const summary = {
  version: VERSION,
  before,
  after,
  added: {
    crops: after.crops - before.crops,
    cultivars: after.cultivars - before.cultivars,
    problems: after.problems - before.problems,
    rules: after.rules - before.rules,
    references: after.references - before.references,
    applicability: after.applicability - before.applicability,
  },
  qualityAdditions: counts,
  cultivarsAdded,
  healthBreakRules: breaks,
  removedFromPrevious: 0,
  canonicalBytes: new TextEncoder().encode(prepared.canonicalJson).byteLength,
  sha256: prepared.sha256,
  deferred:
    "Licence cleanup (FAO Ecocrop-derived values, long quotes) is deferred by the user: kept exactly as in 0.10.0.",
};
await writeFile(
  join(LOG_DIR, "merge-log.json"),
  await json({
    summary,
    addedCrops: log.addedCrops,
    skipped: log.skipped,
    notes: log.notes,
  }),
);
console.log(JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify({ skipped: log.skipped.length, notes: log.notes.length }),
);
