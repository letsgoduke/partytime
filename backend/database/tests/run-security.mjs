/** Executes PostgreSQL SQL assertions with pgcrypto, using isolated AWS request-context auth fixtures.
 * This verifies database behavior, not the hosted Auth service or multi-connection races.
 */
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
const database = new PGlite({ extensions: { pgcrypto } });
try {
  await database.exec(await readFile(new URL('../bootstrap.sql', import.meta.url), 'utf8'));
  await database.exec(await readFile(new URL('../migrations/001_partytime.sql', import.meta.url), 'utf8'));
  console.log('PostgreSQL migration applied.');
  await database.exec(await readFile(new URL('./security.sql', import.meta.url), 'utf8'));
  await database.exec(await readFile(new URL('./runtime.sql', import.meta.url), 'utf8'));
  console.log('Database integration, AWS runtime privileges, privacy, ledger, linking, and replay assertions passed.');
} catch (error) {
  console.error(error.message);
  if (error.where) console.error(error.where);
  process.exitCode = 1;
} finally {
  await database.close();
}
