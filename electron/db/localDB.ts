import {LocalTables, RowOrDeleteOrUpdate, TableNames, Tables} from "../../tables";
import {db} from "./database";

export const tables: (keyof Tables)[] = [
    'areas',
    'companies',
    'customers',
    'balances',
    'billings',
    'billing_items',
    'releases',
    'interest_rates',
    'products',
    'address_lines',
];

export const TablesSQliteSchema: Record<TableNames, {
    name: TableNames,
    columns: Record<string, string>,
    requiredFields: string[],
    unique?: string[],
    primary: string[],
}> = {
    areas: {
        name: "areas",
        columns: {
            name: "TEXT PRIMARY KEY UNIQUE",
            post: "TEXT",
            town: "TEXT",
            pincode: "TEXT",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: ["name"],
        primary: ["name"],
    },

    companies: {
        name: "companies",
        columns: {
            name: "TEXT PRIMARY KEY UNIQUE",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: ["name"],
        primary: ["name"],
    },

    products: {
        name: "products",
        columns: {
            name: "TEXT PRIMARY KEY",
            metal_type: "TEXT NOT NULL CHECK(metal_type IN ('Gold', 'Silver', 'Other'))",
            product_type: "TEXT NOT NULL CHECK(product_type IN ('product', 'quality', 'seal'))",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: ["name", "metal_type", "product_type"],
        primary: ["name"],
    },

    customers: {
        name: "customers",
        columns: {
            id: "TEXT PRIMARY KEY",
            address1: "TEXT",
            address2: "TEXT",
            area: "TEXT REFERENCES areas(name)",
            phone_no: "TEXT",
            fhtitle: "TEXT NOT NULL",
            fhname: "TEXT NOT NULL",
            name: "TEXT NOT NULL",
            id_proof: "TEXT",
            id_proof_value: "TEXT",
            door_no: "TEXT",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: ["id", "fhtitle", "fhname", "name"],
        primary: ["id"],
    },

    balances: {
        name: "balances",
        columns: {
            date: "TEXT NOT NULL",
            opening: "REAL NOT NULL",
            closing: "REAL NOT NULL",
            company: "TEXT REFERENCES companies(name)",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
            // Composite PK emulated by UNIQUE
        },
        requiredFields: ["date", "opening", "closing", "company"],
        unique: ["date", "company"],
        primary: ["date", "company"],
    },

    billings: {
        name: "billings",
        columns: {
            serial: "TEXT NOT NULL",
            loan_no: "INTEGER NOT NULL",
            date: "TEXT NOT NULL",
            customer_id: "TEXT REFERENCES customers(id)",
            loan_amount: "REAL NOT NULL",
            interest_rate: "REAL NOT NULL",
            first_month_interest: "REAL NOT NULL",
            doc_charges: "REAL NOT NULL",
            metal_type: "TEXT NOT NULL CHECK(metal_type IN ('Gold', 'Silver', 'Other'))",
            released: "BOOLEAN NOT NULL DEFAULT 0",
            company: "TEXT REFERENCES companies(name)",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
            // Composite primary key → emulate with UNIQUE
        },
        requiredFields: [
            "serial",
            "loan_no",
            "date",
            "loan_amount",
            "interest_rate",
            "first_month_interest",
            "doc_charges",
            "metal_type",
            "company",
        ],
        unique: ["serial", "loan_no"],
        primary: ["serial", "loan_no"],
    },

    billing_items: {
        name: "billing_items",
        columns: {
            serial: "TEXT NOT NULL",
            loan_no: "INTEGER NOT NULL",
            product: "TEXT NOT NULL REFERENCES products(name)",
            quality: "TEXT",
            extra: "TEXT",
            quantity: "INTEGER NOT NULL",
            gross_weight: "REAL NOT NULL",
            net_weight: "REAL NOT NULL",
            ignore_weight: "REAL NOT NULL",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: [
            "serial",
            "loan_no",
            "product",
            "quantity",
            "gross_weight",
            "net_weight",
            "ignore_weight",
        ],
        unique: ["serial", "loan_no"],
        primary: ["serial", "loan_no"],
    },

    releases: {
        name: "releases",
        columns: {
            serial: "TEXT NOT NULL",
            loan_no: "INTEGER NOT NULL",
            date: "TEXT NOT NULL",
            interest_amount: "REAL NOT NULL",
            total_amount: "REAL NOT NULL",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: ["serial", "loan_no", "date", "interest_amount", "total_amount"],
        unique: ["serial", "loan_no"],
        primary: ["serial", "loan_no"],
    },

    interest_rates: {
        name: "interest_rates",
        columns: {
            metal_type: "TEXT NOT NULL CHECK(metal_type IN ('Gold', 'Silver', 'Other'))",
            rate: "REAL NOT NULL",
            from_: "INTEGER NOT NULL",
            to_: "INTEGER NOT NULL",
            doc_charges: "REAL NOT NULL",
            doc_charges_type: "TEXT NOT NULL CHECK(doc_charges_type IN ('Fixed', 'Percentage'))",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: [
            "metal_type",
            "rate",
            "from_",
            "to_",
            "doc_charges",
            "doc_charges_type",
        ],
        unique: ["rate", "from_", "to_"],
        primary: ["rate", "from_", "to_"],
    },

    address_lines: {
        name: "address_lines",
        columns: {
            address: "TEXT PRIMARY KEY UNIQUE",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: ["address"],
        primary: ["address"],
    },
} as const;

export function fetchUnsynced<K extends TableNames>(table: K): LocalTables<K>[] | null {
    return read<K>(table, {synced: false} as Partial<LocalTables<K>>);
}

export function validate<K extends TableNames>(table: K, record: RowOrDeleteOrUpdate<K>, byPrimaryKey = false) {
    const required = TablesSQliteSchema[table][byPrimaryKey ? 'primary' : 'requiredFields'];
    if (!required) return;
    for (const field of required) {
        if (record[field as keyof RowOrDeleteOrUpdate<K>] === undefined || record[field as keyof RowOrDeleteOrUpdate<K>] === null) {
            throw new Error(`Missing required field "${String(field)}" in ${table}`);
        }
    }
}

export async function migrateSchema() {
    if (!db) {
        return null;
    }
    for (const table of Object.values(TablesSQliteSchema)) {
        const {name, columns, unique} = table;
        const columnDefs = Object.entries(columns)
            .map(([col, def]) => `${col} ${def}`)
            .join(", ");

        const exists = db.prepare(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table'
               AND name = ?`
        ).get(name);

        if (exists === undefined) {
            const createSQL = `CREATE TABLE ${name}
                               (
                                   ${columnDefs}${unique ? `, UNIQUE(${unique.join(", ")})` : ""}
                               );`;
            db.exec(createSQL);
            continue;
        }

        const pragma = db.pragma(`table_info(${name})`) as {
            cid: number,
            name: string,
            type: string,
            notnull: number,
            dflt_value: null,
            pk: number
        }[];
        const existingCols = pragma.map((row) => row.name);

        for (const [colName, colDef] of Object.entries(columns)) {
            if (!existingCols.includes(colName)) {
                db.exec(`ALTER TABLE ${name}
                    ADD COLUMN ${colName} ${colDef}`);
                console.log(`➕ Added column '${colName}' to '${name}'`);
            }
        }

        // 3️⃣ Check if unique constraints exist (optional safeguard)
        if (unique && unique.length > 0) {
            const indexName = `${name}_unique_${unique.join("_")}`;
            const indexExists = db.prepare(
                `SELECT name
                 FROM sqlite_master
                 WHERE type = 'index'
                   AND name = ?`
            ).get(indexName);
            if (indexExists === undefined) {
                db.exec(
                    `CREATE UNIQUE INDEX ${indexName} ON ${name} (${unique.join(", ")});`
                );
                console.log(`🔒 Added unique constraint on ${name}(${unique.join(", ")})`);
            }
        }
    }
}

export function create<K extends TableNames>(table: K, record: Tables[K]['Row']): null {
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

export function markAsSynced<K extends TableNames>(table: K, record: Tables[K]['Row']): null {
    if (!db) return null;

    const pkFields = TablesSQliteSchema[table].primary;
    if (!pkFields) {
        throw new Error(`Primary key fields not defined for table ${table}`);
    }

    const whereClauses = pkFields.map(field => `${field} = ?`).join(' AND ');
    const whereValues = pkFields.map((field) => record[field as keyof Tables[K]['Row']]);

    const stmt = db.prepare(
        `UPDATE ${table}
         SET synced = 1
         WHERE ${whereClauses}`
    );

    stmt.run(...whereValues);
    return null;
}

export function read<K extends TableNames>(
    table: K,
    conditions: Partial<LocalTables<K>>,
    fields: keyof LocalTables<K> | '*' = '*' // TODO: update return type based on the requested fields
): LocalTables<K>[] | null {
    if (!db) return null;
    const whereClauses = Object.keys(conditions).map(field => `${field} = ?`).join(' AND ');
    // Convert boolean values to integers for SQLite
    const whereValues = Object.values(conditions).map(value => 
        typeof value === 'boolean' ? (value ? 1 : 0) : value
    );
    const stmt = db.prepare(
        `SELECT ${String(fields)}
         FROM ${table}
         WHERE ${whereClauses}`
    );

    return stmt.all(...whereValues) as LocalTables<K>[];
}

export function upsert<K extends TableNames>(table: K, record: Tables[K]['Row']): null {
    if (!db) return null;

    validate(table, record, true);

    const pkFields = TablesSQliteSchema[table].primary;
    if (!pkFields) {
        throw new Error(`Primary key fields not defined for table ${table}`);
    }

    const whereClauses = pkFields.map(field => `${field} = ?`).join(' AND ');
    const whereValues = pkFields.map((field) => record[field as keyof Tables[K]['Row']]);

    const existingStmt = db.prepare(
        `SELECT *
         FROM ${table}
         WHERE ${whereClauses}`
    );

    const existing = existingStmt.get(...whereValues);

    if (existing) {
        // Update
        const updateFields = Object.keys(record)
            .filter(key => !pkFields.includes(key))
            .map(key => `${key} = ?`)
            .join(', ');
        const updateValues = Object.keys(record)
            .filter(key => !pkFields.includes(key))
            .map(key => record[key as keyof Tables[K]['Row']]);

        const updateStmt = db.prepare(
            `UPDATE ${table}
             SET ${updateFields},
                 synced = 0
             WHERE ${whereClauses}`
        );

        updateStmt.run(...updateValues, ...whereValues);
    } else {
        // Insert
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

export function deleteRecord<K extends TableNames>(table: K, record: Tables[K]['Delete']): null {
    if (!db) return null;

    validate(table, record, true);

    const pkFields = TablesSQliteSchema[table].primary;
    if (!pkFields) {
        throw new Error(`Primary key fields not defined for table ${table}`);
    }

    const whereClauses = pkFields.map(field => `${field} = ?`).join(' AND ');
    const whereValues = pkFields.map((field) => record[field as keyof Tables[K]['Delete']]);

    const stmt = db.prepare(
        `DELETE
         FROM ${table}
         WHERE ${whereClauses}`
    );

    stmt.run(...whereValues);
    return null;
}

export function update<K extends TableNames>(table: K, record: Tables[K]['Update']): null {
    if (!db) return null;

    validate(table, record, true);

    const pkFields = TablesSQliteSchema[table].primary;
    if (!pkFields) {
        throw new Error(`Primary key fields not defined for table ${table}`);
    }

    const whereClauses = pkFields.map(field => `${field} = ?`).join(' AND ');
    const whereValues = pkFields.map((field) => record[field as keyof Tables[K]['Update']]);

    const updateFields = Object.keys(record)
        .filter(key => !pkFields.includes(key))
        .map(key => `${key} = ?`)
        .join(', ');
    const updateValues = Object.keys(record)
        .filter(key => !pkFields.includes(key))
        .map(key => record[key as keyof Tables[K]['Update']]);

    const stmt = db.prepare(
        `UPDATE ${table}
         SET ${updateFields},
             synced = 0
         WHERE ${whereClauses}`
    );

    stmt.run(...updateValues, ...whereValues);
    return null;
}

export function executeSql(sql: string, params: unknown[] = []): unknown[] | null {
    if (!db) return null;

    const stmt = db.prepare(sql);
    return stmt.all(...params) as unknown[];
}