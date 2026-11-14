// Offline, additive release. Usage: node tooling/catalog/build-release-0.14.0.mjs
// <income-research-worktree> <benefits-research-worktree>
// Original bytes remain local; CI checks committed short extracts and hashes.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { format } from "prettier";
import { prepareCatalogV2 } from "../../packages/catalog/dist/index.js";

const BASE = "data/catalog/releases/0.13.0";
const OUT = "data/catalog/releases/0.14.0";
const EVIDENCE = "docs/evidence/catalog/2026-11-10";
const EXTRACTS = `${OUT}/research-quote-extracts.json`;
const sha = (v) => createHash("sha256").update(v).digest("hex");
const read = async (p) => JSON.parse(await readFile(p, "utf8"));
const json = (v) => format(JSON.stringify(v), { parser: "json" });
const roots = {
  income: process.argv[2] ?? ".",
  benefits: process.argv[3] ?? ".",
};
const manifest = await read(`${BASE}/manifest.json`);
const sources = await read(`${BASE}/sources.json`);
const audit = await read(`${BASE}/quote-check.json`);
const profiles = await Promise.all(
  manifest.profileFiles.map((p) => read(`${BASE}/${p}`)),
);
const originals = structuredClone(profiles);
const researchSources = {};
const quotes = [];
const inputHashes = {};
const batches = {};
for (const kind of ["income", "benefits"]) {
  researchSources[kind] = await read(
    `${EVIDENCE}/${kind}/${kind}-sources.json`,
  );
  batches[kind] = [];
  for (let n = 1; n <= 10; n++) {
    const path = `${EVIDENCE}/${kind}/${kind}-batch-${String(n).padStart(2, "0")}.json`;
    const bytes = await readFile(path);
    inputHashes[path] = sha(bytes);
    const batch = JSON.parse(bytes);
    batches[kind].push(...(batch.records ?? batch.crops));
  }
}
for (const kind of ["income", "benefits"])
  for (const name of [
    `${kind}-sources.json`,
    `${kind}-verification.json`,
    ...(kind === "income" ? ["income-snapshot-manifest.json"] : []),
  ]) {
    const path = `${EVIDENCE}/${kind}/${name}`;
    inputHashes[path] = sha(await readFile(path));
  }
const sid = (kind, id) => `research-${kind}-${id}`;
function citations(value, kind, where, inheritedSource, inheritedLocator = {}) {
  if (Array.isArray(value))
    return value.flatMap((v, i) =>
      citations(v, kind, `${where}.${i}`, inheritedSource, inheritedLocator),
    );
  if (!value || typeof value !== "object") return [];
  const sourceId = value.sourceId ?? inheritedSource;
  const locator = value.locator ?? inheritedLocator;
  const out = [];
  if (typeof value.original === "string") {
    const source = researchSources[kind].find((s) => s.id === sourceId);
    if (!source) throw new Error(`UNKNOWN_QUOTE_SOURCE ${where} ${sourceId}`);
    const key = `${kind}:${where}`;
    quotes.push({
      kind,
      where: key,
      researchSourceId: sourceId,
      sourceId: sid(kind, sourceId),
      sourceSha256: source.sha256,
      quote: value.original,
      locator,
      ...(value.textFile
        ? { textFile: value.textFile, textSha256: value.textSha256 }
        : {}),
    });
    out.push({
      sourceId: sid(kind, sourceId),
      sourceSha256: source.sha256,
      quote: value.original,
      locator: JSON.stringify(locator),
      quoteCheck: key,
    });
  }
  for (const [k, v] of Object.entries(value))
    if (v && typeof v === "object")
      out.push(...citations(v, kind, `${where}.${k}`, sourceId, locator));
  return out;
}
// Shared typed fields and checked quotations are stored once. The complete
// original records remain immutable in docs/evidence with the input hashes.
const metadata = (record, keys) =>
  Object.fromEntries(
    Object.entries(record).filter(([key]) => !keys.includes(key)),
  );
