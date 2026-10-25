/** Public identifiers only. Database passwords and AWS credentials never belong in Vite. */
export const awsConfig = {
  apiUrl: import.meta.env.VITE_AWS_API_URL?.replace(/\/$/, ""),
  region: import.meta.env.VITE_AWS_REGION,
  userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
  domain: import.meta.env.VITE_COGNITO_DOMAIN?.replace(/\/$/, ""),
};
export const awsConfigured = Object.values(awsConfig).every(Boolean);
export function cognitoIssuer() {
  return `https://cognito-idp.${awsConfig.region}.amazonaws.com/${awsConfig.userPoolId}`;
}
