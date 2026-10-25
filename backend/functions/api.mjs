import { createHandler } from './core.mjs';
import { getClient } from './database.mjs';
export const handler = createHandler({ getClient, config: {
  issuer: process.env.COGNITO_ISSUER,
  clientId: process.env.COGNITO_CLIENT_ID,
  origin: process.env.APP_ORIGIN,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').map(value => value.trim()).filter(Boolean),
} });
