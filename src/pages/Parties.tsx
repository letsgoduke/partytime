import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Plus, Users } from "lucide-react";
import { Shell } from "../components/Shell";
import { AuthPanel, useAuth } from "../components/AuthPanel";
import { Button } from "../components/ui/button";
import { callApi } from "../lib/api";
import { awsConfigured } from "../lib/aws-config";
interface Summary {
  id: string;
  title: string;
  startsAt: string;
  generalLocation: string;
  going: number;
  status: string;
}
export default function Parties() {
  const { userId, ready } = useAuth();
  const query = useQuery({
    queryKey: ["parties", userId],
    queryFn: () => callApi<{ parties: Summary[] }>("listParties", {}),
    enabled: !!userId,
  });
  return (
    <Shell>
      <section className="dashboard-page">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow pink-text">MAKE ROOM FOR YOUR PEOPLE</span>
            <h1>Your next good time.</h1>
            <p>Big celebrations. Little get-togethers. All yours.</p>
          </div>
          <Button asChild>
            <Link to="/create">
              <Plus size={16} /> Throw a party
            </Link>
          </Button>
        </div>
        {!awsConfigured ? (
          <div className="empty-state">
            <h2>Let’s get something on the calendar.</h2>
            <p>Explore the demo while live hosting is being configured.</p>
            <Link className="text-link" to="/host/demo">
              Manage the demo party <ArrowRight size={16} />
            </Link>
          </div>
        ) : !ready ? (
          <p className="loading">Checking your session…</p>
        ) : !userId ? (
          <AuthPanel />
        ) : query.isPending ? (
          <p className="loading">Finding your good times…</p>
        ) : query.isError ? (
          <p role="alert" className="error">
            {query.error.message}
          </p>
        ) : query.data?.parties.length ? (
          <div className="party-list">
            {query.data.parties.map((p) => (
              <Link
                to={`/host/${p.id}`}
                className="form-card party-list-card"
                key={p.id}
              >
                <div className="need-icon blue">
                  <CalendarDays />
                </div>
                <span className="status-badge">{p.status}</span>
                <h2>{p.title}</h2>
                <p>
                  {new Date(p.startsAt).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  · {p.generalLocation}
                </p>
                <span className="text-link">
                  <Users size={16} />
                  {p.going} coming <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h2>The first one is always special.</h2>
            <p>Create a party, send a link, and bring everyone together.</p>
            <Link to="/create" className="text-link">
              Plan your first party <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </section>
    </Shell>
  );
}
