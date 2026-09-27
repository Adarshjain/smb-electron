import type {
  LocalTables,
  RowOrDeleteOrUpdate,
  TableName,
  Tables,
  TablesDelete,
  TablesUpdate,
} from '../../tables';
import { db } from './database';
import { TablesSQliteSchema } from '../../tableSchema';

export const tables: TableName[] = [
  'areas',
  'companies',
  'customers',
  'daily_entries',
  'account_head',
  'bills',
  'bill_items',
  'releases',
  'interest_rates',
  'products',
];

export function fetchUnsynced<K extends TableName>(
  table: K
): LocalTables<K>[] | null {
  return executeSql(
    `SELECT *
     from ${table}
     where synced = 0
        OR deleted IS NOT NULL`
  ) as LocalTables<K>[] | null;
}

export function validate<K extends TableName>(
  table: K,
  record: RowOrDeleteOrUpdate<K>,
  byPrimaryKey = false
) {
  const required =
    TablesSQliteSchema[table][byPrimaryKey ? 'primary' : 'requiredFields'];
  if (!required) return;
  for (const field of required) {
    if (field === 'deleted') {
      continue;
    }
    if (
      record[field as keyof RowOrDeleteOrUpdate<K>] === undefined ||
      record[field as keyof RowOrDeleteOrUpdate<K>] === null
    ) {
      throw new Error(`Missing required field "${String(field)}" in ${table}`);
    }
  }
}

