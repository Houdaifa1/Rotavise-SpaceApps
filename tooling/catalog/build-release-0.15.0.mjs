// Offline additive release. First assemble the two research filesets, then run:
// node tooling/catalog/build-release-0.15.0.mjs
// Raw upstream snapshots stay in .research-sources/2026-11-11 (not redistributed).
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { format } from "prettier";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
const BASE = "data/catalog/releases/0.14.0",
  OUT = "data/catalog/releases/0.15.0",
  ROOT = "docs/evidence/catalog/2026-11-11/benefits",
  EXTRACTS = `${OUT}/research-quote-extracts.json`;
const sha = (v) => createHash("sha256").update(v).digest("hex");
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const json = (v) => format(JSON.stringify(v), { parser: "json" });
const manifest = await read(`${BASE}/manifest.json`),
  sources = await read(`${BASE}/sources.json`),
  audit = await read(`${BASE}/quote-check.json`);
const originals = await Promise.all(
    manifest.profileFiles.map((p) => read(`${BASE}/${p}`)),
  ),
  profiles = structuredClone(originals);
const sourceManifest = await read(`${ROOT}/benefits-sources.json`),
  roles = await read(`${ROOT}/benefits-roles.json`),
  summary = await read(`${ROOT}/benefits-summary.json`);
const inputHashes = {},
  checks = [],
  sourceMap = new Map(sourceManifest.map((s) => [s.id, s]));
for (const path of [
  `${ROOT}/benefits-sources.json`,
  `${ROOT}/benefits-roles.json`,
  `${ROOT}/benefits-summary.json`,
  ...summary.batches,
])
  inputHashes[path] = sha(await readFile(path));
const texts = new Map();
for (const s of sourceManifest) {
  const raw = await readFile(s.savedFile),
    text = await readFile(s.textFile);
  if (
    sha(raw) !== s.sha256 ||
    sha(text) !== s.textSha256 ||
    raw.length !== s.bytes
  )
    throw new Error(`SOURCE_HASH ${s.id}`);
  for (const artifact of s.derivedArtifacts ?? [])
    if (sha(await readFile(artifact.savedFile)) !== artifact.sha256)
      throw new Error(`DERIVATIVE_HASH ${s.id}`);
  texts.set(s.id, text.toString("utf8"));
}
function check(c, sourceId, where) {
  const source = sourceMap.get(sourceId),
    text = texts.get(sourceId);
  if (!source || c.sourceSha256 !== source.sha256 || !text.includes(c.quote))
    throw new Error(`QUOTE_NOT_FOUND ${where}`);
  if (c.sourceId !== `b4-${sourceId}` || c.quoteCheck !== where)
    throw new Error(`CITATION_BINDING ${where}`);
  checks.push({
    where,
    sourceId: c.sourceId,
    sourceSha256: source.sha256,
    quote: c.quote,
    locator: c.locator,
    textFile: source.textFile,
    textSha256: source.textSha256,
    matched: true,
    method: source.visualReview
      ? "literal visually reviewed transcription; original, render and transcript SHA-256 verified"
      : "literal saved visible text; original and derivative SHA-256 verified",
  });
}
const records = [];
for (const path of summary.batches) records.push(...(await read(path)).crops);
for (const p of profiles) {
  const crop = records.find((r) => r.cropId === p.id);
  if (!crop) throw new Error(`MISSING_CROP ${p.id}`);
  p.version = "0.15.0";
  p.research.benefits.version = "benefits-2";
  p.research.benefits.records = crop.findings.map((f) => {
    const citations = [];
    if (f.status === "sourced") {
      const source = sourceMap.get(f.sourceId),
        where = `b4:${f.id}`;
      const citation = {
        sourceId: `b4-${f.sourceId}`,
        quote: f.quote.original,
        locator: JSON.stringify(f.quote.locator),
        sourceSha256: source.sha256,
        quoteCheck: where,
      };
      check(citation, f.sourceId, where);
      citations.push(citation);
    } else if (f.quote !== null || f.sourceId !== null || !f.recall)
      throw new Error(`RECALL_PROVENANCE ${f.id}`);
    return {
      id: f.id,
      category: f.effectCategory,
      status: f.status,
      effect: f.effect,
      nonLocal: f.regionApplicability.nonLocal,
      region: f.regionApplicability.region,
      conditions: f.conditions,
      magnitude: f.magnitude,
      citations,
      ...(f.recall ? { recall: f.recall } : {}),
      ...(f.status === "not_found"
        ? { applicability: "not_applicable", reason: f.notFoundReason }
        : {}),
    };
  });
  const previous = structuredClone(p);
  previous.version = "0.14.0";
  delete previous.research.benefits.version;
  delete previous.research.benefits.records;
  if (
    JSON.stringify(previous) !==
    JSON.stringify(originals.find((o) => o.id === p.id))
  )
    throw new Error(`NOT_ADDITIVE ${p.id}`);
}
for (const role of roles.entries)
  for (const c of role.evidence.citations)
    check(c, c.sourceId.slice(3), c.quoteCheck);
