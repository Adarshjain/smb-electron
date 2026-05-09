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

// Inserts each input as a main + inverted pair, sharing one sort_order.
// sort_order is globally unique across the whole table — one sort_order = one
// pair (2 rows). Computes the next sort_order from the global MAX inside the
// same transaction as the inserts. better-sqlite3 transactions serialize, so
// concurrent callers cannot race on the MAX read.
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
      .prepare(
        `SELECT COALESCE(MAX(sort_order), 0) AS max FROM daily_entries`
      )
      .get() as { max: number };
    let next = row.max + 1;

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

export function markAsSynced<K extends TableName>(
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

  const sql = `UPDATE ${table}
     SET synced = 1
     WHERE ${whereClauses}`;

  db.prepare(sql).run(...whereValues);
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

  const transaction = db.transaction(() => {
    if (!db) return null;

    const selectSql = `SELECT synced FROM ${table} WHERE ${whereClause}`;
    const existing = db.prepare(selectSql).get(...whereValues) as {
      synced: 0 | 1;
    } | null;

    if (!existing) {
      throw new Error(`Record not found in table ${table}`);
    }

    let sql: string;

    if (existing.synced === 0) {
      sql = `DELETE
             FROM ${table}
             WHERE ${whereClause}`;
    } else {
      sql = `UPDATE ${table}
             SET synced  = 0,
                 deleted = 1
             WHERE ${whereClause}`;
    }

    db.prepare(sql).run(...whereValues);
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

  const sql = `UPDATE ${table}
     SET ${updateFields},
         synced = 0
     WHERE ${whereClauses}`;

  const stmt = db.prepare(sql);
  stmt.run(...updateValues, ...whereValues);
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
