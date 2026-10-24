/** Executes PostgreSQL SQL assertions with pgcrypto, using isolated Supabase auth fixtures.
 * This verifies database behavior, not the hosted Auth service or multi-connection races.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
const database = new PGlite({ extensions: { pgcrypto } });
try {
  await database.exec(`
    create schema extensions;
    create schema auth;
    create role anon;
    create role authenticated;
    create role service_role;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
  `);
  await database.exec(await readFile(new URL('../migrations/202610240001_partytime.sql', import.meta.url), 'utf8'));
  console.log('PostgreSQL migration applied.');
  await database.exec(await readFile(new URL('./security.sql', import.meta.url), 'utf8'));
  console.log('Database integration, privacy, authorization, ledger, linking, and replay assertions passed.');
} finally {
  await database.close();
}
