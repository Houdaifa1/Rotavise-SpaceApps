// Family hue + three lightness bands. Fine saturation/hue offsets retain crop
// identity: a palette of only 16 × 3 discrete colours cannot identify 246 crops.
const familyHues = [
  43, 153, 208, 29, 282, 184, 332, 83, 225, 12, 170, 258, 53, 309, 118, 196,
] as const;
function hash(value: string): number {
  let result = 2166136261;
  for (const char of value)
    result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return result >>> 0;
}
export function cropColor(cropId: string, family: string): string {
  const identity = hash(cropId);
  const base = familyHues[hash(family) % familyHues.length]!;
  const hue = (base + (identity % 1601) / 100 - 8 + 360) % 360;
  const saturation = 34 + ((identity >>> 11) % 2001) / 100;
  const lightness = [38, 47, 56][identity % 3]!;
  return `hsl(${hue.toFixed(2)} ${saturation.toFixed(2)}% ${lightness}%)`;
}
