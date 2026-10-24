import {
  ArrowUpRight,
  CalendarDays,
  Heart,
  MapPin,
  Music2,
  ShieldCheck,
  Utensils,
} from "lucide-react";
import type { Party } from "../../lib/demo";

interface PartyDetailsProps {
  party: Party;
  addressVisible: boolean;
  onCopyInvitation: () => void;
}

export function PartyDetails({
  party,
  addressVisible,
  onCopyInvitation,
}: PartyDetailsProps) {
  const date = new Date(`${party.date}T${party.time}`);
  return (
    <>
      <div className="party-title-row">
        <div>
          <div className="eyebrow pink-text">YOU’RE INVITED</div>
          <h1>{party.title}</h1>
          <p className="host-line">
            <span className="avatar small">A</span> Hosted with love by{" "}
            <strong>{party.hostName}</strong>
            <ShieldCheck size={17} />
          </p>
        </div>
        <button
          className="icon-button"
          aria-label="Copy invitation link"
          onClick={onCopyInvitation}
        >
          <ArrowUpRight />
        </button>
      </div>
      <div className="event-details">
        <div>
          <CalendarDays />
          <p>
            <strong>
              {date.toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </strong>
            <span>
              {date.toLocaleTimeString("en-US", {
                hour: "numeric",
                minute: "2-digit",
              })}{" "}
              · Come as you are
            </span>
          </p>
        </div>
        <div>
          <MapPin />
          <p>
            <strong>
              {addressVisible
                ? party.address || party.location
                : party.location}
            </strong>
            <span>
              {addressVisible
                ? "Your spot for a good night"
                : "Exact address shared after you RSVP"}
            </span>
          </p>
        </div>
      </div>
      <section className="about">
        <h2>A good night starts with good people.</h2>
        <p>{party.description}</p>
        <div className="tags">
          <span>
            <Utensils size={14} /> Dinner & drinks
          </span>
          <span>
            <Music2 size={14} /> Good tunes
          </span>
          <span>
            <Heart size={14} /> Zero pressure
          </span>
        </div>
      </section>
    </>
  );
}
