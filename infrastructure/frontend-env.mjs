/** Print only public Vite configuration from CloudFormation describe-stacks JSON on stdin. */
let input = "";
for await (const chunk of process.stdin) input += chunk;
try {
  const result = JSON.parse(input);
  const stack = result.Stacks?.[0];
  if (!stack || result.Stacks.length !== 1)
    throw new Error("Select exactly one deployed stack.");
  const outputs = Object.fromEntries(
    (stack.Outputs ?? []).map((output) => [
      output.OutputKey,
      output.OutputValue,
    ]),
  );
  const mapping = {
    VITE_AWS_API_URL: "ApiUrl",
    VITE_AWS_REGION: "AwsRegion",
    VITE_COGNITO_USER_POOL_ID: "CognitoUserPoolId",
    VITE_COGNITO_CLIENT_ID: "CognitoClientId",
    VITE_COGNITO_DOMAIN: "CognitoDomain",
  };
  const lines = Object.entries(mapping).map(([variable, output]) => {
    const value = outputs[output];
    if (typeof value !== "string" || !value || /[\r\n\s"'`$\\]/.test(value))
      throw new Error(`Missing or invalid public output: ${output}`);
    return `${variable}=${value}`;
  });
  process.stdout.write(lines.join("\n") + "\n");
} catch (error) {
  process.stderr.write(
    `Could not export frontend configuration: ${error.message}\n`,
  );
  process.exitCode = 1;
}
