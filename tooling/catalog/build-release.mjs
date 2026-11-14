// Builds a catalog release (0.3.0 onwards) from local source snapshots and checks every
// quoted citation against its page by machine. Re-running with the same
// snapshots reproduces the committed files; any missing quote stops the build.
// Usage: node tooling/catalog/build-release.mjs <snapshot-directory> [version]
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { format } from "prettier";
import { pdfPages } from "./pdf-text.mjs";

const snapshots = process.argv[2];
if (!snapshots) throw new Error("SNAPSHOT_DIRECTORY_REQUIRED");
const version = process.argv[3] ?? "0.9.0";
const { releaseData } = await import(`./release-${version}.data.mjs`);
const out = `data/catalog/releases/${version}`;
const evidence = "docs/evidence/catalog/2026-10-18";
const sha = (b) => createHash("sha256").update(b).digest("hex");
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

const data = await releaseData(snapshots);
const old = JSON.parse(
  await readFile("data/catalog/releases/0.2.0/sources.json", "utf8"),
);
const sources = [];
const texts = new Map();
for (const s of data.sources) {
  if (s.reuse) {
    const prior = old.find((o) => o.id === s.id);
    if (!prior) throw new Error(`UNKNOWN_REUSED_SOURCE ${s.id}`);
    sources.push(prior);
    if (s.file) {
      const bytes = await readFile(join(snapshots, s.file));
      if (sha(bytes) !== prior.evidence.sha256)
        throw new Error(`SNAPSHOT_CHANGED ${s.id}`);
      texts.set(s.id, await pdfPages(join(snapshots, s.file)));
    }
    continue;
  }
  const bytes = await readFile(join(snapshots, s.file));
  if (s.file.endsWith(".pdf"))
    texts.set(s.id, await pdfPages(join(snapshots, s.file)));
  else if (s.file.endsWith(".html") || s.file.endsWith(".htm"))
    texts.set(s.id, [htmlText(bytes.toString(s.encoding ?? "utf8"))]);
  else if (s.file.endsWith(".json")) texts.set(s.id, [bytes.toString("utf8")]);
  let artifactPath = null;
  if (s.commit) {
    artifactPath = `${evidence}/${s.commit.name}`;
    await mkdir(evidence, { recursive: true });
    await writeFile(
      artifactPath,
      s.commit.bytes ? s.commit.bytes(bytes) : bytes,
    );
  }
  const committed = artifactPath ? await readFile(artifactPath) : bytes;
  sources.push({
    id: s.id,
    title: s.title,
    publisher: s.publisher,
    url: s.url,
    publicationYear: s.year,
    accessedAt: s.accessedAt,
    evidence: {
      kind: s.commit?.bytes ? "verified_extract" : "document_bytes",
      sha256: sha(committed),
      bytes: committed.byteLength,
      artifactPath,
      captureNote: s.captureNote,
    },
    geographicScope: s.scope,
    limitations: s.limitations,
    synthetic: false,
    kind: s.kind,
    rights: s.rights,
  });
}
// Machine quote check: every quote must appear on its cited page (or, for a
// web page, in its text), ignoring case and whitespace only.
const checks = [];
const failures = [];
const visit = (citation, where) => {
  if (citation.quote === undefined) return;
  const pages = texts.get(citation.sourceId);
  if (!pages) {
    failures.push({ where, reason: "no text for source", citation });
    return;
  }
  const page =
    citation.page === null ? pages.join(" ") : pages[citation.page - 1];
  const found =
    page !== undefined && squash(page).includes(squash(citation.quote));
  const record = {
    where,
    sourceId: citation.sourceId,
    page: citation.page,
    quoteSha256: sha(citation.quote),
    matched: found,
  };
  checks.push(record);
  if (!found) failures.push({ ...record, quote: citation.quote });
};
for (const region of data.manifest.regions)
  region.citations.forEach((c, i) => visit(c, `region:${region.id}:${i}`));
for (const issue of data.manifest.issues)
  issue.citations.forEach((c, i) => visit(c, `issue:${issue.id}:${i}`));
for (const profile of data.profiles) {
  // 0.3.0 predates this check; its committed record stays reproducible.
  if (version !== "0.3.0")
    for (const entry of profile.applicability)
      entry.citations.forEach((c, i) =>
        visit(c, `${profile.id}:applicability:${entry.regionId}:${i}`),
      );
  profile.identity.citations.forEach((c, i) =>
    visit(c, `${profile.id}:identity:${i}`),
  );
  for (const rule of profile.rules)
    rule.citations.forEach((c, i) => visit(c, `${profile.id}:${rule.id}:${i}`));
  for (const cultivar of profile.cultivars)
    cultivar.citations.forEach((c, i) =>
      visit(c, `${profile.id}:${cultivar.id}:${i}`),
    );
}
if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  throw new Error(`QUOTE_CHECK_FAILED ${failures.length}`);
}
// Every quote-checked rule must rest on at least one matched quote.
for (const profile of data.profiles)
  for (const rule of profile.rules)
    if (
      rule.verification.method === "quote_match_and_second_reading" &&
      !checks.some(
        (c) => c.where.startsWith(`${profile.id}:${rule.id}:`) && c.matched,
      )
    )
      throw new Error(`RULE_WITHOUT_MATCHED_QUOTE ${rule.id}`);
// Written in the repository's Prettier style so a rebuild passes format checks.
const json = (v) => format(JSON.stringify(v), { parser: "json" });
await mkdir(join(out, "profiles"), { recursive: true });
await writeFile(join(out, "sources.json"), await json(sources));
for (const profile of data.profiles)
  await writeFile(
    join(out, `profiles/${profile.id}.json`),
    await json(profile),
  );
await writeFile(
  join(out, "manifest.json"),
  await json({
    ...data.manifest,
    sourceFile: "sources.json",
    profileFiles: data.profiles.map((p) => `profiles/${p.id}.json`),
  }),
);
await writeFile(
  join(out, "quote-check.json"),
  await json({
    method:
      "NFC, case-insensitive, whitespace-insensitive substring of the cited page text (PDF.js 6.3.289)",
    checkedOn: version === "0.3.0" ? "2026-10-18" : "2026-11-01",
    citations: checks.length,
    matched: checks.filter((c) => c.matched).length,
    checks,
  }),
);
console.log(
  JSON.stringify({
    sources: sources.length,
    profiles: data.profiles.length,
    rules: data.profiles.reduce((n, p) => n + p.rules.length, 0),
    quotes: checks.length,
  }),
);
