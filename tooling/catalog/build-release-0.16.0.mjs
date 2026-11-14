// Offline deterministic B8 build. Existing releases are read-only inputs.
// pnpm build:server && node tooling/catalog/build-release-0.16.0.mjs
// --verify-originals also checks the locally saved PDF and rendered page bytes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { format } from "prettier";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";
import { CROP_NAMES, CULTIVAR_NAMES } from "./release-0.16.0.names.mjs";

const VERSION = "0.16.0",
  BASE = "data/catalog/releases/0.15.0";
const OUT = `data/catalog/releases/${VERSION}`;
const EVIDENCE = "docs/evidence/catalog/2026-11-12";
const SOURCE_FILE = `${EVIDENCE}/b8-name-sources.json`;
const EXTRACTS = `${OUT}/name-quote-extracts.json`;
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const json = (v) => format(JSON.stringify(v), { parser: "json" });
const sha = (v) => createHash("sha256").update(v).digest("hex");
const rows = (v) =>
  v
    .trim()
    .split("\n")
    .map((r) => r.split("|"));
const originalManifest = await read(`${BASE}/manifest.json`);
const originals = await Promise.all(
  originalManifest.profileFiles.map((f) => read(`${BASE}/${f}`)),
);
const profiles = structuredClone(originals),
  byId = new Map(profiles.map((p) => [p.id, p]));
const oldSources = await read(`${BASE}/sources.json`),
  sources = structuredClone(oldSources);
const oldAudit = await read(`${BASE}/quote-check.json`);
const evidence = await read(SOURCE_FILE);
const added = [],
  checks = [];
function owner(path) {
  const [crop, cultivar] = path.split("/");
  const p = byId.get(crop);
  const o = cultivar
    ? p?.cultivars.find((c) => c.id === cultivar)
    : p?.identity;
  assert.ok(o, `UNKNOWN_NAME_OWNER ${path}`);
  o.localNames ??= [];
  return o;
}
function append(path, n, purpose) {
  owner(path).localNames.push(n);
  added.push({
    scope: path.includes("/") ? "cultivar" : "crop",
    id: path,
    purpose,
    ...n,
  });
}
function recall(path, name, confidence, basis) {
  assert.ok(["low", "medium", "high"].includes(confidence));
  append(
    path,
    {
      language: "ary",
      name,
      recall: {
        valueKind: "model_recall_unverified",
        confidence,
        basis: `${basis} AI model recall, not a sourced attestation. Arabic-script spelling and Moroccan usage are unverified; native review pending.`,
        recordedOn: "2026-11-12",
        researchItem: `B8.name.${path}.ary`.slice(0, 160),
      },
    },
    "darija_recall",
  );
}
const missing = profiles
  .filter((p) => !p.identity.localNames.some((n) => n.language === "ary"))
  .map((p) => p.id);
assert.equal(missing.length, 68);
assert.deepEqual(
  rows(CROP_NAMES)
    .map(([id]) => id)
    .sort(),
  [...missing].sort(),
);
for (const [id, name, confidence, basis] of rows(CROP_NAMES))
  recall(id, name, confidence, basis);
const seenCultivars = new Set();
for (const [path, name, confidence, basis] of rows(CULTIVAR_NAMES)) {
  assert.ok(!seenCultivars.has(path), `DUPLICATE_CULTIVAR ${path}`);
  seenCultivars.add(path);
  assert.ok(
    !owner(path).localNames.some((n) => n.language === "ary"),
    `DARIIJA_ALREADY_RECORDED ${path}`,
  );
  recall(path, name, confidence, basis);
}

