// Prints self-time and total-time hot spots of a V8 .cpuprofile.
// Usage: node tooling/performance/summarize-profile.mjs file.cpuprofile [top]
import { readFileSync } from "node:fs";

const profile = JSON.parse(readFileSync(process.argv[2], "utf8"));
const top = Number(process.argv[3] ?? 25);
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => self.set(id, (self.get(id) ?? 0) + dt[i]));
const parent = new Map();
for (const n of profile.nodes)
  for (const c of n.children ?? []) parent.set(c, n.id);
const label = (n) => {
  const f = n.callFrame;
  return `${f.functionName || "(anon)"} ${f.url.split("/").slice(-3).join("/")}:${f.lineNumber + 1}`;
};
const selfBy = new Map();
const totalBy = new Map();
for (const [id, t] of self) {
  const n = byId.get(id);
  selfBy.set(label(n), (selfBy.get(label(n)) ?? 0) + t);
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const l = label(byId.get(cur));
    if (seen.has(l)) continue;
    seen.add(l);
    totalBy.set(l, (totalBy.get(l) ?? 0) + t);
  }
}
const show = (title, map) => {
  console.log(`\n${title}`);
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .forEach(([l, t]) =>
      console.log(`${(t / 1000).toFixed(0).padStart(8)} ms  ${l}`),
    );
};
show("self time", selfBy);
show("total time", totalBy);
