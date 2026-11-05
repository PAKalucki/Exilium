import { DatabaseSync } from 'node:sqlite';
import { constants, copyFileSync, mkdirSync, existsSync, chmodSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

export function restore(input, destination) {
  if (!existsSync(input)) throw new Error('Snapshot does not exist');
  if ([destination, `${destination}-wal`, `${destination}-shm`].some(existsSync))
    throw new Error(
      'Restore requires an empty destination; stop the application and move its data directory aside first',
    );
  const source = new DatabaseSync(input, { readOnly: true });
  try {
    if (source.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
      throw new Error('Snapshot integrity check failed');
    const version = source
      .prepare('SELECT MAX(version) version FROM schema_migrations')
      .get().version;
    if (![1, 2, 3, 4, 5].includes(version)) throw new Error('Unsupported database schema');
    source.prepare('SELECT count(*) FROM characters').get();
  } finally {
    source.close();
  }
  mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
  copyFileSync(input, destination, constants.COPYFILE_EXCL);
  chmodSync(destination, 0o600);
  const copy = new DatabaseSync(destination);
  try {
    copy.exec('DELETE FROM auth_sessions;');
    if (copy.prepare("SELECT 1 FROM sqlite_master WHERE name='api_tokens'").get())
      copy.exec('DELETE FROM api_tokens;');
    if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
      throw new Error('Restored integrity check failed');
  } catch (e) {
    copy.close();
    rmSync(destination, { force: true });
    throw e;
  }
  copy.close();
  return destination;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (!process.argv[2] || !process.argv[3])
      throw new Error('Usage: node scripts/restore.mjs SNAPSHOT EMPTY_DESTINATION');
    console.log(
      JSON.stringify({ status: 'ok', database: restore(process.argv[2], process.argv[3]) }),
    );
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
