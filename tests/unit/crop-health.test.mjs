import { describe, expect, jest, test } from "@jest/globals";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import {
  ClaudeClient,
  explainPlan,
  looksLikeAdvice,
  planFacts,
  triagePhoto,
  unknownNumbers,
} from "../../apps/server/dist/modules/crop-health/crop-health.service.js";
import { cleanPhoto } from "../../apps/server/dist/modules/crop-health/photo-image.js";
import {
  cropPhotoRequestSchema,
  cropPhotoResultSchema,
} from "../../packages/contracts/dist/index.js";

// Synthetic drawn photos carrying invented GPS, camera and text metadata.
const photo = (name) =>
  readFileSync(`tests/support/fixtures/photos/${name}`).toString("base64");
const leaf = photo("leaf-exif.jpg");
const calls = [];
const fake = (json, text = "") => ({
  json: async (request) => {
    calls.push(request);
    return json;
  },
  text: async () => text,
});
const issues = [
  { id: "fusarium-crown-rot", name: "Crown rot", scientificName: null },
  { id: "common-root-rot", name: "Common root rot", scientificName: null },
];
const triage = (json, extra = {}) =>
  triagePhoto(fake(json), {
    cropName: "Durum wheat",
    issues,
    mediaType: "image/jpeg",
    base64: leaf,
    ...extra,
  });
