// Builds catalog release 0.12.0 from the committed release 0.11.0.
// Strictly additive: 0.12.0 only adds names. Every crop, cultivar, rule,
// problem, region, quote and reference of 0.11.0 is carried over unchanged;
// the only fields that grow are identity.localNames and, new in this release,
// cultivars[].localNames. Each added name carries its own recall record
// (model recall, confidence, basis, date). Deterministic and offline.
// Usage: node tooling/catalog/build-release-0.12.0.mjs
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { format } from "prettier";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
import { CROP_NAMES, CULTIVAR_NAMES } from "./release-0.12.0.names.mjs";

const VERSION = "0.12.0";
const TODAY = "2026-11-09";
const BASE = "data/catalog/releases/0.11.0";
const OUT = `data/catalog/releases/${VERSION}`;
const LOG_DIR = "docs/evidence/catalog/2026-11-09";
const LEVEL = { h: "high", m: "medium", l: "low" };
const BASIS = {
  fr: "French name recalled by the AI model; no source consulted.",
  ar: "Modern Standard Arabic name recalled by the AI model; no source consulted.",
  ary: "Moroccan Arabic (Darija) name recalled by the AI model as Moroccans commonly say it; spelling is not standardised and no source was consulted. Needs a native speaker's review.",
};
const LANGUAGES = ["fr", "ar", "ary"];

const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));
const json = (v) => format(JSON.stringify(v), { parser: "json" });
const recall = (item, language, level) => ({
  confidence: LEVEL[level],
  basis: BASIS[language],
  valueKind: "model_recall_unverified",
  recordedOn: TODAY,
  researchItem: item.slice(0, 160),
});
const rows = (text) =>
  text
    .trim()
    .split("\n")
    .filter((l) => l.trim() && !l.startsWith("#"));

const baseManifest = await readJson(`${BASE}/manifest.json`);
const sources = await readJson(`${BASE}/sources.json`);
const quoteCheck = await readJson(`${BASE}/quote-check.json`);
const original = new Map();
for (const file of baseManifest.profileFiles)
  original.set(
    file.replace(/^profiles\/|\.json$/g, ""),
    await readJson(`${BASE}/${file}`),
  );
const profiles = new Map(
  [...original].map(([id, p]) => [id, structuredClone(p)]),
);

const log = { skipped: [], notes: [] };
const added = { fr: 0, ar: 0, ary: 0, cultivarAr: 0, cultivarAry: 0 };
const addedNames = []; // for the review file
const has = (names, language) => names.some((n) => n.language === language);

// ---- 1. crop names ---------------------------------------------------------
const seen = new Set();
for (const line of rows(CROP_NAMES)) {
  const f = line.split("|").map((x) => x.trim());
  if (f.length !== 6) {
    log.skipped.push({ row: line.slice(0, 80), reason: "bad crop row" });
    continue;
  }
  const [id, fr, ar, ary, arLevel, aryLevel] = f;
  const profile = profiles.get(id);
  if (!profile || seen.has(id)) {
    log.skipped.push({
      crop: id,
      reason: profile ? "duplicate row" : "no such crop",
    });
    continue;
  }
  seen.add(id);
  const names = profile.identity.localNames;
  const adds = [
    ["fr", fr, "h"],
    ["ar", ar, arLevel],
    ["ary", ary, aryLevel],
  ];
  for (const [language, name, level] of adds) {
    if (name === "-") continue;
    if (!LEVEL[level]) {
      log.skipped.push({ crop: id, language, reason: "bad confidence" });
      continue;
    }
    if (has(names, language)) {
      log.skipped.push({
        crop: id,
        language,
        reason: "0.11.0 already has one",
      });
      continue;
    }
    names.push({
      language,
      name,
      recall: recall(`C12.name.${id}.${language}`, language, level),
    });
    added[language]++;
    addedNames.push({ scope: "crop", id, language, name, level });
  }
}

// ---- 2. cultivar names -----------------------------------------------------
const cultivarSeen = new Set();
for (const line of rows(CULTIVAR_NAMES)) {
  const f = line.split("|").map((x) => x.trim());
  if (f.length !== 4) {
    log.skipped.push({ row: line.slice(0, 80), reason: "bad cultivar row" });
    continue;
  }
  const [path, language, name, level] = f;
  const [cropId, suffix] = path.split("/");
  const profile = profiles.get(cropId);
  const cultivar = profile?.cultivars.find((c) => c.id === suffix);
  if (!cultivar || !LANGUAGES.includes(language) || !LEVEL[level]) {
    log.skipped.push({
      cultivar: path,
      language,
      reason: "no such cultivar or bad row",
    });
    continue;
  }
  const key = `${path}|${language}`;
  if (cultivarSeen.has(key)) {
    log.skipped.push({ cultivar: path, language, reason: "duplicate row" });
    continue;
  }
  cultivarSeen.add(key);
  cultivar.localNames ??= [];
  cultivar.localNames.push({
    language,
    name,
    recall: recall(`C12.name.${cultivar.id}.${language}`, language, level),
  });
  added[language === "ar" ? "cultivarAr" : "cultivarAry"]++;
  addedNames.push({
    scope: "cultivar",
    id: cultivar.id,
    language,
    name,
    level,
  });
}

// ---- 3. assemble, validate, write ------------------------------------------
const finalProfiles = [...profiles.values()]
  .map((p) => ({ ...p, version: VERSION }))
  .sort((a, b) => (a.id < b.id ? -1 : 1));
const manifest = {
  ...baseManifest,
  version: VERSION,
  profileFiles: finalProfiles.map((p) => `profiles/${p.id}.json`),
};
const bundle = { ...manifest, sources, profiles: finalProfiles };
delete bundle.sourceFile;
delete bundle.profileFiles;
const prepared = prepareCatalogV2(bundle);

