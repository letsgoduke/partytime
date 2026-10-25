import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Heart,
  Plus,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { AuthPanel, useAuth } from "../components/AuthPanel";
import { HostSettings } from "../components/HostSettings";
import { Shell } from "../components/Shell";
import { Button } from "../components/ui/button";
import { callApi } from "../lib/api";
import { money, readDemo, saveDemo, type Party } from "../lib/demo";
export default function Dashboard() {
  const { partyId } = useParams();
  const { userId, ready } = useAuth();
  const demo = partyId === "demo";
  const [local, setLocal] = useState(readDemo);
  const [tab, setTab] = useState("Overview");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [recap, setRecap] = useState<{
    auraAwarded: number;
    verifiedParticipants: number;
  } | null>(null);
  const query = useQuery({
    queryKey: ["dashboard", partyId, userId],
    queryFn: () => callApi<Party>("dashboard", { partyId }),
    enabled: !demo && !!userId,
  });
  const p = demo ? local : query.data;
  function update(party: Party) {
    saveDemo(party);
    setLocal(party);
  }
  async function action(
    name: string,
    payload: Record<string, unknown>,
    localAction: () => void,
    success: string,
  ) {
    setBusy(true);
    setError("");
    try {
      if (demo) localAction();
      else {
        const result = await callApi<unknown>(name, { partyId, ...payload });
        if (
          name === "finalize" &&
          result &&
          typeof result === "object" &&
          "auraAwarded" in result &&
          "verifiedParticipants" in result
        )
          setRecap(
            result as { auraAwarded: number; verifiedParticipants: number },
          );
        await query.refetch();
      }
      setMessage(success);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this change.");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!p) return;
    if (!demo && !p.inviteToken) {
      setError(
        "This device does not have the current invitation. Generate a new link below.",
      );
      setTab("Party");
      return;
    }
    const url = `${location.origin}${demo ? "/" : `/invite/${p.inviteToken}`}`;
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Invitation copied. Send it to your people.");
    } catch {
      setMessage(url);
    }
  }
  if (!demo && ready && !userId)
    return (
      <Shell>
        <div className="dashboard-page">
          <AuthPanel />
        </div>
      </Shell>
    );
  if (!p)
    return (
      <Shell>
        <div className="loading">
          <h1>
            {query.isError
              ? "Sign in to manage your party."
              : "Getting your party ready…"}
          </h1>
          <p>{query.error instanceof Error ? query.error.message : ""}</p>
          <Link to="/create">Sign in / create a party</Link>
        </div>
      </Shell>
    );
  return (
    <Shell demo={demo}>
      <div className="dashboard-page">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow pink-text">
              YOU MAKE THE GOOD TIMES HAPPEN
            </span>
            <h1>{p.title}</h1>
            <p>
              {new Date(`${p.date}T${p.time}`).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}{" "}
              · {p.location} <span className="status-badge">{p.status}</span>
            </p>
          </div>
          <Button onClick={() => void copy()}>
            <Copy size={16} /> Share invitation
          </Button>
        </div>
        <nav className="dashboard-tabs" aria-label="Manage party">
          {["Overview", "Guests", "Contributions", "Party", "Wrap up"].map(
            (t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ),
          )}
        </nav>
        {message && (
          <div className="notice" role="status">
            <CheckCircle2 size={18} />
            {message}
          </div>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {tab === "Overview" ? (
          <>
            <div className="dashboard-stats">
              <article>
                <Users />
                <strong>{p.going}</strong>
                <span>people coming</span>
                <small>
                  {p.maybe} maybe · {p.declined} can’t make it
                </small>
              </article>
              <article>
                <Heart />
                <strong>{money(p.confirmedCents)}</strong>
                <span>confirmed received</span>
                <small>{money(p.pendingCents)} still pledged</small>
              </article>
              <article>
                <Sparkles />
                <strong>
                  {money(Math.max(0, p.budgetCents - p.confirmedCents))}
                </strong>
                <span>left to make it happen</span>
                <small>of {money(p.budgetCents)} budget</small>
              </article>
            </div>
            <div className="dashboard-columns">
              <section className="form-card">
                <h2>The little things.</h2>
                <p>Here’s what still needs a little love.</p>
                {p.needs.map((n) => (
                  <div className="manage-row" key={n.id}>
                    <span>
                      <strong>{n.title}</strong>
                      <small>
                        {n.claimed} of {n.quantity} covered
                      </small>
                    </span>
                    {n.claimed === n.quantity ? (
                      <CheckCircle2 className="blue-text" />
                    ) : (
                      <span className="status-badge">
                        {n.quantity - n.claimed} open
                      </span>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => setTab("Contributions")}
                >
                  Manage contributions <ArrowRight size={16} />
                </Button>
              </section>
              <section className="host-note">
                <div>
                  <span className="eyebrow">YOUR HOSTING SUPERPOWER</span>
                  <h2>Make people feel welcome.</h2>
                  <p>
                    A quick update goes a long way. Share the little details
                    that make showing up easier.
                  </p>
                  <Button variant="outline" onClick={() => setTab("Party")}>
                    Post an update <Plus size={16} />
                  </Button>
                </div>
              </section>
            </div>
          </>
        ) : tab === "Guests" ? (
          <section className="form-card">
            <h2>Your people.</h2>
            <p>
              {demo
                ? "Sample guests and guests added in this browser."
                : "Guest details are visible only to you."}
            </p>
            {p.guests.map((g) => (
              <div className="manage-row" key={g.id}>
                <span>
                  <strong>{g.name}</strong>
                  <small>
                    {g.status}
                    {g.attended ? " · checked in" : ""}
                  </small>
                </span>
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    p.status !== "published" ||
                    g.attended ||
                    g.status !== "going"
                  }
                  onClick={() =>
                    void action(
                      "attendance",
                      { guestId: g.id, attended: true },
                      () =>
                        update({
                          ...p,
                          guests: p.guests.map((x) =>
                            x.id === g.id ? { ...x, attended: true } : x,
                          ),
                        }),
                      "Attendance recorded.",
                    )
                  }
                >
                  {g.attended ? <Check size={16} /> : "Check in"}
                </Button>
              </div>
            ))}
            <p className="fine-print">
              Check in only people who actually attend. Finalization doesn’t
              penalize unreviewed guests.
            </p>
          </section>
        ) : tab === "Contributions" ? (
          <section className="form-card">
            <h2>Promises meet follow-through.</h2>
            <p>
              Confirm only money received and commitments actually fulfilled.
            </p>
            <h3>Money</h3>
            {p.pledges
              .filter((x) => x.status !== "canceled")
              .map((pledge) => (
                <div className="manage-row" key={pledge.id}>
                  <span>
                    <strong>
                      {pledge.name} · {money(pledge.amountCents)}
                    </strong>
                    <small>{pledge.status}</small>
                  </span>
                  <Button
                    variant="outline"
                    disabled={
                      busy ||
                      p.status !== "published" ||
                      !["pledged", "payment_initiated"].includes(pledge.status)
                    }
                    onClick={() =>
                      void action(
                        "confirmPayment",
                        { pledgeId: pledge.id },
                        () =>
                          update({
                            ...p,
                            confirmedCents:
                              p.confirmedCents + pledge.amountCents,
                            pendingCents: p.pendingCents - pledge.amountCents,
                            pledges: p.pledges.map((x) =>
                              x.id === pledge.id
                                ? { ...x, status: "confirmed" }
                                : x,
                            ),
                          }),
                        "Payment confirmed as received.",
                      )
                    }
                  >
                    {pledge.status === "confirmed" ? (
                      <Check size={16} />
                    ) : (
                      "Confirm received"
                    )}
                  </Button>
                </div>
              ))}
            <h3>Items & helping hands</h3>
            {p.claims
              .filter((c) => c.status !== "released")
              .map((c) => (
                <div className="manage-row" key={c.id}>
                  <span>
                    <strong>
                      {p.needs.find((n) => n.id === c.needId)?.title}
                    </strong>
                    <small>
                      {p.guests.find((g) => g.id === c.guestId)?.name ||
                        "Guest"}{" "}
                      · {c.status}
                    </small>
                  </span>
                  <Button
                    variant="outline"
                    disabled={
                      busy || p.status !== "published" || c.status !== "claimed"
                    }
                    onClick={() =>
                      void action(
                        "verifyClaim",
                        { claimId: c.id },
                        () =>
                          update({
                            ...p,
                            claims: p.claims.map((x) =>
                              x.id === c.id
                                ? {
                                    ...x,
                                    status:
                                      p.needs.find((n) => n.id === c.needId)
                                        ?.kind === "task"
                                        ? "completed"
                                        : "delivered",
                                  }
                                : x,
                            ),
                          }),
                        "Commitment verified.",
                      )
                    }
                  >
                    {c.status === "claimed" ? (
                      "Confirm fulfilled"
                    ) : (
                      <Check size={16} />
                    )}
                  </Button>
                </div>
              ))}
            {!p.claims.length && (
              <p className="empty-state">
                No item claims yet. Share your invitation to get the good things
                going.
              </p>
            )}
          </section>
        ) : tab === "Party" ? (
          <section className="form-card">
            <h2>Keep everyone in the loop.</h2>
            <label>
              A note for your guests
              <textarea
                value={announcement}
                onChange={(e) => setAnnouncement(e.target.value)}
                maxLength={2000}
                placeholder="Parking tips, dietary options, the playlist…"
              />
            </label>
            <Button
              disabled={
                busy || p.status !== "published" || !announcement.trim()
              }
              onClick={() =>
                void action(
                  "postUpdate",
                  { message: announcement.trim() },
                  () =>
                    update({
                      ...p,
                      updates: [...p.updates, announcement.trim()],
                    }),
                  "Update posted to your invitation.",
                ).then((ok) => {
                  if (ok) setAnnouncement("");
                })
              }
            >
              Post update <ArrowRight size={16} />
            </Button>
            <h3>Invitation</h3>
            <Button variant="outline" onClick={() => void copy()}>
              Copy invitation <Copy size={16} />
            </Button>
            {(demo || p.inviteToken) && (
              <Link
                className="text-link"
                to={demo ? "/" : `/invite/${p.inviteToken}`}
              >
                Preview invitation <ArrowUpRight size={16} />
              </Link>
            )}
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (demo) {
                  setMessage("Demo link stays the same.");
                  return;
                }
                void action(
                  "rotateInvite",
                  {},
                  () => {},
                  "New invitation created. Previous invitations no longer work.",
                ).then(() => void query.refetch());
              }}
            >
              Generate a new invitation link
            </Button>
            <h3>Party controls</h3>
            <Button
              variant="outline"
              disabled={
                busy || p.status !== "published" || p.rsvpsOpen === false
              }
              onClick={() =>
                void action(
                  "updateParty",
                  { rsvpsOpen: false },
                  () => update({ ...p, rsvpsOpen: false }),
                  "RSVPs closed.",
                )
              }
            >
              Close RSVPs
            </Button>
            <HostSettings
              party={p}
              busy={busy}
              onSave={(payload, updated, message) =>
                action("updateParty", payload, () => update(updated), message)
              }
            />
            <p className="fine-print">
              Private street addresses are shared only after guest access is
              validated.
            </p>
          </section>
        ) : (
          <section className="form-card">
            <span className="eyebrow">THE NIGHT WAS JUST THE BEGINNING</span>
            <h2>Good times deserve a good recap.</h2>
            {recap && (
              <div className="notice">
                <Sparkles size={19} />
                {recap.verifiedParticipants} independently verified participants
                · {recap.auraAwarded} Aura awarded by the server. Guest awards
                appear on linked verified profiles.
              </div>
            )}
            <p>
              Check attendance and confirm fulfilled contributions first. Scores
              use verified activity; pending promises never become automatic
              penalties.
            </p>
            <div className="review">
              <p>
                {p.guests.filter((g) => g.attended).length} guests checked in
              </p>
              <p>{money(p.confirmedCents)} confirmed funding</p>
              <p>
                {
                  p.claims.filter(
                    (c) => c.status === "delivered" || c.status === "completed",
                  ).length
                }{" "}
                commitments fulfilled
              </p>
            </div>
            <div className="notice">
              <ShieldCheck size={20} />
              {demo
                ? "Demo recap only. No real scores are awarded."
                : "Server validation requires an event that has ended and independent participation. Scores cannot be manually entered."}
            </div>
            {confirmFinalize ? (
              <>
                <p>Finish this event using the verified records above?</p>
                <Button
                  disabled={busy}
                  onClick={() =>
                    void action(
                      "finalize",
                      {},
                      () => update({ ...p, status: "finalized" }),
                      demo
                        ? "Demo party finalized. Real score awards require the live backend."
                        : "Party finalized. Verified score events recorded.",
                    ).then((ok) => {
                      if (ok) setConfirmFinalize(false);
                    })
                  }
                >
                  Confirm & finalize
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setConfirmFinalize(false)}
                >
                  Keep reviewing
                </Button>
              </>
            ) : (
              <Button
                disabled={p.status !== "published"}
                onClick={() => setConfirmFinalize(true)}
              >
                {p.status === "finalized"
                  ? "Party finalized"
                  : "Review & finalize"}
                <Sparkles size={17} />
              </Button>
            )}
          </section>
        )}
      </div>
    </Shell>
  );
}
