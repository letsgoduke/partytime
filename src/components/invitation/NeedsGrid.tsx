import { ArrowUpRight, HandHeart, Heart, Plus } from "lucide-react";
import type { Need } from "../../lib/demo";

interface NeedsGridProps {
  needs: readonly Need[];
  busy: boolean;
  onClaim: (needId: string) => void;
  onChipIn: () => void;
}

export function NeedsGrid({ needs, busy, onClaim, onChipIn }: NeedsGridProps) {
  return (
    <section className="needs-section">
      <div className="section-heading">
        <div className="eyebrow">MANY HANDS, LIGHT WORK</div>
        <h2>A little help goes a long way.</h2>
        <p>Pick a way to pitch in. Or just bring yourself.</p>
      </div>
      <div className="need-grid">
        {needs.map((n) => (
          <article className="need-card" key={n.id}>
            <div
              className={`need-icon ${n.kind === "task" ? "lavender" : "blue"}`}
            >
              {n.kind === "task" ? (
                <HandHeart />
              ) : n.id === "ice" ? (
                <span>🧊</span>
              ) : (
                <span>🥤</span>
              )}
            </div>
            <span className="need-status">
              {n.quantity - n.claimed > 0
                ? `${n.quantity - n.claimed} ${n.kind === "task" ? "spot" : "needed"}${n.quantity - n.claimed > 1 && n.kind === "task" ? "s" : ""}`
                : "All covered ✓"}
            </span>
            <h3>{n.title}</h3>
            <p>{n.note}</p>
            <button
              disabled={busy || n.claimed >= n.quantity}
              onClick={() => onClaim(n.id)}
            >
              {n.claimed >= n.quantity
                ? "Thanks, team"
                : n.kind === "task"
                  ? "I can help"
                  : "I’ll bring this"}
              <Plus size={17} />
            </button>
          </article>
        ))}
        <article className="need-card dinner-card">
          <div className="need-icon pink">
            <Heart />
          </div>
          <span className="need-status">Every little bit helps</span>
          <h3>Dinner, on all of us</h3>
          <p>Good food tastes better together.</p>
          <button onClick={onChipIn}>
            Chip in a little
            <ArrowUpRight size={17} />
          </button>
        </article>
      </div>
    </section>
  );
}