// Additive check: apart from the two name fields, every profile is identical,
// and every name of 0.11.0 is still there, unchanged and in place.
const strip = (p) => {
  const c = structuredClone(p);
  c.version = "";
  delete c.identity.localNames;
  for (const cv of c.cultivars) delete cv.localNames;
  return JSON.stringify(c);
};
const lost = [];
for (const [id, old] of original) {
  const now = profiles.get(id);
  if (strip(old) !== strip({ ...now }))
    lost.push(`profile ${id} changed outside the name fields`);
  old.identity.localNames.forEach((n, i) => {
    if (JSON.stringify(now.identity.localNames[i]) !== JSON.stringify(n))
      lost.push(`name ${id}#${i}`);
  });
  old.cultivars.forEach((cv, i) => {
    if (cv.id !== now.cultivars[i]?.id) lost.push(`cultivar order ${id}#${i}`);
    if (cv.localNames) lost.push(`unexpected 0.11.0 cultivar names ${id}`);
  });
}
const baseWithoutVersion = { ...baseManifest, version: "", profileFiles: [] };
const nowWithoutVersion = { ...manifest, version: "", profileFiles: [] };
if (JSON.stringify(baseWithoutVersion) !== JSON.stringify(nowWithoutVersion))
  lost.push("manifest changed");
if (lost.length) {
  console.error("NOT ADDITIVE:", lost.slice(0, 20), lost.length);
  process.exit(1);
}

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
    method: `${quoteCheck.method} 0.12.0 carries every check forward unchanged and adds names only: recalled names have no quote.`,
  }),
);

// ---- 4. counts, gaps and the review file -----------------------------------
const count = (list, language) =>
  list.filter((p) => has(p.identity.localNames, language)).length;
const gaps = {
  fr: finalProfiles
    .filter((p) => !has(p.identity.localNames, "fr"))
    .map((p) => p.id),
  ar: finalProfiles
    .filter((p) => !has(p.identity.localNames, "ar"))
    .map((p) => p.id),
  ary: finalProfiles
    .filter((p) => !has(p.identity.localNames, "ary"))
    .map((p) => p.id),
};
const cultivarTotal = finalProfiles.reduce((n, p) => n + p.cultivars.length, 0);
const cultivarsNamed = finalProfiles.reduce(
  (n, p) => n + p.cultivars.filter((c) => c.localNames?.length).length,
  0,
);
const summary = {
  version: VERSION,
  crops: finalProfiles.length,
  cropsWith: {
    fr: count(finalProfiles, "fr"),
    ar: count(finalProfiles, "ar"),
    ary: count(finalProfiles, "ary"),
  },
  cultivars: cultivarTotal,
  cultivarsWithNames: cultivarsNamed,
  added,
  gaps: { fr: gaps.fr.length, ar: gaps.ar.length, ary: gaps.ary.length },
  skipped: log.skipped.length,
  removedFromPrevious: 0,
  canonicalBytes: new TextEncoder().encode(prepared.canonicalJson).byteLength,
  sha256: prepared.sha256,
};
await writeFile(
  join(LOG_DIR, "names-log.json"),
  await json({ summary, gaps, skipped: log.skipped, addedNames }),
);

const nameOf = (p) => p.identity.name;
const byId = new Map(finalProfiles.map((p) => [p.id, p]));
const table = (list) =>
  [
    "| Item | Language | Name | Confidence |",
    "| --- | --- | --- | --- |",
    ...list.map(
      (n) =>
        `| ${n.scope} \`${n.id}\` | ${n.language} | ${n.name} | ${n.level === "h" ? "high" : n.level === "m" ? "medium" : "low"} |`,
    ),
  ].join("\n");
const lowOnes = addedNames.filter((n) => n.level === "l");
const darija = addedNames.filter((n) => n.language === "ary");
const review = `# Names for native-speaker review (catalog ${VERSION})

Recorded ${TODAY}. Every name below was recalled by the AI model; no source was
consulted. Nothing was removed from 0.11.0. This file lists what a native
speaker should check first, and the crops that still have no name.

## 1. Moroccan Arabic (Darija) names

Spelling is not standardised. Check the word and the Arabic-script spelling.
${darija.length} names.

${table(darija)}

## 2. Names recorded with low confidence (any language)

${lowOnes.length} names. Remove or correct what is wrong; a wrong crop name is
worse than none.

${table(lowOnes)}

## 3. Gaps: no name recorded

Crops without a Darija name (${gaps.ary.length}): a Darija name was left out
unless I was reasonably sure of a real, commonly used one.

${gaps.ary.map((id) => `- \`${id}\` ${nameOf(byId.get(id))}`).join("\n")}

Crops without a Modern Standard Arabic name (${gaps.ar.length}):

${gaps.ar.length ? gaps.ar.map((id) => `- \`${id}\` ${nameOf(byId.get(id))}`).join("\n") : "- none"}

Crops without a French name (${gaps.fr.length}):

${gaps.fr.length ? gaps.fr.map((id) => `- \`${id}\` ${nameOf(byId.get(id))}`).join("\n") : "- none"}

## 4. Varieties

Most varieties are international proper names that keep their single name.
Only varieties with a real Arabic-script or Moroccan name were given one
(${added.cultivarAr} Arabic, ${added.cultivarAry} Darija); ${cultivarTotal - cultivarsNamed} of
${cultivarTotal} varieties have no extra name by design.
`;
await writeFile(
  join(LOG_DIR, "names-for-native-review.md"),
  await format(review, { parser: "markdown" }),
);
console.log(JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ skipped: log.skipped }, null, 1));
