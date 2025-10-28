import type {
  LocalTables,
  RowOrDeleteOrUpdate,
  TableName,
  Tables,
} from '../../tables';
import { db } from './database';
import { TablesSQliteSchema } from '../../tableSchema';

export const tables: TableName[] = [
  'areas',
  'companies',
  'customers',
  'balances',
  'bills',
  'bill_items',
  'releases',
  'interest_rates',
  'products',
  'address_lines',
];

export function fetchUnsynced<K extends TableName>(
  table: K
): LocalTables<K>[] | null {
  return read<K>(table, { synced: 0 } as Partial<LocalTables<K>>);
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
    if (
      record[field as keyof RowOrDeleteOrUpdate<K>] === undefined ||
      record[field as keyof RowOrDeleteOrUpdate<K>] === null
    ) {
      throw new Error(`Missing required field "${String(field)}" in ${table}`);
    }
  }
}

export async function migrateSchema() {
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

export function create<K extends TableName>(
  table: K,
  record: Tables[K]['Row']
): null {
  if (!db) return null;

  validate(table, record);

  const keys = Object.keys(record);
  const values = Object.values(record);
  const placeholders = keys.map(() => '?').join(', ');

  const stmt = db.prepare(
    `INSERT INTO ${table} (${keys.join(', ')}, synced)
         VALUES (${placeholders}, 0)`
  );

  stmt.run(...values);

  return null;
}

export function markAsSynced<K extends TableName>(
  table: K,
  record: Tables[K]['Row']
): null {
  if (!db) return null;

  const pkFields = TablesSQliteSchema[table].primary;
  if (!pkFields) {
    throw new Error(`Primary key fields not defined for table ${table}`);
  }

  const whereClauses = pkFields.map((field) => `${field} = ?`).join(' AND ');
  const whereValues = pkFields.map(
    (field) => record[field as keyof Tables[K]['Row']]
  );

  const stmt = db.prepare(
    `UPDATE ${table}
         SET synced = 1
         WHERE ${whereClauses}`
  );

  stmt.run(...whereValues);
  return null;
}

export function read<K extends TableName>(
  table: K,
  conditions: Partial<LocalTables<K>>,
  fields: keyof LocalTables<K> | '*' = '*' // TODO: update return type based on the requested fields
): LocalTables<K>[] | null {
  if (!db) return null;
  const whereClauses = Object.keys(conditions)
    .map((field) => `${field} = ?`)
    .join(' AND ');
  // Convert boolean values to integers for SQLite
  const whereValues = Object.values(conditions).map((value) =>
    typeof value === 'boolean' ? (value ? 1 : 0) : value
  );
  const stmt = db.prepare(
    `SELECT ${String(fields)}
         FROM ${table}
         ${whereClauses.length ? `WHERE ${whereClauses}` : ''}`
  );

  return stmt.all(...whereValues) as LocalTables<K>[];
}

export function upsert<K extends TableName>(
  table: K,
  record: Tables[K]['Row']
): null {
  if (!db) return null;

  validate(table, record, true);

  const pkFields = TablesSQliteSchema[table].primary;
  if (!pkFields) {
    throw new Error(`Primary key fields not defined for table ${table}`);
  }

  const whereClauses = pkFields.map((field) => `${field} = ?`).join(' AND ');
  const whereValues = pkFields.map(
    (field) => record[field as keyof Tables[K]['Row']]
  );

  const existingStmt = db.prepare(
    `SELECT *
         FROM ${table}
         WHERE ${whereClauses}`
  );

  const existing = existingStmt.get(...whereValues);

  if (existing) {
    const updateFields = Object.keys(record)
      .filter((key) => !pkFields.includes(key))
      .map((key) => `${key} = ?`)
      .join(', ');
    const updateValues = Object.keys(record)
      .filter((key) => !pkFields.includes(key))
      .map((key) => record[key as keyof Tables[K]['Row']]);

    const updateStmt = db.prepare(
      `UPDATE ${table}
             SET ${updateFields},
                 synced = 0
             WHERE ${whereClauses}`
    );

    updateStmt.run(...updateValues, ...whereValues);
  } else {
    const keys = Object.keys(record);
    const values = Object.values(record);
    const placeholders = keys.map(() => '?').join(', ');

    const insertStmt = db.prepare(
      `INSERT INTO ${table} (${keys.join(', ')}, synced)
             VALUES (${placeholders}, 0)`
    );

    insertStmt.run(...values);
  }
  return null;
}

export function deleteRecord<K extends TableName>(
  table: K,
  record: Tables[K]['Delete']
): null {
  if (!db) return null;

  validate(table, record, true);

  const pkFields = TablesSQliteSchema[table].primary;
  if (!pkFields) {
    throw new Error(`Primary key fields not defined for table ${table}`);
  }

  const whereClauses = pkFields.map((field) => `${field} = ?`).join(' AND ');
  const whereValues = pkFields.map(
    (field) => record[field as keyof Tables[K]['Delete']]
  );

  const stmt = db.prepare(
    `DELETE
         FROM ${table}
         WHERE ${whereClauses}`
  );

  stmt.run(...whereValues);
  return null;
}

export function update<K extends TableName>(
  table: K,
  record: Tables[K]['Update']
): null {
  if (!db) return null;

  validate(table, record, true);

  const pkFields = TablesSQliteSchema[table].primary;
  if (!pkFields) {
    throw new Error(`Primary key fields not defined for table ${table}`);
  }

  const whereClauses = pkFields.map((field) => `${field} = ?`).join(' AND ');
  const whereValues = pkFields.map(
    (field) => record[field as keyof Tables[K]['Update']]
  );

  const updateFields = Object.keys(record)
    .filter((key) => !pkFields.includes(key))
    .map((key) => `${key} = ?`)
    .join(', ');
  const updateValues = Object.keys(record)
    .filter((key) => !pkFields.includes(key))
    .map((key) => record[key as keyof Tables[K]['Update']]);

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
