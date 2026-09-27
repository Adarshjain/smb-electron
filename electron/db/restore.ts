import type { SupabaseClient } from '@supabase/supabase-js';
import type { TableName } from '../../tables';
import type { RestoreProgress, RestoreReport } from '../../shared-types';
import { db } from './database';
import {
  compareTable,
  fetchAllRemote,
  readLocal,
  type Row,
  tableShape,
} from './verifyBackup';

// better-sqlite3 refuses JS booleans, which Supabase returns for BOOLEAN columns.
const toSqlite = (value: unknown) => {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return value;
};

function tablesWithRows(tables: TableName[]): TableName[] {
  return tables.filter(
    (table) =>
      (db?.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number })
        .n > 0
  );
}

function assertEmpty(tables: TableName[]) {
  const nonEmpty = tablesWithRows(tables);
  if (nonEmpty.length) {
    throw new Error(
      `Restore only runs on an empty database. These tables already have rows: ${nonEmpty.join(', ')}`
    );
  }
}

// Rebuilds an empty local database from Supabase: downloads every table,
// writes all of it in a single transaction (so a failure leaves the database
// untouched), then compares what was written with what was downloaded.
export async function restoreFromSupabase(
  supabase: SupabaseClient,
  tables: TableName[],
  onProgress: (progress: RestoreProgress) => void
): Promise<RestoreReport> {
  const database = db;
  if (!database) throw new Error('Local database is not initialised');

  onProgress({ step: 'check' });
  assertEmpty(tables);

  const downloaded = new Map<TableName, Row[]>();
  for (const [index, table] of tables.entries()) {
    onProgress({ step: 'download', table, index, total: tables.length });
    const { columns, primary } = tableShape(table);
    const rows = await fetchAllRemote(supabase, table, primary);
    const missing = rows.length ? columns.filter((c) => !(c in rows[0])) : [];
    if (missing.length) {
      throw new Error(
        `Supabase table ${table} has no ${missing.join(', ')} column(s). Fix the Supabase schema before restoring.`
      );
    }
    downloaded.set(table, rows);
  }

  onProgress({ step: 'write' });
  database.transaction(() => {
    // Downloading can take a while; make sure nothing was entered meanwhile.
    assertEmpty(tables);
    for (const [table, rows] of downloaded) {
      const { columns } = tableShape(table);
      const insert = database.prepare(
        `INSERT INTO ${table} (${columns.map((c) => `"${c}"`).join(', ')}, synced, deleted)
         VALUES (${columns.map(() => '?').join(', ')}, 1, NULL)`
      );
      for (const row of rows) {
        insert.run(...columns.map((c) => toSqlite(row[c])));
      }
    }
  })();

  onProgress({ step: 'verify' });
  const reports = tables.map((table) => {
    const { rows, pendingCount } = readLocal(table);
    return compareTable(table, rows, downloaded.get(table) ?? [], pendingCount);
  });

  return {
    rowsRestored: [...downloaded.values()].reduce((n, r) => n + r.length, 0),
    tables: reports,
    inSync: reports.every((r) => r.status === 'match'),
  };
}
