// The AWS pipeline must fail closed instead of accidentally publishing demo mode.
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
function fail(message) {
  console.error(message);
  process.exit(1);
}
if (!url || !key)
  fail(
    "Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in hosting build variables.",
  );
try {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password)
    fail("Use an HTTPS Supabase project URL without credentials.");
} catch {
  fail("VITE_SUPABASE_URL is not a valid URL.");
}
if (key.startsWith("sb_secret_"))
  fail("A secret/service-role key must never be used in the frontend.");
if (!key.startsWith("sb_publishable_")) {
  try {
    const payload = JSON.parse(
      Buffer.from(key.split(".")[1] || "", "base64url").toString(),
    );
    if (payload.role !== "anon")
      fail("The legacy frontend JWT must have the anon role.");
  } catch {
    fail("Use the Supabase publishable key or legacy anon JWT.");
  }
}
console.log("Frontend environment validated; no credentials printed.");
