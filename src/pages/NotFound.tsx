import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Shell } from "../components/Shell";
import { Button } from "../components/ui/button";
export default function NotFound() {
  return (
    <Shell>
      <section className="loading">
        <span className="eyebrow pink-text">A LITTLE OFF THE BEATEN PATH</span>
        <h1>This isn’t where the party is.</h1>
        <p>Check your invitation link, or head back to your plans.</p>
        <Button asChild>
          <Link to="/parties">
            My parties <ArrowRight size={16} />
          </Link>
        </Button>
      </section>
    </Shell>
  );
}
