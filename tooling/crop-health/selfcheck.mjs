// One live request to confirm the photo check works with the real key.
// It sends a tiny built-in picture (a flat green square, no real photo),
// checks that the answer passes the same rules as a farmer's photo, and
// prints pass or fail with the tokens used and an estimated cost. It never
// prints the key. Costs a few cents at most.
//
// Usage: pnpm crop-health:selfcheck   (ANTHROPIC_API_KEY in .env or exported)
import { deflateSync, crc32 } from "node:zlib";
import { cropPhotoResultSchema } from "../../packages/contracts/dist/index.js";
import {
  CLAUDE_MODEL,
  ClaudeClient,
  triagePhoto,
} from "../../apps/server/dist/modules/crop-health/crop-health.service.js";

const key = process.env.ANTHROPIC_API_KEY?.trim();
if (!key) {
  console.error("FAIL ANTHROPIC_API_KEY is not set (add it to .env).");
  process.exit(2);
}
if (!/^[\x21-\x7e]+$/.test(key)) {
  console.error("FAIL ANTHROPIC_API_KEY contains spaces or line breaks.");
  process.exit(2);
}
const model = process.env.ANTHROPIC_MODEL?.trim() || CLAUDE_MODEL;

// A 256 x 256 flat green PNG, built here so no image file is needed.
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), body.length + 4);
  return out;
};
const side = 256;
const header = Buffer.alloc(13);
header.writeUInt32BE(side, 0);
header.writeUInt32BE(side, 4);
header.set([8, 2, 0, 0, 0], 8);
const row = Buffer.alloc(1 + side * 3);
for (let x = 0; x < side; x++) row.set([60, 140, 60], 1 + x * 3);
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", header),
  chunk("IDAT", deflateSync(Buffer.concat(Array(side).fill(row)))),
  chunk("IEND", Buffer.alloc(0)),
]);

let usage = { inputTokens: 0, outputTokens: 0 };
const client = new ClaudeClient(key, {
  model,
  onUsage: (u) => {
    usage = {
      inputTokens: usage.inputTokens + u.inputTokens,
      outputTokens: usage.outputTokens + u.outputTokens,
    };
  },
});
const started = Date.now();
try {
  const result = await triagePhoto(client, {
    cropName: "Durum wheat",
    issues: [
      { id: "check-leaf-spot", name: "Leaf spot", scientificName: null },
      { id: "check-root-rot", name: "Root rot", scientificName: null },
    ],
    mediaType: "image/png",
    base64: png.toString("base64"),
  });
  cropPhotoResultSchema.parse(result);
  // Published rates for claude-opus-5-5: 4 USD in, 20 USD out per million
  // tokens (Claude API pricing, checked 2026-10-06); other models unpriced.
  const cost =
    model === "claude-opus-5-5"
      ? Number(
          (
            (usage.inputTokens * 4 + usage.outputTokens * 20) /
            1_000_000
          ).toFixed(4),
        )
      : null;
  console.log(
    JSON.stringify(
      {
        status: "pass",
        model,
        seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimatedCostUsd: cost,
        assessment: result.assessment,
        imageQuality: result.image_quality,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const code = error?.code ?? "FAILED";
  const hint =
    {
      AI_NOT_CONFIGURED: "The key was refused (wrong, revoked or no access).",
      AI_BUSY: "The provider is rate-limiting or overloaded; try again.",
      AI_UNAVAILABLE:
        "The provider call failed; the status is on the line above.",
      AI_DECLINED: "The provider declined this request.",
      AI_REQUEST_REJECTED: "The provider rejected the request.",
      PHOTO_UNREADABLE: "The provider could not read the test picture.",
    }[code] ?? "Unexpected failure.";
  console.error(JSON.stringify({ status: "fail", model, code, hint }, null, 2));
  process.exit(1);
}
