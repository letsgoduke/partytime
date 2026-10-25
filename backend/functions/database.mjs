import pg from "pg";
import { readFile } from "node:fs/promises";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
const secrets = new SecretsManagerClient({});
let pool;
let poolCreatedAt = 0;
export async function readSecret(arn) {
  if (!arn) throw new Error("Database secret ARN is required");
  const value = await secrets.send(
    new GetSecretValueCommand({ SecretId: arn }),
  );
  let secret;
  try {
    secret = JSON.parse(value.SecretString ?? "null");
  } catch {
    throw new Error("Database secret must contain valid JSON");
  }
  if (
    !secret ||
    typeof secret.username !== "string" ||
    typeof secret.password !== "string"
  )
    throw new Error("Invalid database secret");
  return secret;
}
export async function connectionOptions(secretArn = process.env.DB_SECRET_ARN) {
  const secret = await readSecret(secretArn);
  if (!process.env.DB_HOST || !process.env.DB_NAME)
    throw new Error("Database endpoint is required");
  const ca = await readFile(
    process.env.RDS_CA_PATH ?? "/var/runtime/ca-cert.pem",
    "utf8",
  );
  return {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME,
    user: secret.username,
    password: secret.password,
    ssl: { ca, rejectUnauthorized: true },
    connectionTimeoutMillis: 5000,
    query_timeout: 10000,
    application_name: "partytime-lambda",
  };
}
export async function getClient() {
  // Recreate periodically so rotated credentials replace old pools. One invocation per Lambda environment.
  if (!pool || Date.now() - poolCreatedAt > 300000) {
    if (pool) await pool.end();
    const options = await connectionOptions();
    if (options.user !== "partytime_runtime")
      throw new Error("Runtime must use the restricted database login");
    pool = new pg.Pool({ ...options, max: 2, idleTimeoutMillis: 30000 });
    pool.on("error", () => {
      /* No SQL, credentials, guest capabilities, or private payloads in logs. */
    });
    poolCreatedAt = Date.now();
  }
  return pool.connect();
}
