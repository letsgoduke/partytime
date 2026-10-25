/** IAM-only deployment task. Never expose this handler through API Gateway or a function URL. */
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { connectionOptions, readSecret } from './database.mjs';
export async function handler(event) {
  if (event?.confirm !== 'APPLY_DATABASE_MIGRATIONS') throw new Error('Explicit migration confirmation is required');
  const runtime = await readSecret(process.env.APP_DB_SECRET_ARN);
  if (runtime.username !== 'partytime_runtime' || runtime.password.length < 24) throw new Error('Restricted runtime secret is invalid');
  const client = new pg.Client({ ...await connectionOptions(), query_timeout: 60000 });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7241356201)');
    await client.query(await readFile(new URL('../database/bootstrap.sql', import.meta.url), 'utf8'));
    await client.query('CREATE TABLE IF NOT EXISTS public.schema_migrations(version text primary key, checksum text not null, applied_at timestamptz not null default now())');
    await client.query('REVOKE ALL ON public.schema_migrations FROM PUBLIC,app_guest,app_user');
    const version = '001_partytime';
    const sql = await readFile(new URL('../database/migrations/001_partytime.sql', import.meta.url), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const previous = await client.query('SELECT checksum FROM public.schema_migrations WHERE version=$1', [version]);
    if (previous.rowCount && previous.rows[0].checksum !== checksum) throw new Error('Applied migration changed; create a new migration instead');
    if (!previous.rowCount) {
      await client.query(sql);
      await client.query('INSERT INTO public.schema_migrations(version,checksum) VALUES($1,$2)', [version, checksum]);
    }
    await client.query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='partytime_runtime') THEN CREATE ROLE partytime_runtime LOGIN NOINHERIT; END IF; END $$");
    // PostgreSQL utility statements do not accept bind placeholders; server-side %L quotes the secret safely.
    const passwordSql = await client.query("SELECT format('ALTER ROLE partytime_runtime LOGIN NOINHERIT PASSWORD %L',$1::text) AS sql", [runtime.password]);
    await client.query(passwordSql.rows[0].sql);
    const attributes = await client.query("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls FROM pg_roles WHERE rolname='partytime_runtime'");
    if (Object.values(attributes.rows[0]).some(Boolean)) throw new Error('Runtime login has forbidden elevated attributes');
    await client.query('REVOKE ALL ON ALL TABLES IN SCHEMA public,identity FROM partytime_runtime');
    await client.query('GRANT app_guest,app_user TO partytime_runtime');
    await client.query('REVOKE app_admin FROM partytime_runtime');
    await client.query('GRANT USAGE ON SCHEMA identity TO partytime_runtime');
    await client.query('GRANT EXECUTE ON FUNCTION identity.bootstrap_user(uuid,text) TO partytime_runtime');
    await client.query('COMMIT');
    return { applied: !previous.rowCount, version };
  } catch (error) {
    await client.query('ROLLBACK');
    // Never log database exception detail: password SQL is deliberately kept out of application logs.
    throw new Error(`Database migration failed (${error.code ?? 'configuration'}). Review database schema and deployment configuration.`);
  } finally { await client.end(); }
}
