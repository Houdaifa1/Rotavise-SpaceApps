// Labelled evaluation of the crop photo check against the real Claude API.
// It costs money (about 0.02-0.06 USD a photo) and needs ANTHROPIC_API_KEY,
// so it never runs in CI and refuses to start without --confirm-cost.
//
// Usage:
//   pnpm crop-health:eval <folder> --confirm-cost [--language fr]
//
// <folder> holds the photos and labels.json, a list of
//   { "file": "wheat-01.jpg", "crop_id": "durum-wheat",
//     "expected": ["fusarium-crown-rot"], "labelled_by": "name, role" }
// where "expected" lists the catalog problems an agronomist confirmed in the
// photo, or is [] for a healthy plant. Photos must be real field photos the
// labeller may share with the AI provider.
import { readFileSync } from "node:fs";
import path from "node:path";
import { loadCatalogRelease } from "../../apps/server/dist/modules/catalog/importing/load-release.js";
import {
  ClaudeClient,
  triagePhoto,
} from "../../apps/server/dist/modules/crop-health/crop-health.service.js";

const args = process.argv.slice(2);
const folder = args.find((a) => !a.startsWith("--"));
const language = args.includes("--language")
  ? args[args.indexOf("--language") + 1]
  : "en";
if (!folder || !args.includes("--confirm-cost")) {
  console.error(
    "Usage: pnpm crop-health:eval <folder> --confirm-cost [--language fr]",
  );
  process.exit(2);
}
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("ANTHROPIC_API_KEY is not set in .env");
  process.exit(2);
}
const types = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};
const labels = JSON.parse(
  readFileSync(path.join(folder, "labels.json"), "utf8"),
);
// The catalog release to score against; pass --catalog <folder> for a newer one.
const catalog = await loadCatalogRelease(
  args.includes("--catalog")
    ? args[args.indexOf("--catalog") + 1]
    : "data/catalog/releases/0.9.0",
);
const client = new ClaudeClient(process.env.ANTHROPIC_API_KEY);
const rows = [];
for (const label of labels) {
  const crop = catalog.profiles.find((p) => p.id === label.crop_id);
  const mediaType = types[path.extname(label.file).toLowerCase()];
  if (!crop || !mediaType) {
    rows.push({
      file: label.file,
      error: !crop ? "UNKNOWN_CROP" : "UNKNOWN_TYPE",
    });
    continue;
  }
  const issues = catalog.issues
    .filter((i) => i.hostCropIds.includes(crop.id))
    .map((i) => ({ id: i.id, name: i.name, scientificName: i.scientificName }));
  try {
    const r = await triagePhoto(client, {
      cropName: crop.identity.name,
      issues,
      mediaType,
      base64: readFileSync(path.join(folder, label.file)).toString("base64"),
      language,
    });
    const named = r.candidates.map((c) => c.issue_id);
    rows.push({
      file: label.file,
      crop: crop.id,
      expected: label.expected,
      assessment: r.assessment,
      named,
      hit:
        label.expected.length > 0 &&
        label.expected.some((e) => named.includes(e)),
      // The costly mistake: a confirmed problem called "nothing visible".
      falseReassurance:
        label.expected.length > 0 && r.assessment === "no_visible_problem",
      falseAlarm: label.expected.length === 0 && named.length > 0,
      textRemoved: r.text_removed,
    });
  } catch (error) {
    rows.push({
      file: label.file,
      crop: crop.id,
      error: error.code ?? "FAILED",
    });
  }
}
const scored = rows.filter((r) => !r.error);
const sick = scored.filter((r) => r.expected.length > 0);
const healthy = scored.filter((r) => r.expected.length === 0);
const share = (n, d) => (d ? Number((n / d).toFixed(3)) : null);
console.log(
  JSON.stringify(
    {
      label:
        "Crop photo check evaluation; labels from the folder, model claude-opus-5-5",
      photos: rows.length,
      errors: rows.filter((r) => r.error).length,
      withProblem: sick.length,
      healthy: healthy.length,
      hitRate: share(sick.filter((r) => r.hit).length, sick.length),
      notSureRate: share(
        scored.filter((r) => r.assessment === "not_sure").length,
        scored.length,
      ),
      falseReassuranceRate: share(
        sick.filter((r) => r.falseReassurance).length,
        sick.length,
      ),
      falseAlarmRate: share(
        healthy.filter((r) => r.falseAlarm).length,
        healthy.length,
      ),
      rows,
    },
    null,
    2,
  ),
);