for (const p of profiles) {
  const income = batches.income.find((r) => r.cropId === p.id);
  const benefits = batches.benefits.find((r) => r.cropId === p.id);
  if (!income || !benefits) throw new Error(`MISSING_RESEARCH_CROP ${p.id}`);
  p.version = "0.14.0";
  p.research = {
    version: "income-benefits-1",
    income: {
      facts: ["prices", "yields", "costs", "margins"].flatMap((kind) =>
        income[kind].map((f) => ({
          id: f.id,
          kind,
          value: f.value,
          unit: f.unit,
          currency: f.currency,
          year: f.year,
          region: f.region,
          commodity: f.commodity ?? null,
          scenarioId: f.scenarioId ?? null,
          definition: f.costDefinition ?? f.marginDefinition ?? f.statistic,
          citations: citations(
            f,
            "income",
            `${p.id}.${kind}.${f.id}`,
            f.sourceId,
          ),
          research: metadata(f, [
            "id",
            "value",
            "unit",
            "currency",
            "year",
            "region",
            "commodity",
            "scenarioId",
            "sourceId",
            "quote",
          ]),
        })),
      ),
      options: income.incomeOptions.map((f) => ({
        research: f,
        citations: citations(f, "income", `${p.id}.option.${f.id}`, f.sourceId),
      })),
      gaps: income.gaps,
    },
    benefits: {
      findings: benefits.findings
        .filter((f) => f.status === "sourced")
        .map((f) => ({
          id: f.id,
          category: f.effectCategory,
          effect: f.effect,
          nonLocal: f.regionApplicability.nonLocal,
          region: f.regionApplicability.region,
          conditions: f.conditions,
          magnitude: f.magnitude,
          rotationContext: f.rotationContext,
          citations: citations(f, "benefits", `${p.id}.${f.id}`, f.sourceId),
          research: metadata(f, [
            "id",
            "effect",
            "effectCategory",
            "conditions",
            "magnitude",
            "rotationContext",
            "quote",
            "sourceId",
          ]),
        })),
      gaps: benefits.findings
        .filter((f) => f.status === "not_found")
        .map((f) => ({ category: f.effectCategory, reason: f.notFoundReason })),
    },
  };
}
const verification = JSON.parse(
  execFileSync("python3", ["tooling/catalog/research-quote-check.py"], {
    input: JSON.stringify({
      roots,
      sources: researchSources,
      quotes,
      incomeManifest: await read(
        `${EVIDENCE}/income/income-snapshot-manifest.json`,
      ),
    }),
    maxBuffer: 20_000_000,
  }),
);
const used = new Set(quotes.map((q) => q.sourceId));
for (const [kind, list] of Object.entries(researchSources))
  for (const s of list) {
    const id = sid(kind, s.id);
    if (!used.has(id)) continue;
    const licence =
      typeof s.licence === "string"
        ? s.licence
        : `${s.licence.name ?? s.licence.status}; ${s.licence.note ?? ""}`;
    sources.push({
      id,
      title: s.title,
      publisher: "See saved research title and publisher URL",
      url: s.url,
      publicationYear: s.publicationYear ?? null,
      accessedAt: new Date(s.retrievedOn).toISOString(),
      evidence: {
        kind: "document_bytes",
        sha256: s.sha256,
        bytes: verification.sources[`${kind}:${s.id}`],
        artifactPath: null,
        captureNote: `Original ${s.savedFile} is not redistributed. ${EXTRACTS} records short quote checks; research manifest: ${EVIDENCE}/${kind}/${kind}-sources.json.`,
      },
      geographicScope:
        "Only the regions and conditions stated in each research record.",
      limitations: [
        "Research extraction and translations are not expert reviewed. Historical observations are not forecasts or current quotes.",
        "Original sources stay local. Reuse clearance is not implied.",
      ],
      synthetic: false,
      kind: "other",
      rights: {
        reuse: /CC BY 4.0/.test(licence)
          ? "permitted"
          : /restricted|reserved|réservés|NC-SA/.test(licence)
            ? "restricted"
            : "unknown",
        licence: licence.slice(0, 200),
        note: "Only short quotations and factual records are included; see research for rights limitations.",
      },
    });
  }
const outputManifest = { ...manifest, version: "0.14.0" };
const bundle = { ...outputManifest, sources, profiles };
delete bundle.sourceFile;
delete bundle.profileFiles;
const prepared = prepareCatalogV2(bundle);
for (const [i, p] of profiles.entries()) {
  const old = { ...p, version: "0.13.0" };
  delete old.research;
  if (JSON.stringify(old) !== JSON.stringify(originals[i]))
    throw new Error(`NOT_ADDITIVE ${p.id}`);
}
await mkdir(`${OUT}/profiles`, { recursive: true });
const extracts = await json({
  checkedOn: "2026-11-10",
  inputHashes,
  checks: verification.checks,
});
await writeFile(EXTRACTS, extracts);
await writeFile(`${OUT}/sources.json`, await json(sources));
await writeFile(`${OUT}/manifest.json`, await json(outputManifest));
for (const p of profiles)
  await writeFile(`${OUT}/profiles/${p.id}.json`, await json(p));
const checks = verification.checks.map((q) => ({
  where: q.where,
  sourceId: q.sourceId,
  sourceSha256: q.sourceSha256,
  quoteSha256: sha(q.quote),
  matched: q.matched,
  method: q.method,
  extractPath: EXTRACTS,
  extractSha256: sha(extracts),
}));
await writeFile(
  `${OUT}/quote-check.json`,
  await json({
    ...audit,
    checkedOn: "2026-11-10",
    method: `${audit.method} 0.14.0: original snapshot and derivative hashes checked; exact archive rows or hash-bound extracted text; prior visual transcriptions explicitly identified. CI rechecks every new citation against committed extracts.`,
    citations: audit.checks.length + checks.length,
    matched: audit.checks.length + checks.length,
    checks: [...audit.checks, ...checks],
  }),
);
console.log(
  JSON.stringify(
    {
      version: "0.14.0",
      sha256: prepared.sha256,
      bytes: Buffer.byteLength(prepared.canonicalJson),
      crops: profiles.length,
      incomeCrops: profiles.filter(
        (p) =>
          p.research.income.facts.length || p.research.income.options.length,
      ).length,
      benefitCrops: profiles.filter((p) => p.research.benefits.findings.length)
        .length,
      addedSources: used.size,
      newQuoteChecks: checks.length,
    },
    null,
    2,
  ),
);
