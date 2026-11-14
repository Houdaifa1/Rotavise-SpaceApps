# Photo check: readiness for the Anthropic key

Audit and fixes of 2026-11-07 on branch `claude/photo-check-ready`. The photo
check and plan explanations are built, tested against a local stand-in for the
API, and need only `ANTHROPIC_API_KEY`. **No real Claude call has been made.**

## What you do

1. Put the key in `.env` (server-side only, never in a `VITE_*` variable):

   ```
   ANTHROPIC_API_KEY=<your key>
   ```

   Optional: `ANTHROPIC_MODEL` (default `claude-opus-5-5`) and
   `AI_DAILY_REQUEST_LIMIT` (default 300 provider calls a day for all users).
   Spaces or line breaks around the key are removed; any inside it stop the
   server at start-up with a clear message.

2. Run one live request (a few cents at most):

   ```bash
   pnpm crop-health:selfcheck
   ```

   It sends a built-in flat green picture, checks the answer against the same
   rules as a farmer's photo, and prints `pass` or `fail` with the model,
   seconds, tokens and an estimated cost. It never prints the key. A failure
   prints a stable code (`AI_NOT_CONFIGURED` = key refused, `AI_BUSY` =
   rate-limited or overloaded, `AI_UNAVAILABLE` = call failed; the provider's
   HTTP status is on the log line just above).

3. Restart the API. `GET /api/v1/crop-health/status` then answers
   `{"available": true, "reason": null}`; without a key it answers
   `{"available": false, "reason": "AI_NOT_CONFIGURED"}` and the photo and
   explanation routes answer `503 AI_NOT_CONFIGURED`.

## What was checked and fixed (2026-11-07)

Audited against the Claude API documentation (Messages API, structured
outputs, refusal fallbacks, vision limits read 2026-11-07).

| Area              | Result                                                                                                                                                                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request shape     | Correct: image block before text, base64, JSON-schema output, adaptive thinking by default, `effort: medium`, `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`, `max_tokens` 16000.                                                                        |
| Model             | `claude-opus-5-5` by default; now overridable with `ANTHROPIC_MODEL`. The explanation reports the model that actually answered.                                                                                                                                              |
| Image limits      | 200 to 8000 px a side, JPEG/PNG/WebP, metadata removed, at most 7 MB of base64 (the API takes 10 MB). A 5 MB limit tried during the audit was wrong for the Claude API and was removed.                                                                                      |
| Answer validation | Strict schema; model ids must be on the crop's catalog list; at most three; a poor photo names nothing; treatment, product and dose words are removed by code; an unusable answer is never shown.                                                                            |
| Failures          | 401/403 → `AI_NOT_CONFIGURED`; 429 and now 529 (overloaded) → `AI_BUSY`; other errors, timeouts and cut-off answers → `AI_UNAVAILABLE`; refusal → `AI_DECLINED`; unreadable image → `PHOTO_UNREADABLE`. The SDK retries once, so a farmer waits at most two 60-second tries. |
| Cost caps         | 20 photos an hour per owner, 120 requests a minute per address, and a shared daily budget of provider calls. Invalid photos and uncovered crops use none of it.                                                                                                              |
| Privacy           | Photos are not stored. Logs hold status, error type, model and token counts only; a test proves the key, photo bytes and answers never reach the log.                                                                                                                        |
| Missing key       | Clear: status route plus `503 AI_NOT_CONFIGURED`.                                                                                                                                                                                                                            |
| New               | Status route, `ANTHROPIC_MODEL`, key shape check, 529 handling, `pnpm crop-health:selfcheck`, `--catalog <folder>` for `crop-health:eval`.                                                                                                                                   |

## Tests (local stand-in for the API, real PostgreSQL for routes)

Success, abstaining ("not sure"), malformed and rule-breaking answers, 429 then
success, 429 and 529 giving up, timeout, a fallback block in the reply, model
override and token reporting, logs free of secrets, the largest allowed upload,
the self-check (pass, key refused, no key), the status route, the daily cap and
the missing-key response. Commands and results are in the branch report.

## Not proven, and what proves it

- **The real API has never answered.** `pnpm crop-health:selfcheck` is the
  first proof. Details it cannot show: the exact bill per photo (the earlier
  estimate was 0.02 to 0.06 USD) and latency on real photos.
- **Accuracy on real Moroccan photos is unknown.** It needs photos labelled by
  an agronomist and `pnpm crop-health:eval <folder> --confirm-cost`; until then
  the feature stays labelled unreviewed.
- **Coverage depends on the catalog.** A crop with no listed problems answers
  `CROP_NOT_COVERED` and is never sent. Catalog 0.9.0 lists problems for only
  five crops; the research (section G) and catalog 0.10.0 widen this. The
  integration test that expects tomato to be uncovered is tied to 0.9.0 and
  must change when 0.10.0 becomes the default.
- **For the website (Step 15):** re-encode the photo with its orientation
  applied (metadata removal drops the orientation flag), keep it under 7 MB of
  base64, ask for the farmer's consent, and read the status route to show the
  feature as on or off.

## Proposed text for DECISIONS and PROGRESS (not applied)

DECISIONS "Photo check readiness (2026-11-07)": the photo check needs only the
key; `ANTHROPIC_MODEL` overrides the model; overload (529) is reported as busy;
a public status route tells the interface whether the check is on; the vision
limit is 10 MB base64 on the Claude API (read 2026-11-07), the contract keeps
7 MB; `pnpm crop-health:selfcheck` is the first live check.

PROGRESS: photo check ready except for the key and the first live run.
