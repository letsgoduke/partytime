import { assertNonnegativeInteger } from "./party";

export type ReliabilityKind = "attendance" | "money" | "item" | "volunteer";
export interface ReliabilityEvidence {
  id: string;
  activityId: string;
  kind: ReliabilityKind;
  occurredAt: string;
  verified: boolean;
  outcome: "fulfilled" | "failed" | "excused";
}
export interface ReputationConfig {
  minimumActivities: number;
  halfLifeDays: number;
  priorWeight: number;
  priorRate: number;
  weights: Record<ReliabilityKind, number>;
}
export const DEFAULT_REPUTATION: ReputationConfig = {
  minimumActivities: 5,
  halfLifeDays: 180,
  priorWeight: 4,
  priorRate: 0.5,
  weights: { attendance: 1, money: 1, item: 1, volunteer: 1 },
};
export interface ReputationResult {
  score: number | null;
  verifiedActivities: number;
  confidence: number;
}
export function calculateReputation(
  evidence: readonly ReliabilityEvidence[],
  now: Date,
  config = DEFAULT_REPUTATION,
): ReputationResult {
  if (
    !(config.halfLifeDays > 0) ||
    !(config.priorWeight > 0) ||
    config.priorRate < 0 ||
    config.priorRate > 1 ||
    !Number.isFinite(now.getTime())
  )
    throw new Error("Invalid reputation configuration");
  assertNonnegativeInteger(config.minimumActivities, "Minimum activity count");
  const seen = new Set<string>();
  let total = 0;
  let fulfilled = 0;
  for (const entry of evidence) {
    if (!entry.verified || entry.outcome === "excused") continue;
    if (seen.has(entry.activityId))
      throw new Error("Duplicate reliability activity");
    const timestamp = new Date(entry.occurredAt).getTime();
    if (!Number.isFinite(timestamp) || timestamp > now.getTime())
      throw new Error("Invalid evidence date");
    const weight = config.weights[entry.kind];
    if (!Number.isFinite(weight) || weight <= 0)
      throw new Error("Invalid activity weight");
    seen.add(entry.activityId);
    const decayedWeight =
      weight *
      2 ** (-(now.getTime() - timestamp) / 86_400_000 / config.halfLifeDays);
    total += decayedWeight;
    if (entry.outcome === "fulfilled") fulfilled += decayedWeight;
  }
  const confidence = total / (total + config.priorWeight);
  return {
    score:
      seen.size < config.minimumActivities
        ? null
        : Math.round(
            (1000 * (fulfilled + config.priorWeight * config.priorRate)) /
              (total + config.priorWeight),
          ) / 10,
    verifiedActivities: seen.size,
    confidence,
  };
}

