import { expect, jest, test } from "@jest/globals";
import { planRequestV2Schema } from "@rotavise/contracts";
import { ApiClient } from "../../apps/web/src/api/client.js";
import { submitPlan } from "../../apps/web/src/api/plans.js";
import { Owner } from "../../apps/web/src/features/session/owner.js";
import { guest, renewedGuest, response } from "../support/fixtures/f1.js";
import fixture from "../support/fixtures/f5-builder.json" with { type: "json" };

test("a plan submission keeps its body and idempotency key through the single owner refresh", async () => {
  const original = globalThis.fetch;
  const fetch = jest.fn<typeof globalThis.fetch>();
  globalThis.fetch = fetch;
  try {
    const owner = new Owner();
    owner.setAccount(null);
    owner.saveGuest(guest);
    const accepted = {
      id: fixture.cases[0]!.state.field_id,
      expiresAt: "2099-01-01T00:00:00.000Z",
    };
    fetch
      .mockResolvedValueOnce(response({ code: "UNAUTHORIZED" }, 401))
      .mockResolvedValueOnce(response(renewedGuest, 201))
      .mockResolvedValueOnce(response(accepted, 202));
    const input = planRequestV2Schema.parse(fixture.cases[0]!.state);
    const key = "01848ba0-762a-4a82-9000-0d0000000009";
    expect(
      await submitPlan(new ApiClient(owner), {
        body: input,
        idempotencyKey: key,
      }),
    ).toEqual(accepted);
    const sends = fetch.mock.calls.filter(([path]) => path === "/api/v1/plans");
    expect(sends).toHaveLength(2);
    for (const [, options] of sends) {
      expect(options?.credentials).toBe("omit");
      expect(options?.headers).toMatchObject({ "Idempotency-Key": key });
      expect(JSON.parse(String(options?.body))).toEqual(input);
    }
    expect(sends[0]![1]?.headers).toMatchObject({
      Authorization: `Bearer ${guest.accessToken}`,
    });
    expect(sends[1]![1]?.headers).toMatchObject({
      Authorization: `Bearer ${renewedGuest.accessToken}`,
    });
    expect(owner.snapshot().recovered).toBe(true);
  } finally {
    globalThis.fetch = original;
  }
});
