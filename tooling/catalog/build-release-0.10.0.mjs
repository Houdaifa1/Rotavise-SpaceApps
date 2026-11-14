// Builds catalog release 0.10.0 from release 0.9.0 and the research folder.
// Deterministic and offline: it reads committed files plus the locally saved
// source texts (.research-sources, not committed) and writes the release and a
// merge log. Sourced facts and AI-recalled facts stay in separate evidence
// classes; nothing recalled is ever presented as sourced.
// Usage: node tooling/catalog/build-release-0.10.0.mjs
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { format } from "prettier";
import {
  catalogRuleV2Schema,
  cropIssueSchema,
  cropProfileV2Schema,
  profileReferenceSchema,
} from "../../packages/contracts/dist/index.js";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
import { cropAliases, identities, skippedCropIds } from "./crop-identities.mjs";

const VERSION = "0.10.0";
const TODAY = "2026-11-07";
const BASE = "data/catalog/releases/0.9.0";
const OUT = `data/catalog/releases/${VERSION}`;
const RESEARCH = "docs/evidence/catalog/2026-11-03/research";
const LOG_DIR = "docs/evidence/catalog/2026-11-07";
// Order matters only for tie-breaks: earlier files win equal-quality duplicates.
const FILES = [
  "facts.json",
  "claude-supplement-A.json",
  "claude-supplement-BCD.json",
  "claude-supplement-FG.json",
  "claude-new-crops.json",
  "claude-varieties-sourced.json",
  "claude-more-crops-cereals.json",
  "claude-more-crops-vegetables.json",
  "claude-more-crops-herbs.json",
  "claude-more-crops-trees.json",
  "claude-training-knowledge.json",
  "claude-training-new-crops.json",
  "claude-recall-fill.json",
  "claude-recall-minor-crops.json",
  "claude-training-varieties.json",
  "../../2026-11-07/recall-gap-fill.json",
  "../../2026-11-07/recall-gap-fill-issues.json",
];

