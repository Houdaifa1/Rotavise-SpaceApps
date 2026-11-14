# P6 – What-if scenario backend

Branch `claude/p6-whatif`. A farmer can ask "what if it rains 30 % less, runs 3 °C
warmer, or I sow a week later?" and get the normal rotation comparison under
those assumptions. Nothing here is a forecast and the result says so.

## What was built

- **Request field** (`packages/contracts/src/plans/plan-v2.contract.ts`):
  optional `what_if` on the format 2 request, strict, units in the key names:
  - `rainfall_change_percent`: integer, −50…+50. Every daily rain amount is
    multiplied by `1 + value/100`.
  - `temperature_change_c`: −3…+6 in steps of 0.1. Added to every daily
    minimum, maximum and mean air temperature.
  - `sowing_shift_days`: integer, −45…+45. Moves the first-sowing range
    (`earliest_start_date`, `latest_start_date`) of the rotation.
  - Each key defaults to 0; a what-if with no change is rejected.
- **Pure domain code** (`packages/domain/src/rotation/what-if.ts`, no Node
  imports): `applyWhatIfToSource` returns a new climate source (input never
  modified, missing days stay missing), `shiftPlanning`, `whatIfBlock`.
- **Where it applies** (`rotation/assess.ts`):
  - the historical POWER record (after the GPM rain correction);
  - each model's _future_ world (SSP2-4.5 and SSP5-8.5). The model's own
    baseline years are left alone, so the future comparison shows the model's
    change plus the farmer's extra change;
  - the crop-model weather used for yields and soil carbon (`yieldRequestWeather`,
    `addSoilCarbon`);
  - the first-sowing range (validated again: a shift before today or beyond
    the 366-day limit fails with `ROTATION_INPUT_INVALID`, it is not guessed).
- **Result** (`packages/contracts/src/engine/rotation.contract.ts`): optional
  `whatIf` block with `notAForecast: true`, the label, the three changes,
  `appliedTo.futureModelWorlds` (`applied | not_prepared | incomplete |
not_needed`) and the requested versus effective sowing range. One line is
  appended to `limitations`. `result.input` stays the request as submitted.
- **API** (`plans.controller.ts`, `plan-store.ts`):
  `POST /api/v1/plans/:id/what-if` with an `Idempotency-Key` header and body
  `{ "what_if": { ... } }`. It reads the caller's own stored format 2 plan
  (owner-scoped, same rules as `GET /plans/:id`), adds `what_if` and submits the
  result through the normal intake: same hashing, quota, catalog pinning and
  queue. Response `202` with `Location`. `POST /api/v1/plans` also accepts
  `what_if` directly.
- **No migration.** `what_if` lives inside the already-hashed JSON input.

## Unchanged behaviour (checked)

A request without `what_if` normalizes to the same canonical JSON and hash as
before and its result has no `whatIf` key and the old `limitations`. The
existing engine, plan and backend tests were not edited for this.

## Verified (2026-11-09, this worktree)

See the commands and exit codes in the commit message / run log at the end of
this file.

- Unit (`rotation` project): contract bounds and refusals; absent `what_if`
  keeps identity; deterministic, non-mutating source change with NaN kept;
  labelled, repeatable result that parses; warmer and drier costs more on the
  same rotation; sowing shift moves `sowEarliest` by exactly the shift and an
  out-of-range shift throws `RotationInputError`; future worlds are scaled
  (`futureRainMm` ≈ 0.7 × baseline for −30 %).
- Integration (`rotation-integration`, real PostgreSQL): stored input equals
  the original plus `what_if`, with its own hash; the full pipeline completes
  and passes the result-hash check; idempotency (same key and body returns the
  same plan, same key with other changes is `IDEMPOTENCY_CONFLICT`); another
  owner gets `NOT_FOUND`; invalid or empty changes are `INVALID_INPUT` and
  never reach the queue; HTTP route returns 202/Location, 404, 401, 400.

## Not verified / limits

- Synthetic weather and synthetic model series only. No run with real NASA
  data, so the sizes of the effects on real crops are not checked.
- The deltas are uniform shifts of every day (no seasonal shape, no change in
  rainfall pattern or extremes). Multiplying rain keeps the number of rain
  days the same.
- Future worlds get the delta on top of the model's change; whether that is
  the interpretation a farmer expects is a product decision for the interface
  copy ("extra change on top of the climate models").
- A stored plan whose first sowing date has already passed cannot be rerun
  (intake refuses dates before today); the interface must say so or send a
  fresh request.
- The what-if does not change the catalog rules; a rule's thresholds are the
  same, only the weather moves.

## Proposed DECISIONS text

> **What-if tests (2026-11-09).** The format 2 request has an optional
> `what_if` (rain %, temperature °C, sowing days, bounded and strict). It is
> applied to the historical weather, to each model's future worlds (not the
> model's baseline years) and to the crop-model weather, and moves the
> first-sowing range. Results carry a `whatIf` block with `notAForecast: true`.
> A request without it is byte-identical to before, so existing hashes and
> stored results stay valid. `POST /api/v1/plans/:id/what-if` creates a new
> plan from the caller's own stored plan through the normal intake.

## Proposed PROGRESS text

> P6 what-if backend: contract, pure domain function, engine wiring, result
> label, `POST /api/v1/plans/:id/what-if`. Unit and PostgreSQL integration
> tests pass on synthetic data; not run on real NASA data.

## Run log (2026-11-09, this worktree, real exit codes)

`pnpm lint` 0, `pnpm format:check` 0, `pnpm typecheck` 0, `pnpm test:engine` 0, `pnpm test:plans` 0, `pnpm test:backend` 0. No migration, so terrain-integration was not needed.