// Real Moroccan Arabic-language documents attest these loan/proper-name
// spellings. Their use in Darija is an explicit model interpretation, not a
// claim that the source document is in ary. Keep the separate recall entry.
const attestations = [
  [
    "sulla",
    "سولا",
    "b8-inra-sulla-name",
    "low",
    "The report pairs سولا with Sulla and Hedysarum sp in northern Moroccan pasture research. It does not establish a species-exclusive vernacular for H. coronarium.",
  ],
  [
    "olive/picholine-marocaine",
    "البيشولين المغربية",
    "b8-onssa-olive-names",
    "medium",
    "Moroccan olive cultivar proper name in article 5; same proper name used in Darija is the model interpretation.",
  ],
  [
    "olive/haouzia",
    "الحوزية",
    "b8-onssa-olive-names",
    "medium",
    "Moroccan olive cultivar proper name in article 5; same proper name used in Darija is the model interpretation.",
  ],
  [
    "olive/menara",
    "المنارة",
    "b8-onssa-olive-names",
    "medium",
    "Moroccan olive cultivar proper name in article 5; same proper name used in Darija is the model interpretation.",
  ],
];
for (const s of evidence.sources) {
  if (process.argv.includes("--verify-originals")) {
    const raw = await readFile(s.savedFile);
    assert.equal(sha(raw), s.sourceSha256);
    assert.equal(raw.length, s.sourceBytes);
    assert.equal(sha(await readFile(s.renderFile)), s.renderSha256);
  }
  assert.ok(!sources.some((v) => v.id === s.id));
  sources.push({
    id: s.id,
    title: s.title,
    publisher: s.publisher,
    url: s.url,
    publicationYear: s.publicationYear,
    accessedAt: s.accessedAt,
    evidence: {
      kind: "document_bytes",
      sha256: s.sourceSha256,
      bytes: s.sourceBytes,
      artifactPath: null,
      captureNote: `Original ${s.savedFile}; visually read PDF page ${s.pdfPage}, printed page ${s.printedPage}. Short transcription and render hash: ${SOURCE_FILE}. Full PDF and render are not redistributed.`,
    },
    geographicScope:
      "Morocco; name spelling only, not crop suitability or a Darija-language source claim.",
    limitations: [s.limitations],
    synthetic: false,
    kind: "other",
    rights: {
      reuse: "unknown",
      licence: "Reuse licence not verified",
      note: "Only short name quotations redistributed; no redistribution rights claimed for the original document.",
    },
  });
}
for (const [path, name, sourceId, confidence, note] of attestations) {
  const s = evidence.sources.find((v) => v.id === sourceId);
  assert.ok(s.text.includes(name), `QUOTE_NOT_FOUND ${path}`);
  const o = owner(path);
  assert.ok(!o.localNames.some((n) => n.language === "ary" && n.preferred));
  const n = {
    language: "ary",
    name,
    confidence,
    preferred: true,
    citations: [
      {
        sourceId,
        locator: `PDF page ${s.pdfPage}, printed page ${s.printedPage}`,
        page: s.pdfPage,
        interpretation: "normalized",
        note: `${note} Arabic-script name visually verified in the original PDF. Native-speaker review pending.`,
        quote: name,
      },
    ],
  };
  append(path, n, "sourced_darija_selection");
  checks.push({
    where: `${path.split("/")[0]}:${path.includes("/") ? `cultivar:${path.split("/")[1]}` : "identity"}:localName:${o.localNames.length - 1}`,
    sourceId,
    sourceSha256: s.sourceSha256,
    quote: name,
    quoteSha256: sha(name),
    matched: true,
    method: "visual_pdf_transcription",
    pdfPage: s.pdfPage,
    renderSha256: s.renderSha256,
  });
}

// Every primary label is copied verbatim, including proper cultivar names and
// type labels; no invented translation or model-recall evidence is attached.
// Append preferred copies of existing fr/ar/ary names instead of mutating any
// earlier entry. Sources outrank recall; legacy selection order breaks ties.
for (const p of profiles) {
  for (const [path, o] of [
    [p.id, p.identity],
    ...p.cultivars.map((c) => [`${p.id}/${c.id}`, c]),
  ]) {
    if (o.name)
      append(
        path,
        {
          language: "en",
          name: o.name,
          origin: "primary_name",
          preferred: true,
        },
        "primary_english_copy",
      );
    const languages = [...new Set(o.localNames.map((n) => n.language))];
    for (const language of languages) {
      if (o.localNames.some((n) => n.language === language && n.preferred))
        continue;
      const candidates = o.localNames.filter((n) => n.language === language);
      const selected =
        candidates.find((n) => n.citations?.length) ?? candidates[0];
      // A newly appended record may be marked in place. Old entries are never
      // edited: they are the complete unchanged prefix in the superset check.
      const newEntry = added.find(
        (n) =>
          n.id === path &&
          n.language === language &&
          n.name === selected.name &&
          n.purpose === "darija_recall",
      );
      if (newEntry) {
        selected.preferred = true;
        newEntry.preferred = true;
      } else
        append(
          path,
          { ...structuredClone(selected), preferred: true },
          "preferred_existing_name_copy",
        );
    }
  }
  p.version = VERSION;
}
const stripNames = (p) => {
  const c = structuredClone(p);
  c.version = "";
  delete c.identity.localNames;
  c.cultivars.forEach((v) => delete v.localNames);
  return c;
};
for (const [i, p] of profiles.entries()) {
  const old = originals[i];
  assert.deepEqual(stripNames(p), stripNames(old));
  for (const [a, b] of [
    [p.identity, old.identity],
    ...p.cultivars.map((c, j) => [c, old.cultivars[j]]),
  ])
    assert.deepEqual(
      a.localNames?.slice(0, b.localNames?.length ?? 0) ?? [],
      b.localNames ?? [],
    );
}
assert.deepEqual(sources.slice(0, oldSources.length), oldSources);
const manifest = { ...originalManifest, version: VERSION };
const bundle = { ...manifest, sources, profiles };
delete bundle.sourceFile;
delete bundle.profileFiles;
const prepared = prepareCatalogV2(bundle);
await mkdir(`${OUT}/profiles`, { recursive: true });
for (const p of profiles)
  await writeFile(`${OUT}/profiles/${p.id}.json`, await json(p));