const sha = (b) => createHash("sha256").update(b).digest("hex");
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));
const squash = (t) =>
  t
    .normalize("NFC")
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/[­\s]+/g, "");
const htmlText = (t) =>
  t
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ");
const slug = (s) => {
  const out = String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const safe = /^[a-z]/.test(out) ? out : `x-${out}`;
  if (safe.length <= 78) return safe;
  return `${safe.slice(0, 68)}-${sha(safe).slice(0, 8)}`;
};
const clip = (s, n) => {
  const t = String(s ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return t.length <= n ? t : `${t.slice(0, n - 1)}…`;
};
const num = (x) => {
  if (x === null || x === undefined || x === "") return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
};
const confidenceOf = (c) =>
  /high/i.test(String(c))
    ? "high"
    : /medium/i.test(String(c))
      ? "medium"
      : "low";
const CONF_RANK = { low: 0, medium: 1, high: 2 };
const minConfidence = (a, b) => (CONF_RANK[a] <= CONF_RANK[b] ? a : b);

// ---------------------------------------------------------------- log
const log = {
  mapped: {},
  skipped: [],
  dropped: [],
  conflicts: [],
  sources: [],
  notes: [],
};
const count = (key) => (log.mapped[key] = (log.mapped[key] ?? 0) + 1);
const skip = (rec, reason) =>
  log.skipped.push({ item: rec.item, crop: rec.crop ?? null, reason });

// ---------------------------------------------------------------- load
const baseManifest = await readJson(`${BASE}/manifest.json`);
const baseSources = await readJson(`${BASE}/sources.json`);
const baseQuoteCheck = await readJson(`${BASE}/quote-check.json`);
const baseProfiles = new Map();
for (const file of baseManifest.profileFiles) {
  const p = await readJson(join(BASE, file));
  baseProfiles.set(p.id, p);
}
const regionIds = new Set(baseManifest.regions.map((r) => r.id));
const records = [];
for (const file of FILES) {
  for (const rec of await readJson(join(RESEARCH, file))) {
    records.push({ ...rec, _file: file });
  }
}
const cropIds = new Set([...baseProfiles.keys(), ...identities.keys()]);
const normCrop = (c) => {
  if (typeof c !== "string") return null;
  const id = cropAliases[c] ?? c;
  if (skippedCropIds.has(id)) return null;
  return cropIds.has(id) ? id : null;
};

// ------------------------------------------------------------ sources
const newSources = new Map();
const sourceBySha = new Map();
const textCache = new Map();
const kindOf = (s) => {
  const t = `${s.title} ${s.publisher}`;
  if (/ecocrop|FAO/i.test(t)) return "fao_method";
  if (/UPOV|catalogue|register|registre/i.test(t)) return "variety_register";
  if (/HCP|Haut-Commissariat|statistiq|monograph|annuaire/i.test(t))
    return "official_statistics";
  if (s.tier === 1) return "official_guide";
  if (s.tier === 3) return "scientific_paper";
  return "other";
};
function registerSource(s) {
  if (!s || typeof s !== "object") return null;
  const hash = s.fileSha256;
  if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) return null;
  if (sourceBySha.has(hash)) return sourceBySha.get(hash);
  let url;
  try {
    url = new URL(s.url);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const file = s.localFile;
  if (!file || !existsSync(file)) return null;
  const id = `rs-${slug(basename(file).replace(/\.[a-z0-9]+$/i, ""))}`.slice(
    0,
    79,
  );
  const unique = newSources.has(id)
    ? `${id.slice(0, 70)}-${hash.slice(0, 8)}`
    : id;
  const year = Number.isInteger(Number(s.year)) ? Number(s.year) : null;
  const tierText =
    s.tier === 1
      ? "Moroccan official or technical source"
      : s.tier === 2
        ? "FAO source"
        : s.tier === 3
          ? "Peer-reviewed or scientific source"
          : "Press or other extension source (lowest tier)";
  newSources.set(unique, {
    id: unique,
    title: clip(s.title ?? basename(file), 1900),
    publisher: clip(s.publisher ?? "unknown", 1900),
    url: s.url,
    publicationYear: year && year >= 1700 && year <= 2100 ? year : null,
    accessedAt: `${/^\d{4}-\d{2}-\d{2}$/.test(s.retrievedOn ?? "") ? s.retrievedOn : "2026-11-04"}T00:00:00.000Z`,
    evidence: {
      kind: "document_bytes",
      sha256: hash,
      bytes: 0, // replaced below once the size is known
      artifactPath: null,
      captureNote:
        "Saved locally under .research-sources/ (not committed: no reuse licence); the hash is of that saved file.",
    },
    geographicScope: s.nonLocal
      ? "Not Moroccan: used as non-local evidence only"
      : "Morocco, or as stated by the source",
    limitations: [
      `${tierText}.`,
      `Licence: ${s.licence ?? "unknown"}.`,
      "Quotes were re-found by machine in the saved text; the agronomic reading is not expert-reviewed.",
    ],
    synthetic: false,
    kind: kindOf(s),
    rights: {
      reuse: !s.licence || s.licence === "unknown" ? "unknown" : "restricted",
      licence:
        !s.licence || s.licence === "unknown" ? null : clip(s.licence, 190),
      note: "Not redistributed in this repository; cited by hash and URL.",
    },
    _file: file,
  });
  sourceBySha.set(hash, unique);
  return unique;
}
async function sourceText(rec) {
  const s = rec.source ?? {};
  const candidates = [
    s.textExtractUsedForQuoteCheck,
    s.extractFile,
    s.textExtract,
    rec.evidenceTextFile,
    s.localFile && s.localFile.replace(/\.[a-z0-9]+$/i, ".plain.txt"),
    s.localFile && s.localFile.replace(/\.[a-z0-9]+$/i, ".txt"),
    s.localFile,
  ].filter(Boolean);
  for (const path of candidates) {
    if (textCache.has(path)) return textCache.get(path);
    if (!existsSync(path) || /\.(pdf|png|jpg)$/i.test(path)) continue;
    let text = await readFile(path, "utf8");
    if (/\.html?$/i.test(path)) text = htmlText(text);
    textCache.set(path, text);
    return text;
  }
  return null;
}
function quotePieces(rec) {
  if (Array.isArray(rec.quoteFragments) && rec.quoteFragments.length)
    return rec.quoteFragments.filter((f) => typeof f === "string");
  const pieces = String(rec.quote ?? "")
    .split(/\s*(?:\[…\]|\[\.\.\.\]|…|\.\.\.)\s*/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 8);
  return pieces.length ? pieces : [String(rec.quote ?? "")];
}

// ----------------------------------------------------------- evidence
const recallOf = (rec, basisExtra) => ({
  confidence: confidenceOf(rec.confidence),
  basis: clip(
    `${rec.basis ?? rec.note ?? "AI model recall; no source consulted"}${basisExtra ? ` ${basisExtra}` : ""}`,
    1900,
  ),
  valueKind: "model_recall_unverified",
  recordedOn: TODAY,
  researchItem: clip(rec.item ?? "unknown", 150),
});
// Returns { kind: "recall", recall } or { kind: "sourced", citation, eligible }
// or null when a sourced record cannot be used.
async function evidenceOf(rec) {
  if (rec.status === "training_based")
    return { kind: "recall", recall: recallOf(rec) };
  if (rec.status !== "found") return null;
  const sourceId = registerSource(rec.source);
  if (!sourceId) {
    skip(rec, "source unusable (not https, no saved file, or no hash)");
    return null;
  }
  const text = await sourceText(rec);
  let matched = false;
  const quote = String(rec.quote ?? "");
  if (text && quote.length >= 8) {
    const hay = squash(text);
    matched = quotePieces(rec).every((p) => hay.includes(squash(p)));
  }
  const page = (() => {
    const m = /(?:page|p\.|slide)\s*(\d{1,4})/i.exec(String(rec.locator ?? ""));
    return m ? Number(m[1]) : null;
  })();
  const citation = {
    sourceId,
    locator: clip(rec.locator ?? "see source", 1900) || "see source",
    interpretation: "normalized",
    note: clip(
      matched
        ? (rec.interpretation ?? "Quote re-found in the saved text.")
        : `${rec.interpretation ?? "See source."} The builder could not re-find the quote in the saved text, so it is not reproduced.`,
      1900,
    ),
    page,
    ...(matched ? { quote: clip(quote, 800) } : {}),
  };
  const tier = rec.source?.tier;
  return {
    kind: "sourced",
    citation,
    matched,
    eligible: matched && quote.length >= 8 && tier !== undefined,
  };
}

// ------------------------------------------------------------- buckets
const buckets = new Map();
const bucket = (crop) => {
  if (!buckets.has(crop))
    buckets.set(crop, {
      rules: [],
      refs: [],
      cultivars: [],
      presence: [],
      issueMentions: 0,
    });
  return buckets.get(crop);
};
const usedRuleIds = new Set();
for (const p of baseProfiles.values())
  for (const r of p.rules) usedRuleIds.add(r.id);
const ruleId = (base) => {
  let id = slug(base);
  if (!usedRuleIds.has(id)) {
    usedRuleIds.add(id);
    return id;
  }
  for (let i = 2; ; i++) {
    const next = `${id.slice(0, 74)}-${i}`;
    if (!usedRuleIds.has(next)) {
      usedRuleIds.add(next);
      return next;
    }
  }
};
const scopeOf = (rec) => {
  const sc = rec.scope ?? {};
  const regions = Array.isArray(sc.regions)
    ? sc.regions.filter((r) => regionIds.has(r))
    : [];
  const system = sc.farmingSystem;
  return {
    regionIds: regions.length ? regions.slice(0, 12) : ["morocco-general"],
    farmingSystems:
      system === "rainfed" || system === "irrigated" ? [system] : "unspecified",
    cultivarIds: "unspecified",
  };
};
const farmKey = (scope) =>
  Array.isArray(scope.farmingSystems) ? scope.farmingSystems.join("+") : "any";

// Adds a planner rule if it passes the real schema.
function emitRule(crop, rec, ev, spec, key, conditionText) {
  const recall = ev.kind === "recall";
  const sourcedVerified = ev.kind === "sourced" && ev.eligible;
  const rule = {
    id: ruleId(`${rec.item}-${spec.metric}`),
    ...spec,
    citations: recall ? [] : [ev.citation],
    scope: scopeOf(rec),
    severity: recall || sourcedVerified ? "soft" : "reference",
    verification: recall
      ? { status: "model_recall", ...ev.recall }
      : sourcedVerified
        ? {
            status: "double_checked",
            checkedOn: TODAY,
            method: "quote_match_and_second_reading",
          }
        : { status: "extracted" },
    conditions: clip(
      `${recall ? "Recalled by the AI model; unverified. " : sourcedVerified ? "" : "Evidence only; not enough to bind a plan. "}${conditionText}`,
      1900,
    ),
  };
  // Field order of the schema is irrelevant, but keep id first for readability.
  const parsed = catalogRuleV2Schema.safeParse(rule);
  if (!parsed.success) {
    skip(
      rec,
      `rule rejected by schema: ${parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join(".")} ${i.message}`)
        .join("; ")}`,
    );
    return null;
  }
  const quality = sourcedVerified ? 3 : recall ? 1 : 2;
  bucket(crop).rules.push({
    rule: parsed.data,
    key,
    quality,
    confidence: recall ? ev.recall.confidence : "high",
    file: FILES.indexOf(rec._file),
  });
  count(
    `rule:${spec.metric}:${recall ? "recall" : sourcedVerified ? "verified" : "evidence"}`,
  );
  return parsed.data;
}
let refSeq = 0;
function emitRef(crop, rec, ev, topic, summary, value = null) {
  const recall = ev.kind === "recall";
  const ref = {
    id: slug(`${rec.item}-${topic}-${refSeq++}`),
    topic,
    summary: clip(summary, 780),
    value,
    citations: recall ? [] : [ev.citation],
    ...(recall ? { recall: ev.recall } : {}),
  };
  const parsed = profileReferenceSchema.safeParse(ref);
  if (!parsed.success) {
    skip(
      rec,
      `reference rejected by schema: ${parsed.error.issues[0]?.message}`,
    );
    return;
  }
  bucket(crop).refs.push({
    ref: parsed.data,
    recall,
    file: FILES.indexOf(rec._file),
  });
  count(`reference:${topic}:${recall ? "recall" : "sourced"}`);
}

// ------------------------------------------------- per-metric mapping
const STAGES = [
  ["germination", "germination"],
  ["emergence", "emergence"],
  ["flower", "flowering"],
  ["vegetative", "vegetative_growth"],
  ["grain", "grain_filling"],
  ["pod", "pod_formation"],
];
function stageOf(raw) {
  const s = String(raw ?? "whole_cycle").toLowerCase();
  if (
    /whole|any stage|established|growing season|frost kills|all stages/.test(s)
  )
    return { stage: "whole_cycle", label: null };
  for (const [needle, stage] of STAGES)
    if (s.includes(needle)) return { stage, label: s === stage ? null : raw };
  return { stage: "other", label: String(raw) };
}
const validWindow = (w, stage) => {
  if (stage === "whole_cycle" || !w || typeof w !== "object") return null;
  if (
    w.basis === "elapsed_days_from_sowing" &&
    Number.isInteger(w.startDay) &&
    Number.isInteger(w.endDay)
  )
    return {
      basis: w.basis,
      startDay: w.startDay,
      endDay: w.endDay,
    };
  if (
    w.basis === "growing_degree_days_from_sowing" &&
    w.method === "aquacrop_method_3"
  )
    return {
      basis: w.basis,
      method: w.method,
      startGdd: w.startGdd,
      endGdd: w.endGdd,
      baseDegC: w.baseDegC,
      upperDegC: w.upperDegC,
    };
  return null;
};
const fullMonth = (start, end) => {
  if (!start.endsWith("-01")) return false;
  const [m, d] = end.split("-").map(Number);
  return d === new Date(Date.UTC(2000, m, 0)).getUTCDate();
};
const FAMILY = /\b([A-Z][a-z]+aceae)\b/;
const familyOf = (x) => {
  if (typeof x !== "string") return null;
  const m = FAMILY.exec(x);
  return m ? m[1] : null;
};
const planner = (crop) => {
  const base = baseProfiles.get(crop);
  return base ? base.modelType : (identities.get(crop)?.modelType ?? "annual");
};
const sourceTag = (ev) =>
  ev.kind === "recall"
    ? ""
    : ev.matched
      ? "Quote re-found in the saved source text. "
      : "";

async function mapRecord(rec) {
  const crop = normCrop(rec.crop);
  if (!crop) {
    if (rec.crop) skip(rec, "crop id not usable or generic");
    return;
  }
  if (rec.status !== "found" && rec.status !== "training_based") return;
  const metric = rec.metric ?? (rec.name ? "variety" : null);
  const p = rec.proposed;
  if (metric === "background_knowledge") return mapBackground(crop, rec);
  if (
    [
      "model_constant",
      "model_formula",
      "decomposition_rate",
      "unit_conversion",
      "soil_carbon",
    ].includes(metric)
  )
    return skip(rec, "not a crop-level fact (soil or model constant)");
  if (p === null || p === undefined) {
    if (metric === "variety") {
      // Varieties are described by top-level fields.
    } else return skip(rec, "no value recorded");
  }
  const ev = await evidenceOf(rec);
  if (!ev) return;
  const type = planner(crop);
  const plannable = type === "annual" || type === "multi_year_stand";
  const text = sourceTag(ev);

  switch (metric) {
    case "temperature":
      return mapTemperature(crop, rec, ev, p, type);
    case "planting_window":
      return mapWindow(crop, rec, ev, p, plannable, text);
    case "cycle_duration":
    case "stand_lifetime":
      return mapDuration(crop, rec, ev, p, type, text);
    case "preferred_predecessor_family":
    case "preferred_predecessor":
    case "prohibited_predecessor_family":
    case "prohibited_predecessor":
    case "minimum_return_interval":
    case "rotation":
      return mapRotation(crop, rec, ev, p, metric, plannable, text);
    case "crop_issue":
      return mapIssueRecord(crop, rec, ev);
    case "observed_yield":
    case "yield_range":
    case "typical_yield_range":
      return mapYield(crop, rec, ev, p);
    case "chilling_requirement":
    case "chill_requirement":
      return mapChill(crop, rec, ev, p);
    case "variety":
    case "varieties":
      return mapVariety(crop, rec, ev, p);
    case "varieties_types":
      return emitRef(crop, rec, ev, "background", `Types: ${p?.text ?? ""}`);
    case "harvest_window":
      return emitRef(
        crop,
        rec,
        ev,
        "harvest_window",
        `Harvest ${p.start} to ${p.end} (${p.precision ?? "approximate"})${p.basis ? `; ${p.basis}` : ""}${p.note ? `; ${p.note}` : ""}`,
      );
    case "crop_presence":
      bucket(crop).presence.push({ ev, rec });
      return emitRef(
        crop,
        rec,
        ev,
        "presence",
        p.statusInMorocco ?? p.note ?? "Present in Morocco",
      );
    case "planner_fit":
      return emitRef(
        crop,
        rec,
        ev,
        "planner_fit",
        `Planner fit recalled as "${p.plannerFit}"${p.note ? `; ${p.note}` : ""}. The release uses its own model type for this crop.`,
      );
    case "profile":
    case "botanical_family":
      return count(`identity-hint:${metric}`);
    case "stage_timing":
    case "cold_exposure_bolting":
    case "agronomic_reference_gap":
    case "regions":
      return emitRef(
        crop,
        rec,
        ev,
        "background",
        `${metric.replace(/_/g, " ")}: ${JSON.stringify(p)}`,
      );
    default:
      return skip(rec, `metric not mapped: ${metric}`);
  }
}

function mapTemperature(crop, rec, ev, p, type) {
  if (
    p &&
    (p.TOPMN !== undefined || p.TMIN !== undefined || p.TMAX !== undefined)
  ) {
    const parts = ["TOPMN", "TOPMX", "TMIN", "TMAX", "KTMP_killing_temperature"]
      .filter((k) => p[k] !== null && p[k] !== undefined)
      .map((k) => `${k} ${p[k]}`);
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `FAO Ecocrop species-level temperature bounds (not daily damage limits): ${parts.join(", ")} °C.`,
    );
  }
  if (p && p.text !== undefined && p.lowerDegC === undefined)
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `Temperature (${p.basis ?? "unspecified"}): ${p.text}`,
    );
  let lower = num(p.lowerDegC);
  let upper = num(p.upperDegC);
  const tt = String(rec.thresholdType ?? "");
  // FAO frost tables give a critical range; the milder end is used (conservative).
  if (
    lower === null &&
    upper === null &&
    Array.isArray(p.sourceCriticalRangeDegC)
  ) {
    const [a, b] = p.sourceCriticalRangeDegC.map(num);
    if (a !== null && b !== null) {
      if (/\.heat\b/.test(String(rec.item))) upper = Math.min(a, b);
      else lower = Math.max(a, b);
    }
  }
  const damage =
    /^damage/.test(tt) || tt === "species_killing_temperature_unstaged";
  if (lower === null && upper === null && p.sourceFieldName) {
    const v = num(p.sourceFieldValueDegC);
    if (/KTMP|TMIN/.test(p.sourceFieldName)) lower = v;
    else if (/TMAX/.test(p.sourceFieldName)) upper = v;
  }
  if (lower === null && upper === null && num(p.killingTempDegC) !== null)
    lower = num(p.killingTempDegC);
  if (lower === null && upper === null) {
    const facts = Object.entries(p)
      .filter(
        ([, v]) =>
          (typeof v === "number" || (typeof v === "string" && v.length < 90)) &&
          v !== "",
      )
      .map(([k, v]) => `${k} ${v}`);
    if (!facts.length) return skip(rec, "temperature without a bound");
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `Temperature facts (${rec.thresholdType ?? "unclassified"}): ${facts.join("; ")}.`,
    );
  }
  const { stage, label } = stageOf(p.stage);
  if (
    !damage ||
    (rec.status === "found" && rec.coverage !== "found" && !damage)
  ) {
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `Temperature (${tt || "unclassified"}; not a damage limit) ${lower !== null ? `from ${lower}` : ""}${upper !== null ? ` to ${upper}` : ""} °C at ${label ?? stage}.`,
    );
  }
  if (type === "orchard" || type === "wild_harvested") {
    // Kept as a rule: climate checks never run for unplanned crops but the
    // limit is crop knowledge the farmer-facing catalog should hold.
  }
  const basis = [
    "daily_minimum",
    "daily_maximum",
    "daily_mean",
    "stage_mean",
  ].includes(p.basis)
    ? p.basis
    : "unspecified";
  const medium = ["air", "soil"].includes(p.medium) ? p.medium : "unspecified";
  const side =
    lower !== null && upper === null
      ? "cold"
      : upper !== null && lower === null
        ? "heat"
        : "range";
  emitRule(
    crop,
    rec,
    ev,
    {
      metric: "temperature",
      basis,
      medium,
      stage,
      stageWindow: validWindow(p.stageWindow, stage),
      lowerDegC: lower,
      upperDegC: upper,
    },
    `temp|${side}|${stage === "whole_cycle" ? "wc" : stage === "other" ? `other-${slug(label ?? "")}` : stage}`,
    `Damage limit (${tt}) at stage "${label ?? stage}".${rec.thresholdType === "species_killing_temperature_unstaged" ? " Species-level killing temperature, not a stage-timed limit." : ""} ${sourceTag(ev)}`,
  );
}

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const MONTH_RANGE =
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(?:-|–|—|to|through|until)\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/gi;
const pad = (n) => String(n).padStart(2, "0");
function textWindows(text) {
  const out = [];
  for (const m of String(text).matchAll(MONTH_RANGE)) {
    const a = MONTHS[m[1].toLowerCase()];
    const b = MONTHS[m[2].toLowerCase()];
    out.push({
      start: `${pad(a)}-01`,
      end: `${pad(b)}-${pad(new Date(Date.UTC(2001, b, 0)).getUTCDate())}`,
      precision: "approximate",
    });
  }
  return out.slice(0, 3);
}
function textDuration(text) {
  const t = String(text);
  let m = /(\d{2,4})\s*(?:-|–|to)\s*(\d{2,4})\s*days/i.exec(t);
  if (m) return { min: Number(m[1]), max: Number(m[2]), years: false };
  m = /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*months/i.exec(t);
  if (m)
    return {
      min: Math.round(m[1] * 30),
      max: Math.round(m[2] * 30),
      years: false,
    };
  m = /(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*years/i.exec(t);
  if (m)
    return {
      min: Math.round(m[1] * 365),
      max: Math.round(m[2] * 365),
      years: true,
    };
  return null;
}
function mapWindow(crop, rec, ev, p, plannable, text) {
  if (p?.text !== undefined && plannable) {
    const ranges = textWindows(p.text);
    ranges.forEach((w, idx) =>
      mapWindow(
        crop,
        rec,
        ev,
        { ...w, context: p.text, _idx: idx },
        plannable,
        text,
      ),
    );
    if (ranges.length) return;
  }
  if (!p || p.text !== undefined || (!p.start && !p.windowDescription))
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `Planting: ${p?.text ?? "not stated"}`,
    );
  if (p.cycleDays && num(p.cycleDays.minDays) && num(p.cycleDays.maxDays))
    mapDuration(
      crop,
      rec,
      ev,
      {
        basis: "sowing_to_harvest",
        minDays: p.cycleDays.minDays,
        maxDays: p.cycleDays.maxDays,
      },
      planner(crop),
      "Cycle length taken from the same record as the planting description. ",
    );
  if (!p.start || !p.end || !plannable)
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `Planting: ${p.windowDescription ?? `${p.start} to ${p.end}`}${p.context ? ` (${p.context})` : ""}`,
    );
  const precision =
    p.precision === "exact_day"
      ? "exact_day"
      : p.precision === "full_month" && fullMonth(p.start, p.end)
        ? "full_month"
        : "approximate";
  const scope = scopeOf(rec);
  emitRule(
    crop,
    rec,
    ev,
    { metric: "planting_window", start: p.start, end: p.end, precision },
    `window|${farmKey(scope)}|${p._idx ? `r${p._idx}` : ""}`,
    `${text}${p.context ? `${p.context}. ` : ""}Planting window as stated or recalled.`,
  );
}

function mapDuration(crop, rec, ev, p, type, text) {
  let min = num(p?.minDays);
  let max = num(p?.maxDays);
  let textYears = false;
  if (min === null && typeof p?.text === "string") {
    const parsed = textDuration(p.text);
    if (parsed) ({ min, max, years: textYears } = parsed);
  }
  if (min === null && num(p?.minYears) !== null) {
    min = Math.round(p.minYears * 365);
    max = Math.round((num(p.maxYears) ?? p.minYears) * 365);
  }
  if (min === null || max === null)
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `Cycle: ${p?.text ?? JSON.stringify(p)}`,
    );
  const stand = type === "multi_year_stand";
  const wantsStand =
    rec.metric === "stand_lifetime" ||
    /stand_lifetime/.test(p.basis ?? "") ||
    num(p.minYears) !== null ||
    textYears;
  if (type === "orchard" || type === "wild_harvested" || stand !== wantsStand) {
    const lifetime = wantsStand;
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `${lifetime ? "Stand lifetime" : "Cycle"} ${min}–${max} days${p.lifeForm ? ` (${p.lifeForm})` : ""}.`,
      { unit: "days", min, max },
    );
  }
  if (max < min) [min, max] = [max, min];
  const scope = scopeOf(rec);
  emitRule(
    crop,
    rec,
    ev,
    {
      metric: "cycle_duration",
      basis: stand ? "stand_lifetime" : "sowing_to_harvest",
      minDays: min,
      maxDays: max,
    },
    `duration|${stand ? "stand" : "cycle"}|${farmKey(scope)}`,
    `${text}${/unspecified/.test(p.basis ?? "") ? "Species-level cycle length (FAO Ecocrop), not specific to Moroccan sowing dates. " : ""}Cycle length as stated or recalled.`,
  );
}

function mapRotation(crop, rec, ev, p, metric, plannable, text) {
  const item = String(rec.item);
  const out = [];
  const add = (kind, value, note) => out.push({ kind, value, note });
  const years = (v) => {
    const direct =
      num(v?.years) ?? num(v?.years_text) ?? num(v?.minimumReturnIntervalYears);
    if (direct !== null) return direct;
    if (v?.sourceRangeYears)
      return num(v.sourceRangeYears.max) ?? num(v.sourceRangeYears.min);
    return null;
  };
  if (
    p?.family &&
    p.sourceTerm !== undefined &&
    !/preferred|prohibited|return/.test(item)
  )
    return count("identity-hint:family-term");
  if (p?.text !== undefined && !p.family) {
    const families = [
      ...new Set(String(p.text).match(/\b[A-Z][a-z]+aceae\b/g) ?? []),
    ];
    const kind = /prohibited/.test(metric)
      ? "prohibited"
      : /preferred/.test(metric)
        ? "preferred"
        : null;
    if (kind && families.length && plannable) {
      for (const f of families)
        emitRule(
          crop,
          rec,
          ev,
          {
            metric:
              kind === "preferred"
                ? "preferred_predecessor_family"
                : "prohibited_predecessor_family",
            family: f,
          },
          `pred-${kind}|${f}`,
          `${text}${p.text}. ${kind === "preferred" ? "Preferred" : "Avoided"} previous-crop family.`,
        );
      return;
    }
    return emitRef(
      crop,
      rec,
      ev,
      "background",
      `${metric.replace(/_/g, " ")}: ${p.text}`,
    );
  }
  if (
    p &&
    (p.preferredPredecessorFamily !== undefined ||
      p.prohibitedPredecessorFamily !== undefined ||
      p.minimumReturnYears !== undefined)
  ) {
    const fams = (v) => [
      ...new Set(String(v ?? "").match(/\b[A-Z][a-z]+aceae\b/g) ?? []),
    ];
    for (const f of fams(p.preferredPredecessorFamily))
      add("preferred", f, String(p.preferredPredecessorFamily));
    for (const f of fams(p.prohibitedPredecessorFamily))
      add("prohibited", f, String(p.prohibitedPredecessorFamily));
    if (num(p.minimumReturnYears) !== null)
      add("return", num(p.minimumReturnYears), "");
    if (!out.length)
      return emitRef(
        crop,
        rec,
        ev,
        "background",
        `Rotation: ${JSON.stringify(p)}`,
      );
  } else if (metric === "minimum_return_interval") {
    const y = years(p);
    if (y === null) return skip(rec, "no return interval value");
    if (p.condition)
      return emitRef(
        crop,
        rec,
        ev,
        "background",
        `Return interval ${y} years under condition: ${p.condition}.`,
      );
    add(
      "return",
      y,
      p.sourceRangeYears
        ? `Source range ${p.sourceRangeYears.min}–${p.sourceRangeYears.max} years; the larger is used.`
        : "",
    );
  } else if (metric === "rotation") {
    if (p.families !== undefined && /prohibited/.test(item))
      for (const f of p.families)
        add("prohibited", familyOf(f), p.reason ?? "");
    else if (p.families !== undefined && /preferred/.test(item))
      for (const f of p.families) add("preferred", familyOf(f), p.reason ?? "");
    else if (p.years !== undefined && Object.keys(p).length === 1)
      add("return", num(p.years), "");
    else if (
      p.preferredPredecessorFamilies !== undefined ||
      p.minimumReturnIntervalYears !== undefined
    ) {
      for (const f of p.preferredPredecessorFamilies ?? [])
        add("preferred", familyOf(f), "");
      for (const f of p.prohibitedPredecessorFamilies ?? [])
        add("prohibited", familyOf(f), "");
      if (num(p.minimumReturnIntervalYears) !== null)
        add("return", num(p.minimumReturnIntervalYears), "");
      if (p.note && !out.length)
        return emitRef(crop, rec, ev, "background", `Rotation: ${p.note}`);
    } else if (p.preferredPredecessors !== undefined) {
      for (const f of p.families ?? [])
        add(
          "preferred",
          familyOf(f),
          `Previous crops named: ${p.preferredPredecessors.join(", ")}.`,
        );
    } else if (p.classificationString !== undefined)
      return count("identity-hint:ecocrop-family");
    else return skip(rec, "rotation record shape not mapped");
  } else {
    const kind = /prohibited/.test(metric) ? "prohibited" : "preferred";
    let f =
      familyOf(p.family) ??
      familyOf(p.botanicalFamily) ??
      familyOf(p.catalogFamily);
    const list = (p.botanicalFamilies ?? []).map(familyOf).filter(Boolean);
    if (f) add(kind, f, p.condition ?? "");
    else if (list.length) for (const x of list) add(kind, x, p.condition ?? "");
    else return skip(rec, "no botanical family in predecessor record");
  }
  for (const o of out) {
    if (!plannable) {
      emitRef(
        crop,
        rec,
        ev,
        "background",
        `Rotation (${o.kind}): ${o.value}${o.note ? `. ${o.note}` : ""}`,
      );
      continue;
    }
    if (o.kind === "return") {
      const y = Math.round(o.value);
      if (!(y >= 1 && y <= 20)) {
        skip(rec, `return interval ${o.value} outside 1–20 years`);
        continue;
      }
      emitRule(
        crop,
        rec,
        ev,
        { metric: "minimum_return_interval", years: y },
        "return",
        `${text}${o.note} Minimum years before the same crop or family returns.`.trim(),
      );
    } else {
      if (!o.value || !FAMILY.test(o.value)) {
        skip(rec, "predecessor family not a botanical family");
        continue;
      }
      emitRule(
        crop,
        rec,
        ev,
        {
          metric:
            o.kind === "preferred"
              ? "preferred_predecessor_family"
              : "prohibited_predecessor_family",
          family: o.value,
        },
        `pred-${o.kind}|${o.value}`,
        `${text}${o.note} ${o.kind === "preferred" ? "Preferred" : "Avoided"} previous-crop family.`.trim(),
      );
    }
  }
}

function yieldRange(p) {
  if (!p) return null;
  const pairs = [
    [p.minTonnesPerHectare, p.maxTonnesPerHectare],
    [p.minTPerHa, p.maxTPerHa],
    [p.min, p.max],
    [p.low, p.high],
    p.rangeTonnesPerHa
      ? [p.rangeTonnesPerHa[0], p.rangeTonnesPerHa[1]]
      : [null, null],
    [p.valueTonnesPerHa, p.valueTonnesPerHa],
    [p.irrigatedTonnesPerHa, p.irrigatedTonnesPerHa],
    [p.rainfedTonnesPerHa, p.rainfedTonnesPerHa],
  ];
  for (const [a, b] of pairs) {
    const lo = num(a),
      hi = num(b);
    if (lo !== null || hi !== null) return { min: lo, max: hi ?? lo };
  }
  return null;
}
function mapYield(crop, rec, ev, p) {
  const range = yieldRange(p);
  const bits = [
    p?.product ? `product ${p.product}` : null,
    (p?.system ?? p?.farmingSystem)
      ? `system ${p.system ?? p.farmingSystem}`
      : null,
    p?.region ? `region ${p.region}` : null,
    p?.yearsCovered ? `years ${p.yearsCovered.join(", ")}` : null,
    p?.aggregation ?? null,
    p?.note ?? null,
    p?.text ?? null,
  ].filter(Boolean);
  if (!range && !bits.length) return skip(rec, "no yield value");
  const unit = /seed|grain/.test(String(p?.unit ?? ""))
    ? clip(p.unit, 50)
    : "t/ha";
  emitRef(
    crop,
    rec,
    ev,
    "yield",
    `Yield${range ? ` ${range.min ?? "?"}–${range.max ?? "?"} ${unit}` : ""}${bits.length ? ` (${bits.join("; ")})` : ""}${ev.kind === "recall" ? ". AI recall, not a Moroccan statistic." : ""}`,
    range ? { unit, min: range.min, max: range.max } : null,
  );
}
function mapChill(crop, rec, ev, p) {
  if (!p) return skip(rec, "no chill value");
  const lo = num(p.minHours) ?? num(p.low) ?? num(p.chillHours?.min);
  const hi = num(p.maxHours) ?? num(p.high) ?? num(p.chillHours?.max);
  if (lo === null && hi === null) return skip(rec, "no chill hours");
  emitRef(
    crop,
    rec,
    ev,
    "chill_requirement",
    `Chill requirement ${lo ?? "?"}–${hi ?? "?"} ${p.unit ?? "hours"}${p.qualifier ? `; ${p.qualifier}` : ""}${p.note ? `; ${p.note}` : ""}. A dormancy requirement, not a damage limit.`,
    { unit: clip(p.unit ?? "chill hours", 55), min: lo, max: hi ?? lo },
  );
}

// ---------------------------------------------------------- cultivars
const BAD_NAME =
  /unnamed|none|no moroccan|omitted|not recalled|landrace populations/i;
function mapVariety(crop, rec, ev, p) {
  const names = [];
  if (Array.isArray(p?.names))
    for (const n of p.names)
      names.push({
        name: n,
        notes: [p.types?.join("/") ?? p.traits ?? p.origin ?? p.note],
      });
  else {
    const name = rec.name ?? p?.name;
    if (!name) return skip(rec, "variety without a name");
    names.push({
      name,
      notes: [
        rec.varietyKind ?? p?.varietyKind ?? p?.type,
        rec.origin,
        rec.notableTraits,
        p?.moroccanUse && p.moroccanUse !== "unverified"
          ? `Moroccan use: ${p.moroccanUse}`
          : null,
      ],
    });
  }
  for (const { name, notes } of names) {
    const clean = clip(name, 190);
    if (!clean || BAD_NAME.test(clean) || clean.length < 3) {
      skip(rec, `variety name not usable: ${clean}`);
      continue;
    }
    bucket(crop).cultivars.push({
      id: slug(clean).length >= 3 ? slug(clean) : `${slug(clean)}-cv`,
      name: clean,
      notes: clip(notes.filter(Boolean).join("; "), 590),
      ev,
      file: FILES.indexOf(rec._file),
    });
    count(`cultivar:${ev.kind}`);
  }
}

// ------------------------------------------------------------- issues
const issues = new Map();
const issueBreaks = [];
const nameOfIssue = (i) => ({
  nameEn: i.commonNameEn ?? i.nameEn ?? i.commonName?.en ?? null,
  nameFr:
    i.commonNameFr ?? i.nameFr ?? i.frenchName ?? i.commonName?.fr ?? null,
  nameAr:
    i.commonNameAr ?? i.nameAr ?? i.arabicName ?? i.commonName?.ar ?? null,
});
function addIssue(rec, ev, raw, defaultCrop) {
  const kind = raw.kind;
  if (!["disease", "pest", "parasitic_plant", "weed"].includes(kind))
    return skip(rec, `issue kind not usable: ${kind}`);
  const { nameEn, nameFr, nameAr } = nameOfIssue(raw);
  const name = clip(nameEn ?? nameFr ?? nameAr ?? "", 190);
  if (!name) return skip(rec, "issue without a name");
  const sci = raw.scientificName ? clip(raw.scientificName, 190) : null;
  const key = slug(
    sci ? sci.replace(/\b(sp|spp|f\. sp\.)\b.*$/i, "").trim() || sci : name,
  ).slice(0, 70);
  const hostsRaw = raw.hostCrops ?? raw.hostCrop ?? [defaultCrop];
  const hosts = [
    ...new Set(
      (Array.isArray(hostsRaw) ? hostsRaw : [hostsRaw])
        .map(normCrop)
        .filter(Boolean),
    ),
  ];
  if (!hosts.length) hosts.push(defaultCrop);
  const entry = issues.get(key) ?? {
    id: key,
    kind,
    names: { nameEn: null, nameFr: null, nameAr: null },
    sci: null,
    symptoms: null,
    hosts: new Set(),
    citations: new Map(),
    recall: null,
    recallItems: new Set(),
    symptomsRecall: false,
  };
  entry.names.nameEn ??= nameEn ? clip(nameEn, 190) : null;
  entry.names.nameFr ??= nameFr ? clip(nameFr, 190) : null;
  entry.names.nameAr ??= nameAr ? clip(nameAr, 190) : null;
  entry.sci ??= sci;
  const symptoms = raw.visibleSymptoms ?? raw.visibleSigns ?? null;
  if (
    symptoms &&
    (!entry.symptoms || (ev.kind === "sourced" && entry.symptomsRecall))
  ) {
    entry.symptoms = clip(symptoms, 790);
    entry.symptomsRecall = ev.kind === "recall";
  }
  for (const h of hosts) entry.hosts.add(h);
  if (ev.kind === "sourced") {
    entry.citations.set(
      JSON.stringify([ev.citation.sourceId, ev.citation.locator]),
      ev.citation,
    );
  } else {
    entry.recall = entry.recall
      ? {
          ...entry.recall,
          confidence: minConfidence(
            entry.recall.confidence,
            ev.recall.confidence,
          ),
        }
      : { ...ev.recall };
    entry.recallItems.add(rec.item);
  }
  issues.set(key, entry);
  count(`issue:${ev.kind}`);
  const years = num(raw.minimumBreakYears) ?? num(raw.rotationBreakYears);
  if (years !== null && years >= 1 && years <= 20)
    for (const h of hosts)
      issueBreaks.push({
        crop: h,
        issue: key,
        years: Math.round(years),
        rec,
        ev,
      });
}
function mapIssueRecord(crop, rec, ev) {
  const p = rec.proposed;
  if (Array.isArray(p?.issues))
    for (const i of p.issues) addIssue(rec, ev, i, crop);
  else if (p?.kind) addIssue(rec, ev, p, crop);
  else skip(rec, "crop issue record shape not mapped");
}
function mapBackground(crop, rec) {
  const k = rec.knowledge;
  if (!k || !crop) return;
  const ev = {
    kind: "recall",
    recall: recallOf(rec, "Background note from the first research pass."),
  };
  const parts = [
    k.productionHabit,
    k.coldResponse,
    k.heatResponse,
    k.rotationContext,
    k.developmentAndManagement,
  ].filter(Boolean);
  if (parts.length) emitRef(crop, rec, ev, "background", parts.join(" "));
  for (const c of k.cropIssueCandidates ?? [])
    addIssue(
      rec,
      ev,
      {
        kind: c.kind ?? "pest",
        commonNameEn: c.commonNameEn,
        scientificName: c.scientificName,
        visibleSymptoms: c.visibleSigns,
        hostCrops: c.hostCrops,
      },
      crop,
    );
}

// ----------------------------------------------------------------- run
for (const rec of records) await mapRecord(rec);

// Source sizes.
for (const s of newSources.values()) {
  s.evidence.bytes = (await stat(s._file)).size;
  delete s._file;
}

// ---------------------------------------------- resolve rule conflicts
const existingKeys = (crop) => {
  const keys = new Map();
  for (const r of baseProfiles.get(crop)?.rules ?? []) {
    if (r.severity === "reference" || r.verification.status === "extracted")
      continue;
    let key = null;
    if (r.metric === "planting_window")
      key = `window|${Array.isArray(r.scope.farmingSystems) ? r.scope.farmingSystems.join("+") : "any"}|`;
    else if (r.metric === "cycle_duration")
      key = `duration|${r.basis === "stand_lifetime" ? "stand" : "cycle"}|any`;
    else if (
      r.metric === "temperature" &&
      (r.lowerDegC !== null) !== (r.upperDegC !== null)
    )
      key = `temp|${r.lowerDegC !== null ? "cold" : "heat"}|${r.stage === "whole_cycle" ? "wc" : r.stage}`;
    else if (r.metric === "preferred_predecessor_family")
      key = `pred-preferred|${r.family}`;
    else if (r.metric === "prohibited_predecessor_family")
      key = `pred-prohibited|${r.family}`;
    else if (r.metric === "minimum_return_interval") key = "return";
    if (key) keys.set(key, r.id);
  }
  return keys;
};
const valueOf = (r) =>
  JSON.stringify([
    r.start,
    r.end,
    r.minDays,
    r.maxDays,
    r.lowerDegC,
    r.upperDegC,
    r.years,
    r.family,
  ]);
function resolve(crop) {
  const b = bucket(crop);
  const blocked = existingKeys(crop);
  const groups = new Map();
  for (const entry of b.rules) {
    const list = groups.get(entry.key) ?? [];
    list.push(entry);
    groups.set(entry.key, list);
  }
  const kept = [];
  for (const [key, list] of groups) {
    // A sourced temperature whose measurement the source leaves unspecified
    // cannot be evaluated by the engine, so it does not displace a recalled
    // rule that can.
    const evaluable = (r) =>
      r.metric !== "temperature" ||
      (["daily_minimum", "daily_maximum", "daily_mean"].includes(r.basis) &&
        r.medium === "air");
    const verified = list.filter((e) => e.quality === 3 && evaluable(e.rule));
    const weak = list.filter(
      (e) => e.quality === 2 || (e.quality === 3 && !evaluable(e.rule)),
    );
    const recalled = list.filter((e) => e.quality === 1);
    kept.push(...verified, ...weak);
    for (const w of weak)
      for (const e of recalled)
        if (valueOf(w.rule) !== valueOf(e.rule))
          log.conflicts.push({
            crop,
            key,
            sourcedEvidenceOnly: w.rule.id,
            recalled: e.rule.id,
            resolution: "both kept; the sourced rule is evidence only",
          });
    const winner = blocked.has(key)
      ? `0.9.0 rule ${blocked.get(key)}`
      : verified[0]
        ? `sourced rule ${verified[0].rule.id}`
        : null;
    if (winner) {
      for (const e of recalled) {
        const differs = verified[0]
          ? valueOf(e.rule) !== valueOf(verified[0].rule)
          : true;
        log.dropped.push({
          crop,
          dropped: e.rule.id,
          kept: winner,
          reason: "sourced beats recall",
          valuesDiffer: differs,
        });
        if (differs)
          log.conflicts.push({ crop, key, recalled: e.rule.id, kept: winner });
      }
      continue;
    }
    // Recall only: best confidence, then file order; drop identical duplicates.
    recalled.sort(
      (x, y) =>
        CONF_RANK[y.confidence] - CONF_RANK[x.confidence] ||
        x.file - y.file ||
        (x.rule.id < y.rule.id ? -1 : 1),
    );
    if (recalled.length) kept.push(recalled[0]);
    for (const e of recalled.slice(1))
      log.dropped.push({
        crop,
        dropped: e.rule.id,
        kept: recalled[0].rule.id,
        reason:
          valueOf(e.rule) === valueOf(recalled[0].rule)
            ? "duplicate recall"
            : "lower-confidence recall for the same question",
      });
  }
  return kept;
}

// ------------------------------------------------------------- profiles
const cultivarFrom = (c) => {
  const sourced = c.ev.kind === "sourced";
  return {
    id: c.id,
    name: c.name,
    registration: "unknown",
    citations: sourced ? [c.ev.citation] : [],
    ...(sourced ? {} : { recall: c.ev.recall }),
    ...(c.notes ? { notes: c.notes } : {}),
  };
};
function mergeCultivars(crop, existing) {
  const out = [...existing];
  const seen = new Set(existing.map((c) => c.id));
  const incoming = [...bucket(crop).cultivars].sort((a, b) =>
    a.ev.kind === b.ev.kind
      ? a.file - b.file
      : a.ev.kind === "sourced"
        ? -1
        : 1,
  );
  for (const c of incoming) {
    if (seen.has(c.id)) continue;
    if (out.length >= 50) {
      log.dropped.push({
        crop,
        dropped: c.id,
        reason: "cultivar cap of 50 reached",
      });
      continue;
    }
    seen.add(c.id);
    out.push(cultivarFrom(c));
  }
  return out;
}
const standardGap = (topic, reason) => ({ topic, reason });
function gapsFor(crop, rules, type, base) {
  const gaps = [...(base?.gaps ?? [])];
  const have = (m) =>
    rules.some(
      (r) =>
        r.metric === m &&
        r.severity !== "reference" &&
        r.verification.status !== "extracted",
    );
  const add = (t, r) => {
    if (!gaps.some((g) => g.topic === t)) gaps.push(standardGap(t, r));
  };
  if (type === "orchard" || type === "wild_harvested") {
    add(
      "planting_window",
      type === "orchard"
        ? "Tree crops are not planned as rotations."
        : "Wild-harvested plants are not planned as rotations.",
    );
    return gaps;
  }
  if (!have("planting_window"))
    add("planting_window", "No usable planting window.");
  if (!have("cycle_duration"))
    add("cycle_duration", "No usable cycle or stand duration.");
  if (
    !rules.some((r) => r.metric === "temperature" && r.severity !== "reference")
  )
    add("temperature", "No usable damage temperature.");
  if (
    !rules.some(
      (r) =>
        [
          "preferred_predecessor_family",
          "prohibited_predecessor_family",
          "minimum_return_interval",
        ].includes(r.metric) && r.severity !== "reference",
    )
  )
    add("rotation", "No usable rotation rule.");
  add("soil", "No soil pH, salinity or drainage rule.");
  add("water_demand", "No FAO-56 water curve or demand class.");
  return gaps.slice(0, 20);
}
const finalProfiles = [];
const outRules = new Map();
for (const crop of [...cropIds].sort()) {
  const base = baseProfiles.get(crop);
  const b = bucket(crop);
  const type = planner(crop);
  const kept = resolve(crop);
  kept.sort((x, y) => (x.rule.id < y.rule.id ? -1 : 1));
  let rules = [...(base?.rules ?? []), ...kept.map((e) => e.rule)];
  // crop_health_break rules are added after issues are final.
  b.finalRules = rules;
  b.type = type;
  outRules.set(crop, b);
}
// Issue objects.
const issueList = [];
const baseIssueIds = new Set(baseManifest.issues.map((i) => i.id));
for (const e of [...issues.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
  if (baseIssueIds.has(e.id)) {
    log.dropped.push({ dropped: e.id, reason: "issue id already in 0.9.0" });
    continue;
  }
  const name = e.names.nameEn ?? e.names.nameFr ?? e.names.nameAr;
  const localNames = [];
  if (e.names.nameFr && e.names.nameFr !== name)
    localNames.push({ language: "fr", name: e.names.nameFr });
  if (e.names.nameAr && e.names.nameAr !== name)
    localNames.push({ language: "ar", name: e.names.nameAr });
  const citations = [...e.citations.values()].slice(0, 12);
  const recall = e.recall
    ? {
        ...e.recall,
        basis: clip(
          `${e.recall.basis} Items: ${[...e.recallItems].slice(0, 4).join(", ")}${e.recallItems.size > 4 ? ", …" : ""}.`,
          1900,
        ),
        researchItem: clip([...e.recallItems][0], 150),
      }
    : undefined;
  const issue = {
    id: e.id,
    kind: e.kind,
    name,
    scientificName: e.sci,
    localNames,
    hostCropIds: [...e.hosts].sort(),
    ...(e.symptoms ? { visibleSymptoms: e.symptoms } : {}),
    citations,
    ...(recall ? { recall } : {}),
    synthetic: false,
  };
  const parsed = cropIssueSchema.safeParse(issue);
  if (!parsed.success) {
    log.skipped.push({
      item: `issue:${e.id}`,
      reason: parsed.error.issues[0]?.message,
    });
    continue;
  }
  issueList.push(parsed.data);
}
const issueById = new Map(issueList.map((i) => [i.id, i]));
const seenBreaks = new Set();
for (const br of issueBreaks) {
  const issue = issueById.get(br.issue);
  if (!issue || !issue.hostCropIds.includes(br.crop)) continue;
  const k = `${br.crop}|${br.issue}`;
  if (seenBreaks.has(k)) continue;
  seenBreaks.add(k);
  const b = bucket(br.crop);
  if (b.type === "orchard" || b.type === "wild_harvested") continue;
  emitRule(
    br.crop,
    br.rec,
    br.ev,
    {
      metric: "crop_health_break",
      issueId: br.issue,
      minimumBreakDays: br.years * 365,
    },
    `break|${br.issue}`,
    `${br.years} years without host crops after ${issue.name}.`,
  );
}
// Re-resolve rules now that break rules exist, then assemble profiles.
for (const crop of [...cropIds].sort()) {
  const base = baseProfiles.get(crop);
  const b = bucket(crop);
  const type = planner(crop);
  const kept = resolve(crop)
    .map((e) => e.rule)
    .sort((x, y) => (x.id < y.id ? -1 : 1));
  let rules = [...(base?.rules ?? []), ...kept];
  if (rules.length > 64) {
    const extra = rules.length - 64;
    log.dropped.push({
      crop,
      reason: `rule cap of 64 exceeded by ${extra}; lowest-priority recall rules trimmed`,
    });
    const baseCount = base?.rules.length ?? 0;
    rules = [
      ...rules.slice(0, baseCount),
      ...rules.slice(baseCount).slice(0, 64 - baseCount),
    ];
  }
  const refs = [...b.refs]
    .sort((x, y) =>
      x.recall === y.recall ? x.file - y.file : x.recall ? 1 : -1,
    )
    .map((r) => r.ref);
  const seenRef = new Set();
  const references = refs
    .filter((r) => (seenRef.has(r.id) ? false : seenRef.add(r.id)))
    .slice(0, 60);
  const cultivars = mergeCultivars(crop, base?.cultivars ?? []);
  let profile;
  if (base) {
    profile = {
      ...base,
      version: VERSION,
      cultivars,
      rules,
      ...(references.length ? { references } : {}),
      gaps: base.gaps,
      limitations: [
        ...base.limitations,
        "Release 0.10.0 adds rules recalled by the AI model (marked model_recall), references and cultivars; they are unverified and not expert-reviewed.",
      ].slice(0, 20),
    };
  } else {
    const id = identities.get(crop);
    const sourcedPresence = b.presence
      .filter((x) => x.ev.kind === "sourced")
      .map((x) => x.ev.citation)
      .slice(0, 3);
    const identityRecall = {
      confidence: "medium",
      basis:
        "Names, scientific name and family recalled by the AI model; check against GBIF.",
      valueKind: "model_recall_unverified",
      recordedOn: TODAY,
      researchItem: `identity:${crop}`,
    };
    const localNames = [{ language: "fr", name: id.fr }];
    if (id.ar) localNames.push({ language: "ar", name: id.ar });
    profile = {
      id: crop,
      version: VERSION,
      synthetic: false,
      identity: {
        name: id.en,
        localNames,
        scientificName: id.scientificName,
        family: id.family,
        citations: [],
        recall: identityRecall,
      },
      harvestProduct: id.harvestProduct,
      modelType: id.modelType,
      cultivars,
      applicability: [
        {
          regionId: "morocco-general",
          status: "candidate",
          citations: sourcedPresence,
          ...(sourcedPresence.length
            ? {}
            : {
                recall: {
                  confidence: "low",
                  basis:
                    "Presence in Morocco recalled by the AI model; no source consulted.",
                  valueKind: "model_recall_unverified",
                  recordedOn: TODAY,
                  researchItem: `presence:${crop}`,
                },
              }),
          note: "Candidate only: not validated for any region.",
        },
      ],
      rules,
      ...(references.length ? { references } : {}),
      gaps: gapsFor(crop, rules, type, null),
      limitations: [
        "Most facts about this crop are recalled by the AI model (marked model_recall); they are unverified and not expert-reviewed.",
        type === "orchard"
          ? "Listed as an orchard crop: it is not placed in a rotation."
          : type === "wild_harvested"
            ? "Wild-harvested plant: listed for knowledge, never placed in a rotation."
            : "Moroccan sowing windows, damage limits and rotation rules for this crop need a source or an agronomist before they are relied on.",
      ],
    };
  }
  const parsed = cropProfileV2Schema.safeParse(profile);
  if (!parsed.success) {
    log.notes.push({
      crop,
      error: parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join(".")} ${i.message}`),
    });
    continue;
  }
  finalProfiles.push(parsed.data);
}

