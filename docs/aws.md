# AWS launch checklist

The entire production stack is AWS. Amplify serves the website; Cognito signs hosts in; API Gateway and Lambda handle secure requests; RDS PostgreSQL stores the data; Secrets Manager holds private database credentials.

## What is ready in the repository

- `infrastructure/template.yaml`: reviewable SAM/CloudFormation stack.
- `backend/`: API handlers, restricted database roles, versioned SQL, and an IAM-only migration task.
- `amplify.yml`: install, configuration validation, tests, and production build.
- `customHttp.yml`: security and privacy response headers.
- `deploy/aws/rewrites.json`: SPA routes, including `/auth/callback` and private invitations.
- `.env.example`: the five public frontend configuration values.

No AWS account connection or live deployment has been performed. AWS CLI/SAM setup, account access, region, origin/domain, email readiness, and an infrastructure cost review are still required.

## Deployment order

1. Choose the Amplify app's production origin (or your custom domain). Connect the AWS GitHub App to `letsgoduke/partytime` without sharing AWS keys or GitHub tokens in chat. The application root is the repository root.
2. Follow [the infrastructure guide](aws-infrastructure.md) to prepare a CloudFormation change set for that exact origin. Select a PostgreSQL minor actually available in your region. Review resource creation, IAM, retention, and recurring RDS/endpoint charges before executing it.
3. Invoke the IAM-only database migration function. Check its result; a successful Lambda Invoke HTTP status alone does not prove migration success.
4. Export the public stack outputs with `infrastructure/frontend-env.mjs`. Enter those five values into Amplify build variables, then rebuild. The deployment build fails if configuration is missing or private credentials appear in frontend variables.
5. Import `deploy/aws/rewrites.json` into Amplify's rewrites settings. Repository `customHttp.yml` applies headers. Verify cold invitation links, `/auth/callback`, icons, and the PWA manifest.
6. Exercise [the live acceptance checklist](deployment.md). Only then distribute real invitations.

For local development against a deployed development stack, explicitly enable `AllowLocalhost=true`. Production defaults to disallowing localhost in API CORS and Cognito callbacks. Never enable wildcard origins. Cognito uses managed email-code sign-in with authorization-code PKCE; private guest-link fragments never enter its callback URL.

The template enables retained private data and a long-lived database. Removing the stack does not automatically remove retained resources or stop all charges; use the decommission procedure in the infrastructure guide.

Official references: [AWS Vite hosting](https://docs.amplify.aws/gen1/javascript/deploy-and-host/frameworks/deploy-vite-site/), [SPA rewrites](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html), and [custom response headers](https://docs.aws.amazon.com/amplify/latest/userguide/setting-custom-headers.html).
