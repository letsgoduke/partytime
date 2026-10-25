# Partytime: project status

## Current work: move the entire backend to AWS

The website is built. We are replacing the previous backend integration with AWS services, not just moving the website host.

| Part | AWS service | Status |
| --- | --- | --- |
| Website | Amplify Hosting | Build configuration exists; account not connected |
| Host sign-in | Cognito | Migration in progress |
| Secure requests | API Gateway + Lambda | Migration in progress |
| Parties, contributions, and scores | RDS PostgreSQL | Porting tested database rules |

**Nothing has been deployed to an AWS account yet.** Local tests do not prove a live deployment.

## Reading the history

Commits describe one feature or fix where practical. Titles say what changed for the product; bodies explain why and how it was checked. We do not label a service “live” just because its configuration is written.

See [CHANGELOG.md](CHANGELOG.md) for a plain-language feature history and [README.md](README.md) for setup instructions. Superseded setup instructions are being replaced as each AWS component lands.
