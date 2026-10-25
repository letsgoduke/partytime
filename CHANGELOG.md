# Product changes

## October 25, 2026 — AWS migration implemented, deployment pending

- Added Cognito email-code sign-in and separate guest/host API Gateway routes.
- Added Lambda handlers, private encrypted RDS, Secrets Manager credentials, and an IAM-only migration task.
- Ported database privacy/accounting/scoring rules to AWS identities.
- Removed the previous backend SDK and deployment files.
- Added short-lived host tokens, explicit development-origin controls, and private migration access.
- Added reproducible infrastructure checks and kept the commit history split by feature and fix.
- Preserve guest RSVPs without accounts, private management links, separate pledges/receipts, atomic item claims, and verified scoring.
- Add a plain-language project status page and smaller feature/fix commits.

Deployment is pending AWS account configuration and live acceptance tests.

## Initial app and security review

- Built mobile invitations, party creation, RSVP, supply/task claims, pledges, and host management.
- Added three separate score systems with verified evidence and correction records.
- Fixed private management links being copied by the invitation-share action.
- Fixed authentication/draft preservation and request-retry behavior.
- Added unit, component, database-security, mobile, and browser contract tests.
- Prepared frontend hosting assets and installation icons. No live backend was deployed.
