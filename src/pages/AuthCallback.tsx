import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { auth } from "../lib/auth";
import { Shell } from "../components/Shell";
// React StrictMode may run effects twice; redeem a one-use authorization code once.
const callbacks = new Map<string, Promise<string>>();
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const key = location.href;
    if (!callbacks.has(key)) callbacks.set(key, auth.completeSignIn());
    void callbacks
      .get(key)!
      .then((path) => {
        if (active) navigate(path, { replace: true });
      })
      .catch(() => {
        if (active)
          setError(
            "Sign-in could not be completed. Return to your saved draft and try again.",
          );
        history.replaceState(null, "", "/auth/callback");
      });
    return () => {
      active = false;
    };
  }, [navigate]);
  return (
    <Shell>
      <section className="loading">
        <h1>
          {error ? "Let’s try that sign-in again." : "Welcoming you back…"}
        </h1>
        {error && (
          <>
            <p role="alert" className="error">
              {error}
            </p>
            <Link className="text-link" to="/create">
              Return to my saved draft
            </Link>
          </>
        )}
      </section>
    </Shell>
  );
}
