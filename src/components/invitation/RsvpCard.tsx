import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Heart,
  PartyPopper,
} from "lucide-react";
import { Button } from "../ui/button";

interface RsvpCardProps {
  goingCount: number;
  hasGuest: boolean;
  canManage: boolean;
  onRsvp: () => void;
  onMaybe: () => void;
  onManage: () => void;
}

export function RsvpCard({
  goingCount,
  hasGuest,
  canManage,
  onRsvp,
  onMaybe,
  onManage,
}: RsvpCardProps) {
  return (
    <section className="rsvp-card">
      <div className="mini-eyebrow">
        <PartyPopper size={17} /> GOOD TIMES AHEAD
      </div>
      <h2>
        There’s a spot
        <br />
        with your name on it.
      </h2>
      <p>Friends, food, and a Friday well spent.</p>
      <div className="attendee-row">
        <div className="avatar-stack">
          {["J", "S", "M", "T"].map((a, i) => (
            <span
              key={a}
              style={{
                background: ["#efd6c1", "#cbdcd0", "#e6c5cf", "#d8d8f0"][i],
              }}
            >
              {a}
            </span>
          ))}
        </div>
        <div>
          <strong>{goingCount} people coming</strong>
          <span>It’s going to be a good one.</span>
        </div>
      </div>
      <Button onClick={onRsvp}>
        <Check size={18} />
        {hasGuest ? "Update my RSVP" : "I’m coming"}
        <ArrowRight size={18} />
      </Button>
      <button className="maybe-button" onClick={onMaybe}>
        Maybe? You can decide later.
      </button>
      <div className="welcome-note">
        <Heart size={15} /> No contribution needed. Just you.
      </div>
      {canManage && (
        <button className="manage-link" onClick={onManage}>
          Manage my commitments <ArrowUpRight size={13} />
        </button>
      )}
    </section>
  );
}
