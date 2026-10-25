// Fail the hosting build instead of accidentally publishing demo mode or private keys.
const required = [
  "VITE_AWS_API_URL",
  "VITE_AWS_REGION",
  "VITE_COGNITO_USER_POOL_ID",
  "VITE_COGNITO_CLIENT_ID",
  "VITE_COGNITO_DOMAIN",
];
function fail(message) {
  console.error(message);
  process.exit(1);
}
for (const name of required)
  if (!process.env[name])
    fail(`Set ${name} from the AWS infrastructure stack outputs.`);
for (const name of Object.keys(process.env))
  if (
    /^VITE_.*(?:SECRET|PASSWORD|PRIVATE_KEY|ACCESS_KEY|SERVICE_ROLE)/i.test(
      name,
    )
  )
    fail("Private credentials must never be exposed through VITE_ variables.");
for (const name of ["VITE_AWS_API_URL", "VITE_COGNITO_DOMAIN"]) {
  try {
    const url = new URL(process.env[name]);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      fail(
        `${name} must be an HTTPS URL without credentials, query, or fragment.`,
      );
    if (name === "VITE_COGNITO_DOMAIN" && url.pathname !== "/")
      fail("VITE_COGNITO_DOMAIN must be an origin without a path.");
  } catch {
    fail(`${name} must be a valid HTTPS URL.`);
  }
}
const region = process.env.VITE_AWS_REGION;
if (!/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(region))
  fail("VITE_AWS_REGION is not a valid AWS region identifier.");
if (!process.env.VITE_COGNITO_USER_POOL_ID.startsWith(region + "_"))
  fail("Cognito user pool and AWS region must match.");
if (!/^[a-zA-Z0-9]+$/.test(process.env.VITE_COGNITO_CLIENT_ID))
  fail(
    "Cognito client ID must be a public app-client identifier, not a secret.",
  );
console.log(
  "AWS frontend configuration validated. No private credentials printed.",
);
