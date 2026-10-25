import { createClient } from "@supabase/supabase-js";
import type { Party, Need, Guest, Pledge, Claim } from "./demo";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase =
  url && key ? createClient(url, key, { auth: { flowType: "pkce" } }) : null;
export const idempotencyKey = () => crypto.randomUUID();
interface NeedSnapshot extends Omit<Need, "claimed" | "note"> {
  claimedQuantity: number;
  estimatedValueCents?: number;
  minutesPerUnit?: number;
}
export interface PartySnapshot extends Omit<
  Party,
  | "date"
  | "time"
  | "location"
  | "needs"
  | "guests"
  | "pledges"
  | "claims"
  | "updates"
> {
  startsAt: string;
  generalLocation: string;
  needs: NeedSnapshot[];
  paymentMethods: { label: string; url: string }[];
  updates: ({ message: string; createdAt: string } | string)[];
}
interface GuestPledge extends Omit<Pledge, "guestId" | "name"> {
  guestId?: string;
  name?: string;
}
interface GuestClaim extends Omit<Claim, "guestId"> {
  guestId?: string;
}
export interface PartyEnvelope {
  party: PartySnapshot;
  guest?: Guest;
  guests?: Guest[];
  pledges?: GuestPledge[];
  claims?: GuestClaim[];
}
/** Only the protected guest endpoint may supply a private address or guest-owned records. */
export function normalizeParty(
  snapshot: PartySnapshot,
  extra?: PartyEnvelope,
): Party {
  const date = new Date(snapshot.startsAt);
  const pad = (v: number) => String(v).padStart(2, "0");
  const guests = extra?.guests || (extra?.guest ? [extra.guest] : []);
  return {
    ...snapshot,
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
    location: snapshot.generalLocation,
    needs: snapshot.needs
      .filter((n) => n.kind === "item" || n.kind === "task")
      .map((n) => ({
        ...n,
        claimed: n.claimedQuantity,
        valueCents: n.estimatedValueCents,
        note:
          n.kind === "task"
            ? "A little help from a friend"
            : "Thanks for bringing this",
      })),
    guests,
    pledges: (extra?.pledges || []).map((p) => ({
      ...p,
      guestId: p.guestId || extra?.guest?.id || "",
      name:
        p.name ||
        guests.find((g) => g.id === (p.guestId || extra?.guest?.id))?.name ||
        "Guest",
    })),
    claims: (extra?.claims || []).map((c) => ({
      ...c,
      guestId: c.guestId || extra?.guest?.id || "",
    })),
    maybe: snapshot.maybe ?? guests.filter((g) => g.status === "maybe").length,
    declined:
      snapshot.declined ?? guests.filter((g) => g.status === "declined").length,
    updates: snapshot.updates
      .map((u) => (typeof u === "string" ? u : u.message))
      .reverse(),
    paymentUrl: snapshot.paymentMethods?.[0]?.url,
    inviteToken: sessionStorage.getItem(`invite-${snapshot.id}`) || undefined,
  };
}
const reads = new Set([
  "invitation",
  "guest",
  "dashboard",
  "listParties",
  "profile",
]);
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}
async function requestKey(action: string, payload: Record<string, unknown>) {
  // Keep the same key after a lost response, including across refresh. Store only a hash,
  // never the request or guest credential, and discard it once success is acknowledged.
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(JSON.stringify([action, canonical(payload)])),
  );
  const storageKey =
    "pending-request-" +
    Array.from(new Uint8Array(bytes), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  const key = sessionStorage.getItem(storageKey) || idempotencyKey();
  sessionStorage.setItem(storageKey, key);
  return { key, storageKey };
}
export async function callApi<T>(
  action: string,
  payload: Record<string, unknown>,
): Promise<T> {
  if (!supabase)
    throw new Error(
      "Live hosting needs Supabase configuration. You can explore the labeled demo.",
    );
  const pending =
    !reads.has(action) && !payload.idempotencyKey
      ? await requestKey(action, payload)
      : null;
  const request = pending
    ? { ...payload, idempotencyKey: pending.key }
    : payload;
  const { data, error } = await supabase.rpc("party_api", {
    action,
    payload: request,
  });
  if (error) throw new Error(error.message);
  if (pending) sessionStorage.removeItem(pending.storageKey);
  if (action === "rotateInvite")
    sessionStorage.setItem(
      `invite-${payload.partyId}`,
      String(data.inviteToken),
    );
  if (action === "invitation")
    return normalizeParty(data as PartySnapshot) as T;
  if (action === "guest" || action === "dashboard")
    return normalizeParty(
      (data as PartyEnvelope).party,
      data as PartyEnvelope,
    ) as T;
  if (action === "createParty") {
    const result = data as { party: PartySnapshot; inviteToken: string };
    sessionStorage.setItem(`invite-${result.party.id}`, result.inviteToken);
    return { ...result, partyId: result.party.id } as T;
  }
  return data as T;
}
