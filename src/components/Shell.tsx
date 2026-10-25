import { Link, useLocation } from "react-router-dom";
import { ArrowUpRight, PartyPopper, Plus, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
export function Shell({
  children,
  demo = false,
}: {
  children: ReactNode;
  demo?: boolean;
}) {
  const location = useLocation();
  return (
    <>
      <header className="site-header">
        <Link className="brand" to="/">
          <span className="brand-mark">
            t<span>t</span>
          </span>
          together<span className="brand-dot">✳</span>
        </Link>
        <nav aria-label="Main navigation">
          <Link
            className={location.pathname.startsWith("/host") ? "active" : ""}
            to="/parties"
          >
            My parties
          </Link>
          <Link to="/profile">My profile</Link>
          <Link className="header-create" to="/create">
            <Plus size={17} /> Throw a party <ArrowUpRight size={16} />
          </Link>
          <Link className="avatar" to="/profile" aria-label="Your profile">
            A
          </Link>
        </nav>
      </header>
      {demo && (
        <div className="demo-banner">
          <Sparkles size={13} /> You’re exploring a demo party. Changes stay on
          this device.{" "}
          <Link to="/create">
            Create your own <ArrowUpRight size={12} />
          </Link>
        </div>
      )}
      <main>{children}</main>
      <footer>
        <Link className="footer-brand" to="/">
          <PartyPopper size={19} /> Good people. Better together.
        </Link>
        <span>Made for real life, outside the group chat.</span>
        <span>Everybody’s welcome. Always.</span>
      </footer>
    </>
  );
}
