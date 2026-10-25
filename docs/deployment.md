# Deployment

## AWS hosting

The selected target is AWS. Follow [AWS Amplify setup](aws.md); the repo includes its build specification, security headers, and SPA rewrite rule. Supabase remains the backend.

## Other static hosts

Deploy this repository to Vercel or Netlify with build command `npm run build` and output directory `dist`. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build-time variables. Rebuild when those values change. Vercel SPA rewrites and security headers are in `vercel.json`; Netlify equivalents are in `public/_redirects` and `public/_headers`. Configure HTTPS and a real production domain before distributing invitations.

Do not deploy only a nested workspace parent: the project root is the `partytime` repository. Preview and production should use separate Supabase projects. Never apply disposable SQL fixtures to a real project.

## Supabase

Apply migrations, configure verified email OTP/magic links and SMTP, production Site URL, and exact callback URLs. Confirm PKCE with the same browser. Configure gateway/IP rate limiting and CAPTCHA; database capability throttling is not an ingress abuse-defense replacement. Failed SQL transactions roll back their rate counters. Database functions cannot reliably trust client-submitted IP addresses.

Provision an administrative process for score disputes. The browser cannot call `reverse_score`; an authenticated, audited administrative backend with the service-role credential must invoke it after reviewing evidence. Never put that key in a browser bundle or client environment variable.

## Launch gates requiring a configured project

- Real email delivery, callback session recovery, and successful host publication.
- Invitation deep links after a cold navigation; management-link recovery and proof-based linking.
- Cross-account/cross-party denial using actual Supabase roles and JWTs.
- Two independent connections racing for the final supply unit and final capacity slot.
- Dropped-response retry yielding one RSVP/pledge/score event.
- Real external payment URL usability; opening the URL must not confirm payment.
- Post-event attendance, fulfillment, finalization, score summaries, correction request and trusted reversal.
- Production headers, no-referrer behavior, secret scan, mobile review, backup/restore and logging redaction.

These are explicit launch requirements, not tests claimed to have been run without credentials. Local PostgreSQL and simulated HTTP tests reduce risk but do not replace them.

## Release and recovery

Run all local checks, deploy a preview, complete the staged acceptance flow, then promote that exact build. Keep the previous static deployment for rollback. Take a database backup before future migrations. Prefer additive follow-up migrations over editing an already-applied production migration. Keep score history append-only; corrections append reversals. Watch RPC errors, delivery failures and suspicious scoring without logging private invite or management tokens.
