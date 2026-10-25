import { Cover } from "./components/invitation/Cover";
import { PartyDetails } from "./components/invitation/PartyDetails";
import { NeedsGrid } from "./components/invitation/NeedsGrid";
import { HostNote } from "./components/invitation/HostNote";
import { RsvpCard } from "./components/invitation/RsvpCard";
import { FundingCard } from "./components/invitation/FundingCard";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  Heart,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import { AuthPanel, useAuth } from "./components/AuthPanel";
import { Dialog } from "./components/Dialog";
import { Shell } from "./components/Shell";
import { Button } from "./components/ui/button";
import { callApi } from "./lib/api";
import { money, readDemo, saveDemo, type Party, type Guest } from "./lib/demo";
type Mode = "rsvp" | "money" | "manage" | null;
export default function App({ manage = false }: { manage?: boolean }) {
  const { token } = useParams();
  const { userId } = useAuth();
  const demo = !token && !manage;
  const [local, setLocal] = useState(readDemo);
  const [mode, setMode] = useState<Mode>(manage ? "manage" : null);
  const [name, setName] = useState("");
  const [rsvp, setRsvp] = useState<Guest["status"]>("going");
  const [amount, setAmount] = useState("20");
  const [notice, setNotice] = useState("");
  const [showContributionChoices, setShowContributionChoices] = useState(false);
  const [editingPledgeId, setEditingPledgeId] = useState<string | null>(null);
  const [editedAmount, setEditedAmount] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [guest, setGuest] = useState<Guest | null>(() =>
    demo ? JSON.parse(sessionStorage.getItem("demo-guest") || "null") : null,
  );
  const [managementToken, setManagementToken] = useState(() =>
    manage
      ? /^[a-f0-9]{64}$/i.test(location.hash.slice(1))
        ? location.hash.slice(1)
        : sessionStorage.getItem("active-management-token") || ""
      : sessionStorage.getItem(`guest-${token}`) || "",
  );
  useEffect(() => {
    if (managementToken)
      sessionStorage.setItem("active-management-token", managementToken);
  }, [managementToken]);
  const query = useQuery({
    queryKey: ["invitation", token, manage, managementToken],
    queryFn: () =>
      callApi<Party>(
        managementToken ? "guest" : "invitation",
        managementToken ? { managementToken } : { inviteToken: token },
      ),
    enabled: !demo,
  });
  const party = demo ? local : query.data;
  useEffect(() => {
    if (!demo && managementToken && query.data?.guests[0])
      setGuest(query.data.guests[0]);
  }, [demo, managementToken, query.data]);
  function update(p: Party) {
    saveDemo(p);
    setLocal(p);
  }
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function submitRsvp() {
    await act(async () => {
      if (!name.trim())
        throw new Error("Add your name so your host knows who’s coming.");
      if (demo) {
        const g = {
          id: guest?.id || crypto.randomUUID(),
          name: name.trim(),
          status: rsvp,
        };
        const guests = local.guests.filter((x) => x.id !== g.id);
        guests.push(g);
        update({
          ...local,
          guests,
          going:
            local.going +
            (rsvp === "going" ? 1 : 0) -
            (guest?.status === "going" ? 1 : 0),
        });
        setGuest(g);
        sessionStorage.setItem("demo-guest", JSON.stringify(g));
      } else {
        if (managementToken) {
          await callApi("changeRsvp", {
            managementToken,
            status: rsvp,
            name: name.trim(),
          });
          setGuest(
            guest ? { ...guest, status: rsvp, name: name.trim() } : null,
          );
          await query.refetch();
        } else {
          const data = await callApi<{ guest: Guest; managementToken: string }>(
            "rsvp",
            {
              inviteToken: token,
              name: name.trim(),
              status: rsvp,
            },
          );
          setGuest(data.guest);
          setManagementToken(data.managementToken);
          sessionStorage.setItem(`guest-${token}`, data.managementToken);
          await query.refetch();
        }
      }
      setMode(null);
      setShowContributionChoices(rsvp === "going");
      setNotice(
        rsvp === "going"
          ? "You’re on the list. We’re glad you’re coming!"
          : "Your RSVP is saved.",
      );
    });
  }
  async function pledge(cover = false) {
    await act(async () => {
      if (!party) return;
      const cents = cover
        ? Math.max(0, party.budgetCents - party.confirmedCents)
        : Math.round(Number(amount) * 100);
      if (!Number.isFinite(cents) || cents <= 0 || cents > 10000000)
        throw new Error("Enter an amount between $0.01 and $100,000.");
      if (!guest && !manage)
        throw new Error(
          "RSVP first so your pledge has a private management link.",
        );
      if (demo) {
        update({
          ...local,
          pendingCents: local.pendingCents + cents,
          pledges: [
            ...local.pledges,
            {
              id: crypto.randomUUID(),
              guestId: guest!.id,
              name: guest!.name,
              amountCents: cents,
              status: "pledged",
            },
          ],
        });
      } else {
        await callApi("pledge", {
          managementToken,
          amountCents: cents,
          coverRemaining: cover,
        });
        await query.refetch();
      }
      setMode(null);
      setNotice(
        `${money(cents)} pledged. Only the host can confirm money received.`,
      );
    });
  }
  async function claim(needId: string) {
    await act(async () => {
      if (!guest && !manage)
        throw new Error("RSVP first to save your commitment securely.");
      if (demo) {
        const need = local.needs.find((n) => n.id === needId)!;
        if (need.claimed >= need.quantity)
          throw new Error("This one is covered. Thank you!");
        update({
          ...local,
          needs: local.needs.map((n) =>
            n.id === needId ? { ...n, claimed: n.claimed + 1 } : n,
          ),
          claims: [
            ...local.claims,
            {
              id: crypto.randomUUID(),
              guestId: guest!.id,
              needId,
              quantity: 1,
              status: "claimed",
            },
          ],
        });
      } else {
        await callApi("claim", {
          managementToken,
          needId,
          quantity: 1,
        });
        await query.refetch();
      }
      setNotice("You’re a good egg. Your commitment is saved.");
      setMode(null);
    });
  }
  async function savePledgeEdit(pledgeId: string) {
    await act(async () => {
      const value = Number(editedAmount);
      const amountCents = Math.round(value * 100);
      if (
        !Number.isFinite(value) ||
        amountCents <= 0 ||
        amountCents > 10_000_000
      )
        throw new Error("Enter an amount between $0.01 and $100,000.");
      if (demo) {
        const original = local.pledges.find((pledge) => pledge.id === pledgeId);
        if (!original || original.status !== "pledged")
          throw new Error("Only pending pledges can be edited.");
        update({
          ...local,
          pendingCents: local.pendingCents - original.amountCents + amountCents,
          pledges: local.pledges.map((pledge) =>
            pledge.id === pledgeId ? { ...pledge, amountCents } : pledge,
          ),
        });
      } else {
        await callApi("editPledge", { managementToken, pledgeId, amountCents });
        await query.refetch();
      }
      setEditingPledgeId(null);
      setNotice("Your pending pledge is updated.");
    });
  }
  function chooseSupplies() {
    setShowContributionChoices(false);
    document
      .querySelector(".needs-section")
      ?.scrollIntoView?.({ behavior: "auto", block: "start" });
  }
  async function copyLink(privateManagement = false) {
    if (!privateManagement && manage) {
      setNotice(
        "Ask your host for the invitation link. Your management link is private.",
      );
      return;
    }
    const link = privateManagement
      ? `${location.origin}/manage#${managementToken}`
      : `${location.origin}${token ? `/invite/${token}` : "/"}`;
    try {
      await navigator.clipboard.writeText(link);
      setNotice(
        privateManagement
          ? "Private management link copied. Keep it just for you."
          : "Invitation link copied.",
      );
    } catch {
      setNotice(
        privateManagement
          ? "Clipboard unavailable. Your private management link is shown below."
          : "Copy the invitation from your browser’s address bar.",
      );
    }
  }
  if (!party)
    return (
      <Shell>
        <section className="loading">
          <h1>
            {query.isError
              ? "This invitation couldn’t be opened."
              : "Making room for you…"}
          </h1>
          <p>
            {query.error instanceof Error ? query.error.message : "One moment."}
          </p>
          <Link to="/">Explore the demo</Link>
        </section>
      </Shell>
    );
  return (
    <Shell demo={demo}>
      {error && !mode && (
        <p className="error page-error" role="alert">
          {error}
        </p>
      )}
      {party.status !== "published" && (
        <p className="notice page-error">
          {party.status === "canceled"
            ? "This party has been canceled."
            : party.status === "finalized"
              ? "This party has wrapped up. Thanks for being part of it."
              : "This invitation is no longer accepting RSVPs."}
        </p>
      )}
      <div className="invitation-layout">
        <div className="party-main">
          <div className="eyebrow">
            <span className="live-dot" /> A LITTLE GET-TOGETHER, A LOT TO LOOK
            FORWARD TO
          </div>
          <Cover coverUrl={party.coverUrl} />
          <PartyDetails
            party={party}
            addressVisible={Boolean(guest || managementToken)}
            onCopyInvitation={() => void copyLink()}
          />
          {showContributionChoices && (
            <section
              className="form-card contribution-choices"
              aria-label="Optional ways to join in"
            >
              <h2>You’re coming. That’s what matters.</h2>
              <p>Anything else is completely optional.</p>
              <div className="amount-options">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowContributionChoices(false);
                    setMode("money");
                  }}
                >
                  Chip in
                </Button>
                <Button variant="outline" onClick={chooseSupplies}>
                  Bring something
                </Button>
                <Button variant="outline" onClick={chooseSupplies}>
                  Lend a hand
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowContributionChoices(false);
                    setNotice("Just bring yourself. We’re glad you’re coming!");
                  }}
                >
                  Just coming
                </Button>
              </div>
            </section>
          )}
          <NeedsGrid
            needs={party.needs}
            busy={busy}
            onClaim={(needId) => {
              if (!guest && !manage) {
                setMode("rsvp");
                setNotice("First, let us know who’s coming.");
              } else void claim(needId);
            }}
            onChipIn={() => setMode(guest || manage ? "money" : "rsvp")}
          />
          <HostNote hostName={party.hostName} updates={party.updates} />
        </div>
        <aside className="party-sidebar">
          <RsvpCard
            goingCount={party.going}
            demo={demo}
            hasGuest={Boolean(guest)}
            canManage={Boolean(guest || manage)}
            onRsvp={() => {
              setName(guest?.name || "");
              setRsvp(guest?.status || "going");
              setMode("rsvp");
            }}
            onMaybe={() => {
              setRsvp("maybe");
              setName(guest?.name || "");
              setMode("rsvp");
            }}
            onManage={() => setMode("manage")}
          />
          <FundingCard
            budgetCents={party.budgetCents}
            confirmedCents={party.confirmedCents}
            pendingCents={party.pendingCents}
            onChipIn={() => setMode(guest || manage ? "money" : "rsvp")}
            onCoverRemaining={() => {
              setAmount(
                String(
                  Math.max(0, party.budgetCents - party.confirmedCents) / 100,
                ),
              );
              setMode(guest || manage ? "money" : "rsvp");
            }}
          />
          <div className="together-note">
            <Sparkles size={23} />
            <p>
              Less organizing.
              <br />
              More <em>“remember that night?”</em>
            </p>
          </div>
        </aside>
      </div>
      <section className="bottom-message">
        <span>✳</span>
        <h2>
          The best things happen
          <br />
          when we show up.
        </h2>
        <p>You host. Everyone helps. Everybody’s welcome.</p>
        <Link to="/create">
          Make a little something happen <ArrowRight size={16} />
        </Link>
      </section>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={19} />
          <span>{notice}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <X size={17} />
          </button>
        </div>
      )}
      {mode && (
        <Dialog
          onClose={() => setMode(null)}
          label={mode === "rsvp" ? "Your RSVP" : "Your contribution"}
        >
          <section className="modal">
            <button
              className="modal-close icon-button"
              aria-label="Close"
              onClick={() => setMode(null)}
            >
              <X />
            </button>
            <span className="modal-emblem">
              <Heart />
            </span>
            <h2>
              {mode === "rsvp"
                ? "Make yourself at home."
                : mode === "money"
                  ? "A little generosity. A great night."
                  : mode === "manage"
                    ? "Your plans, all in one place."
                    : "Everyone brings something."}
            </h2>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {mode === "rsvp" ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitRsvp();
                }}
              >
                <label>
                  Your name
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={80}
                    required
                    placeholder="What should we call you?"
                  />
                </label>
                <div className="rsvp-options">
                  {(["going", "maybe", "declined"] as const).map((s) => (
                    <button
                      type="button"
                      className={rsvp === s ? "selected" : ""}
                      aria-pressed={rsvp === s}
                      onClick={() => setRsvp(s)}
                      key={s}
                    >
                      {s === "going"
                        ? "I’m coming"
                        : s === "maybe"
                          ? "Maybe"
                          : "Can’t make it"}
                    </button>
                  ))}
                </div>
                <Button disabled={busy} type="submit">
                  {busy ? "Saving…" : "Save my RSVP"}
                  <ArrowRight size={17} />
                </Button>
                <p className="fine-print">
                  No account. No admission fee. Just a good time.
                </p>
              </form>
            ) : mode === "money" ? (
              <>
                <p>Choose any amount. This saves a pledge, not a payment.</p>
                <div className="amount-options">
                  {[10, 20, 35, 50].map((n) => (
                    <button
                      className={amount === String(n) ? "selected" : ""}
                      aria-pressed={amount === String(n)}
                      key={n}
                      onClick={() => setAmount(String(n))}
                    >
                      {money(n * 100)}
                    </button>
                  ))}
                </div>
                <label>
                  Custom amount ($)
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>
                <Button disabled={busy} onClick={() => void pledge()}>
                  Pledge {money(Math.round((Number(amount) || 0) * 100))}
                  <Heart size={17} />
                </Button>
                {party.paymentUrl && (
                  <a
                    className="text-link"
                    href={party.paymentUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Open host’s payment link <ArrowUpRight size={16} />
                  </a>
                )}
                <button
                  className="sponsor-link"
                  disabled={busy}
                  onClick={() => void pledge(true)}
                >
                  Cover the remaining{" "}
                  {money(Math.max(0, party.budgetCents - party.confirmedCents))}
                </button>
                <p className="fine-print">
                  The remaining amount is fixed when you pledge. Your host
                  confirms payment separately.
                </p>
              </>
            ) : mode === "manage" ? (
              <>
                <p>
                  {guest ? `Hey ${guest.name}. ` : ""}You can update your RSVP
                  or release a pending commitment.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setName(guest?.name || "");
                    setMode("rsvp");
                  }}
                >
                  Update RSVP
                </Button>
                {party.pledges
                  .filter(
                    (p) =>
                      (manage || p.guestId === guest?.id) &&
                      p.status !== "canceled",
                  )
                  .map((p) => (
                    <div className="manage-row" key={p.id}>
                      <span>
                        {money(p.amountCents)} · {p.status.replace("_", " ")}
                      </span>
                      {p.status === "pledged" &&
                        (editingPledgeId === p.id ? (
                          <div>
                            <label>
                              New pledge amount ($)
                              <input
                                type="number"
                                min="0.01"
                                max="100000"
                                step="0.01"
                                value={editedAmount}
                                onChange={(event) =>
                                  setEditedAmount(event.target.value)
                                }
                              />
                            </label>
                            <button
                              disabled={busy}
                              onClick={() => void savePledgeEdit(p.id)}
                            >
                              Save amount
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => setEditingPledgeId(null)}
                            >
                              Keep original
                            </button>
                          </div>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() => {
                              setEditedAmount(String(p.amountCents / 100));
                              setEditingPledgeId(p.id);
                            }}
                          >
                            Edit
                          </button>
                        ))}
                      {p.status === "pledged" && (
                        <button
                          onClick={() =>
                            void act(async () => {
                              if (demo)
                                update({
                                  ...local,
                                  pendingCents:
                                    local.pendingCents - p.amountCents,
                                  pledges: local.pledges.map((x) =>
                                    x.id === p.id
                                      ? { ...x, status: "canceled" }
                                      : x,
                                  ),
                                });
                              else {
                                await callApi("cancelPledge", {
                                  managementToken,
                                  pledgeId: p.id,
                                });
                                await query.refetch();
                              }
                              setNotice("Pledge canceled.");
                            })
                          }
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                {party.claims
                  .filter(
                    (c) =>
                      (manage || c.guestId === guest?.id) &&
                      c.status === "claimed",
                  )
                  .map((c) => (
                    <div className="manage-row" key={c.id}>
                      <span>
                        {party.needs.find((n) => n.id === c.needId)?.title}
                      </span>
                      <button
                        onClick={() =>
                          void act(async () => {
                            if (demo)
                              update({
                                ...local,
                                claims: local.claims.map((x) =>
                                  x.id === c.id
                                    ? { ...x, status: "released" }
                                    : x,
                                ),
                                needs: local.needs.map((n) =>
                                  n.id === c.needId
                                    ? { ...n, claimed: n.claimed - c.quantity }
                                    : n,
                                ),
                              });
                            else {
                              await callApi("releaseClaim", {
                                managementToken,
                                claimId: c.id,
                              });
                              await query.refetch();
                            }
                            setNotice("Commitment released.");
                          })
                        }
                      >
                        Release
                      </button>
                    </div>
                  ))}
                {managementToken && (
                  <>
                    <Button
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void act(async () => {
                          await callApi("confirmAttendance", {
                            managementToken,
                          });
                          setNotice(
                            "Your attendance is attested. Your host verifies attendance separately.",
                          );
                        })
                      }
                    >
                      I’m here · confirm my attendance
                    </Button>
                    {userId ? (
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await callApi("linkGuest", { managementToken });
                            setNotice(
                              "Participation linked to your verified profile.",
                            );
                          })
                        }
                      >
                        Link this party to my profile
                      </Button>
                    ) : (
                      <AuthPanel />
                    )}
                  </>
                )}
                {managementToken && (
                  <Button variant="outline" onClick={() => void copyLink(true)}>
                    <Copy size={16} /> Copy private management link
                  </Button>
                )}
                {managementToken && (
                  <p className="private-link">{`${location.origin}/manage#${managementToken}`}</p>
                )}
                <Button onClick={() => setMode("money")}>
                  Add a contribution <Plus size={16} />
                </Button>
                <p className="fine-print">
                  {demo
                    ? "Demo changes are saved in this browser."
                    : "Keep your management link private: anyone with it can manage your commitments."}
                </p>
              </>
            ) : null}
          </section>
        </Dialog>
      )}
      <div className="mobile-rsvp">
        <span>
          <strong>{party.going} friends & counting</strong>
          <small>Your presence is plenty.</small>
        </span>
        <Button onClick={() => setMode("rsvp")}>
          {guest ? "My RSVP" : "I’m coming"}
          <ArrowRight size={16} />
        </Button>
      </div>
    </Shell>
  );
}