export function migrateSchema() {
  if (!db) {
    return null;
  }
  for (const table of Object.values(TablesSQliteSchema)) {
    const { name, columns, unique } = table;
    const columnDefs = Object.entries(columns)
      .map(([col, def]) => `${col} ${def.schema}`)
      .join(', ');

    const exists = db
      .prepare(
        `SELECT name
         FROM sqlite_master
         WHERE type = 'table'
           AND name = ?`
      )
      .get(name);

    if (exists === undefined) {
      const createSQL = `CREATE TABLE ${name}
                         (
                           ${columnDefs}${unique ? `, UNIQUE(${unique.join(', ')})` : ''}
                         );`;
      db.exec(createSQL);
      continue;
    }

    const pragma = db.pragma(`table_info(${name})`) as {
      cid: number;
      name: string;
      type: string;
      notnull: number;
      dflt_value: null;
      pk: number;
    }[];
    const existingCols = pragma.map((row) => row.name);

    for (const [colName, colDef] of Object.entries(columns)) {
      if (!existingCols.includes(colName)) {
        db.exec(`ALTER TABLE ${name}
          ADD COLUMN ${colName} ${colDef.schema}`);
        console.log(`➕ Added column '${colName}' to '${name}'`);
      }
    }

    if (unique && unique.length > 0) {
      const indexName = `${name}_unique_${unique.join('_')}`;
      const indexExists = db
        .prepare(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'index'
             AND name = ?`
        )
        .get(indexName);
      if (indexExists === undefined) {
        db.exec(
          `CREATE UNIQUE INDEX ${indexName} ON ${name} (${unique.join(', ')});`
        );
        console.log(
          `🔒 Added unique constraint on ${name}(${unique.join(', ')})`
        );
      }
    }
  }

  ensureLiveKeyIndexes();
}

// The UNIQUE(..., deleted) constraints never stopped two live copies of a
// record: SQLite treats every NULL as distinct, and live rows have
// deleted = NULL. Two live copies make Supabase reject the table's whole
// backup batch and make the record impossible to delete, so each table gets
// a unique index over its key for live rows only.
//
// Exact duplicates already in the table (release F1871 got saved twice) are
// removed first, keeping the oldest copy and queueing it for upload. If
// copies with the same key differ, nothing is removed and the index is left
// out for that table, since picking the right copy needs a person.
function ensureLiveKeyIndexes() {
  if (!db) return;
  const localDb = db;
  const indexes = Object.values(TablesSQliteSchema).map((table) => ({
    table: table.name,
    name: `${table.name}_live_key`,
    columns: table.primary.filter((c) => c !== 'deleted'),
    dataColumns: Object.keys(table.columns).filter(
      (c) => c !== 'synced' && c !== 'deleted'
    ),
  }));
  // sort_order is unique per pair across the whole table, not just per day.
  indexes.push({
    table: 'daily_entries',
    name: 'daily_entries_live_unique',
    columns: ['sort_order', 'main_code', 'sub_code'],
    dataColumns: [],
  });

  for (const index of indexes) {
    const exists = localDb
      .prepare(`SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?`)
      .get(index.name);
    if (exists) continue;

    try {
      localDb.transaction(() => {
        if (index.dataColumns.length) {
          const sameData = index.dataColumns.join(', ');
          const kept = localDb
            .prepare(
              `UPDATE ${index.table}
               SET synced = 0
               WHERE rowid IN (SELECT MIN(rowid)
                               FROM ${index.table}
                               WHERE deleted IS NULL
                               GROUP BY ${sameData}
                               HAVING COUNT(*) > 1)`
            )
            .run().changes;
          if (kept) {
            const { changes } = localDb
              .prepare(
                `DELETE
                 FROM ${index.table}
                 WHERE deleted IS NULL
                   AND rowid NOT IN (SELECT MIN(rowid)
                                     FROM ${index.table}
                                     WHERE deleted IS NULL
                                     GROUP BY ${sameData})`
              )
              .run();
            console.log(
              `Removed ${changes} exact duplicate row(s) from ${index.table}`
            );
          }
        }
        localDb.exec(
          `CREATE UNIQUE INDEX ${index.name}
           ON ${index.table} (${index.columns.join(', ')})
           WHERE deleted IS NULL`
        );
      })();
    } catch (error) {
      console.error(
        `Could not add ${index.name}: ${index.table} has live rows that share a key but differ.`,
        error
      );
    }
  }
}

export function create<K extends TableName>(table: K, record: Tables[K]): null {
  if (!db) return null;

  validate(table, record);

  const keys = Object.keys(record);
  const values = Object.values(record);
  const placeholders = keys.map(() => '?').join(', ');

  const sql = `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}, synced, deleted)
     VALUES (${placeholders}, 0, NULL)`;

  const stmt = db.prepare(sql);
  stmt.run(...values);

  return null;
}

export function createMultiple<K extends TableName>(
  table: K,
  records: Tables[K][]
): null {
  if (!db || !records.length) return null;

  for (const record of records) {
    validate(table, record);
  }

  // Assume all records have same keys (should be consistent schema)
  const keys = Object.keys(records[0]);
  const placeholders = `(${keys.map(() => '?').join(', ')}, 0, NULL)`;

  const values: (string | number | null)[] = [];
  for (const record of records) {
    values.push(...Object.values(record));
  }

  // Build the SQL with multiple value groups
  const sql = `
    INSERT INTO ${table} (${keys.join(', ')}, synced, deleted)
    VALUES ${records.map(() => placeholders).join(', ')}
  `;

  const stmt = db.prepare(sql);
  stmt.run(...values);

  return null;
}

export function createBatched<K extends TableName>(
  table: K,
  records: Tables[K][]
): void {
  if (!db || !records.length) return;

  const cols = Object.keys(records[0]).length;
  const MAX_VARS = 900;
  const BATCH_SIZE = Math.floor(MAX_VARS / cols);

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    createMultiple(table, batch);
  }
}

export interface DailyEntryPair {
  main_code: number;
  sub_code: number;
  credit: number;
  debit: number;
  description: string | null;
}

// Highest daily_entries sort_order on Supabase, refreshed by the sync. If the
// local database is ever replaced by an older copy, its MAX falls behind
// Supabase's, and reusing those numbers leaves the old Supabase rows behind
// next to the new ones.
let remoteSortOrderFloor = 0;

export function setRemoteSortOrderFloor(value: number) {
  remoteSortOrderFloor = value;
}

// Inserts each input as a main + inverted pair, sharing one sort_order.
// sort_order is globally unique across the whole table — one sort_order = one
// pair (2 rows). Computes the next sort_order from the global MAX, local or
// Supabase's, inside the same transaction as the inserts. better-sqlite3
// transactions serialize, so concurrent callers cannot race on the MAX read.
export function createDailyEntries(
  date: string,
  company: string,
  pairs: DailyEntryPair[]
): null {
  if (!db || !pairs.length) return null;

  const insertSql = `INSERT INTO daily_entries
      (date, company, main_code, sub_code, credit, debit, description, sort_order, synced, deleted)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`;

  const transaction = db.transaction(() => {
    if (!db) return;
    const row = db
      .prepare(`SELECT COALESCE(MAX(sort_order), 0) AS max FROM daily_entries`)
      .get() as { max: number };
    let next = Math.max(row.max, remoteSortOrderFloor) + 1;

    const insert = db.prepare(insertSql);
    for (const p of pairs) {
      insert.run(
        date,
        company,
        p.main_code,
        p.sub_code,
        p.credit,
        p.debit,
        p.description,
        next
      );
      insert.run(
        date,
        company,
        p.sub_code,
        p.main_code,
        p.debit,
        p.credit,
        p.description,
        next
      );
      next += 1;
    }
  });

  transaction();
  return null;
}

// Rewrites one main + inverted pair in place, keeping its sort_order so the
// entry stays where it was in the day's list. The account (sub_code) is part
// of the key, so changing it can't be an UPDATE: Supabase would keep the row
// under the old key. Instead the old pair is tombstoned and the new pair
// inserted under the same sort_order, and the next backup deletes the old
// key and uploads the new one.
export function updateDailyEntry(
  date: string,
  company: string,
  sort_order: number,
  old_sub_code: number,
  pair: DailyEntryPair
): null {
  if (!db) return null;
  const { main_code, sub_code, credit, debit, description } = pair;

  db.transaction(() => {
    if (!db) return;

    if (sub_code !== old_sub_code) {
      for (const [main, sub] of [
        [main_code, old_sub_code],
        [old_sub_code, main_code],
      ]) {
        deleteRecord('daily_entries', {
          date,
          company,
          main_code: main,
          sub_code: sub,
          sort_order,
        });
      }
      const insert = db.prepare(`INSERT INTO daily_entries
        (date, company, main_code, sub_code, credit, debit, description, sort_order, synced, deleted)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`);
      insert.run(
        date,
        company,
        main_code,
        sub_code,
        credit,
        debit,
        description,
        sort_order
      );
      insert.run(
        date,
        company,
        sub_code,
        main_code,
        debit,
        credit,
        description,
        sort_order
      );
      return;
    }

    const updateRow = db.prepare(`UPDATE daily_entries
      SET credit      = ?,
          debit       = ?,
          description = ?,
          synced      = 0
      WHERE date = ?
        AND company = ?
        AND main_code = ?
        AND sub_code = ?
        AND sort_order = ?
        AND deleted IS NULL`);
    for (const [main, sub, cr, dr] of [
      [main_code, sub_code, credit, debit],
      [sub_code, main_code, debit, credit],
    ]) {
      const { changes } = updateRow.run(
        cr,
        dr,
        description,
        date,
        company,
        main,
        sub,
        sort_order
      );
      if (changes !== 1) {
        throw new Error(
          `Entry ${sort_order} (${main} → ${sub}) on ${date} not found`
        );
      }
    }
  })();

  return null;
}

// Marks all records as synced in one transaction with a single prepared
// statement, instead of one auto-committed UPDATE per record.
export function markAsSynced<K extends TableName>(
  table: K,
  records: LocalTables<K>[]
): null {
  if (!db || !records.length) return null;

  const pkFields = TablesSQliteSchema[table].primary.filter(
    (key) => key !== 'deleted'
  );
  if (!pkFields) {
    throw new Error(`Primary key fields not defined for table ${table}`);
  }

  const whereClauses = pkFields.map((field) => `${field} = ?`).join(' AND ');
  const stmt = db.prepare(`UPDATE ${table}
     SET synced = 1
     WHERE ${whereClauses}`);

  db.transaction(() => {
    for (const record of records) {
      stmt.run(
        ...pkFields.map((field) => record[field as keyof LocalTables<K>])
      );
    }
  })();
  return null;
}

export function deleteSynced<K extends TableName>(
  table: K,
  record: LocalTables<K>
): null {
  if (!db) return null;

  const pkFields = TablesSQliteSchema[table].primary.filter(
    (key) => key !== 'deleted'
  );
  if (!pkFields) {
    throw new Error(`Primary key fields not defined for table ${table}`);
  }

  const whereClauses = pkFields.map((field) => `${field} = ?`).join(' AND ');
  const whereValues = pkFields.map(
    (field) => record[field as keyof LocalTables<K>]
  );

  const sql = `DELETE
     from ${table}
     WHERE ${whereClauses} AND deleted IS NOT NULL`;

  db.prepare(sql).run(...whereValues);
  return null;
}

export function read<K extends TableName>(
  table: K,
  conditions: Partial<LocalTables<K>>,
  fields: keyof LocalTables<K> | '*' = '*',
  isLikeQuery = false,
  includeDeleted = true
): LocalTables<K>[] | null {
  if (!db) return null;

  const [whereClauses, whereValues] = Object.entries(conditions).reduce<
    [string[], (string | number | boolean)[]]
  >(
    (
      [clauses, values],
      [field, value]: [string, string | number | boolean]
    ) => {
      clauses.push(`${field} ${isLikeQuery ? 'LIKE' : '='} ?`);
      values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
      return [clauses, values];
    },
    [[], []]
  );

  if (includeDeleted) {
    whereClauses.push('deleted IS NULL');
  }

  const whereClause = whereClauses.join(' AND ');

  const sql = `SELECT ${String(fields)}
     FROM ${table} ${whereClauses.length ? `WHERE ${whereClause}` : ''}`;

  const stmt = db.prepare(sql);
  return stmt.all(...whereValues) as LocalTables<K>[];
}

export function deleteRecord<K extends TableName>(
  table: K,
  record: TablesDelete[K]
): null {
  if (!db) return null;

  const recordKeys = Object.keys(record);
  const pkFields = TablesSQliteSchema[table].primary.filter(
    (key) => key !== 'deleted' && recordKeys.includes(key)
  );

  if (!pkFields) {
    throw new Error(`Primary key fields not defined for table ${table}`);
  }

  const whereClause = pkFields.map((f) => `${f} = ?`).join(' AND ');
  const whereValues = pkFields.map(
    (field) => record[field as keyof TablesDelete[K]]
  );

  // A row that was edited since the last backup is also synced = 0, so
  // synced = 0 can't tell us the row never reached Supabase. Always leave a
  // tombstone for the next backup to delete; deleting a key Supabase never
  // had is a no-op there. The one exception is a live row whose key already
  // has a tombstone (deleted, re-created, deleted again before a backup): the
  // existing tombstone already covers Supabase, so the row goes outright.
  const fullKey = TablesSQliteSchema[table].primary.filter(
    (key) => key !== 'deleted'
  );
  const sameKey = fullKey.map((f) => `t.${f} = ${table}.${f}`).join(' AND ');

  const transaction = db.transaction(() => {
    if (!db) return null;

    const live = db
      .prepare(
        `SELECT 1 FROM ${table} WHERE ${whereClause} AND deleted IS NULL`
      )
      .get(...whereValues);

    if (!live) {
      throw new Error(`Record not found in table ${table}`);
    }

    db.prepare(
      `DELETE
       FROM ${table}
       WHERE ${whereClause}
         AND deleted IS NULL
         AND EXISTS (SELECT 1
                     FROM ${table} AS t
                     WHERE t.deleted IS NOT NULL
                       AND ${sameKey})`
    ).run(...whereValues);

    db.prepare(
      `UPDATE ${table}
       SET synced  = 0,
           deleted = 1
       WHERE ${whereClause}
         AND deleted IS NULL`
    ).run(...whereValues);
  });

  transaction();

  return null;
}

export function update<K extends TableName>(
  table: K,
  record: TablesUpdate[K]
): null {
  if (!db) return null;

  validate(table, record, true);

  const pkFields = TablesSQliteSchema[table].primary.filter(
    (key) => key !== 'deleted'
  );
  if (!pkFields) {
    throw new Error(`Primary key fields not defined for table ${table}`);
  }

  const whereClauses = pkFields.map((field) => `${field} = ?`).join(' AND ');
  const whereValues = pkFields.map(
    (field) => record[field as keyof TablesUpdate[K]]
  );

  const updateFields = Object.keys(record)
    .filter((key) => !pkFields.includes(key))
    .map((key) => `${key} = ?`)
    .join(', ');
  const updateValues = Object.keys(record)
    .filter((key) => !pkFields.includes(key))
    .map((key) => record[key as keyof TablesUpdate[K]]);

  // Live rows only: a tombstone is waiting to be deleted on Supabase, and
  // editing it would make an edit of a deleted record look like it worked.
  const sql = `UPDATE ${table}
     SET ${updateFields},
         synced = 0
     WHERE ${whereClauses}
       AND deleted IS NULL`;

  const stmt = db.prepare(sql);
  const { changes } = stmt.run(...updateValues, ...whereValues);
  if (changes === 0) {
    throw new Error(`Record not found in table ${table}`);
  }
  return null;
}

// Writes the release and marks its bill released in one transaction, so a
// release can never be saved for a loan that doesn't exist.
export function releaseLoan(release: Tables['releases']): null {
  if (!db) return null;

  db.transaction(() => {
    if (!db) return;
    const bill = db
      .prepare(
        `SELECT released FROM bills
         WHERE serial = ? AND loan_no = ? AND deleted IS NULL`
      )
      .get(release.serial, release.loan_no) as { released: 0 | 1 } | undefined;
    if (!bill) {
      throw new Error(
        `Loan ${release.serial}${release.loan_no} does not exist`
      );
    }
    if (bill.released) {
      throw new Error(
        `Loan ${release.serial}${release.loan_no} is already released`
      );
    }
    create('releases', release);
    update('bills', {
      serial: release.serial,
      loan_no: release.loan_no,
      released: 1,
    });
  })();

  return null;
}

// Undoes releaseLoan: removes the release and marks the bill active again.
export function unreleaseLoan(serial: string, loan_no: number): null {
  if (!db) return null;

  db.transaction(() => {
    deleteRecord('releases', { serial, loan_no });
    update('bills', { serial, loan_no, released: 0 });
  })();

  return null;
}

export function executeSql(
  sql: string,
  params: unknown[] = [],
  justRun = false
): unknown[] | null {
  if (!db) return null;

  const stmt = db.prepare(sql);

  if (justRun) {
    stmt.run(...params);
    return null;
  }

  return stmt.all(...params);
}

// Batch execute multiple queries in a transaction for better performance
export function executeBatch(
  queries: { sql: string; params?: unknown[]; justRun?: boolean }[]
): unknown[][] {
  if (!db) return [];

  const results: unknown[][] = [];

  const transaction = db.transaction(() => {
    if (!db) {
      return;
    }
    for (const { sql, params = [], justRun = false } of queries) {
      const stmt = db.prepare(sql);
      if (justRun) {
        stmt.run(...params);
        results.push([]);
      } else {
        results.push(stmt.all(...params));
      }
    }
  });

  transaction();
  return results;
}