// ------------------------------------------------------ write release
const fixIssueHosts = (issue) => ({
  ...issue,
  hostCropIds: issue.hostCropIds.filter((h) =>
    finalProfiles.some((p) => p.id === h),
  ),
});
const allIssues = [
  ...baseManifest.issues,
  ...issueList.map(fixIssueHosts),
].filter((i) => i.hostCropIds.length);
// crop_health_break rules must point at an issue hosted by their crop.
const issueHosts = new Map(
  allIssues.map((i) => [i.id, new Set(i.hostCropIds)]),
);
for (const p of finalProfiles)
  p.rules = p.rules.filter(
    (r) =>
      r.metric !== "crop_health_break" || issueHosts.get(r.issueId)?.has(p.id),
  );

const sources = [
  ...baseSources,
  ...[...newSources.values()].sort((a, b) => (a.id < b.id ? -1 : 1)),
];
// Drop sources nothing cites.
const cited = new Set();
const walk = (v) => {
  if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === "object") {
    if (typeof v.sourceId === "string") cited.add(v.sourceId);
    Object.values(v).forEach(walk);
  }
};
walk(finalProfiles);
walk(allIssues);
walk(baseManifest.regions);
const usedSources = sources.filter(
  (s) => cited.has(s.id) || baseSources.some((b) => b.id === s.id),
);
const manifest = {
  ...baseManifest,
  version: VERSION,
  issues: allIssues,
  sourceFile: "sources.json",
  profileFiles: finalProfiles.map((p) => `profiles/${p.id}.json`),
};
const bundle = { ...manifest, sources: usedSources, profiles: finalProfiles };
delete bundle.sourceFile;
delete bundle.profileFiles;
const prepared = prepareCatalogV2(bundle);

