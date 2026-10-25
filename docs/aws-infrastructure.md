# AWS infrastructure

`infrastructure/template.yaml` is the AWS SAM deployment source. It provisions Cognito, HTTP API Gateway, Lambda, private RDS PostgreSQL, Secrets Manager, and logs. Amplify hosts the separate Vite frontend. No resources have been deployed by preparing these files. Deployment needs an AWS account, credentials, a reviewed change set, and a decision about ongoing charges.

## Architecture and security boundaries

Cognito Essentials uses verified email and the passwordless `EMAIL_OTP` first factor. Managed login version 2 and its default branding are attached to a public client without a secret. Only authorization-code OAuth is enabled; the frontend sends a fresh PKCE S256 challenge, validates state/nonce, and exchanges the code at `/auth/callback`. Production callbacks/logout URLs are explicitly registered. Setting `AllowLocalhost=true` additionally registers `http://localhost:5173` and enables that exact API CORS origin; the default keeps localhost disabled. Callback origins and API CORS origins must match the actual browser origin exactly. [AWS documents passwordless sign-in](https://docs.aws.amazon.com/cognito/latest/developerguide/authentication-flows-selection-managedlogin.html) and the [Essentials sign-in policy](https://docs.aws.amazon.com/AWSCloudFormation/latest/TemplateReference/aws-properties-cognito-userpool-signinpolicy.html).

`POST /host` requires an API Gateway JWT with the Cognito pool issuer and app client audience. Lambda additionally requires an ID token with verified email and obtains identity from Gateway's verified claims. The browser must never submit a user ID as authority. `POST /guest` deliberately has no JWT authorizer: invitation and guest-management capabilities are checked by the backend. Account linking uses `/host`. CORS is browser policy, not authorization. Both routes have aggregate rate/burst throttles; persistent application rate limits protect individual actions. An unauthenticated caller must never be able to select a host-only operation by changing the JSON action. [AWS SAM JWT authorizer reference](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/serverless-controlling-access-to-apis-oauth2-authorizer.html).

RDS is encrypted, has no public address, and occupies isolated subnets in two AZs. The only PostgreSQL ingress is TCP 5432 from the function security group. `rds.force_ssl=1` rejects unencrypted database sessions; backend TLS verifies the server certificate using `/var/runtime/ca-cert.pem`. Lambda's Node 22 runtime does not automatically load these additional roots, so the backend explicitly loads the CA file. [AWS CA loading guidance](https://docs.aws.amazon.com/lambda/latest/dg/lambda-nodejs.html).

There is no Internet Gateway or NAT Gateway. Functions can reach the database and a private Secrets Manager interface endpoint on port 443. The endpoint policy permits only reads of the two stack secrets. API invocation, API JWT verification, and Cognito browser login do not require Lambda internet access. Adding an external payment SDK or any other outbound service later requires a reviewed network change; opening a browser payment URL does not involve Lambda.

Request and migration functions use separate IAM roles. The request role can read only the generated runtime credential. The migration role can additionally read the RDS-managed master credential. IAM access is restricted to the account's resources; EC2 network-interface permissions require wildcard resource scope for Lambda VPC attachment. Logs have 14-day retention. API access logs omit bodies, headers, addresses, and tokens.

## Prepare and review a deployment

Use AWS CLI v2, current AWS SAM CLI, Node 22, and optionally `cfn-lint` in a tooling environment. Pick a commercial AWS region with at least two AZs and Cognito managed login support. Stack names must fit the explicit function names: use no more than 56 characters. Configure an AWS profile or SSO session; do not put AWS access keys or database secrets in `.env` or frontend configuration.

First verify the selected PostgreSQL minor exists in that region. There is no default: explicitly select a supported minor from the current [RDS release calendar](https://docs.aws.amazon.com/AmazonRDS/latest/PostgreSQLReleaseNotes/postgresql-release-calendar.html). Update the parameter when AWS retires that minor; the parameter group is PostgreSQL 16, so a major upgrade requires a reviewed parameter-group and database change.

```sh
aws rds describe-db-engine-versions --engine postgres --region us-east-1 --query "DBEngineVersions[?starts_with(EngineVersion, '16.')].EngineVersion"
npm ci --prefix backend
sam validate --lint --template-file infrastructure/template.yaml
sam build --template-file infrastructure/template.yaml
```

Choose an available, supported minor from the returned list. The deployment command below uses `16.15` as an example only; replace it with the selected version before preparing the change set. Review the generated artifact and SQL before uploading. For production, create/verify an SES sender identity in a Cognito-compatible region and move SES out of its sandbox. Pass `SesIdentityArn` and `SesFromAddress` together. Omitting these uses Cognito's limited default email service, suitable only for initial testing. [AWS email delivery setup](https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-email.html).

Create a change set for review, substituting the real origin and a regionally unique login domain prefix:

```sh
sam deploy --template-file .aws-sam/build/template.yaml --stack-name partytime-prod --region us-east-1 --resolve-s3 --capabilities CAPABILITY_IAM --parameter-overrides AppOrigin=https://your-app.amplifyapp.com CognitoDomainPrefix=your-unique-partytime-login DatabaseMultiAZ=true DatabaseEngineVersion=16.15 --no-execute-changeset
```

This command uploads artifacts and may create SAM's artifact bucket; it does not execute the application change set. Review changes, IAM, deletion behavior, and recurring costs in CloudFormation before explicitly executing the change set. Use production SES parameters in the real deployment. New accounts may need a Lambda concurrency quota increase: this stack reserves ten concurrent API executions and one migration execution, and AWS requires an unreserved account concurrency allowance. No AWS deployment was used as a substitute for local validation. For an isolated development stack, explicitly set `AllowLocalhost=true`; API CORS and the runtime `ALLOWED_ORIGINS` list then change together.

## Initialize the private database

Deploying the stack does **not** apply SQL. After the stack finishes, invoke the migration function with a reviewed AWS identity that has `lambda:InvokeFunction` on that specific function. The migration function has neither an API route nor a function URL. Its runtime payload cannot contain arbitrary SQL.

```sh
aws lambda invoke --function-name partytime-prod-migrate --region us-east-1 --cli-binary-format raw-in-base64-out --payload '{"confirm":"APPLY_DATABASE_MIGRATIONS"}' /tmp/partytime-migration-result.json
```

Inspect both CLI `FunctionError` and the result JSON; an HTTP 200 from Lambda's Invoke API alone does not prove successful migration. Expected output includes `version` and `applied`. Subsequent identical invocations are safe; a checksum mismatch blocks modifications to already-applied migration files. Add a new versioned migration for schema changes.

The function first applies `backend/database/bootstrap.sql`, then versioned application SQL. It provisions `partytime_runtime` from the generated app secret as `LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`. It grants membership only in `app_guest` and `app_user`, and the narrowly scoped identity-bootstrap function. It never grants `app_admin`. Requests use transactions with the relevant restricted role, allowing row-level policies and protected SQL operations to enforce access. The API role cannot retrieve the master password. See backend documentation for SQL ownership, grants, and application-level authorization.

Treat migration invocation as privileged deployment access; ordinary hosts and frontend build roles must not receive it. The app secret has no automatic password-rotation attachment. To rotate it, arrange the secret and database login update in a maintenance procedure, reapply provisioning through the migration function, and recycle request function environments so cached credentials refresh. RDS manages the separate master secret's rotation. Never print either secret into logs or shell history.

## Configure Amplify and verify real flows

The stack outputs public IDs/URLs only. Export the exact browser variables after successful deployment:

```sh
aws cloudformation describe-stacks --stack-name partytime-prod --region us-east-1 --output json | node infrastructure/frontend-env.mjs
```

Copy the six `VITE_` values into Amplify environment variables and rebuild. They are public configuration: `VITE_AWS_API_URL`, `VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_DOMAIN`. Keep API URL/domain values without trailing slashes. No database endpoint, secret ARN, password, or private AWS credential belongs in the browser. Amplify must rewrite `/auth/callback`, invitations, management links, and other SPA routes to `index.html`.

Before launch, exercise a real OTP login, party creation, private invitation, no-account RSVP, final-item concurrent claims, pending pledge, host-only payment confirmation, credential-based account linking, and finalization. Check that `/host` rejects no token/wrong issuer/wrong audience/unverified email and that guest requests cannot mutate another party. Live cloud smoke tests require the deployed resources and verified sender; local tests do not assert a deployment exists. Existing Supabase data is not automatically migrated by this stack.

## Costs, availability, and retention

This is not a scale-to-zero database architecture. RDS compute/storage and the two-AZ Secrets Manager interface endpoint incur recurring charges even without traffic. Single-AZ `db.t4g.micro` is the template's lower-cost testing default; production should explicitly choose Multi-AZ and an appropriate instance size after load testing. API Gateway, Lambda, CloudWatch, Secrets Manager, Cognito Essentials active users, SES email, backups beyond included allowances, and Amplify also have charges. There is no NAT Gateway charge in this design. Set AWS Budgets and check regional totals using [RDS pricing](https://aws.amazon.com/rds/postgresql/pricing/), [PrivateLink pricing](https://aws.amazon.com/privatelink/pricing/), [Cognito pricing](https://aws.amazon.com/cognito/pricing/), and the AWS Pricing Calculator before execution.

The database has seven-day automated backups, storage autoscaling up to 100 GiB, and deletion protection. The database, app secret, Cognito pool, and the network resources needed to keep the retained database private use `Retain` on deletion/replacement. Retained resources remain billable and require an explicit decommission plan: back up/export data, decide whether to retain identity, disable protection only when approved, then remove retained database/secrets/network in dependency order. Deleting the stack does not stop these costs or delete user data. Restores and major upgrades need a tested runbook; backups alone do not prove recovery.

## Local infrastructure checks

```sh
cfn-lint infrastructure/template.yaml
python3 -m unittest discover -s infrastructure/tests -v
```

These static checks validate CloudFormation/SAM syntax and guard private networking, IAM secret separation, passwordless login, JWT route policy, throttles, and retained data. They require `cfn-lint` installed in the local Python environment and do not call AWS. Real deployability still depends on account quotas, region/version availability, SES readiness, IAM deployment permissions, and review of the prepared change set.
