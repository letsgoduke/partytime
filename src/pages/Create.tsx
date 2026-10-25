import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Shell } from "../components/Shell";
import { Button } from "../components/ui/button";
import { callApi, supabase } from "../lib/api";
import type { Need } from "../lib/demo";
import { useAuth } from "../components/AuthPanel";

function optionalHttpsUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function validLocalDateTime(date: string, time: string): boolean {
  const value = new Date(`${date}T${time}`);
  return (
    Number.isFinite(value.getTime()) &&
    value.getFullYear() === Number(date.slice(0, 4)) &&
    value.getMonth() + 1 === Number(date.slice(5, 7)) &&
    value.getDate() === Number(date.slice(8, 10)) &&
    value.getHours() === Number(time.slice(0, 2)) &&
    value.getMinutes() === Number(time.slice(3, 5))
  );
}

const schema = z
  .object({
    hostName: z.string().trim().min(1, "Add your name.").max(80),
    endTime: z
      .string()
      .refine(
        (value) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value),
        "Choose a valid end time.",
      ),
    coverUrl: z
      .string()
      .refine(optionalHttpsUrl, "Cover photos need an HTTPS image URL."),
    title: z.string().trim().min(3, "Give your party a name.").max(120),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a valid date."),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Choose a valid time."),
    location: z.string().trim().min(2, "Add a general location.").max(150),
    address: z.string().trim().min(3, "Add the private address.").max(300),
    description: z.string().max(3000),
    budget: z
      .string()
      .refine(
        (v) =>
          /^\d+(\.\d{1,2})?$/.test(v) && Number(v) >= 0 && Number(v) <= 100000,
        "Use a budget from $0 to $100,000.",
      ),
    capacity: z
      .string()
      .refine(
        (v) =>
          !v ||
          (Number.isInteger(Number(v)) && Number(v) > 0 && Number(v) <= 10000),
        "Choose a capacity from 1 to 10,000.",
      ),
    paymentUrl: z
      .string()
      .refine(optionalHttpsUrl, "Payment links must start with https://"),
  })
  .superRefine((values, context) => {
    if (
      !validLocalDateTime(values.date, values.time) ||
      new Date(`${values.date}T${values.time}`).getTime() <= Date.now()
    )
      context.addIssue({
        code: "custom",
        path: ["date"],
        message: "Choose a valid future date and time for your party.",
      });
    if (values.endTime && values.endTime <= values.time)
      context.addIssue({
        code: "custom",
        path: ["endTime"],
        message: "End time must be after the start time on the same date.",
      });
  });
