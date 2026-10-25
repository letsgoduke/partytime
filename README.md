# Partytime · Together

**You host. Everyone helps. Everybody’s welcome.**

A mobile-first app for private gatherings. Hosts make a plan and share one invitation. Guests RSVP without accounts, bring supplies, lend a hand, or pledge money. Showing up is enough; contributions are optional.

## Where the project stands

**The app is implemented and tested locally. It is not deployed to an AWS account yet.**

The backend now uses AWS throughout. There is no separate hosted-database service to sign up for.

| What it does                              | Where it runs            |
| ----------------------------------------- | ------------------------ |
| Website and mobile layouts                | AWS Amplify Hosting      |
| Host sign-in with email codes             | Amazon Cognito           |
| Secure guest and host requests            | API Gateway + AWS Lambda |
| Parties, RSVPs, money records, and scores | Amazon RDS PostgreSQL    |
| Private database credentials              | AWS Secrets Manager      |

Read [PROJECT_STATUS.md](PROJECT_STATUS.md) for current progress, [CHANGELOG.md](CHANGELOG.md) for the feature history, or the [GitHub commit history](https://github.com/letsgoduke/partytime/commits/main/) for individual changes and fixes.

## What works

- Create, edit, reuse, cancel, and archive parties; preserve a draft through sign-in.
- Share a private invitation; keep street addresses behind validated guest access.
- RSVP without an account and manage commitments with a private link.
- Claim items or volunteer tasks without exceeding available quantities.
- Pledge money, edit pending pledges, or cover the remaining funding gap.
- Let hosts confirm money actually received and commitments actually fulfilled.
- Check attendance, post updates, close RSVPs, and finalize a gathering.
- Calculate Reputation, Prestige, and Aura from verified evidence, with an immutable correction trail.
- Link past guest participation to a verified account by proving control of the original private credential.

A pledge is **not** a payment. Opening a payment link never marks money as received. Supplies never count twice as cash. Unreviewed commitments do not become automatic penalties.

## Try it locally

Requires Node 22.12+; Node 24 is recommended.

```sh
npm ci
npm ci --prefix backend
npm run dev
```

Open the URL printed by Vite. Without AWS configuration, the app explicitly labels its local demonstration data. Demo changes stay on this browser and do not award real scores. The app currently displays **Together** as its product name; renaming it is a separate decision.

## Put it on AWS

1. Review [the AWS deployment guide](docs/aws.md) and [infrastructure details](docs/aws-infrastructure.md).
2. Prepare an AWS change set for Cognito, Lambda, API Gateway, private RDS, and Secrets Manager. **Review the infrastructure and ongoing charges before executing it.** No cloud resources have been created here.
3. Invoke the private migration task with an authorized deployment identity.
4. Connect `letsgoduke/partytime` to Amplify. Copy the five public stack outputs into the build environment; `.env.example` lists their names.
5. Run the live acceptance checklist before inviting real guests.

There are no browser database passwords or AWS secret keys. Never put private credentials into `VITE_` variables. AWS setup needs account access, a domain/origin, available database capacity, and working Cognito email delivery. Local checks cannot prove these cloud services are live.

## Quality checks

```sh
npm run check            # production build, frontend tests, PostgreSQL security tests, Lambda tests
npm run test:e2e         # demo flows, five mobile widths, keyboard and accessibility checks
npm run test:contract    # simulated AWS HTTP responses; not a live AWS integration
npm run format:check
```

Install Chromium once with `npx playwright install chromium`. Stop any existing Vite process on port 5173 before `test:contract`. Database checks use a real PostgreSQL engine through PGlite without connecting to production. [Testing details](docs/testing.md) describe exact coverage and limits.

The Amplify build runs `npm run check`. An optional GitHub Actions template lives in `ci/github-actions-check.yml`; enabling it requires workflow-scoped GitHub authorization, which the currently connected credential does not have.

## Still on the roadmap

Photo uploads (HTTPS photo URLs already work), expense-specific sponsorship, public sponsor recognition, bulk verification, richer achievements, and attendee-count privacy controls remain deferred. Public discovery and automatic payment settlement are outside the current private-party release. PWA installation assets are included; private party information is never cached for offline editing.

Technical references: [architecture](docs/architecture.md), [API contract](docs/backend.md), [scoring](docs/scoring.md), [backend operations](backend/README.md).