export interface VerifiedContribution {
  activityId: string;
  expenseId?: string;
  contributorId: string;
  hostId: string;
  verified: boolean;
  kind: "money" | "item" | "volunteer";
  valueCents?: number;
  minutes?: number;
}
export interface PrestigeConfig {
  pointsPerDollar: number;
  pointsPerSuppliesDollar: number;
  pointsPerVolunteerHour: number;
  maximumPerActivity: number;
}
export const DEFAULT_PRESTIGE: PrestigeConfig = {
  pointsPerDollar: 1,
  pointsPerSuppliesDollar: 1,
  pointsPerVolunteerHour: 15,
  maximumPerActivity: 1_000,
};
export function calculatePrestige(
  contributions: readonly VerifiedContribution[],
  config = DEFAULT_PRESTIGE,
): number {
  if (
    Object.values(config).some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error("Invalid prestige configuration");
  const activities = new Set<string>();
  const expenses = new Set<string>();
  let points = 0;
  for (const contribution of contributions) {
    if (
      !contribution.verified ||
      contribution.contributorId === contribution.hostId
    )
      continue;
    if (
      activities.has(contribution.activityId) ||
      (contribution.expenseId && expenses.has(contribution.expenseId))
    )
      throw new Error("Duplicate contribution credit");
    activities.add(contribution.activityId);
    if (contribution.expenseId) expenses.add(contribution.expenseId);
    const amount =
      contribution.kind === "volunteer"
        ? (contribution.minutes ?? 0)
        : (contribution.valueCents ?? 0);
    assertNonnegativeInteger(amount, "Contribution value");
    points += Math.min(
      config.maximumPerActivity,
      contribution.kind === "volunteer"
        ? (amount / 60) * config.pointsPerVolunteerHour
        : (amount / 100) *
            (contribution.kind === "item"
              ? config.pointsPerSuppliesDollar
              : config.pointsPerDollar),
    );
  }
  return Math.round(points * 100) / 100;
}
export function prestigeTitle(points: number): string {
  return points >= 10_000
    ? "Benefactor"
    : points >= 2_000
      ? "Patron"
      : points >= 500
        ? "Supporter"
        : points >= 100
          ? "Contributor"
          : "Community member";
}

export interface AuraInput {
  hostId: string;
  endedAt: string;
  completionVerified: boolean;
  canceled: boolean;
  attendeeIds: readonly string[];
  independentVerifierIds: readonly string[];
  confirmedCommunityFundingCents: number;
  verifiedInKindCents: number;
  previousHostEvents30Days: number;
}
export interface AuraConfig {
  attendanceCoefficient: number;
  fundingCoefficient: number;
  inKindCoefficient: number;
  minimumIndependentParticipants: number;
  maximumPerParty: number;
}
export const DEFAULT_AURA: AuraConfig = {
  attendanceCoefficient: 10,
  fundingCoefficient: 2,
  inKindCoefficient: 3,
  minimumIndependentParticipants: 2,
  maximumPerParty: 500,
};
/** Funding must already exclude the host and pending payments at the trusted server boundary. */
export function calculateAura(
  input: AuraInput,
  now: Date,
  config = DEFAULT_AURA,
): number {
  assertNonnegativeInteger(
    input.confirmedCommunityFundingCents,
    "Community funding",
  );
  assertNonnegativeInteger(input.verifiedInKindCents, "In-kind value");
  assertNonnegativeInteger(
    input.previousHostEvents30Days,
    "Previous group events",
  );
  if (
    Object.values(config).some((value) => !Number.isFinite(value) || value < 0)
  )
    throw new Error("Invalid aura configuration");
  const endedAt = new Date(input.endedAt).getTime();
  if (!Number.isFinite(endedAt) || !Number.isFinite(now.getTime()))
    throw new Error("Invalid event date");
  if (input.canceled || !input.completionVerified || endedAt > now.getTime())
    return 0;
  const attendees = new Set(
    input.attendeeIds.filter((id) => id !== input.hostId),
  );
  const independent = new Set(
    input.independentVerifierIds.filter(
      (id) => id !== input.hostId && attendees.has(id),
    ),
  );
  if (independent.size < config.minimumIndependentParticipants) return 0;
  const base = Math.min(
    config.maximumPerParty,
    Math.round(
      config.attendanceCoefficient * Math.sqrt(independent.size) +
        config.fundingCoefficient *
          Math.sqrt(input.confirmedCommunityFundingCents / 100) +
        config.inKindCoefficient * Math.sqrt(input.verifiedInKindCents / 100),
    ),
  );
  return Math.round(base / Math.sqrt(1 + input.previousHostEvents30Days));
}

export interface ScoreLedgerEntry {
  id: string;
  profileId: string;
  system: "prestige" | "aura";
  activityId: string;
  points: number;
  reversesId?: string;
}
export function sumScoreLedger(
  entries: readonly ScoreLedgerEntry[],
  profileId: string,
  system: ScoreLedgerEntry["system"],
): number {
  const ids = new Map<string, ScoreLedgerEntry>();
  const awards = new Set<string>();
  const reversed = new Set<string>();
  let total = 0;
  for (const entry of entries) {
    if (ids.has(entry.id)) throw new Error("Duplicate ledger identifier");
    if (!Number.isFinite(entry.points))
      throw new Error("Invalid ledger points");
    if (entry.reversesId) {
      const original = ids.get(entry.reversesId);
      if (
        !original ||
        original.reversesId ||
        reversed.has(original.id) ||
        original.profileId !== entry.profileId ||
        original.system !== entry.system ||
        original.activityId !== entry.activityId ||
        entry.points !== -original.points
      )
        throw new Error("Invalid score reversal");
      reversed.add(original.id);
    } else {
      const key = `${entry.profileId}:${entry.system}:${entry.activityId}`;
      if (entry.points < 0 || awards.has(key))
        throw new Error("Duplicate or negative score award");
      awards.add(key);
    }
    ids.set(entry.id, entry);
    if (entry.profileId === profileId && entry.system === system)
      total += entry.points;
  }
  return Math.round(total * 100) / 100;
}
