# AWS Amplify Hosting

The repository includes `amplify.yml`, `customHttp.yml`, and `deploy/aws/rewrites.json`. Amplify hosts the static frontend; Supabase remains the specified database/authentication backend. No AWS account credentials or resources are embedded in the repository.

## Connect and deploy

1. Sign in to your AWS account and open **Amplify → Create new app → GitHub**. Authorize the AWS GitHub App for `letsgoduke/partytime`, then select that repository and `main`. This account authorization must be performed by the account owner; do not send GitHub tokens or AWS secret keys in chat.
2. Keep the repository root as the app root. Amplify reads `amplify.yml`: Node 24, `npm ci`, environment validation, then the strict build and unit/database checks. Artifacts come from `dist`.
3. In build environment variables, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (Supabase publishable key or legacy anon JWT). The build intentionally fails if configuration is missing or if a secret/service-role key is supplied. These are frontend public configuration, not server credentials.
4. Save and deploy. Under **Hosting → Rewrites and redirects**, import the JSON rule from `deploy/aws/rewrites.json`. The rule returns `index.html` for application routes while preserving JS, CSS, icons, and the PWA manifest. Test a cold deep link such as `/invite/TOKEN`; loading the homepage alone is insufficient.
5. Repository `customHttp.yml` applies response headers. Check no-referrer and CSP headers on a real deployed invitation. If you use a custom Supabase domain, add that exact HTTPS/WSS origin to the `connect-src` allowlist before deploying.
6. Use the assigned `https://main.APP_ID.amplifyapp.com` address for staging, or add your domain through **Hosting → Custom domains**. Follow the DNS verification shown in your AWS account. Do not replace an existing production DNS record without reviewing its current use.
7. In Supabase Auth, set the Site URL to the actual frontend origin and add exact callback URLs for `/create`, `/profile`, `/parties`, `/manage`, and any host-dashboard callback you intend to use. Verify SMTP and email confirmation. Apply the database migration before using the app.
8. Complete the live launch gates in [deployment.md](deployment.md), then distribute invitations.

AWS CLI is not installed in the current workspace. No AWS resources have been created, no GitHub/AWS authorization has been performed, and no deployment is claimed. The repository configuration is ready for that connection.

Official references: [AWS Vite deployment guide](https://docs.amplify.aws/gen1/javascript/deploy-and-host/frameworks/deploy-vite-site/), [SPA rewrite rules](https://docs.aws.amazon.com/amplify/latest/userguide/redirect-rewrite-examples.html), and [custom HTTP headers](https://docs.aws.amazon.com/amplify/latest/userguide/setting-custom-headers.html).
