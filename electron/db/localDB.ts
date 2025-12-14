import type {
  LocalTables,
  RowOrDeleteOrUpdate,
  TableName,
  Tables,
  TablesDelete,
  TablesUpdate,
} from '../../tables';
import { db, getCachedStatement } from './database';
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

// Performance indexes for common queries
const PERFORMANCE_INDEXES: {
  table: string;
  columns: string[];
  name: string;
}[] = [
  // Customer searches by name
  { table: 'customers', columns: ['name'], name: 'idx_customers_name' },
  // Bills by customer and date
  {
    table: 'bills',
    columns: ['customer_id', 'deleted'],
    name: 'idx_bills_customer',
  },
  { table: 'bills', columns: ['date', 'company'], name: 'idx_bills_date' },
  {
    table: 'bills',
    columns: ['released', 'deleted'],
    name: 'idx_bills_released',
  },
  // Bill items lookup
  {
    table: 'bill_items',
    columns: ['serial', 'loan_no'],
    name: 'idx_bill_items_loan',
  },
  // Daily entries by date and company
  {
    table: 'daily_entries',
    columns: ['company', 'date', 'main_code'],
    name: 'idx_daily_entries_lookup',
  },
  // Releases lookup
  {
    table: 'releases',
    columns: ['serial', 'loan_no'],
    name: 'idx_releases_loan',
  },
  {
    table: 'releases',
    columns: ['company', 'date'],
    name: 'idx_releases_date',
  },
  // Products lookup for autocomplete
  {
    table: 'products',
    columns: ['metal_type', 'product_type'],
    name: 'idx_products_type',
  },
];

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

  // Create performance indexes
  for (const index of PERFORMANCE_INDEXES) {
    try {
      const indexExists = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`
        )
        .get(index.name);
      if (!indexExists) {
        db.exec(
          `CREATE INDEX IF NOT EXISTS ${index.name} ON ${index.table} (${index.columns.join(', ')})`
        );
        console.log(`📊 Created performance index: ${index.name}`);
      }
    } catch {
      // Index creation might fail if table doesn't exist yet
    }
  }

  // Run ANALYZE to update query planner statistics
  try {
    db.exec('ANALYZE');
    console.log('📈 Updated query planner statistics');
  } catch {
    // Ignore analyze errors
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

  const stmt = getCachedStatement(sql);
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

  getCachedStatement(sql).run(...whereValues);
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

  getCachedStatement(sql).run(...whereValues);
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

  const stmt = getCachedStatement(sql);
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

  const sql = `UPDATE ${table}
     SET synced  = 0,
         deleted = 1
     WHERE ${whereClauses}`;

  const stmt = getCachedStatement(sql);
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

  const sql = `UPDATE ${table}
     SET ${updateFields},
         synced = 0
     WHERE ${whereClauses}`;

  const stmt = getCachedStatement(sql);
  stmt.run(...updateValues, ...whereValues);
  return null;
}

export function executeSql(
  sql: string,
  params: unknown[] = [],
  justRun = false
): unknown[] | null {
  if (!db) return null;

  const stmt = getCachedStatement(sql);

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
    for (const { sql, params = [], justRun = false } of queries) {
      const stmt = getCachedStatement(sql);
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
