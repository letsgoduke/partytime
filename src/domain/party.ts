export type RsvpStatus = "going" | "maybe" | "declined";
export type PledgeStatus =
  "pledged" | "payment_initiated" | "confirmed" | "canceled" | "disputed";
export interface Pledge {
  id: string;
  amountCents: number;
  status: PledgeStatus;
}
export interface BudgetSummary {
  targetCents: number;
  confirmedCents: number;
  pendingCents: number;
  inKindCents: number;
  gapCents: number;
}

export function assertNonnegativeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error(`${label} must be a nonnegative safe integer`);
}

/** In-kind gifts describe impact, but never settle cash expenses. */
export function summarizeBudget(
  targetCents: number,
  pledges: readonly Pledge[],
  inKindCents = 0,
): BudgetSummary {
  assertNonnegativeInteger(targetCents, "Budget");
  assertNonnegativeInteger(inKindCents, "In-kind value");
  const ids = new Set<string>();
  let confirmedCents = 0;
  let pendingCents = 0;
  for (const pledge of pledges) {
    if (ids.has(pledge.id)) throw new Error("Duplicate pledge");
    ids.add(pledge.id);
    assertNonnegativeInteger(pledge.amountCents, "Pledge");
    if (pledge.status === "confirmed") confirmedCents += pledge.amountCents;
    if (pledge.status === "pledged" || pledge.status === "payment_initiated")
      pendingCents += pledge.amountCents;
  }
  assertNonnegativeInteger(confirmedCents, "Confirmed total");
  assertNonnegativeInteger(pendingCents, "Pending total");
  return {
    targetCents,
    confirmedCents,
    pendingCents,
    inKindCents,
    gapCents: Math.max(0, targetCents - confirmedCents),
  };
}

export function snapshotRemainingSponsorship(summary: BudgetSummary): number {
  return summary.gapCents;
}

export function changeRsvp(
  current: RsvpStatus | null,
  next: RsvpStatus,
  goingCount: number,
  capacity: number | null,
  closed = false,
): RsvpStatus {
  assertNonnegativeInteger(goingCount, "Going count");
  if (capacity !== null) assertNonnegativeInteger(capacity, "Capacity");
  if (current === next) return next;
  if (closed && next === "going") throw new Error("RSVPs are closed");
  if (
    next === "going" &&
    current !== "going" &&
    capacity !== null &&
    goingCount >= capacity
  )
    throw new Error("Party is full");
  return next;
}

export interface QuantityClaim {
  quantity: number;
  status: "claimed" | "delivered" | "completed" | "released" | "not_fulfilled";
}
export function availableQuantity(
  required: number,
  claims: readonly QuantityClaim[],
): number {
  assertNonnegativeInteger(required, "Required quantity");
  let reserved = 0;
  for (const claim of claims) {
    assertNonnegativeInteger(claim.quantity, "Claim quantity");
    if (["claimed", "delivered", "completed"].includes(claim.status))
      reserved += claim.quantity;
  }
  if (reserved > required) throw new Error("Claims exceed required quantity");
  return required - reserved;
}

/** Recheck under a database lock on the server; this helper alone is not concurrency protection. */
export function validateClaim(
  required: number,
  claims: readonly QuantityClaim[],
  requested: number,
  allowPartial: boolean,
): number {
  assertNonnegativeInteger(requested, "Requested quantity");
  const available = availableQuantity(required, claims);
  if (requested === 0 || requested > available)
    throw new Error("Quantity unavailable");
  if (!allowPartial && requested !== available)
    throw new Error("Claim the full remaining quantity");
  return requested;
}
