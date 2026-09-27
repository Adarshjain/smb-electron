import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TableName } from '../../tables';
import { TablesSQliteSchema } from '../../tableSchema';
import type {
  BackupVerifyProgress,
  BackupVerifyReport,
  VerifyRowDiff,
  VerifyTableReport,
} from '../../shared-types';
import { executeSql } from './localDB';

type Row = Record<string, unknown>;

const PAGE_SIZE = 1000;
// Cap on how many example rows per category are sent back to the UI.
const SAMPLE_LIMIT = 50;
const NULL_MARKER = '␀';
const FIELD_SEPARATOR = '\u001f';
const LOCAL_ONLY_COLUMNS = ['synced', 'deleted'];

interface TableShape {
  columns: string[];
  numeric: Set<string>;
  primary: string[];
}

function tableShape(table: TableName): TableShape {
  const schema = TablesSQliteSchema[table];
  const columns = Object.keys(schema.columns)
    .filter((c) => !LOCAL_ONLY_COLUMNS.includes(c))
    .sort();
  const numeric = new Set(
    columns.filter((c) =>
      /^(REAL|INTEGER|BOOLEAN)\b/i.test(schema.columns[c].schema)
    )
  );
  const primary = schema.primary.filter((c) => !LOCAL_ONLY_COLUMNS.includes(c));
  return { columns, numeric, primary };
}

// SQLite and Postgres return the same data in different shapes (0/1 vs
// true/false, numbers stored in TEXT columns, ...). Both sides are reduced to
// one string form before hashing so only real differences show up.
export function canonicalValue(value: unknown, numeric: boolean): string {
  if (value === null || value === undefined) return NULL_MARKER;
  // Database rows only ever hold scalars.
  const scalar = value as string | number | boolean;
  if (numeric) {
    const n = Number(scalar);
    return Number.isNaN(n) ? `NaN(${String(scalar)})` : String(n);
  }
  return String(scalar);
}

const sha256 = (input: string) =>
  createHash('sha256').update(input).digest('hex');

interface HashedRow {
  key: string;
  label: string;
  hash: string;
  row: Row;
}

function hashRows(rows: Row[], shape: TableShape): HashedRow[] {
  return rows.map((row) => ({
    key: shape.primary
      .map((c) => canonicalValue(row[c], shape.numeric.has(c)))
      .join(FIELD_SEPARATOR),
    label: shape.primary.map((c) => `${c}=${String(row[c])}`).join(', '),
    hash: sha256(
      shape.columns
        .map((c) => canonicalValue(row[c], shape.numeric.has(c)))
        .join(FIELD_SEPARATOR)
    ),
    row,
  }));
}

// Order-independent fingerprint of a whole table.
function tableHash(rows: HashedRow[]): string {
  return sha256(
    rows
      .map((r) => `${r.key}\u001e${r.hash}`)
      .sort()
      .join('\n')
  );
}

function indexByKey(rows: HashedRow[]) {
  const byKey = new Map<string, HashedRow>();
  let duplicates = 0;
  for (const r of rows) {
    if (byKey.has(r.key)) duplicates++;
    else byKey.set(r.key, r);
  }
  return { byKey, duplicates };
}

export function compareTable(
  table: TableName,
  localRows: Row[],
  remoteRows: Row[],
  pendingCount: number
): VerifyTableReport {
  const shape = tableShape(table);
  const local = hashRows(localRows, shape);
  const remote = hashRows(remoteRows, shape);
  const localIndex = indexByKey(local);
  const remoteIndex = indexByKey(remote);

  const missingRemoteColumns = remoteRows.length
    ? shape.columns.filter((c) => !(c in remoteRows[0]))
    : [];

  const missingOnSupabase: string[] = [];
  const different: VerifyRowDiff[] = [];
  for (const [key, l] of localIndex.byKey) {
    const r = remoteIndex.byKey.get(key);
    if (!r) {
      missingOnSupabase.push(l.label);
    } else if (r.hash !== l.hash) {
      different.push({
        key: l.label,
        columns: shape.columns
          .filter(
            (c) =>
              canonicalValue(l.row[c], shape.numeric.has(c)) !==
              canonicalValue(r.row[c], shape.numeric.has(c))
          )
          .map((c) => ({ column: c, local: l.row[c], remote: r.row[c] })),
      });
    }
  }
  const missingLocally = [...remoteIndex.byKey]
    .filter(([key]) => !localIndex.byKey.has(key))
    .map(([, r]) => r.label);

  const localHash = tableHash(local);
  const remoteHash = tableHash(remote);

  return {
    table,
    status: localHash === remoteHash ? 'match' : 'mismatch',
    localCount: localRows.length,
    remoteCount: remoteRows.length,
    pendingCount,
    localHash,
    remoteHash,
    missingOnSupabase: missingOnSupabase.length,
    missingLocally: missingLocally.length,
    different: different.length,
    duplicateLocalKeys: localIndex.duplicates,
    duplicateRemoteKeys: remoteIndex.duplicates,
    missingRemoteColumns,
    samples: {
      missingOnSupabase: missingOnSupabase.slice(0, SAMPLE_LIMIT),
      missingLocally: missingLocally.slice(0, SAMPLE_LIMIT),
      different: different.slice(0, SAMPLE_LIMIT),
    },
  };
}

