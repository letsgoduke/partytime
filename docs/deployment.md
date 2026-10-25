# Release and deployment

See [the AWS launch checklist](aws.md) for deployment order and [the infrastructure guide](aws-infrastructure.md) for commands, privileges, costs, and retained resources.

## Gates before a real launch

These require an actual AWS deployment. They have not been claimed by local tests.

- Receive a real Cognito email code, complete sign-in, return to a saved draft, and publish a party.
- Load an invitation directly in an isolated browser, RSVP without signing up, save the private management link, and recover commitments through it.
- Confirm full addresses and guest records are unavailable without the appropriate credential.
- Race two independent guest sessions for the final item and final capacity slot; exactly one succeeds.
- Drop a response after a successful mutation, retry, and verify one RSVP/pledge/award exists.
- Confirm `/host` rejects missing, expired, wrong-issuer, wrong-audience, and unverified-email tokens.
- Confirm a guest cannot impersonate a host or access another party's commitments.
- Open the external payment link; funding must remain pending until the host confirms receipt.
- After the event, attest/check attendance, verify fulfillment, finalize, link prior guest participation, and review the three separate score systems.
- Submit a correction request and use an authorized administrator to append a reversal.
- Check deployed CSP/no-referrer headers, real mobile layouts, database backups, credential rotation, and logging redaction.

## Release procedure

Run `npm run check`, browser tests, and infrastructure validation. Deploy a staging stack, complete the acceptance flow, then promote the reviewed static build. The Amplify build performs build/unit/database/Lambda checks. The optional GitHub Actions template is not active until a workflow-authorized user installs it.

Keep the previous Amplify deployment for rollback. Back up the database before future migrations. Never edit an applied migration: append a versioned migration and register it with the migration task. Ledger corrections append reversals rather than deleting history. API request roles must never gain migration or administrative score privileges.

The stack retains the database, credentials, identity pool, and dependent private network on deletion; read the explicit cleanup procedure before removing resources. No live resources have been created during local implementation.
