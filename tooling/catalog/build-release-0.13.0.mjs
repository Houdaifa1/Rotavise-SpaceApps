// Builds 0.13.0 from immutable 0.12.0. Only name lists and the source list grow;
// existing names, including recall records and their order, stay intact.
// Offline and deterministic, using the hash-checked original research snapshots.
// Usage: node tooling/catalog/build-release-0.13.0.mjs [research-worktree-root]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { format } from "prettier";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
import {
  EXTRACTS,
  releaseNames,
  sourceId,
  squashQuote,
} from "./release-0.13.0.names.mjs";

const VERSION = "0.13.0";
const TODAY = "2026-11-09";
const BASE = "data/catalog/releases/0.12.0";
const OUT = `data/catalog/releases/${VERSION}`;
const snapshotsRoot = resolve(process.argv[2] ?? ".");
const readJson = async (p) => JSON.parse(await readFile(p, "utf8"));
const json = (v) => format(JSON.stringify(v), { parser: "json" });
const sha = (v) => createHash("sha256").update(v).digest("hex");
const htmlText = (text) =>
  text
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x([a-f0-9]+);/gi, (_, n) =>
      String.fromCodePoint(parseInt(n, 16)),
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

const research = await releaseNames();
const baseManifest = await readJson(`${BASE}/manifest.json`);
const sources = await readJson(`${BASE}/sources.json`);
const baseQuoteCheck = await readJson(`${BASE}/quote-check.json`);
const original = new Map();
for (const file of baseManifest.profileFiles) {
  const profile = await readJson(`${BASE}/${file}`);
  original.set(profile.id, profile);
}
const profiles = new Map(
  [...original].map(([id, p]) => [id, structuredClone(p)]),
);
const checks = [...baseQuoteCheck.checks];
const extracts = [];
const texts = new Map();
const auditByWhere = new Map(
  research.audit.quoteChecks.map((q) => [q.where, q]),
);
const records = [...research.cropNames, ...research.cultivarNames];
const usedIds = new Set(records.map((n) => n.sourceId));

// Reopen the original bytes before any extraction; no source document is copied
// into the repository. Committed extracts contain only the short quoted names.
for (const s of research.sources.filter((s) => usedIds.has(s.id))) {
  const path = join(snapshotsRoot, s.savedFile);
  const bytes = await readFile(path);
  if (sha(bytes) !== s.sha256) throw new Error(`SNAPSHOT_CHANGED ${s.id}`);
  const id = sourceId(s.id);
  if (sources.some((old) => old.id === id))
    throw new Error(`DUPLICATE_SOURCE ${id}`);
  let pages;
  if (path.endsWith(".pdf"))
    pages = execFileSync("pdftotext", ["-layout", path, "-"], {
      maxBuffer: 20_000_000,
    })
      .toString("utf8")
      .split("\f");
  else if (path.endsWith(".json"))
    pages = [JSON.stringify(JSON.parse(bytes.toString("utf8")))];
  else pages = [htmlText(bytes.toString("utf8"))];
  texts.set(s.id, { pages, sha256: s.sha256 });
  const reuse =
    s.licence.startsWith("CC-") || s.licence === "CC0-1.0"
      ? "permitted"
      : s.licence === "unknown"
        ? "unknown"
        : "restricted";
  sources.push({
    id,
    title: s.title,
    publisher:
      s.publisher ?? s.authors?.join("; ") ?? "Not recorded in research",
    url: s.url,
    publicationYear: s.year ?? null,
    accessedAt: new Date(s.retrievedOn).toISOString(),
    evidence: {
      kind: "document_bytes",
      sha256: s.sha256,
      bytes: bytes.byteLength,
      artifactPath: null,
      captureNote: `Original ${s.savedFile} is not redistributed. Name-only quote extracts: ${EXTRACTS}. Research source ID: ${s.id}.`,
    },
    geographicScope:
      "Moroccan vernacular attestation; not a crop suitability claim.",
    limitations: [
      "Attested wording only; botanical mappings and regional usage are not expert-reviewed.",
      "PDF quotes with damaged extraction use the research audit's visually verified transcription; the machine check is against that transcript.",
    ],
    synthetic: false,
    kind: "other",
    rights: {
      reuse,
      licence: s.licence,
      note: "Source files are not redistributed; only short quoted names and verification records are committed.",
    },
  });
}
if (texts.size !== usedIds.size) throw new Error("MISSING_RESEARCH_SOURCE");

