import { ArrowUpRight, Gem, Heart } from "lucide-react";
import { money } from "../../lib/demo";
import { Button } from "../ui/button";

interface FundingCardProps {
  budgetCents: number;
  confirmedCents: number;
  pendingCents: number;
  onChipIn: () => void;
  onCoverRemaining: () => void;
}

export function FundingCard({
  budgetCents,
  confirmedCents,
  pendingCents,
  onChipIn,
  onCoverRemaining,
}: FundingCardProps) {
  const funding = Math.min(
    100,
    (confirmedCents / Math.max(1, budgetCents)) * 100,
  );
  return (
    <section className="funding-card">
      <div className="funding-heading">
        <span className="need-icon pink">
          <Heart size={19} />
        </span>
        <h3>
          A party made possible,
          <br />
          together.
        </h3>
      </div>
      <div className="funding-total">
        <strong>{money(confirmedCents)}</strong>
        <span>of {money(budgetCents)} received</span>
        <span className="percent">{Math.round(funding)}%</span>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-label="Confirmed party funding"
        aria-valuenow={Math.round(funding)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span style={{ width: `${funding}%` }} />
      </div>
      <p>
        <strong>
          {money(Math.max(0, budgetCents - confirmedCents))} to go
        </strong>{" "}
        to make the whole night happen.
      </p>
      <Button variant="outline" onClick={onChipIn}>
        Chip in <ArrowUpRight size={16} />
      </Button>
      <button className="sponsor-link" onClick={onCoverRemaining}>
        <Gem size={14} /> Feeling generous? Cover the rest
      </button>
      <small>{money(pendingCents)} pledged · not yet received</small>
    </section>
  );
}
