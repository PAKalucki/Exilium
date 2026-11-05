import { DatabaseSync, backup } from 'node:sqlite';
import { existsSync, mkdirSync, renameSync, rmSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function snapshot(database, output) {
  if (!existsSync(database)) throw new Error('Source database does not exist');
  if (resolve(database) === resolve(output))
    throw new Error('Snapshot must not replace the source database');
  mkdirSync(dirname(output), { recursive: true, mode: 0o700 });
  const temporary = `${output}.${process.pid}.tmp`;
  let source;
  try {
    source = new DatabaseSync(database, { readOnly: true });
    await backup(source, temporary);
    const copy = new DatabaseSync(temporary);
    try {
      if (copy.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok')
        throw new Error('Snapshot integrity check failed');
      copy.exec('PRAGMA journal_mode=DELETE; DELETE FROM auth_sessions;');
    } finally {
      copy.close();
    }
    chmodSync(temporary, 0o600);
    renameSync(temporary, output);
  } finally {
    source?.close();
    rmSync(temporary, { force: true });
  }
  return output;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const database = process.env.DATABASE_PATH || './data/exilium.sqlite';
    const output = process.argv[2] || resolve(dirname(database), 'backups/latest.sqlite');
    await snapshot(database, output);
    console.log(JSON.stringify({ status: 'ok', snapshot: output, date: new Date().toISOString() }));
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  }
}