await writeFile(`${OUT}/manifest.json`, await json(manifest));
await writeFile(`${OUT}/sources.json`, await json(sources));
const extracts = await json({
  reviewedOn: evidence.reviewedOn,
  sourceManifest: SOURCE_FILE,
  sourceManifestSha256: sha(await readFile(SOURCE_FILE)),
  checks,
});
await writeFile(EXTRACTS, extracts);
await writeFile(
  `${OUT}/quote-check.json`,
  await json({
    ...oldAudit,
    checkedOn: evidence.reviewedOn,
    method: `${oldAudit.method} 0.16.0: new name quotes checked against visually reviewed PDF transcriptions bound to original PDF and render hashes. Offline checks use the committed short transcriptions, not a claim of literal PDF text extraction.`,
    citations: oldAudit.citations + checks.length,
    matched: oldAudit.matched + checks.length,
    checks: [
      ...oldAudit.checks,
      ...checks.map((q) => {
        const check = {
          ...q,
          extractPath: EXTRACTS,
          extractSha256: sha(extracts),
        };
        delete check.quote;
        return check;
      }),
    ],
  }),
);
const languages = ["en", "fr", "ar", "ary"];
const coverage = (owners) =>
  Object.fromEntries(
    languages.map((l) => [
      l,
      owners.filter((o) => o.localNames?.some((n) => n.language === l)).length,
    ]),
  );
const summary = {
  version: VERSION,
  crops: profiles.length,
  cultivars: profiles.reduce((n, p) => n + p.cultivars.length, 0),
  cropsWith: coverage(profiles.map((p) => p.identity)),
  cultivarsWith: coverage(profiles.flatMap((p) => p.cultivars)),
  addedCropDarijaRecall: missing.length,
  addedCultivarDarijaRecall: seenCultivars.size,
  newSourceCount: evidence.sources.length,
  newCitations: checks.length,
  lowConfidenceDarijaAdditions: added.filter(
    (n) =>
      n.language === "ary" && (n.recall?.confidence ?? n.confidence) === "low",
  ).length,
  canonicalBytes: Buffer.byteLength(prepared.canonicalJson),
  sha256: prepared.sha256,
};
await writeFile(
  `${EVIDENCE}/b8-names-log.json`,
  await json({ summary, addedNames: added }),
);
const table = (items) =>
  [
    "| Item | Name | Confidence | Basis / selection |",
    "| --- | --- | --- | --- |",
    ...items.map(
      (n) =>
        `| ${n.id} | ${n.name} | ${n.recall?.confidence ?? n.confidence ?? "unrecorded"} | ${n.recall?.basis ?? n.citations?.[0]?.note ?? n.purpose} |`,
    ),
  ].join("\n");
const ary = added.filter((n) => n.language === "ary");
const low = added.filter(
  (n) => (n.recall?.confidence ?? n.confidence) === "low",
);
const untranslated = profiles.flatMap((p) =>
  p.cultivars
    .filter((c) => !c.localNames.some((n) => n.language === "ary"))
    .map((c) => `${p.id}/${c.id}`),
);
await writeFile(
  `${EVIDENCE}/names-for-native-review.md`,
  await format(
    `# Names for native review — catalog ${VERSION}

Task provenance date 2026-11-12; assembled and visually checked 2026-11-13.
Every recalled name is unverified model knowledge, not a quote. Low confidence
means the local usage, spelling or taxonomic pairing needs review. No usage
survey or claim of national prevalence is made. The borrowed Arabic-script
forms for rare introduced crops are explicit recall candidates, not proof that
Moroccan farmers grow or name every such crop. All 68 formerly missing crop
Darija labels are present, including these cautiously qualified loan forms.

Preference selects a display label; it does not certify a name. Source-backed
entries outrank recall. French/Arabic selections copied from old names retain
their original provenance (or its absence); the old entries remain unchanged.
English entries copy the primary display name verbatim and mark origin as
primary_name. Cultivar proper names are not translated into English.

## Added Darija entries (${ary.length})

Includes preferred copies of prior recalled names and four sourced selections.
The official sources are Arabic-language Moroccan documents, not Darija texts.
The Darija use of their proper names/loan is an explicit model interpretation.
Sulla's source is genus-level and does not verify an exclusive species name.

${table(ary)}

## All appended entries with low confidence (${low.length})

${table(low)}

## Cultivars without a Darija entry (${untranslated.length})

All 1,226 have explicit English primary-label copies. These remaining items
are international proper names, general type labels, or names for which no
reasonably secure Moroccan local form was recalled. No automatic translation
or blanket ar-to-ary relabelling was used. Some local forms may still exist;
this is a model-knowledge limit, not proof that they have no local name.

${untranslated.map((id) => `- ${id}`).join("\n")}
`,
    { parser: "markdown" },
  ),
);
console.log(JSON.stringify(summary, null, 2));
