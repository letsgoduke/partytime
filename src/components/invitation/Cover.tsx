import { Music2 } from "lucide-react";

interface CoverProps {
  coverUrl?: string;
}

export function Cover({ coverUrl }: CoverProps) {
  return (
    <section
      className="cover"
      aria-label="A warmly lit dinner table ready for friends"
    >
      <img
        src={
          coverUrl ||
          "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1400&q=85"
        }
        alt="A beautiful table set for an evening together"
        fetchPriority="high"
      />
      <div className="cover-shade" />
      <span className="cover-pill">
        <span /> THE BEST PLANS ARE SIMPLE
      </span>
      <div className="cover-lettering">
        Good food.
        <br />
        Great company.
        <span>
          Nothing to celebrate.
          <br />
          Everything to look forward to.
        </span>
      </div>
      <span className="cover-star">✳</span>
      <div className="cover-bottom">
        <Music2 size={16} /> A seat at the table is all you need.
      </div>
    </section>
  );
}
