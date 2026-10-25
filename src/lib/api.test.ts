import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialParty } from "./demo";
const mocks = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("./auth", () => ({ auth: { getSession: mocks.getSession } }));
const request = vi.fn();
const snapshot = {
  ...initialParty,
  startsAt: "2026-10-30T23:00:00Z",
  generalLocation: "East Austin",
  needs: initialParty.needs.map((n) => ({ ...n, claimedQuantity: n.claimed })),
  paymentMethods: [{ label: "Venmo", url: "https://venmo.com/alex" }],
  updates: [
    { message: "Latest update", createdAt: "2026-10-24T12:00:00Z" },
    { message: "Earlier update", createdAt: "2026-10-23T12:00:00Z" },
  ],
};
function result(data: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    json: async () =>
      status < 400 ? { data } : { error: { message: String(data) } },
  };
}
beforeEach(() => {
  vi.resetModules();
  sessionStorage.clear();
  request.mockReset();
  mocks.getSession.mockResolvedValue({
    userId: "host",
    idToken: "verified-cognito-token",
  });
  vi.stubGlobal("fetch", request);
  for (const [k, v] of Object.entries({
    VITE_AWS_API_URL: "https://example.execute-api.us-east-1.amazonaws.com",
    VITE_AWS_REGION: "us-east-1",
    VITE_COGNITO_USER_POOL_ID: "us-east-1_pool",
    VITE_COGNITO_CLIENT_ID: "client",
    VITE_COGNITO_DOMAIN: "https://example.auth.us-east-1.amazoncognito.com",
  }))
    vi.stubEnv(k, v);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("AWS API boundary", () => {
  it("maps guest ownership so commitments remain manageable", async () => {
    request.mockResolvedValue(
      result({
        party: snapshot,
        guest: { id: "guest-42", name: "Casey", status: "going" },
        claims: [
          { id: "claim", needId: "ice", quantity: 1, status: "claimed" },
        ],
        pledges: [{ id: "pledge", amountCents: 2000, status: "pledged" }],
      }),
    );
    const { callApi } = await import("./api");
    const party = await callApi<typeof initialParty>("guest", {
      managementToken: "private-capability",
    });
    expect(party.pledges[0]).toMatchObject({
      guestId: "guest-42",
      name: "Casey",
      amountCents: 2000,
    });
    expect(party.claims[0].guestId).toBe("guest-42");
    expect(party.updates.at(-1)).toBe("Latest update");
    expect(party.maybe).toBe(3);
    expect(request.mock.calls[0][0]).toMatch(/\/guest$/);
    expect(request.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
  it("never exposes guest records on public invitation reads", async () => {
    request.mockResolvedValue(result(snapshot));
    const { callApi } = await import("./api");
    const party = await callApi<typeof initialParty>("invitation", {
      inviteToken: "invitation",
    });
    expect(party.guests).toEqual([]);
    expect(party.claims).toEqual([]);
    expect(party.pledges).toEqual([]);
  });
  it("reuses a pending request key after an uncertain response, then retires it after success", async () => {
    request
      .mockRejectedValueOnce(new Error("Network response lost"))
      .mockResolvedValue(result({ id: "pledge" }));
    const { callApi } = await import("./api");
    const payload = { managementToken: "a-private-token", amountCents: 2000 };
    await expect(callApi("pledge", payload)).rejects.toThrow(
      "Network response lost",
    );
    await callApi("pledge", payload);
    await callApi("pledge", payload);
    const keys = request.mock.calls.map(
      (c) => JSON.parse(c[1].body).payload.idempotencyKey,
    );
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
    expect(JSON.stringify(sessionStorage)).not.toContain("a-private-token");
  });
  it("requires a verified session for host operations and account linking", async () => {
    mocks.getSession.mockResolvedValue(null);
    const { callApi } = await import("./api");
    await expect(
      callApi("createParty", { title: "Good time" }),
    ).rejects.toThrow("Sign in");
    await expect(
      callApi("linkGuest", { managementToken: "private" }),
    ).rejects.toThrow("Sign in");
    expect(request).not.toHaveBeenCalled();
  });
  it("sends host identity only as a Cognito bearer token to the protected route", async () => {
    request.mockResolvedValue(result({ ok: true }));
    const { callApi } = await import("./api");
    await callApi("linkGuest", { managementToken: "private" });
    expect(request.mock.calls[0][0]).toMatch(/\/host$/);
    expect(request.mock.calls[0][1].headers.Authorization).toBe(
      "Bearer verified-cognito-token",
    );
    expect(
      JSON.parse(request.mock.calls[0][1].body).payload.userId,
    ).toBeUndefined();
  });
  it("shows backend errors without clearing safe retry state", async () => {
    request.mockResolvedValue(result("That item is already covered.", 409));
    const { callApi } = await import("./api");
    await expect(
      callApi("claim", {
        managementToken: "private",
        needId: "ice",
        quantity: 1,
      }),
    ).rejects.toThrow("already covered");
  });
  it("normalizes a published party and remembers its returned invitation", async () => {
    request.mockResolvedValue(
      result({ party: snapshot, inviteToken: "host-invite" }),
    );
    const { callApi } = await import("./api");
    const data = await callApi<{ partyId: string }>("createParty", {
      title: "Good time",
    });
    expect(data.partyId).toBe("demo");
    expect(sessionStorage.getItem("invite-demo")).toBe("host-invite");
  });
});
