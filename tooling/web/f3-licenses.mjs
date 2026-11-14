import {
  readFileSync,
  readdirSync,
  realpathSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
const root = new URL("../../", import.meta.url).pathname;
const web = join(root, "apps/web"),
  out = join(web, "public/licenses/f3");
mkdirSync(out, { recursive: true });
const seen = new Map();
function visit(path) {
  path = realpathSync(path);
  const pkg = JSON.parse(readFileSync(join(path, "package.json"), "utf8"));
  if (seen.has(pkg.name)) return;
  const licenses = readdirSync(path).filter((n) =>
    /^(licen[cs]e|copying|notice)(\.|$)/i.test(n),
  );
  const readme = readdirSync(path).find((n) => /^readme\.md$/i.test(n));
  const embedded =
    !licenses.length && readme
      ? readFileSync(join(path, readme), "utf8").split(/## Licen[cs]e\s*/i)[1]
      : undefined;
  if (!licenses.length && !embedded)
    throw new Error(`No license file for ${pkg.name}`);
  const file = pkg.name.replace(/[@/]/g, "_") + ".txt";
  writeFileSync(
    join(out, file),
    embedded ??
      licenses.map((n) => readFileSync(join(path, n), "utf8")).join("\n\n"),
  );
  seen.set(pkg.name, { version: pkg.version, license: pkg.license, file });
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    const linked = join(dirname(path), name);
    const nested = join(path, "node_modules", name);
    if (existsSync(nested)) visit(nested);
    else if (existsSync(linked)) visit(linked);
    else throw new Error(`Missing ${name}`);
  }
}
for (const name of [
  "polylabel",
  "proj4",
  "shpjs",
  "@tmcw/togeojson",
  "polygon-clipping",
  "@types/polylabel",
  "@types/geojson",
])
  visit(join(web, "node_modules", name));
console.log(
  [...seen]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([name, p]) =>
        `| ${name} | ${p.version} | ${p.license} | [Licence](apps/web/public/licenses/f3/${p.file}) |`,
    )
    .join("\n"),
);