// Group identical sourced spellings, keeping all attestations on that new
// entry. Even an identical recalled spelling remains as its original entry.
// First attested spelling in research order is preferred; this is a display
// fallback, not a linguistic ranking. Every sourced name stays low confidence
// pending native-speaker and botanical review.
for (const n of records) {
  const profile = profiles.get(n.cropId);
  const owner = n.cultivarId
    ? profile?.cultivars.find((c) => c.id === n.cultivarId)
    : profile?.identity;
  if (!owner) throw new Error(`UNKNOWN_NAME_OWNER ${n.researchWhere}`);
  owner.localNames ??= [];
  let name = owner.localNames.find(
    (v) => v.language === "ary" && v.name === n.name && v.citations,
  );
  if (!name) {
    name = {
      language: "ary",
      name: n.name,
      citations: [],
      confidence: "low",
      ...(!owner.localNames.some((v) => v.language === "ary" && v.preferred)
        ? { preferred: true }
        : {}),
    };
    owner.localNames.push(name);
  }
  const audit = auditByWhere.get(n.researchWhere);
  if (
    !audit?.present ||
    audit.sourceId !== n.sourceId ||
    audit.quote !== n.quote
  )
    throw new Error(`UNVERIFIED_RESEARCH_QUOTE ${n.researchWhere}`);
  const source = texts.get(n.sourceId);
  const page = n.pdfPage ?? null;
  const text = page === null ? source.pages.join(" ") : source.pages[page - 1];
  const literal =
    text !== undefined && squashQuote(text).includes(squashQuote(n.quote));
  // This fallback is explicit evidence from the completed visual research
  // audit, never a fabricated match against a damaged PDF text layer.
  if (!literal && !(page !== null && /visual|rendered/.test(audit.method)))
    throw new Error(`QUOTE_CHECK_FAILED ${n.researchWhere}`);
  const method = literal
    ? "literal_source_text"
    : "research_visual_transcription";
  const citation = {
    sourceId: sourceId(n.sourceId),
    locator: n.locator ?? `PDF page ${page}`,
    interpretation: "direct",
    note: [
      n.languageEvidence,
      n.identityReason,
      n.note,
      n.scientificNameSourceId
        ? `Botanical pairing: ${n.scientificNameSourceId}, ${n.scientificNameLocator ?? "see research record"}.`
        : null,
      `Research record: ${n.researchWhere}. Native-speaker review pending.`,
    ]
      .filter(Boolean)
      .join(" "),
    page,
    quote: n.quote,
  };
  name.citations.push(citation);
  const index = owner.localNames.indexOf(name);
  const where = `${n.cropId}:${n.cultivarId ? `cultivar:${n.cultivarId}` : "identity"}:localName:${index}:${name.citations.length - 1}`;
  extracts.push({
    where,
    researchWhere: n.researchWhere,
    sourceId: citation.sourceId,
    sourceSha256: source.sha256,
    page,
    text: n.quote,
    method,
    researchMethod: audit.method,
  });
  checks.push({
    where,
    sourceId: citation.sourceId,
    page,
    quoteSha256: sha(citation.quote),
    matched: squashQuote(extracts.at(-1).text).includes(
      squashQuote(citation.quote),
    ),
    method,
    sourceSha256: source.sha256,
    extractPath: EXTRACTS,
  });
}

// Assemble and validate before writing any release output.
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
const stripNames = (p) => {
  const copy = structuredClone(p);
  copy.version = "";
  delete copy.identity.localNames;
  for (const c of copy.cultivars) delete c.localNames;
  return JSON.stringify(copy);
};
const assertOldNames = (old, now) => {
  (old ?? []).forEach((n, i) => {
    if (JSON.stringify(n) !== JSON.stringify(now?.[i]))
      throw new Error("EXISTING_NAME_CHANGED");
  });
};
for (const [id, old] of original) {
  const now = profiles.get(id);
  if (stripNames(old) !== stripNames(now))
    throw new Error(`NOT_ADDITIVE ${id}`);
  assertOldNames(old.identity.localNames, now.identity.localNames);
  old.cultivars.forEach((c, i) =>
    assertOldNames(c.localNames, now.cultivars[i].localNames),
  );
}

const extractBytes = await json({
  method:
    "Name-only extracts, bound to original source hashes and research audit locations. Visual transcriptions are identified individually; no original documents are redistributed.",
  checkedOn: TODAY,
  extracts,
});
const extractSha256 = sha(extractBytes);
for (const check of checks.slice(baseQuoteCheck.checks.length))
  check.extractSha256 = extractSha256;
await mkdir(join(OUT, "profiles"), { recursive: true });
await writeFile(EXTRACTS, extractBytes);
await writeFile(join(OUT, "sources.json"), await json(sources));
for (const p of finalProfiles)
  await writeFile(join(OUT, `profiles/${p.id}.json`), await json(p));
await writeFile(join(OUT, "manifest.json"), await json(manifest));
await writeFile(
  join(OUT, "quote-check.json"),
  await json({
    ...baseQuoteCheck,
    method: `${baseQuoteCheck.method} 0.13.0: new name quotes checked against hash-verified original snapshots, or the research audit's visual PDF transcription when text extraction is damaged. CI rechecks every name quote in the committed name-only extracts; method and original source hash are recorded per check.`,
    checkedOn: TODAY,
    citations: checks.length,
    matched: checks.filter((c) => c.matched).length,
    checks,
  }),
);
const sourced = (p) =>
  p.identity.localNames.some((n) => n.language === "ary" && n.citations);
const hasDarija = (p) =>
  p.identity.localNames.some((n) => n.language === "ary");
console.log(
  JSON.stringify(
    {
      version: VERSION,
      sha256: prepared.sha256,
      crops: finalProfiles.length,
      cropsWithSourcedDarija: finalProfiles.filter(sourced).length,
      cropsWithRecalledDarijaOnly: finalProfiles.filter(
        (p) => !sourced(p) && hasDarija(p),
      ).length,
      cropsWithoutDarija: finalProfiles.filter((p) => !hasDarija(p)).length,
      sourcedCropNames: finalProfiles.reduce(
        (total, p) =>
          total + p.identity.localNames.filter((n) => n.citations).length,
        0,
      ),
      sourcedCultivarNames: research.cultivarNames.length,
      addedSources: usedIds.size,
      newQuoteChecks: extracts.length,
      literalChecks: extracts.filter((e) => e.method === "literal_source_text")
        .length,
      visualTranscriptions: extracts.filter(
        (e) => e.method === "research_visual_transcription",
      ).length,
    },
    null,
    2,
  ),
);