const json = (v) => format(JSON.stringify(v), { parser: "json" });
await mkdir(join(OUT, "profiles"), { recursive: true });
await mkdir(LOG_DIR, { recursive: true });
await writeFile(join(OUT, "sources.json"), await json(usedSources));
for (const p of finalProfiles)
  await writeFile(join(OUT, `profiles/${p.id}.json`), await json(p));
await writeFile(join(OUT, "manifest.json"), await json(manifest));
// New quote checks: every quoted citation on a sourced rule, issue or cultivar.
const checks = [...baseQuoteCheck.checks];
for (const p of finalProfiles)
  for (const r of p.rules)
    r.citations.forEach((c, i) => {
      if (c.quote && !baseProfiles.get(p.id)?.rules.some((x) => x.id === r.id))
        checks.push({
          where: `${p.id}:${r.id}:${i}`,
          sourceId: c.sourceId,
          page: c.page ?? null,
          quoteSha256: sha(c.quote),
          matched: true,
        });
    });
await writeFile(
  join(OUT, "quote-check.json"),
  await json({
    method:
      "0.9.0 checks carried forward (PDF.js 6.3.289). New 0.10.0 checks: NFC, case-insensitive, whitespace-insensitive substring of the saved source text (.research-sources, not committed); recalled rules have no quote and no entry here.",
    checkedOn: TODAY,
    citations: checks.length,
    matched: checks.filter((c) => c.matched).length,
    checks,
  }),
);
const recallRules = finalProfiles.reduce(
  (n, p) =>
    n + p.rules.filter((r) => r.verification.status === "model_recall").length,
  0,
);
const groupOf = (p) => {
  if (p.modelType === "orchard") return "Orchard and nut trees";
  if (p.modelType === "wild_harvested") return "Wild-harvested plants";
  if (p.harvestProduct === "forage") return "Forage";
  if (
    p.identity.family === "Fabaceae" &&
    ["dry_grain", "green_pods"].includes(p.harvestProduct)
  )
    return "Pulses";
  if (
    ["dry_grain", "oilseed", "sugar_root", "fiber"].includes(p.harvestProduct)
  )
    return "Cereals, oilseeds and industrial crops";
  if (["vegetable", "root_tuber"].includes(p.harvestProduct))
    return "Vegetables and roots";
  if (p.harvestProduct === "fruit") return "Berries and other fruit";
  return "Herbs, spices and medicinal plants";
};
const groupById = new Map(finalProfiles.map((p) => [p.id, groupOf(p)]));
const issuesByGroup = {};
for (const issue of allIssues)
  for (const g of new Set(issue.hostCropIds.map((h) => groupById.get(h)))) {
    issuesByGroup[g] ??= { issues: 0, cropIssueLinks: 0 };
    issuesByGroup[g].issues++;
  }
