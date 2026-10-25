# AWS backend

The API runs as Node.js Lambda behind an HTTP API Gateway. PostgreSQL runs privately in RDS; Cognito supplies verified email identities. The schema retains the existing `party_api(action,payload)` transaction semantics, capability tokens, money accounting, RLS, immutable score ledger, and corrections.

## Runtime contract

- `POST /guest` accepts `{action,payload}` for invitation/RSVP and guest capability actions only. It never bootstraps an account, even if the request body contains identity fields.
- `POST /host` requires API Gateway's JWT authorizer configured with the Cognito issuer and app-client audience. The client sends a **Cognito ID token**. Lambda additionally requires `token_use=id`, matching issuer/audience, nonexpired claims, a UUID subject, and `email_verified=true`. Host actions and `linkGuest` are available here.
- Both return `{data: result}` or `{error:{message,retryable}}`. Database rows, statements, passwords, JWTs, private addresses, and guest capability tokens are not written to application logs.
- The handler trusts only `requestContext.authorizer.jwt.claims` produced by API Gateway. A function URL must not be enabled. Lambda invocation permission must be restricted to the intended API Gateway source ARN; do not grant unauthenticated direct invocation.

Every database call uses BEGIN, transaction-local role (`app_guest` or `app_user`), and transaction-local subject. Cognito's subject and confirmed email are copied to the private `identity.users` table through a narrowly granted bootstrap function before role switching. The runtime login has `NOINHERIT` and no table privileges, administration membership, schema ownership, or schema CREATE access. It cannot bootstrap identities after switching to a browser-equivalent role. Commit clears local role/identity; failures roll back and discard the connection.

Lambda does not accept score totals, payment confirmation, profile identity, or host ownership from public client fields. Guest management remains capability-based and does not require Cognito registration.

## Environment

| Variable | API Lambda | Migration Lambda |
| --- | --- | --- |
| `DB_HOST`, `DB_PORT` (5432), `DB_NAME` | Private RDS endpoint/database | Same |
| `DB_SECRET_ARN` | Secret containing restricted login `partytime_runtime` and password | RDS migration-owner secret |
| `APP_DB_SECRET_ARN` | Omit | Restricted runtime secret to provision |
| `RDS_CA_PATH` | `/var/runtime/ca-cert.pem` for Node22 ZIP Lambda | Same |
| `COGNITO_ISSUER` | Exact Cognito user-pool issuer URL | Omit |
| `COGNITO_CLIENT_ID` | SPA app client ID | Omit |
| `APP_ORIGIN` | Exact HTTPS frontend origin | Omit |
| `ALLOWED_ORIGINS` | Optional comma-separated exact origins; no wildcard | Omit |

Production permits only `APP_ORIGIN` by default. The infrastructure `AllowLocalhost` parameter defaults false; explicitly enabling it adds exactly `http://localhost:5173` to API CORS, Cognito callbacks/logout, and `ALLOWED_ORIGINS`. The Lambda reflects only a validated allowed Origin. Requests with no Origin are permitted for authenticated CLI/nonbrowser clients.

The database client reads the actual CA contents, enforces `rejectUnauthorized:true`, and verifies the RDS hostname. No plaintext or insecure TLS fallback exists. Secrets Manager supplies credentials; application code does not embed them. Runtime secrets are refreshed when the pool is recreated after five minutes. Each execution environment keeps at most two database connections. Configure Lambda reserved concurrency to bound total connections; consider RDS Proxy as traffic grows.

The Lambda security group may connect to RDS only on PostgreSQL's port. RDS must not be public. The private Lambda subnets need a Secrets Manager VPC endpoint (and its security group/DNS configuration) or appropriate NAT routing. Restrict `secretsmanager:GetSecretValue` to each function's required secret ARN; the API function must have no access to the migration-owner secret.

## Provision and migrate

1. Build with `npm ci --prefix backend`; SAM's Node builder packages `backend/` with its dependencies.
2. Deploy infrastructure from the repository's infrastructure directory following its deployment instructions. Keep the API function and migration function separate.
3. The runtime secret must contain `{ "username": "partytime_runtime", "password": "..." }`, with a generated password of at least 24 characters. The migration function uses the RDS owner's distinct secret.
4. Invoke the **IAM-only migration Lambda** with `{ "confirm": "APPLY_DATABASE_MIGRATIONS" }`. Its handler is `functions/migrate.handler`. It takes an advisory transaction lock, installs bootstrap roles/identity functions, applies unapplied versioned migrations, and provisions the restricted runtime login. Password literals are quoted by PostgreSQL `format(%L)`; they never appear in application logs.
5. Confirm its result reports `version: "001_partytime"`. Reinvoking is safe when the migration checksum matches. Editing an applied migration is rejected; add a new versioned migration for subsequent database changes and register it in the migration runner.
6. Test the real deployed API with a verified Cognito account, private invite, guest RSVP, claim, pledge, host confirmation, and completed-party recap. No cloud deployment or email delivery is implied by local tests.

`database/bootstrap.sql` and migration SQL require a migration owner able to create roles and the trusted `pgcrypto` extension. The runtime role never executes migrations. `app_admin` is reserved for audited administrative corrections; it is not granted to the runtime login. A trusted operator may call `reverse_score` through an administrative database session, never from the browser API.

## Verification

- `node backend/database/tests/run-security.mjs`: real PostgreSQL engine through PGlite/pgcrypto; SQL privacy, capacity, fulfillment, scoring, immutable reversals, account ownership, replay, confirmed-email, and runtime-role assertions.
- `npm test --prefix backend`: Lambda authorization, public-action whitelist, trusted claim checks, transaction role/context, rollback, response redaction, and request-boundary tests.
- These tests do not prove deployed Cognito email delivery, API Gateway signature verification, VPC routing, RDS certificate configuration, or a two-connection race. Those require AWS integration acceptance tests.

The SQL uses `FOR UPDATE` and revalidates capabilities after locking to prevent overclaims and stale token/account-link races. On a live database, issue simultaneous final-unit claims from two different guest tokens and assert exactly one succeeds. Repeat with concurrent token revocation/linking and confirm the serialized outcome.

API Gateway throttling is required. SQL limits count successful calls; failed transactions roll counters back, so they do not replace ingress throttling. Configure alerting and audit review for suspicious contribution values and account farming. External payment links remain manual payment instructions: opening a link never confirms payment.

## Primary references

[AWS HTTP API JWT authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-jwt-authorizer.html) documents claim validation and the trusted integration claim context. [AWS Lambda with RDS](https://docs.aws.amazon.com/lambda/latest/dg/services-rds.html) documents VPC connectivity, connection pooling, Secrets Manager, and Node.js RDS certificate handling.
