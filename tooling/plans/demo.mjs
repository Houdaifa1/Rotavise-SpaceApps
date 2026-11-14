import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import {
  planSession,
  submitPlan,
  planHttp,
  syntheticPlanInput,
} from "../../tests/support/plans.mjs";
const api = { origin: process.env.PLAN_DEMO_ORIGIN ?? "http://127.0.0.1:3000" };
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(api.origin))
  throw new Error("DEMO_REQUIRES_LOCAL_DISPOSABLE_OR_DEVELOPMENT_API");
const owners = [];
try {
  const session = await planSession(api);
  owners.push(session);
  const other = await planSession(api);
  owners.push(other);
  const input = syntheticPlanInput();
  const key = "synthetic-demo-" + Date.now();
  const accepted = await submitPlan(api, session.accessToken, input, key);
  const repeat = await submitPlan(api, session.accessToken, input, key);
  assert.equal(repeat.id, accepted.id);
  const path = "/api/v1/plans/" + accepted.id;
  const foreign = await planHttp(api, path, { token: other.accessToken });
  assert.equal(foreign.status, 404);
  const anonymous = await planHttp(api, path);
  assert.equal(anonymous.status, 401);
  let state;
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const response = await planHttp(api, path, { token: session.accessToken });
    assert.equal(response.status, 200);
    state = await response.json();
    if (state.status === "failed") throw new Error("DEMO_INTAKE_FAILED");
    if (state.status === "completed") break;
    await delay(250);
  }
  assert.equal(state?.status, "completed");
  assert.equal(state.result.planning, "not_implemented");
  assert.equal(state.result.recommendations, null);
  const deletion = await planHttp(api, path, {
    method: "DELETE",
    token: session.accessToken,
  });
  assert.equal(deletion.status, 204);
  const after = await planHttp(api, path, { token: session.accessToken });
  assert.equal(after.status, 404);
  console.log(
    JSON.stringify(
      {
        synthetic: true,
        purpose: "Infrastructure intake demo; not agricultural output",
        requestId: accepted.id,
        intakeStatus: state.status,
        stage: state.stage,
        attempts: state.attempts,
        catalogSnapshotId: state.evidence.catalogSnapshotId,
        catalogSha256: state.evidence.catalogSha256,
        repeatRetainedId: true,
        otherOwnerStatus: foreign.status,
        anonymousStatus: anonymous.status,
        ownedDeleteStatus: deletion.status,
        afterDeleteStatus: after.status,
        result: state.result,
      },
      null,
      2,
    ),
  );
} finally {
  for (const owner of owners) {
    const response = await planHttp(api, "/api/v1/plan-sessions/current", {
      method: "DELETE",
      token: owner.accessToken,
    });
    assert.equal(response.status, 204);
  }
}