for (const issue of allIssues)
  for (const h of issue.hostCropIds)
    issuesByGroup[groupById.get(h)].cropIssueLinks++;
const hostedCrops = new Set(allIssues.flatMap((i) => i.hostCropIds));
const summary = {
  version: VERSION,
  generatedFor: "research commit bdf538f",
  profiles: finalProfiles.length,
  newProfiles: finalProfiles.filter((p) => !baseProfiles.has(p.id)).length,
  sources: usedSources.length,
  newSources: usedSources.length - baseSources.length,
  issues: allIssues.length,
  newIssues: allIssues.length - baseManifest.issues.length,
  rules: finalProfiles.reduce((n, p) => n + p.rules.length, 0),
  recallRules,
  doubleCheckedNewRules: finalProfiles.reduce(
    (n, p) =>
      n +
      p.rules.filter(
        (r) =>
          r.verification.status === "double_checked" &&
          !baseProfiles.get(p.id)?.rules.some((x) => x.id === r.id),
      ).length,
    0,
  ),
  cultivars: finalProfiles.reduce((n, p) => n + p.cultivars.length, 0),
  references: finalProfiles.reduce(
    (n, p) => n + (p.references?.length ?? 0),
    0,
  ),
  canonicalBytes: new TextEncoder().encode(prepared.canonicalJson).byteLength,
  sha256: prepared.sha256,
  issuesByGroup,
  cropsWithoutIssues: finalProfiles
    .map((p) => p.id)
    .filter((id) => !hostedCrops.has(id)),
  schedulableAnnuals: finalProfiles.filter(
    (p) => p.modelType === "annual" || p.modelType === "multi_year_stand",
  ).length,
};
await writeFile(
  join(LOG_DIR, "merge-log.json"),
  await json({
    summary,
    mapped: log.mapped,
    notes: log.notes,
    conflicts: log.conflicts,
    dropped: log.dropped,
    skipped: log.skipped,
  }),
);
console.log(JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify({
    skipped: log.skipped.length,
    dropped: log.dropped.length,
    notes: log.notes.length,
  }),
);
