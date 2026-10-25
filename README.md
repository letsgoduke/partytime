# Together · Partytime

**You host. Everyone helps. Everybody’s welcome.**

Mobile-first private party hosting, built with React, strict TypeScript, Vite, Tailwind, shadcn-style Radix components, Supabase, TanStack Query, React Hook Form, and Zod. This repository is `partytime`; the product name is **Together**.

## Run locally

Requires Node 22.12+ (Node 24 LTS recommended) and npm.

```sh
npm ci
cp .env.example .env
npm run dev
```

Open the local URL printed by Vite. Without Supabase variables, `/` is an explicitly labeled, browser-local demo. It includes RSVP, optional contributions, pledge editing/cancellation, supply/task claims, host receipt/fulfillment confirmation, and a demo recap. `/profile` shows a labeled sample profile. Demo data never enters a live account and never awards real scores. You can reset it by removing `together-demo-v1` from browser local storage.

## Connect the real backend

1. Create a Supabase project, enable confirmed email/passwordless sign-in, and configure SMTP.
2. Copy its project URL and **anon/publishable** key into `.env`:

   ```dotenv
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_KEY
   ```

3. Apply `supabase/migrations/202610240001_partytime.sql` using Supabase CLI (`supabase link --project-ref YOUR_REF`, then `supabase db push`) or the SQL editor on a new project. Never rerun an already-applied migration manually. For local Supabase, use `supabase start` and `supabase db reset` against a disposable local database.
4. Configure the Auth Site URL and exact allowed redirects (`http://localhost:5173/create`, `/profile`, `/parties`, `/manage`, and your host dashboard URL during local testing; corresponding HTTPS URLs in production). Avoid unrestricted production callback wildcards. PKCE sign-in needs the same browser that requested the link.
5. Restart Vite after changing environment variables. Create a future party at `/create`, sign in, publish, and share its invitation. The publish form preserves its draft while authentication completes.
6. Follow [deployment verification](docs/deployment.md) before accepting real guests.

**Never place a Supabase service-role key in a `VITE_` variable.** Public invitation URLs and private guest-management credentials are separate. The management credential is a 256-bit capability in a URL fragment; keep it private. The backend stores token hashes. Client-held invitation tokens are stored only for the current browser session. Hosts can regenerate a lost invitation; doing so invalidates the old invitation. Guest management links continue to work independently.

## Features and boundaries

Implemented: private invitations; email-link host authentication; draft preservation; party creation/editing/reuse; address privacy; capacity enforcement; anonymous-account RSVP; secure guest-management links; item/task claims with atomic quantity checks; pending money pledges and remaining-gap sponsorship snapshots; external host-approved HTTPS payment links; manual host payment/fulfillment confirmation; announcements; RSVP closure; cancellation/archive; attendance check-in and independent guest attestation; finalization; server-side Reputation/Prestige/Aura; immutable ledger, administrator reversals, correction requests, and credential-proven account linking.

Money stays in integer cents. Pending pledges do **not** become received funds when a payment link is opened. Supplies do **not** count toward cash funding. Unreviewed attendance or commitments do **not** create automatic penalties. Persistent scores require a verified account. Guest display names never establish identity.

This is a tested vertical slice, **not a claim that the entire original product roadmap is launched**. Deferred: uploaded photo storage (HTTPS photo URLs are supported), sponsor recognition and expense-specific sponsorship allocation, bulk verification UI, richer achievement/milestone automation, attendee-count privacy controls, public discovery, automatic payment verification, and automated fraud/dispute adjudication. Exact quantity claims currently use one unit per click; the server supports partial quantities. PWA metadata/icons are included; private data is never cached offline, and offline editing is not supported. A configured hosted project and real email delivery have not been exercised by local tests.

## Checks

```sh
npm run check            # strict TypeScript, production build, unit/component + PostgreSQL tests
npx playwright install chromium
npm run test:e2e         # demo browser flows, five mobile widths, keyboard and axe checks
npm run test:contract    # separate simulated PostgREST browser contract; no real Auth claimed
npm run format:check
```

Close any existing Vite instance on port 5173 before running `test:contract`, which starts a separate configured server. Tests do not require production credentials. The database runner uses PGlite, PostgreSQL compiled to WebAssembly, with pgcrypto and isolated Supabase auth fixtures. It validates real SQL authorization and accounting behavior, but not hosted Supabase services or simultaneous independent database connections.

For your AWS host, follow [AWS Amplify setup](docs/aws.md). The deployment pipeline refuses missing or unsafe frontend credentials.

The optional GitHub Actions template is in `ci/github-actions-check.yml`. To enable it, copy it into `.github/workflows/check.yml` using a GitHub credential with workflow permission. The current connected credential cannot publish workflow files; AWS Amplify runs the strict build/unit/database checks independently.

See [architecture](docs/architecture.md), [backend setup/API/security](docs/backend.md), [scoring](docs/scoring.md), [testing](docs/testing.md), and [deployment](docs/deployment.md).
