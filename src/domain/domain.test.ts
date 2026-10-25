import { describe, expect, it } from "vitest";
import {
  availableQuantity,
  changeRsvp,
  snapshotRemainingSponsorship,
  summarizeBudget,
  validateClaim,
} from "./party";
import {
  calculateAura,
  calculatePrestige,
  calculateReputation,
  prestigeTitle,
  sumScoreLedger,
  type AuraInput,
  type ReliabilityEvidence,
  type ScoreLedgerEntry,
} from "./scoring";

describe("cash accounting", () => {
  it("counts confirmed cash separately from pending and donated goods", () => {
    const summary = summarizeBudget(
      30_000,
      [
        { id: "1", amountCents: 21_000, status: "confirmed" },
        { id: "2", amountCents: 3_000, status: "payment_initiated" },
        { id: "3", amountCents: 1_000, status: "disputed" },
      ],
      5_000,
    );
    expect(summary).toEqual({
      targetCents: 30_000,
      confirmedCents: 21_000,
      pendingCents: 3_000,
      inKindCents: 5_000,
      gapCents: 9_000,
    });
    const snapshot = snapshotRemainingSponsorship(summary);
    summary.gapCents = 12_000;
    expect(snapshot).toBe(9_000);
  });
  it("clamps overfunding and rejects duplicate or fractional cash", () => {
    expect(
      summarizeBudget(100, [{ id: "a", amountCents: 200, status: "confirmed" }])
        .gapCents,
    ).toBe(0);
    expect(() => summarizeBudget(0.5, [])).toThrow();
    expect(() =>
      summarizeBudget(100, [
        { id: "a", amountCents: 1, status: "pledged" },
        { id: "a", amountCents: 1, status: "pledged" },
      ]),
    ).toThrow("Duplicate");
  });
});

describe("RSVP and claims", () => {
  it("enforces capacity only when entering Going and permits cancellation", () => {
    expect(() => changeRsvp("maybe", "going", 2, 2)).toThrow("full");
    expect(changeRsvp("going", "going", 2, 2, true)).toBe("going");
    expect(changeRsvp("going", "declined", 2, 2, true)).toBe("declined");
    expect(() => changeRsvp(null, "going", 0, null, true)).toThrow("closed");
    expect(changeRsvp("declined", "going", 0, null)).toBe("going");
  });
  it("reserves delivered quantities, frees released ones, and rejects overclaiming", () => {
    const claims = [
      { quantity: 1, status: "delivered" as const },
      { quantity: 1, status: "released" as const },
    ];
    expect(availableQuantity(3, claims)).toBe(2);
    expect(validateClaim(3, claims, 1, true)).toBe(1);
    expect(() => validateClaim(3, claims, 1, false)).toThrow("full");
    expect(validateClaim(3, claims, 2, false)).toBe(2);
    expect(() => validateClaim(3, claims, 3, true)).toThrow("unavailable");
    expect(() => validateClaim(3, claims, 0, true)).toThrow();
    expect(() => availableQuantity(0, claims)).toThrow();
  });
});

const now = new Date("2026-10-24T12:00:00Z");
function evidence(
  count: number,
  outcome: ReliabilityEvidence["outcome"] = "fulfilled",
  occurredAt = now.toISOString(),
): ReliabilityEvidence[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `${i}`,
    activityId: `${i}`,
    kind: "attendance",
    occurredAt,
    verified: true,
    outcome,
  }));
}
describe("reliability", () => {
  it("starts unrated and ignores unverified and excused records", () => {
    expect(calculateReputation([], now).score).toBeNull();
    expect(calculateReputation(evidence(2), now).score).toBeNull();
    expect(
      calculateReputation(evidence(5, "excused"), now).verifiedActivities,
    ).toBe(0);
    expect(
      calculateReputation(
        evidence(5).map((e) => ({ ...e, verified: false })),
        now,
      ).score,
    ).toBeNull();
  });
  it("adjusts for confidence and dampens a single failure", () => {
    expect(calculateReputation(evidence(5), now).score).toBe(77.8);
    const established = evidence(30);
    expect(
      calculateReputation(
        [
          ...established,
          { ...evidence(1, "failed")[0]!, activityId: "failure" },
        ],
        now,
      ).score,
    ).toBeGreaterThan(90);
  });
  it("decays older evidence and rejects duplicate or future records", () => {
    expect(
      calculateReputation(evidence(3, "fulfilled", "2025-10-24T12:00:00Z"), now)
        .confidence,
    ).toBeLessThan(calculateReputation(evidence(3), now).confidence);
    expect(() =>
      calculateReputation([...evidence(3), ...evidence(1)], now),
    ).toThrow("Duplicate");
    expect(() =>
      calculateReputation(evidence(3, "fulfilled", "2027-01-01"), now),
    ).toThrow();
  });
});