// PostgREST caps each response (1000 rows by default), so page through the
// table in a stable order and check the total against an exact count.
async function fetchAllRemote(
  supabase: SupabaseClient,
  table: TableName,
  primary: string[]
): Promise<Row[]> {
  const { count, error: countError } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true });
  if (countError) throw countError;

  // Only order by key columns Supabase actually has, or the query fails.
  const probe = await supabase.from(table).select('*').limit(1);
  if (probe.error) throw probe.error;
  const present = probe.data.length ? Object.keys(probe.data[0] as Row) : [];
  const orderColumns = primary.filter((c) => present.includes(c));

  const rows: Row[] = [];
  for (;;) {
    let query = supabase.from(table).select('*');
    for (const column of orderColumns) {
      query = query.order(column, { ascending: true });
    }
    const { data, error } = await query.range(
      rows.length,
      rows.length + PAGE_SIZE - 1
    );
    if (error) throw error;
    if (!data.length) break;
    rows.push(...(data as Row[]));
  }

  if (count !== null && rows.length !== count) {
    throw new Error(
      `Fetched ${rows.length} rows but Supabase reports ${count}. The table may have changed during the check.`
    );
  }
  return rows;
}

function readLocal(table: TableName) {
  const rows = executeSql(`SELECT * FROM ${table} WHERE deleted IS NULL`);
  const pending = executeSql(
    `SELECT COUNT(*) AS n FROM ${table} WHERE synced = 0 OR deleted IS NOT NULL`
  ) as { n: number }[] | null;
  if (rows == null || pending == null) {
    throw new Error('Local database is not initialised');
  }
  return { rows: rows as Row[], pendingCount: pending[0].n };
}

const emptyReport = (table: TableName, error: string): VerifyTableReport => ({
  table,
  status: 'error',
  error,
  localCount: 0,
  remoteCount: 0,
  pendingCount: 0,
  localHash: '',
  remoteHash: '',
  missingOnSupabase: 0,
  missingLocally: 0,
  different: 0,
  duplicateLocalKeys: 0,
  duplicateRemoteKeys: 0,
  missingRemoteColumns: [],
  samples: { missingOnSupabase: [], missingLocally: [], different: [] },
});

// Backs up pending changes, then hashes every table on both sides and diffs
// them. Read-only apart from the backup step.
export async function verifyBackup(
  sync: { client: SupabaseClient; pushAll: () => Promise<void> },
  tables: TableName[],
  onProgress: (progress: BackupVerifyProgress) => void
): Promise<BackupVerifyReport> {
  const startedAt = new Date().toISOString();

  onProgress({ step: 'backup' });
  let backup: BackupVerifyReport['backup'] = { ok: true };
  try {
    await sync.pushAll();
  } catch (error) {
    backup = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const reports: VerifyTableReport[] = [];
  for (const [index, table] of tables.entries()) {
    onProgress({ step: 'table', table, index, total: tables.length });
    try {
      const remoteRows = await fetchAllRemote(
        sync.client,
        table,
        tableShape(table).primary
      );
      // Read local right after the remote fetch to keep the window in which
      // new entries could make the two sides differ as small as possible.
      const { rows, pendingCount } = readLocal(table);
      reports.push(compareTable(table, rows, remoteRows, pendingCount));
    } catch (error) {
      reports.push(
        emptyReport(
          table,
          error instanceof Error
            ? error.message
            : typeof error === 'object' && error && 'message' in error
              ? String(error.message)
              : String(error)
        )
      );
    }
  }

  return {
    startedAt,
    finishedAt: new Date().toISOString(),
    backup,
    tables: reports,
    inSync: reports.every((r) => r.status === 'match'),
  };
}
