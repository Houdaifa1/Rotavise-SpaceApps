import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
const dist = new URL("../../apps/web/dist/", import.meta.url);
const manifest = JSON.parse(
  readFileSync(new URL(".vite/manifest.json", dist), "utf8"),
);
const initial = new Set();
function add(key) {
  const chunk = manifest[key];
  if (!chunk) throw new Error(`Missing build chunk: ${key}`);
  if (initial.has(chunk.file)) return;
  initial.add(chunk.file);
  for (const child of chunk.imports ?? []) add(child);
}
for (const [key, chunk] of Object.entries(manifest))
  if (chunk.isEntry) add(key);
// main.tsx dispatches to App; the welcome and phone sheet are the two F1
// entry variants. Include every static import, then choose the larger route.
if (manifest["src/app/App.tsx"]) add("src/app/App.tsx");
const core = new Set(initial);
const variants = [];
for (const scenario of [
  ["src/features/welcome/Welcome.tsx"],
  ["src/features/glossary/GlossaryPage.tsx"],
  ["src/features/glossary/GlossaryPage.tsx", "src/app/PhoneSheet.tsx"],
  ["src/app/screens/InProgress.tsx", "src/app/PhoneSheet.tsx"],
  ["src/features/map/MapWorkspace.tsx"],
  ["src/features/map/MapWorkspace.tsx", "src/app/PhoneSheet.tsx"],
  ["src/features/plans/PlanBuilder.tsx"],
  ["src/features/plans/PlanBuilder.tsx", "src/features/plans/BuilderSteps.tsx"],
  ["src/features/plans/PlanBuilder.tsx", "src/features/plans/CheckInputs.tsx"],
  ...[undefined, "BuilderSteps", "CheckInputs"].map((step) => [
    "src/features/plans/PlanBuilder.tsx",
    ...(step ? [`src/features/plans/${step}.tsx`] : []),
    ...(manifest["src/features/plans/PlanProgress.tsx"]?.dynamicImports ?? []),
  ]),
  [
    "src/features/plans/PlanProgress.tsx",
    ...(manifest["src/features/plans/PlanProgress.tsx"]?.dynamicImports ?? []),
  ],
  ["src/features/crops/CropsPage.tsx"],
  ["src/features/crops/CropsPage.tsx", "src/app/PhoneSheet.tsx"],
  [
    "src/features/map/MapWorkspace.tsx",
    "src/features/fields/detail/FieldDetail.tsx",
    "src/app/PhoneSheet.tsx",
  ],
  ...["History", "Inputs", "Nasa"].map((tab) => [
    "src/features/map/MapWorkspace.tsx",
    "src/features/fields/detail/FieldDetail.tsx",
    `src/features/fields/detail/${tab}.tsx`,
    "src/app/PhoneSheet.tsx",
  ]),
  [
    "src/features/map/MapWorkspace.tsx",
    "src/features/fields/creation/FieldCreation.tsx",
    "src/app/PhoneSheet.tsx",
  ],
]) {
  initial.clear();
  for (const f of core) initial.add(f);
  for (const route of scenario) add(route);
  variants.push({
    route: scenario.join(" + "),
    bytes: [...initial].reduce(
      (n, file) => n + gzipSync(readFileSync(new URL(file, dist))).byteLength,
      gzipSync(readFileSync(new URL("boot.js", dist))).byteLength,
    ),
  });
}
for (const variant of variants)
  if (variant.bytes >= 250000)
    throw new Error(
      `${variant.route}: ${variant.bytes} gzip bytes exceeds 250 kB`,
    );
const renderer = manifest["src/features/map/mapRenderer.ts"];
if (!renderer?.isDynamicEntry)
  throw new Error("Map renderer must be a deferred entry");
const rendererFiles = [
  renderer.file,
  ...(renderer.assets ?? []).filter((file) => file.endsWith(".js")),
];
const deferredMapGzipBytes = rendererFiles.reduce(
  (bytes, file) =>
    bytes + gzipSync(readFileSync(new URL(file, dist))).byteLength,
  0,
);
for (const file of readdirSync(new URL("assets/", dist)).filter((f) =>
  f.endsWith(".js"),
)) {
  const content = readFileSync(new URL(`assets/${file}`, dist), "utf8");
  if (/verificationWidths|photo-specimen|mountDesign/.test(content))
    throw new Error(`Development fixture leaked into ${file}`);
}
console.log(
  JSON.stringify(
    {
      firstScreenGzipBytes: variants,
      budget: 250000,
      messageDataGzipBytes: ["fr", "en"].map((language) => ({
        language,
        bytes: gzipSync(
          readFileSync(
            new URL(manifest[`src/i18n/${language}.json`].file, dist),
          ),
        ).byteLength,
      })),
      deferredMapGzipBytes,
      notes:
        "Self-hosted fonts allowed; map and chart features remain deferred.",
    },
    null,
    2,
  ),
);
