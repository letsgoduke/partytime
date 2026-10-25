import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialParty } from "./demo";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));
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
beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-publishable-key");
  sessionStorage.clear();
  rpc.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
describe("live API boundary", () => {
  it("maps guest-only ownership so commitments remain manageable", async () => {
    rpc.mockResolvedValue({
      data: {
        party: snapshot,
        guest: { id: "guest-42", name: "Casey", status: "going" },
        claims: [
          { id: "claim", needId: "ice", quantity: 1, status: "claimed" },
        ],
        pledges: [{ id: "pledge", amountCents: 2000, status: "pledged" }],
      },
      error: null,
    });
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
  });
  it("never takes guest records from a public invitation response", async () => {
    rpc.mockResolvedValue({ data: snapshot, error: null });
    const { callApi } = await import("./api");
    const party = await callApi<typeof initialParty>("invitation", {
      inviteToken: "invitation",
    });
    expect(party.guests).toEqual([]);
    expect(party.claims).toEqual([]);
    expect(party.pledges).toEqual([]);
  });
  it("reuses the same idempotency key after a lost response and generates a new one after success", async () => {
    rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: "Network response lost" },
      })
      .mockResolvedValue({
        data: { id: "pledge", amountCents: 2000, status: "pledged" },
        error: null,
      });
    const { callApi } = await import("./api");
    const payload = { managementToken: "a-private-token", amountCents: 2000 };
    await expect(callApi("pledge", payload)).rejects.toThrow(
      "Network response lost",
    );
    await callApi("pledge", payload);
    await callApi("pledge", payload);
    const keys = rpc.mock.calls.map((c) => c[1].payload.idempotencyKey);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[1]);
    expect(JSON.stringify(sessionStorage)).not.toContain("a-private-token");
  });
  it("stores only the returned host invitation and normalizes the create result", async () => {
    rpc.mockResolvedValue({
      data: { party: snapshot, inviteToken: "host-invite" },
      error: null,
    });
    const { callApi } = await import("./api");
    const result = await callApi<{ partyId: string }>("createParty", {
      title: "Good time",
    });
    expect(result.partyId).toBe("demo");
    expect(sessionStorage.getItem("invite-demo")).toBe("host-invite");
  });
});
