import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
export const tokenPairs = [
  ...["--surface", "--app-bg", "--surface-active"].flatMap((bg) =>
    [
      "--ink",
      "--ink-soft",
      "--ink-hint",
      "--danger",
      "--water",
      "--heat",
      "--vegetation",
      "--bare",
      "--caution",
    ].map((fg) => [fg, bg, 4.5]),
  ),
  ["--on-action", "--action", 4.5],
  ["--on-action", "--action-hover", 4.5],
  ["--on-action", "--action-pressed", 4.5],
  ["--on-chrome", "--map-chrome", 4.5],
  ["--chrome-caption", "--map-chrome", 4.5],
  ["--control-edge", "--surface", 3],
  ["--focus", "--surface", 3],
  ["--focus", "--app-bg", 3],
  ["--focus-on-chrome", "--map-chrome", 3],
  ["--action", "--app-bg", 3],
];
function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/../g)
    .map((c) => parseInt(c, 16) / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
export function contrast(a, b) {
  const [lo, hi] = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (hi + 0.05) / (lo + 0.05);
}
export function checkContrast(css) {
  const tokens = Object.fromEntries(
    [...css.matchAll(/(--[\w-]+):\s*(#[\da-f]{6});/gi)].map(
      ([, name, value]) => [name, value],
    ),
  );
  return tokenPairs.map(([fg, bg, minimum]) => {
    if (!tokens[fg] || !tokens[bg])
      throw new Error(`Missing contrast token ${fg} or ${bg}`);
    return { fg, bg, minimum, ratio: contrast(tokens[fg], tokens[bg]) };
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const pairs = checkContrast(
    readFileSync(
      new URL("../../apps/web/src/design/tokens.css", import.meta.url),
      "utf8",
    ),
  );
  const failures = pairs.filter((p) => p.ratio < p.minimum);
  for (const p of failures)
    console.error(`${p.fg} on ${p.bg}: ${p.ratio.toFixed(2)} < ${p.minimum}`);
  console.log(
    `${pairs.length - failures.length}/${pairs.length} semantic contrast pairs pass WCAG AA`,
  );
  process.exitCode = failures.length ? 1 : 0;
}