describe("generosity", () => {
  const contribution = {
    activityId: "a",
    contributorId: "guest",
    hostId: "host",
    verified: true,
    kind: "money" as const,
    valueCents: 12_345,
  };
  it("awards dollars and volunteer hours with no self or unverified credit", () => {
    expect(calculatePrestige([contribution])).toBe(123.45);
    expect(
      calculatePrestige([{ ...contribution, contributorId: "host" }]),
    ).toBe(0);
    expect(calculatePrestige([{ ...contribution, verified: false }])).toBe(0);
    expect(
      calculatePrestige([{ ...contribution, kind: "volunteer", minutes: 90 }]),
    ).toBe(22.5);
    expect(prestigeTitle(2_000)).toBe("Patron");
  });
  it("blocks duplicate expenses and caps inflated single contributions", () => {
    expect(() =>
      calculatePrestige([
        { ...contribution, expenseId: "expense" },
        {
          ...contribution,
          activityId: "b",
          expenseId: "expense",
          kind: "item",
        },
      ]),
    ).toThrow("Duplicate");
    expect(
      calculatePrestige([{ ...contribution, valueCents: 9_999_999 }]),
    ).toBe(1_000);
  });
});

describe("hosting influence", () => {
  const input: AuraInput = {
    hostId: "host",
    endedAt: "2026-10-23",
    completionVerified: true,
    canceled: false,
    attendeeIds: ["a", "b", "c", "host", "a"],
    independentVerifierIds: ["a", "b", "c"],
    confirmedCommunityFundingCents: 10_000,
    verifiedInKindCents: 2_500,
    previousHostEvents30Days: 0,
  };
  it("uses distinct community attendance and dollars", () => {
    expect(calculateAura(input, now)).toBe(
      Math.round(10 * Math.sqrt(3) + 20 + 15),
    );
    expect(
      calculateAura({ ...input, previousHostEvents30Days: 2 }, now),
    ).toBeLessThan(calculateAura(input, now));
  });
  it("requires completed events and independent verification", () => {
    expect(calculateAura({ ...input, canceled: true }, now)).toBe(0);
    expect(calculateAura({ ...input, completionVerified: false }, now)).toBe(0);
    expect(calculateAura({ ...input, endedAt: "2027-01-01" }, now)).toBe(0);
    expect(
      calculateAura(
        { ...input, independentVerifierIds: ["a", "a", "host"] },
        now,
      ),
    ).toBe(0);
    expect(
      calculateAura(
        { ...input, confirmedCommunityFundingCents: 999_999_999 },
        now,
      ),
    ).toBe(500);
  });
  it("counts only independently attested profiles and applies the cap before host frequency attenuation", () => {
    expect(
      calculateAura({ ...input, independentVerifierIds: ["a", "b"] }, now),
    ).toBe(Math.round(10 * Math.sqrt(2) + 20 + 15));
    expect(
      calculateAura(
        {
          ...input,
          confirmedCommunityFundingCents: 999_999_999,
          previousHostEvents30Days: 3,
        },
        now,
      ),
    ).toBe(250);
  });
});

describe("immutable award ledger", () => {
  const award: ScoreLedgerEntry = {
    id: "award",
    profileId: "p",
    system: "prestige",
    activityId: "activity",
    points: 100,
  };
  const reversal: ScoreLedgerEntry = {
    ...award,
    id: "reversal",
    reversesId: "award",
    points: -100,
  };
  it("reverses an award without deleting history", () => {
    expect(sumScoreLedger([award], "p", "prestige")).toBe(100);
    expect(sumScoreLedger([award, reversal], "p", "prestige")).toBe(0);
    expect(sumScoreLedger([award], "other", "prestige")).toBe(0);
  });
  it("rejects duplicate awards, repeated reversals, and forged reversals", () => {
    expect(() =>
      sumScoreLedger([award, { ...award, id: "duplicate" }], "p", "prestige"),
    ).toThrow();
    expect(() =>
      sumScoreLedger(
        [award, reversal, { ...reversal, id: "second" }],
        "p",
        "prestige",
      ),
    ).toThrow();
    expect(() =>
      sumScoreLedger(
        [award, { ...reversal, profileId: "other" }],
        "p",
        "prestige",
      ),
    ).toThrow();
    expect(() =>
      sumScoreLedger([award, { ...reversal, points: -50 }], "p", "prestige"),
    ).toThrow();
  });
});
