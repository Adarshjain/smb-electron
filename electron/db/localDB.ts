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
import { query } from '../../src/hooks/dbUtil';

export const tables: TableName[] = [
  'areas',
  'companies',
  'customers',
  'daily_balances',
  'bills',
  'bill_items',
  'releases',
  'interest_rates',
  'products',
];

export function fetchUnsynced<K extends TableName>(
  table: K
): Promise<LocalTables<K>[] | null> {
  return query<LocalTables<K>[] | null>(
    `SELECT *
     from ?
     where synced = 0
        OR deleted IS NOT NULL`,
    [table]
  );
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

  const doesExist = read(
    table,
    record as unknown as Partial<LocalTables<K>>,
    undefined,
    undefined,
    false
  );

  if (doesExist?.length) {
    update(table, { ...record, deleted: null, synced: 0 });
  } else {
    const keys = Object.keys(record);
    const values = Object.values(record);
    const placeholders = keys.map(() => '?').join(', ');

    const stmt = db.prepare(
      `INSERT INTO ${table} (${keys.join(', ')}, synced, deleted)
         VALUES (${placeholders}, 0, NULL)`
    );

    stmt.run(...values);
  }
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

  db.prepare(
    `UPDATE ${table}
         SET synced = 1
         WHERE ${whereClauses}`
  ).run(...whereValues);

  db.prepare(
    `DELETE
     from ${table}
     WHERE deleted IS NOT NULL`
  ).run();
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

  const stmt = db.prepare(
    `SELECT ${String(fields)}
         FROM ${table}
         ${whereClauses.length ? `WHERE ${whereClause}` : ''}`
  );

  return stmt.all(...whereValues) as LocalTables<K>[];
}

export function deleteRecord<K extends TableName>(
  table: K,
  record: TablesDelete[K]
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
    (field) => record[field as keyof TablesDelete[K]]
  );

  const stmt = db.prepare(
    `UPDATE ${table}
     SET synced = 0,
         deleted = 1
     WHERE ${whereClauses}`
  );

  stmt.run(...whereValues);
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

  const stmt = db.prepare(
    `UPDATE ${table}
         SET ${updateFields},
             synced = 0
         WHERE ${whereClauses}`
  );

  stmt.run(...updateValues, ...whereValues);
  return null;
}

export function executeSql(
  sql: string,
  params: unknown[] = [],
  justRun = false
): unknown[] | null {
  if (!db) return null;

  if (justRun) {
    db.prepare(sql).run(...params);
    return null;
  }

  const stmt = db.prepare(sql);
  return stmt.all(...params);
}
