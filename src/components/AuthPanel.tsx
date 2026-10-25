import { useEffect, useState } from "react";
import { Mail, ArrowRight } from "lucide-react";
import { auth } from "../lib/auth";
import { awsConfigured } from "../lib/aws-config";
import { Button } from "./ui/button";

export function useAuth() {
  const [ready, setReady] = useState(!awsConfigured);
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    if (!awsConfigured) return;
    let active = true;
    let receivedAuthEvent = false;
    const unsubscribe = auth.subscribe((_event, session) => {
      receivedAuthEvent = true;
      if (active) {
        setUserId(session?.userId || null);
        setReady(true);
      }
    });
    void auth
      .getSession()
      .then((session) => {
        if (active && !receivedAuthEvent) {
          setUserId(session?.userId || null);
          setReady(true);
        }
      })
      .catch(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);
  return { ready, userId };
}

export function AuthPanel() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!awsConfigured) {
      setMessage(
        "Live sign-in is not configured yet. Your demo remains available.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      // Private guest credentials stay on this device, outside the email redirect URL.
      await auth.signIn(email.trim(), location.pathname);
      setMessage(
        "Opening secure sign-in. Your plans stay saved on this device.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not send your link.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="form-card auth-panel">
      <Mail className="blue-text" />
      <h2>Your people. Your plans.</h2>
      <p>Continue to secure sign-in and receive a one-time email code.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label>
          Your email
          <input
            required
            type="email"
            maxLength={254}
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
          />
        </label>
        <Button disabled={busy} type="submit">
          {busy ? "Sending…" : "Continue with email"}
          <ArrowRight size={16} />
        </Button>
      </form>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
