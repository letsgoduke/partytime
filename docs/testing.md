# Testing

Run `npm run check` before committing. It compiles strict TypeScript, creates the production bundle, runs Vitest/React Testing Library, and executes the migration plus PostgreSQL assertions.

Vitest covers financial totals, pending-versus-received accounting, sponsorship snapshots, RSVP/capacity transitions, quantity validation, three independent score systems and reversals, optional RSVP contributions, pledge editing, API ownership mapping, retry keys, draft preservation, invalid form data, and authentication failures.

Database tests create fresh schemas/roles/auth fixtures in PGlite with pgcrypto. They cover private data isolation, token validity/revocation, cross-party operations, direct table/helper access denial, atomic quantity/capacity checks, request replay with payload binding, verification, finalization, terminal state rules, proof-based profile linking, ledger immutability, reversals, score privacy, and verified-email requirements. See the SQL assertions for exact coverage. A single PGlite connection cannot prove behavior between two independent simultaneous connections.

`npm run test:e2e` runs Chromium browser interactions, screenshots and overflow assertions at 320, 360, 390, 430, and 768 pixels, reduced-motion settings, draft persistence, the full demo guest-to-host flow, keyboard dismissal, and axe serious/critical accessibility checks. Screenshots and failed traces appear in `test-results/` (gitignored).

`npm run test:contract` starts a separately configured client and intercepts only the AWS API endpoint with documented wire responses. It specifically verifies that guest records remain manageable and copying an invitation does not disclose the private management credential. This is a contract test, not a successful live integration.

Before live launch, run against a staging AWS stack and real Cognito email delivery: create/publish, open invitation in an isolated browser, RSVP, recover the private management link, claim the last item from two independent guest sessions simultaneously, retry a request after dropping its response, pledge, confirm receipt, attest/check in after the event starts, finalize after it ends, link accounts, request and administratively reverse a score, and verify another account cannot read any of those private records.

The GitHub Actions template is saved in `ci/github-actions-check.yml`; activation requires copying it to `.github/workflows/check.yml` with workflow-scoped GitHub authorization. It is a template, not an enabled CI check. The AWS Amplify pipeline independently runs `npm run check` on deployment.

`npm run test:backend` verifies the Lambda route allowlists, trusted Cognito claim checks, explicit origins, transaction-local roles/identity, and error redaction. Infrastructure has additional Python/cfn-lint checks documented in `docs/aws-infrastructure.md`.