type Values = z.infer<typeof schema>;
const draftKey = "together-party-draft";
const defaults: Values = {
  hostName: "",
  endTime: "",
  coverUrl: "",
  title: "",
  date: "",
  time: "19:00",
  location: "",
  address: "",
  description: "",
  budget: "300",
  capacity: "",
  paymentUrl: "",
};
interface Draft {
  values: Values;
  needs: Need[];
}
const savedNeedSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(120),
  kind: z.enum(["item", "task"]),
  quantity: z.number().int().min(1).max(1000),
  claimed: z.literal(0),
  valueCents: z.number().int().min(0).max(1_000_000).optional(),
  note: z.string(),
});
function readDraft(): Draft {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(draftKey) || "null");
    if (!saved || typeof saved !== "object")
      return { values: defaults, needs: [] };
    const candidate = saved as {
      values?: Record<string, unknown>;
      needs?: unknown;
    };
    const values = Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        typeof candidate.values?.[key] === "string"
          ? candidate.values[key]
          : fallback,
      ]),
    ) as Values;
    const needs = z.array(savedNeedSchema).safeParse(candidate.needs);
    return { values, needs: needs.success ? needs.data : [] };
  } catch {
    return { values: defaults, needs: [] };
  }
}
export default function Create() {
  const navigate = useNavigate();
  const published = useRef(false);
  const [draft] = useState(readDraft);
  const [step, setStep] = useState(0);
  const [needs, setNeeds] = useState<Need[]>(draft.needs);
  const [email, setEmail] = useState("");
  const { userId } = useAuth();
  const signedIn = !!userId;
  const [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [needTitle, setNeedTitle] = useState("");
  const [needKind, setNeedKind] = useState<"item" | "task">("item");
  const [quantity, setQuantity] = useState("1");
  const [estimatedValue, setEstimatedValue] = useState("0");
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { ...defaults, ...draft.values },
  });
  const values = form.watch();
  useEffect(() => {
    if (published.current) return;
    try {
      localStorage.setItem(draftKey, JSON.stringify({ values, needs }));
      setStorageError("");
    } catch {
      setStorageError(
        "This browser could not save your draft. Keep this page open until publishing.",
      );
    }
  }, [values, needs]);
  async function signIn() {
    if (!supabase) {
      setMessage(
        "Live publishing needs Supabase. Your draft is saved; follow the setup instructions in README.md.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: `${location.origin}/create` },
      });
      if (error) throw error;
      setMessage(
        "Check your email for your sign-in link. Your draft is saved here.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not send your sign-in link. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function publish(v: Values) {
    setBusy(true);
    setMessage("");
    try {
      if (v.endTime && v.endTime <= v.time)
        throw new Error(
          "End time must be after the start time on the same date.",
        );
      if (
        !validLocalDateTime(v.date, v.time) ||
        new Date(`${v.date}T${v.time}`).getTime() <= Date.now()
      )
        throw new Error("Choose a future date and time for your party.");
      if (!signedIn)
        throw new Error(
          "Sign in by email before publishing. Your draft is saved.",
        );
      const result = await callApi<{ partyId: string; inviteToken: string }>(
        "createParty",
        {
          title: v.title,
          date: v.date,
          time: v.time,
          startsAt: new Date(`${v.date}T${v.time}`).toISOString(),
          generalLocation: v.location,
          hostName: v.hostName,
          coverUrl: v.coverUrl || null,
          endsAt: v.endTime
            ? new Date(`${v.date}T${v.endTime}`).toISOString()
            : null,
          address: v.address,
          description: v.description,
          budgetCents: Math.round(Number(v.budget) * 100),
          capacity: v.capacity ? Number(v.capacity) : null,
          paymentMethods: v.paymentUrl
            ? [{ label: "Pay your host", url: v.paymentUrl }]
            : [],
          needs: needs.map((n) => ({
            title: n.title,
            kind: n.kind,
            quantity: n.quantity,
            estimatedValueCents: n.valueCents || 0,
            minutesPerUnit: n.kind === "task" ? 30 : 0,
          })),
        },
      );
      published.current = true;
      try {
        localStorage.removeItem(draftKey);
      } catch {
        /* The created party must remain reachable even when storage is blocked. */
      }
      navigate(`/host/${result.partyId}`);
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "Could not publish. Your draft is saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  function addNeed() {
    const q = Number(quantity);
    if (!needTitle.trim() || !Number.isInteger(q) || q < 1 || q > 1000) {
      setMessage(
        "Add an item or task name and a whole quantity from 1 to 1,000.",
      );
      return;
    }
    if (
      needKind === "item" &&
      (!/^\d+(\.\d{1,2})?$/.test(estimatedValue) ||
        Number(estimatedValue) > 10000)
    ) {
      setMessage(
        "Use an estimated item value from $0 to $10,000, with no more than two decimal places.",
      );
      return;
    }
    setMessage("");
    setNeeds([
      ...needs,
      {
        id: crypto.randomUUID(),
        title: needTitle.trim(),
        kind: needKind,
        quantity: q,
        claimed: 0,
        valueCents:
          needKind === "item" ? Math.round(Number(estimatedValue) * 100) : 0,
        note:
          needKind === "task"
            ? "A little help from a friend"
            : "Thanks for bringing this",
      },
    ]);
    setNeedTitle("");
    setQuantity("1");
  }
  return (
    <Shell>
      <div className="create-page">
        {storageError && (
          <p className="error" role="alert">
            {storageError}
          </p>
        )}
        <Link className="back-link" to="/">
          <ArrowLeft size={16} /> Back to the good stuff
        </Link>
        <div className="eyebrow pink-text">A GOOD TIME STARTS WITH YOU</div>
        <h1>
          Make a little
          <br />
          <em>something happen.</em>
        </h1>
        <p className="intro">
          No occasion necessary. Just bring your people together.
        </p>
        <div className="steps">
          {["The plan", "A little help", "Make it official"].map((s, i) => (
            <button
              key={s}
              className={i === step ? "active" : ""}
              onClick={() => {
                if (i === 0) setStep(0);
                else
                  void form.trigger().then((ok) => {
                    if (ok) setStep(i);
                  });
              }}
            >
              <span>{i < step ? <Check size={14} /> : i + 1}</span>
              {s}
            </button>
          ))}
        </div>
        <form className="form-card" onSubmit={form.handleSubmit(publish)}>
          {step === 0 ? (
            <>
              <h2>What’s the plan?</h2>
              <label>
                Your name as host
                <input
                  {...form.register("hostName")}
                  placeholder="Alex Morgan"
                />
              </label>
              <label>
                Give it a name
                <input
                  {...form.register("title")}
                  placeholder="Friday at my place"
                  autoFocus
                />
              </label>
              <div className="form-grid">
                <label>
                  Date
                  <input
                    type="date"
                    {...form.register("date")}
                    min={new Date().toLocaleDateString("en-CA")}
                  />
                </label>
                <label>
                  Start time
                  <input type="time" {...form.register("time")} />
                </label>
              </div>
              <label>
                End time (optional, same day)
                <input type="time" {...form.register("endTime")} />
              </label>
              <label>
                Cover photo URL (optional)
                <input
                  type="url"
                  {...form.register("coverUrl")}
                  placeholder="https://your-image-host/photo.jpg"
                />
              </label>
              <label>
                Neighborhood or general location
                <input
                  {...form.register("location")}
                  placeholder="East Austin, TX"
                />
              </label>
              <label>
                Private street address
                <input
                  {...form.register("address")}
                  placeholder="Shared only with validated guests"
                />
              </label>
              <label>
                A little about the night
                <textarea
                  rows={3}
                  {...form.register("description")}
                  placeholder="The food, the mood, anything your friends should know…"
                />
              </label>
              <label>
                Guest capacity (optional)
                <input
                  type="number"
                  min="1"
                  {...form.register("capacity")}
                  placeholder="Room for everyone"
                />
              </label>
              <Button
                type="button"
                onClick={() =>
                  void form.trigger().then((ok) => {
                    if (ok) setStep(1);
                  })
                }
              >
                What do we need? <ArrowRight size={17} />
              </Button>
            </>
          ) : step === 1 ? (
            <>
              <h2>Many hands. Light work.</h2>
              <p>
                Money, supplies, or a helping hand. You decide what would help.
              </p>
              <label>
                Party budget ($)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  {...form.register("budget")}
                />
              </label>
              <label>
                Host-approved payment URL (optional)
                <input
                  type="url"
                  {...form.register("paymentUrl")}
                  placeholder="https://venmo.com/your-name"
                />
              </label>
              <p className="fine-print">
                Payments happen externally. You’ll confirm what you actually
                receive.
              </p>
              <div className="needs-editor">
                {needs.map((n) => (
                  <div className="manage-row" key={n.id}>
                    <span>
                      {n.quantity} × {n.title} <small>{n.kind}</small>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove ${n.title}`}
                      onClick={() =>
                        setNeeds(needs.filter((x) => x.id !== n.id))
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                <label>
                  What else would help?
                  <input
                    value={needTitle}
                    onChange={(e) => setNeedTitle(e.target.value)}
                    placeholder="Ice, cups, setup help…"
                    maxLength={120}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Type
                    <select
                      value={needKind}
                      onChange={(e) =>
                        setNeedKind(e.target.value as "item" | "task")
                      }
                    >
                      <option value="item">Bring an item</option>
                      <option value="task">Volunteer task</option>
                    </select>
                  </label>
                  <label>
                    Quantity / people
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </label>
                </div>
                {needKind === "item" && (
                  <label>
                    Estimated value per item ($)
                    <input
                      type="number"
                      min="0"
                      max="10000"
                      step="0.01"
                      value={estimatedValue}
                      onChange={(e) => setEstimatedValue(e.target.value)}
                    />
                  </label>
                )}
                <Button
                  variant="outline"
                  type="button"
                  onClick={addNeed}
                  disabled={!needTitle.trim()}
                >
                  <Plus size={17} /> Add to the list
                </Button>
              </div>
              <Button
                type="button"
                onClick={() =>
                  void form.trigger().then((ok) => {
                    if (ok) setStep(2);
                  })
                }
              >
                Looking good <ArrowRight size={17} />
              </Button>
            </>
          ) : (
            <>
              <Sparkles className="pink-text" />
              <h2>Almost party time.</h2>
              <div className="review">
                <h3>{values.title}</h3>
                <p>
                  {values.date} at {values.time} · {values.location}
                </p>
                <p>
                  {needs.length} needs · ${values.budget} budget
                </p>
              </div>
              <p>
                Sign in to keep your party safe and manage your guests. Your
                draft stays right here.
              </p>
              {!signedIn && (
                <>
                  <label>
                    Your email
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy || !email.includes("@")}
                    onClick={() => void signIn()}
                  >
                    Send me a sign-in link
                  </Button>
                </>
              )}
              <Button type="submit" disabled={busy || !signedIn}>
                {busy ? "Publishing…" : "Publish & invite my people"}
                <ArrowUpRightIcon />
              </Button>
              <p className="fine-print">
                Private by default. Your exact address is protected.
                Contributions are always optional.
              </p>
            </>
          )}
          {Object.entries(form.formState.errors).map(([field, error]) => (
            <p className="error" role="alert" key={field}>
              {error.message}
            </p>
          ))}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
        </form>
        <p className="draft-note">
          {storageError
            ? "Keep this page open to preserve your draft."
            : "✓ Your draft is automatically saved on this device."}
        </p>
      </div>
    </Shell>
  );
}
function ArrowUpRightIcon() {
  return <ArrowRight size={17} />;
}