const answer = (over = {}) => ({
  image_quality: "usable",
  assessment: "possibly_affected",
  candidates: [
    {
      issue_id: "fusarium-crown-rot",
      what_is_visible: "browning at the stem base",
    },
  ],
  note: "Please check the stem base.",
  ...over,
});
describe("photos are checked and stripped of metadata before they leave", () => {
  test.each([
    ["leaf-exif.jpg", "image/jpeg"],
    ["leaf-text.png", "image/png"],
    ["leaf-exif.webp", "image/webp"],
  ])("%s keeps its size and loses GPS, camera and text", (name, type) => {
    const before = Buffer.from(photo(name), "base64");
    expect(before.includes("SyntheticCam")).toBe(true);
    const clean = cleanPhoto(type, photo(name));
    const after = Buffer.from(clean.base64, "base64");
    expect([clean.width, clean.height]).toEqual([320, 240]);
    expect(clean.removedBytes).toBeGreaterThan(0);
    for (const marker of [
      "SyntheticCam",
      "FixtureModel",
      "Exif",
      "synthetic",
      "Location",
    ])
      expect(after.includes(marker)).toBe(false);
  });
  test("a photo that is not what it claims, too small or too large is refused", () => {
    expect(() => cleanPhoto("image/png", leaf)).toThrow("PHOTO_INVALID");
    expect(() => cleanPhoto("image/jpeg", photo("leaf-text.png"))).toThrow(
      "PHOTO_INVALID",
    );
    expect(() => cleanPhoto("image/jpeg", photo("tiny.jpg"))).toThrow(
      "PHOTO_TOO_SMALL",
    );
    // A PNG header claiming 9000 x 300 px.
    const png = Buffer.alloc(8 + 25 + 12);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(png);
    png.writeUInt32BE(13, 8);
    png.write("IHDR", 12, "latin1");
    png.writeUInt32BE(9000, 16);
    png.writeUInt32BE(300, 20);
    png.writeUInt32BE(0, 33);
    png.write("IEND", 37, "latin1");
    expect(() => cleanPhoto("image/png", png.toString("base64"))).toThrow(
      "PHOTO_TOO_LARGE",
    );
    expect(() =>
      cleanPhoto(
        "image/jpeg",
        Buffer.from("not an image at all").toString("base64"),
      ),
    ).toThrow("PHOTO_INVALID");
  });
});
describe("photo triage rules are enforced by code", () => {
  test("a listed problem stays a possibility, with a fixed notice", async () => {
    const r = await triage(answer());
    expect(() => cropPhotoResultSchema.parse(r)).not.toThrow();
    expect(r.assessment).toBe("possibly_affected");
    expect(r.candidates).toHaveLength(1);
    expect(r.checked_issue_count).toBe(2);
    expect(r.text_removed).toBe(false);
    expect(r.notice).toMatch(/not a diagnosis/);
  });
  test("the model sees only the stripped photo and may only pick listed ids", async () => {
    calls.length = 0;
    await triage(answer());
    const [request] = calls;
    expect(
      Buffer.from(request.image.base64, "base64").includes("SyntheticCam"),
    ).toBe(false);
    expect(
      request.schema.properties.candidates.items.properties.issue_id.enum,
    ).toEqual(["fusarium-crown-rot", "common-root-rot"]);
  });
  test("a crop with no sourced problem list is not sent to the model", async () => {
    calls.length = 0;
    await expect(triage(answer(), { issues: [] })).rejects.toThrow(
      "CROP_NOT_COVERED",
    );
    expect(calls).toHaveLength(0);
  });
  test("a problem not on the crop's list is removed", async () => {
    const r = await triage(
      answer({
        candidates: [{ issue_id: "invented-disease", what_is_visible: "x" }],
      }),
    );
    expect(r.candidates).toEqual([]);
    expect(r.assessment).toBe("not_sure");
  });
  test("a poor photo names nothing", async () => {
    const r = await triage(answer({ image_quality: "poor" }));
    expect(r.candidates).toEqual([]);
    expect(r.assessment).toBe("not_sure");
  });
  test("extra or repeated candidates are cut to three distinct ones", async () => {
    const c = (id) => ({ issue_id: id, what_is_visible: "spots" });
    const r = await triagePhoto(
      fake(
        answer({
          candidates: [
            c("a-one"),
            c("a-one"),
            c("b-two"),
            c("c-three"),
            c("d-four"),
          ],
        }),
      ),
      {
        cropName: "Durum wheat",
        issues: ["a-one", "b-two", "c-three", "d-four"].map((id) => ({
          id,
          name: id,
          scientificName: null,
        })),
        mediaType: "image/jpeg",
        base64: leaf,
      },
    );
    expect(r.candidates.map((x) => x.issue_id)).toEqual([
      "a-one",
      "b-two",
      "c-three",
    ]);
  });
  test("treatment, product or dose text is removed by code", async () => {
    const r = await triage(
      answer({
        note: "Spray a fungicide at 2 g/l.",
        candidates: [
          {
            issue_id: "fusarium-crown-rot",
            what_is_visible: "apply 3 treatments",
          },
        ],
      }),
    );
    expect(r.note).toBe("");
    expect(r.candidates[0].what_is_visible).toBe("");
    expect(r.text_removed).toBe(true);
    for (const text of [
      "رش مبيد",
      "Traitement fongicide",
      "dose",
      "٣ مرات",
      "دير الدوا",
    ])
      expect(looksLikeAdvice(text)).toBe(true);
    expect(looksLikeAdvice("Brown streaks at the stem base.")).toBe(false);
  });
  test("long text is shortened, not refused", async () => {
    const r = await triage(answer({ note: "Look closely. ".repeat(80) }));
    expect(r.note.length).toBeLessThanOrEqual(600);
  });
  test("the notice follows the farmer's language", async () => {
    expect((await triage(answer(), { language: "fr" })).notice).toMatch(
      /pas un diagnostic/,
    );
    expect((await triage(answer(), { language: "ar" })).notice).toMatch(
      /ليست تشخيصاً/,
    );
  });
  test("a photo needs the farmer's consent; the language is optional", () => {
    const body = {
      crop_id: "durum-wheat",
      media_type: "image/jpeg",
      image_base64: "A".repeat(200),
    };
    expect(cropPhotoRequestSchema.safeParse(body).success).toBe(false);
    expect(
      cropPhotoRequestSchema.safeParse({ ...body, consent: true }).success,
    ).toBe(true);
    expect(
      cropPhotoRequestSchema.safeParse({
        ...body,
        consent: true,
        language: "ary",
      }).success,
    ).toBe(true);
  });
});
describe("the Claude client against a local stand-in for the API", () => {
  // Records each request and replies with the queued status and body.
  const serve = async (replies) => {
    const seen = [];
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push({ headers: req.headers, body: JSON.parse(body) });
        const [status, payload] = replies.shift() ?? [500, {}];
        res.writeHead(status, {
          "content-type": "application/json",
          "retry-after": "0",
        });
        res.end(JSON.stringify(payload));
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const client = new ClaudeClient("test-key", {
      baseURL: `http://127.0.0.1:${server.address().port}`,
    });
    return { seen, client, close: () => new Promise((r) => server.close(r)) };
  };
  const message = (text, stop = "end_turn") => ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text }],
    stop_reason: stop,
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  const error = (type) => ({ type: "error", error: { type, message: "x" } });
  test("a photo request is well formed and its answer is checked", async () => {
    const api = await serve([[200, message(JSON.stringify(answer()))]]);
    try {
      const r = await triagePhoto(api.client, {
        cropName: "Durum wheat",
        issues,
        mediaType: "image/jpeg",
        base64: leaf,
        language: "fr",
      });
      expect(r.candidates[0].issue_id).toBe("fusarium-crown-rot");
      const [{ headers, body }] = api.seen;
      expect(headers["anthropic-beta"]).toContain(
        "server-side-fallback-2026-07-01",
      );
      expect(body).toMatchObject({
        model: "claude-opus-5-5",
        fallbacks: "default",
        max_tokens: 16000,
      });
      expect(body.output_config.format.type).toBe("json_schema");
      const image = body.messages[0].content[0];
      expect(image.source.media_type).toBe("image/jpeg");
      expect(
        Buffer.from(image.source.data, "base64").includes("SyntheticCam"),
      ).toBe(false);
    } finally {
      await api.close();
    }
  });
  test.each([
    [401, "authentication_error", "AI_NOT_CONFIGURED"],
    [403, "permission_error", "AI_NOT_CONFIGURED"],
    [429, "rate_limit_error", "AI_BUSY"],
    [500, "api_error", "AI_UNAVAILABLE"],
  ])("HTTP %i is reported as %s", async (status, type, code) => {
    const api = await serve([
      [status, error(type)],
      [status, error(type)],
    ]);
    try {
      await expect(api.client.text({ system: "s", text: "t" })).rejects.toThrow(
        code,
      );
    } finally {
      await api.close();
    }
  });
  test("an image the API cannot read is reported as unreadable", async () => {
    const api = await serve([[400, error("invalid_request_error")]]);
    try {
      await expect(
        triagePhoto(api.client, {
          cropName: "Durum wheat",
          issues,
          mediaType: "image/jpeg",
          base64: leaf,
        }),
      ).rejects.toThrow("PHOTO_UNREADABLE");
    } finally {
      await api.close();
    }
  });
  test("a refusal and a cut-off answer are never shown as results", async () => {
    const api = await serve([
      [200, message("", "refusal")],
      [200, message("{", "max_tokens")],
    ]);
    try {
      await expect(api.client.text({ system: "s", text: "t" })).rejects.toThrow(
        "AI_DECLINED",
      );
      await expect(api.client.text({ system: "s", text: "t" })).rejects.toThrow(
        "AI_UNAVAILABLE",
      );
    } finally {
      await api.close();
    }
  });
});
describe("the Claude client under provider trouble, with a local stand-in", () => {
  const SECRET = "sk-ant-test-SECRET-key-0123456789";
  const reply = (text, extra = {}) => ({
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text }],
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 1200, output_tokens: 80 },
    ...extra,
  });
  const apiError = (type) => ({ type: "error", error: { type, message: "x" } });
  // `handle(request, index)` answers each request; the server counts them.
  const stand = async (handle, options = {}) => {
    const seen = [];
    const sockets = new Set();
    const server = createServer((req, res) => {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => {
        seen.push(JSON.parse(body));
        handle(res, seen.length - 1);
      });
    });
    server.on("connection", (s) => {
      sockets.add(s);
      s.on("close", () => sockets.delete(s));
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    const client = new ClaudeClient(SECRET, {
      baseURL: `http://127.0.0.1:${server.address().port}`,
      ...options,
    });
    return {
      seen,
      client,
      close: () => {
        for (const s of sockets) s.destroy();
        return new Promise((r) => server.close(r));
      },
    };
  };
  const send = (res, status, payload) => {
    res.writeHead(status, {
      "content-type": "application/json",
      "retry-after": "0",
    });
    res.end(JSON.stringify(payload));
  };
  const check = (client) =>
    triagePhoto(client, {
      cropName: "Durum wheat",
      issues,
      mediaType: "image/jpeg",
      base64: leaf,
    });
  test("a busy provider (429, then 529) is reported as busy", async () => {
    for (const status of [429, 529]) {
      const api = await stand((res) =>
        send(res, status, apiError("overloaded_error")),
      );
      try {
        await expect(check(api.client)).rejects.toThrow("AI_BUSY");
        // One try and one retry, then the farmer is told to try later.
        expect(api.seen).toHaveLength(2);
      } finally {
        await api.close();
      }
    }
  });
  test("one 429 followed by a good answer still gives a result", async () => {
    const api = await stand((res, i) =>
      i === 0
        ? send(res, 429, apiError("rate_limit_error"))
        : send(res, 200, reply(JSON.stringify(answer()))),
    );
    try {
      const r = await check(api.client);
      expect(r.candidates[0].issue_id).toBe("fusarium-crown-rot");
      expect(api.seen).toHaveLength(2);
    } finally {
      await api.close();
    }
  });
  test("a provider that never answers times out as unavailable", async () => {
    const api = await stand(() => {}, { timeoutMs: 150 });
    try {
      await expect(check(api.client)).rejects.toThrow("AI_UNAVAILABLE");
      expect(api.seen).toHaveLength(2);
    } finally {
      await api.close();
    }
  });
  test("a malformed or rule-breaking answer is never shown", async () => {
    for (const text of [
      "not json at all",
      "[]",
      JSON.stringify(answer({ unexpected: "field" })),
      JSON.stringify(answer({ assessment: "definitely_sick" })),
      JSON.stringify({ image_quality: "usable" }),
    ]) {
      const api = await stand((res) => send(res, 200, reply(text)));
      try {
        await expect(check(api.client)).rejects.toThrow("AI_UNAVAILABLE");
      } finally {
        await api.close();
      }
    }
  });
  test("the model may abstain and the result says it is not sure", async () => {
    const api = await stand((res) =>
      send(
        res,
        200,
        reply(
          JSON.stringify(
            answer({
              assessment: "not_sure",
              candidates: [],
              note: "The picture does not show a clear problem.",
            }),
          ),
        ),
      ),
    );
    try {
      const r = await check(api.client);
      expect(r.assessment).toBe("not_sure");
      expect(r.candidates).toEqual([]);
      expect(cropPhotoResultSchema.safeParse(r).success).toBe(true);
    } finally {
      await api.close();
    }
  });
  test("a fallback block in the reply does not disturb the answer", async () => {
    const api = await stand((res) =>
      send(
        res,
        200,
        reply("", {
          content: [
            {
              type: "fallback",
              from: { model: "claude-opus-5-5" },
              to: { model: "claude-opus-4-8" },
            },
            { type: "text", text: JSON.stringify(answer()) },
          ],
          usage: {
            input_tokens: 5,
            output_tokens: 5,
            iterations: [{ type: "fallback_message" }],
          },
        }),
      ),
    );
    try {
      const r = await check(api.client);
      expect(r.candidates[0].issue_id).toBe("fusarium-crown-rot");
    } finally {
      await api.close();
    }
  });
  test("the model can be overridden and token use is reported", async () => {
    const used = [];
    const api = await stand(
      (res) => send(res, 200, reply(JSON.stringify(answer()))),
      {
        model: "claude-sonnet-5-5",
        onUsage: (u) => used.push(u),
      },
    );
    try {
      await check(api.client);
      expect(api.client.model).toBe("claude-sonnet-5-5");
      expect(api.seen[0].model).toBe("claude-sonnet-5-5");
      expect(used).toEqual([{ inputTokens: 1200, outputTokens: 80 }]);
    } finally {
      await api.close();
    }
  });
  test("the largest upload the contract accepts is within the provider's 10 MB limit and is sent", async () => {
    const big = Buffer.concat([
      readFileSync("tests/support/fixtures/photos/leaf-exif.jpg"),
      Buffer.alloc(5_100_000),
    ]).toString("base64");
    expect(
      cropPhotoRequestSchema.safeParse({
        crop_id: "durum-wheat",
        media_type: "image/jpeg",
        image_base64: big,
        consent: true,
      }).success,
    ).toBe(true);
    const api = await stand((res) =>
      send(res, 200, reply(JSON.stringify(answer()))),
    );
    try {
      await triagePhoto(api.client, {
        cropName: "Durum wheat",
        issues,
        mediaType: "image/jpeg",
        base64: big,
      });
      expect(
        api.seen[0].messages[0].content[0].source.data.length,
      ).toBeLessThan(10_000_000);
    } finally {
      await api.close();
    }
  });
  test("logs never carry the key, the photo or the answer", async () => {
    const lines = [];
    const spy = jest
      .spyOn(console, "error")
      .mockImplementation((...a) => lines.push(a.join(" ")));
    const good = await stand((res) =>
      send(res, 200, reply(JSON.stringify(answer()))),
    );
    const bad = await stand((res) =>
      send(res, 401, apiError("authentication_error")),
    );
    try {
      await check(good.client);
      await expect(check(bad.client)).rejects.toThrow("AI_NOT_CONFIGURED");
    } finally {
      spy.mockRestore();
      await good.close();
      await bad.close();
    }
    const log = lines.join("\n");
    expect(log).toContain("crop_health_ai");
    expect(log).not.toContain(SECRET);
    expect(log).not.toContain(leaf.slice(100, 180));
    expect(log).not.toContain("browning at the stem base");
  });
});
describe("pnpm crop-health:selfcheck, run against a local stand-in", () => {
  const KEY = "sk-ant-test-SELFCHECK-0123456789";
  const run = (env) =>
    new Promise((resolve) => {
      execFile(
        process.execPath,
        ["tooling/crop-health/selfcheck.mjs"],
        { env: { PATH: process.env.PATH, ...env } },
        (error, stdout, stderr) =>
          resolve({ code: error?.code ?? 0, stdout, stderr }),
      );
    });
  const provider = async (status, payload) => {
    const server = createServer((req, res) => {
      req.resume();
      req.on("end", () => {
        res.writeHead(status, { "content-type": "application/json" });
        res.end(JSON.stringify(payload));
      });
    });
    await new Promise((r) => server.listen(0, "127.0.0.1", r));
    return {
      url: `http://127.0.0.1:${server.address().port}`,
      close: () => new Promise((r) => server.close(r)),
    };
  };
  test("passes with a working provider and prints tokens and cost, not the key", async () => {
    const api = await provider(200, {
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content: [
        {
          type: "text",
          text: JSON.stringify({
            image_quality: "poor",
            assessment: "not_sure",
            candidates: [],
            note: "The picture is a flat colour.",
          }),
        },
      ],
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 1000, output_tokens: 100 },
    });
    try {
      const r = await run({
        ANTHROPIC_API_KEY: KEY,
        ANTHROPIC_BASE_URL: api.url,
      });
      expect(r.code).toBe(0);
      const out = JSON.parse(r.stdout);
      expect(out).toMatchObject({
        status: "pass",
        model: "claude-opus-5-5",
        inputTokens: 1000,
        outputTokens: 100,
        estimatedCostUsd: 0.006,
      });
      expect(r.stdout + r.stderr).not.toContain(KEY);
    } finally {
      await api.close();
    }
  });
  test("fails clearly when the provider refuses the key", async () => {
    const api = await provider(401, {
      type: "error",
      error: { type: "authentication_error", message: "invalid x-api-key" },
    });
    try {
      const r = await run({
        ANTHROPIC_API_KEY: KEY,
        ANTHROPIC_BASE_URL: api.url,
      });
      expect(r.code).toBe(1);
      const fail = JSON.parse(
        r.stderr.slice(r.stderr.lastIndexOf('{\n  "status"')),
      );
      expect(fail).toMatchObject({ status: "fail", code: "AI_NOT_CONFIGURED" });
      expect(r.stdout + r.stderr).not.toContain(KEY);
    } finally {
      await api.close();
    }
  });
  test("says what to do when no key is set", async () => {
    const r = await run({});
    expect(r.code).toBe(2);
    expect(r.stderr).toContain("ANTHROPIC_API_KEY is not set");
  });
});
describe("plan explanations cannot change numbers", () => {
  const facts = { rain: 341.3, rank: 1 };
  test("a number not in the facts is refused", async () => {
    expect(
      unknownNumbers("rain 341.3 mm, rank 1", JSON.stringify(facts)),
    ).toEqual([]);
    expect(unknownNumbers("rain 500 mm", JSON.stringify(facts))).toEqual([
      "500",
    ]);
    await expect(
      explainPlan(fake({}, "rain 500 mm"), facts, "fr"),
    ).rejects.toThrow("EXPLANATION_CHECK_FAILED");
  });
  test("a faithful answer passes and is marked unreviewed", async () => {
    const r = await explainPlan(fake({}, "Pluie 341,3 mm"), facts, "fr");
    expect(r).toMatchObject({ language: "fr", reviewed: false });
  });
  test("facts carry the top three rotations and warnings", () => {
    const candidate = {
      rank: 1,
      slots: [
        {
          cropId: "barley",
          sowEarliest: "2027-11-01",
          sowLatest: "2027-12-15",
        },
      ],
      waterBalance: { meanLoss: 0.5, meanAnnualRainMm: 300 },
      scores: { climate: { meanLoss: 0.01 } },
    };
    const f = planFacts({
      catalog: { version: "0.6.0" },
      outcome: "comparisons_available",
      candidates: [candidate, candidate, candidate, candidate],
      reasons: [{ code: "RAINFED_ARID_RISK", cropId: "barley" }],
      soilEstimate: null,
      limitations: ["x"],
    });
    expect(f.rotations).toHaveLength(3);
    expect(f.warnings[0].code).toBe("RAINFED_ARID_RISK");
  });
});

describe("the photo check works with a large problem table", () => {
  test("every listed problem is offered with its names and visible signs", async () => {
    const many = Array.from({ length: 60 }, (_, i) => ({
      id: `issue-${i}-xx`,
      name: `Issue ${i}`,
      scientificName: null,
      otherNames: ["Nom"],
      visibleSigns: "yellow spots on the leaves",
    }));
    calls.length = 0;
    await triagePhoto(
      fake(
        answer({
          candidates: [
            { issue_id: "issue-3-xx", what_is_visible: "yellow spots" },
          ],
        }),
      ),
      {
        cropName: "Test crop",
        issues: many,
        mediaType: "image/jpeg",
        base64: leaf,
      },
    );
    const sent = JSON.parse(calls.at(-1).text);
    expect(sent.problems_to_consider).toHaveLength(60);
    expect(sent.problems_to_consider[0].visibleSigns).toBe(
      "yellow spots on the leaves",
    );
    expect(
      calls.at(-1).schema.properties.candidates.items.properties.issue_id.enum,
    ).toHaveLength(60);
  });
});
