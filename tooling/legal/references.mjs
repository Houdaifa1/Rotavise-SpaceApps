// Builds docs/REFERENCES.md from tooling/legal/references-core.md plus an
// appendix generated from the newest catalog release's sources.json.
// Run: pnpm legal:references
import { readFileSync, readdirSync, writeFileSync } from "node:fs";

const releases = readdirSync("data/catalog/releases")
  .filter((n) => /^\d+\.\d+\.\d+$/.test(n))
  .sort((a, b) => {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
  });
const release = releases.at(-1);
const sources = JSON.parse(
  readFileSync(`data/catalog/releases/${release}/sources.json`, "utf8"),
);
const core = readFileSync("tooling/legal/references-core.md", "utf8").replace(
  /0\.10\.0/g,
  release,
);

const cell = (value) =>
  String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/\s+/g, " ")
    .trim();
const kindOrder = [
  "official_guide",
  "official_statistics",
  "variety_register",
  "official_communication",
  "scientific_paper",
  "fao_method",
  "boundary_dataset",
  "taxonomy",
  "other",
];
const sorted = [...sources].sort(
  (a, b) =>
    kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
    a.id.localeCompare(b.id),
);

const lines = [core.trimEnd(), ""];
const counts = {};
for (const s of sources) counts[s.kind] = (counts[s.kind] ?? 0) + 1;
lines.push(
  `${sources.length} sources: ${Object.entries(counts)
    .map(([k, n]) => `${k.replace(/_/g, " ")} ${n}`)
    .join(", ")}.`,
);
lines.push("");
lines.push("| Id | Kind | Title | Publisher | Year | URL | Reuse |");
lines.push("| -- | ---- | ----- | --------- | ---- | --- | ----- |");
for (const s of sorted) {
  const reuse = s.rights
    ? `${s.rights.reuse}${s.rights.licence ? `: ${s.rights.licence}` : ""}`
    : "unknown";
  lines.push(
    `| ${cell(s.id)} | ${cell(s.kind).replace(/_/g, " ")} | ${cell(s.title)} | ${cell(s.publisher)} | ${cell(s.publicationYear)} | ${cell(s.url)} | ${cell(reuse)} |`,
  );
}
lines.push("");
writeFileSync("docs/REFERENCES.md", lines.join("\n"));
console.log(
  `Wrote docs/REFERENCES.md from release ${release}: ${sources.length} sources.`,
);
