import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthPanel, useAuth } from "../components/AuthPanel";
import { callApi, supabase } from "../lib/api";
import { Button } from "../components/ui/button";
import { prestigeTitle } from "../domain/scoring";
import {
  Award,
  CheckCircle2,
  Gem,
  Heart,
  PartyPopper,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Shell } from "../components/Shell";
import { Link } from "react-router-dom";
interface ProfileData {
  profile: { id: string; name: string };
  scores: {
    reputation: number | null;
    prestige: number;
    aura: number;
    verifiedActivities: number;
  };
  events: {
    id: string;
    category: string;
    value: number;
    created_at: string;
    reverses_id: string | null;
  }[];
}
export default function Profile() {
  const { userId, ready } = useAuth();
  const query = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => callApi<ProfileData>("profile", {}),
    enabled: !!userId,
  });
  const [reason, setReason] = useState("");
  const [eventId, setEventId] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  if (supabase) {
    const data = query.data;
    return (
      <Shell>
        <div className="profile-page">
          <span className="eyebrow pink-text">YOUR PART IN SOMETHING GOOD</span>
          <h1>{data?.profile?.name || "Your Together profile"}</h1>
          {!ready ? (
            <p>Checking your session…</p>
          ) : !userId ? (
            <AuthPanel />
          ) : query.isPending ? (
            <p>Gathering your verified activity…</p>
          ) : query.isError ? (
            <p role="alert" className="error">
              {query.error.message}
            </p>
          ) : data ? (
            <>
              <div className="score-grid live-scores">
                <article className="score-card">
                  <ShieldCheck />
                  <span>Reputation</span>
                  <strong>{data.scores?.reputation ?? "Unrated"}</strong>
                  <p>Reliability, verified.</p>
                  <small>
                    {data.scores?.verifiedActivities || 0} verified activities ·
                    five needed for a rating
                  </small>
                </article>
                <article className="score-card prestige">
                  <Gem />
                  <span>Prestige</span>
                  <strong>{data.scores?.prestige || 0}</strong>
                  <p>{prestigeTitle(data.scores?.prestige || 0)}</p>
                  <small>Verified generosity. Private amounts.</small>
                </article>
                <article className="score-card aura">
                  <Sparkles />
                  <span>Aura</span>
                  <strong>{data.scores?.aura || 0}</strong>
                  <p>Bringing people together.</p>
                  <small>Earned from verified gatherings.</small>
                </article>
              </div>
              <h2>Your verified history.</h2>
              {!data.events.length ? (
                <div className="empty-state">
                  Your story starts with showing up. Use your private guest link
                  to connect past participation to this account.
                </div>
              ) : (
                data.events.map((e) => (
                  <div className="manage-row" key={e.id}>
                    <span>
                      <strong>
                        {e.category} · {e.value}
                        {e.reverses_id ? " · correction" : ""}
                      </strong>
                      <small>
                        {new Date(e.created_at).toLocaleDateString()}
                      </small>
                    </span>
                    <button onClick={() => setEventId(e.id)}>
                      Request correction
                    </button>
                  </div>
                ))
              )}
              {eventId && (
                <form
                  className="form-card"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setBusy(true);
                    void callApi("dispute", { scoreEventId: eventId, reason })
                      .then(() => {
                        setMessage("Correction request submitted for review.");
                        setEventId("");
                        setReason("");
                      })
                      .catch((e) => setMessage(e.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  <h3>Tell us what needs correcting.</h3>
                  <label>
                    Reason
                    <textarea
                      minLength={10}
                      maxLength={2000}
                      required
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </label>
                  <Button disabled={busy} type="submit">
                    Submit for review
                  </Button>
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setEventId("")}
                  >
                    Cancel
                  </Button>
                </form>
              )}
              {message && (
                <p className="notice" role="status">
                  {message}
                </p>
              )}
              <Button
                variant="outline"
                onClick={() =>
                  void supabase?.auth
                    .signOut()
                    .then(({ error }) => {
                      if (error) setMessage(error.message);
                    })
                    .catch(() =>
                      setMessage("Could not sign out. Please retry."),
                    )
                }
              >
                Sign out
              </Button>
            </>
          ) : null}
        </div>
      </Shell>
    );
  }
  return (
    <Shell demo>
      <div className="profile-page">
        <div className="profile-cover">
          <span>✳</span>
          <span>good people make good things happen.</span>
        </div>
        <div className="profile-identity">
          <div className="avatar profile-avatar">A</div>
          <div>
            <span className="eyebrow">THE PERSON WHO BRINGS US TOGETHER</span>
            <h1>Alex Morgan</h1>
            <p>Always room for one more at the table. · Austin, TX</p>
          </div>
        </div>
        <div className="score-grid">
          <article className="score-card">
            <ShieldCheck />
            <span>Reputation</span>
            <strong>
              96<small>/100</small>
            </strong>
            <p>Someone you can count on.</p>
            <small>Verified reliability, with confidence.</small>
          </article>
          <article className="score-card prestige">
            <Gem />
            <span>Prestige</span>
            <strong>640</strong>
            <p>Supporter</p>
            <small>Generosity that’s made a difference.</small>
          </article>
          <article className="score-card aura">
            <Sparkles />
            <span>Aura</span>
            <strong>328</strong>
            <p>A natural at bringing people together.</p>
            <small>Real gatherings. Real connection.</small>
          </article>
        </div>
        <div className="profile-stats">
          <div>
            <PartyPopper />
            <strong>8</strong>
            <span>parties hosted</span>
          </div>
          <div>
            <Users />
            <strong>142</strong>
            <span>people brought together</span>
          </div>
          <div>
            <CheckCircle2 />
            <strong>24</strong>
            <span>commitments fulfilled</span>
          </div>
        </div>
        <h2>A little recognition goes a long way.</h2>
        <div className="achievement-grid">
          {[
            [PartyPopper, "First of many", "Hosted your first gathering"],
            [ShieldCheck, "True to your word", "A dependable friend"],
            [Heart, "Community builder", "50 people brought together"],
            [Award, "The regular", "10 parties attended"],
          ].map(([Icon, title, description]) => {
            const I = Icon as typeof Award;
            return (
              <article key={String(title)}>
                <I />
                <h3>{String(title)}</h3>
                <p>{String(description)}</p>
              </article>
            );
          })}
        </div>
        <div className="notice">
          This is a sample profile. Live scores are calculated only from
          verified server activity. Guests can link their history after signing
          in and proving control of their private management credential.
        </div>
        <Link className="text-link" to="/create">
          Bring your people together <PartyPopper size={16} />
        </Link>
      </div>
    </Shell>
  );
}
