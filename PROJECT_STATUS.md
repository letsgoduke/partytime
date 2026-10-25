# Partytime: project status

## AWS migration: implementation complete, deployment pending

The website is built. The website and backend now target AWS. The code no longer needs a separate hosted-database account.

| Part                               | AWS service          | Status                                            |
| ---------------------------------- | -------------------- | ------------------------------------------------- |
| Website                            | Amplify Hosting      | Build configuration exists; account not connected |
| Host sign-in                       | Cognito              | Implemented; cloud verification pending           |
| Secure requests                    | API Gateway + Lambda | Implemented; cloud verification pending           |
| Parties, contributions, and scores | RDS PostgreSQL       | Ported and tested locally                         |

**Nothing has been deployed to an AWS account yet.** Local tests do not prove a live deployment.

## Reading the history

Commits describe one feature or fix where practical. Titles say what changed for the product; bodies explain why and how it was checked. We do not label a service “live” just because its configuration is written.

See [CHANGELOG.md](CHANGELOG.md) for a plain-language feature history and [README.md](README.md) for setup instructions. Superseded setup instructions are being replaced as each AWS component lands.

## What still prevents launch

Connect the AWS account/repository, choose the real frontend origin, review infrastructure charges, deploy the reviewed stack, initialize RDS, and complete live Cognito/API/concurrency acceptance tests. No AWS resources have been created. See [the launch checklist](docs/aws.md).
