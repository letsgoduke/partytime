# Architecture

## Boundaries

- `src/components/invitation/`: presentation for invitation details, needs, RSVP, funding, and host updates.
- `src/App.tsx`: invitation/guest interaction controller and private commitment management.
- `src/pages/`: lazy-loaded creation, host dashboard, party list, and profile routes.
- `src/components/AuthPanel.tsx`: passwordless authentication and session state.
- `src/lib/api.ts`: AWS HTTP API integration and explicit snake/wire-shape normalization; durable idempotency keys survive lost responses without persisting request bodies.
- `src/lib/demo.ts`: visibly labeled local demo, isolated from live database activity.
- `src/domain/`: pure financial/reliability/scoring rules and regression tests. These helpers are explanatory/testable business rules, never browser authority for real money or awards.
- `backend/database/migrations/`: authoritative authorization, transactions, accounting, score ledger, and cached summaries.
- `backend/database/tests/`: actual PostgreSQL regression assertions with isolated auth fixtures.

The API exposes separate `/guest` and JWT-authorized `/host` routes with fixed action allowlists. Lambda establishes a verified identity and restricted transaction role before invoking the action-dispatched PostgreSQL `party_api` function. Every action validates its own authority. Read paths explicitly shape responses; arbitrary table data is not returned to public invitation callers. RLS blocks direct sensitive table access and direct financial/score writes. Sensitive helpers have browser execution revoked.

## Credential and authorization flows

Host authentication uses Cognito managed email-code sign-in with authorization-code PKCE. Drafts live locally before sign-in. Auth callbacks never include guest capability fragments. Returning to an original management link proves control when linking guest activity to a verified profile. The original tab retains its credential in session storage; a new tab may require reopening that private link. Signing out clears query caches.

Invitation tokens grant only an event snapshot. Guest management tokens independently grant that guest's private snapshot and permitted mutations. Tokens are cryptographically random, stored hashed server-side, and revocable. Client storage retains credentials only for the current browser session. URLs must never enter analytics or error logs. No third-party analytics are installed. A no-referrer policy prevents token-bearing routes from leaking to external image/payment hosts.

Party locks serialize capacity, funding snapshots, and finalization; need locks serialize remaining quantity. Capabilities are revalidated after lock acquisition. Mutation idempotency records bind action and request digest to an encrypted replay response. The client reuses a pending request key after an uncertain network response. Database unique constraints provide a second integrity boundary.

## Money and scoring

All money uses integer cents. Monetary pledges and actual receipts have separate states. Hosts verify receipts. Supply values and volunteer time affect verified generosity and hosting impact, not cash received. Remaining-balance sponsorship snapshots the gap in the transaction.

Scores are append-only evidence events produced by backend finalization. Reputation uses weighted verified fulfillment with decay and a confidence prior, rather than cumulative points. Prestige and Aura are separately computed. Summaries can be rebuilt; reversals retain original evidence. Only trusted administrators may append correction reversals. Hosts cannot submit totals or award themselves Aura. Unknown/unreviewed outcomes remain neutral.

## Performance and accessibility

Route splitting keeps creation/form dependencies out of first invitation navigation. The first cover has a reserved aspect/height and compressed remote image; other routes load on demand. Native HTML dialog provides focus containment and Escape dismissal. CSS handles safe areas, 320px layouts, reduced motion, keyboard focus, and contrast-safe text variants. Automated checks supplement visual review; they do not certify all assistive technology combinations.

The service worker never caches invitation responses, private addresses, or guest credentials. Offline synchronization is intentionally absent. Production hosts must apply security headers and serve SPA fallbacks for deep invitation links.

AWS infrastructure lives in `infrastructure/`. Normal API functions use a restricted, non-owner database login; the IAM-only migration function uses a separate owner secret. Neither database is publicly reachable. See the infrastructure guide for cost and deletion/retention boundaries.