const used = new Set(checks.map((c) => c.sourceId));
for (const s of sourceManifest) {
  const id = `b4-${s.id}`;
  if (!used.has(id)) continue;
  sources.push({
    id,
    title: s.title,
    publisher: s.publisher,
    url: s.url,
    publicationYear: null,
    accessedAt: new Date(s.retrievedOn).toISOString(),
    evidence: {
      kind: "document_bytes",
      sha256: s.sha256,
      bytes: s.bytes,
      artifactPath: null,
      captureNote: `Original ${s.savedFile} and derived ${s.textFile} are local snapshots. ${EXTRACTS} binds the short quotes and source hashes.`,
    },
    geographicScope:
      "Only the country, scope and management stated in each benefit record.",
    limitations: [
      "AI extraction and translations are not expert reviewed.",
      "Full original bytes are not redistributed; reuse licence not verified.",
    ],
    synthetic: false,
    kind: "other",
    rights: {
      reuse: "unknown",
      licence: "Reuse licence not verified",
      note: "Short research quotations only; no permission to redistribute full originals is claimed.",
    },
  });
}
const release = { ...manifest, version: "0.15.0" },
  bundle = { ...release, sources, profiles };
delete bundle.sourceFile;
delete bundle.profileFiles;
const prepared = prepareCatalogV2(bundle);
await mkdir(`${OUT}/profiles`, { recursive: true });
for (const p of profiles)
  await writeFile(`${OUT}/profiles/${p.id}.json`, await json(p));
await writeFile(`${OUT}/manifest.json`, await json(release));
await writeFile(`${OUT}/sources.json`, await json(sources));
const extracts = await json({ checkedOn: "2026-11-11", inputHashes, checks });
await writeFile(EXTRACTS, extracts);
const added = checks.map((q) => ({
  where: q.where,
  sourceId: q.sourceId,
  sourceSha256: q.sourceSha256,
  quoteSha256: sha(q.quote),
  matched: true,
  method: q.method,
  extractPath: EXTRACTS,
  extractSha256: sha(extracts),
}));
await writeFile(
  `${OUT}/quote-check.json`,
  await json({
    ...audit,
    citations: audit.citations + added.length,
    matched: audit.matched + added.length,
    checks: [...audit.checks, ...added],
  }),
);
const verification = {
  recordedOn: "2026-11-11",
  crops: profiles.length,
  newRecords: profiles.reduce(
    (n, p) => n + p.research.benefits.records.length,
    0,
  ),
  newCitationOccurrences: added.length,
  sourceHashesChecked: sourceManifest.length,
  coverageComplete: true,
  catalogSha256: prepared.sha256,
  canonicalBytes: Buffer.byteLength(prepared.canonicalJson),
  inputHashes,
};
await writeFile(`${ROOT}/benefits-verification.json`, await json(verification));
console.log(JSON.stringify(verification, null, 2));
