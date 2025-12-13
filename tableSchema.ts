import type { LocalTables, TableName, Tables } from './tables';
import { decode, encode } from './thanglish/TsciiConverter.js';

interface TableSchema {
  name: TableName;
  columns: Record<
    string,
    {
      schema: string;
      encoded: boolean;
    }
  >;
  requiredFields: string[];
  unique?: string[];
  primary: string[];
}

const localizedColumns = (
  columns: TableSchema['columns']
): TableSchema['columns'] => {
  return {
    ...columns,
    synced: {
      schema: 'BOOLEAN NOT NULL DEFAULT 0',
      encoded: false,
    },
    deleted: {
      schema: 'BOOLEAN',
      encoded: false,
    },
  };
};

export const TablesSQliteSchema: Record<TableName, TableSchema> = {
  areas: {
    name: 'areas',
    columns: localizedColumns({
      name: {
        schema: 'TEXT',
        encoded: true,
      },
      post: {
        schema: 'TEXT',
        encoded: true,
      },
      town: {
        schema: 'TEXT',
        encoded: true,
      },
      pincode: {
        schema: 'TEXT',
        encoded: false,
      },
    }),
    requiredFields: ['name'],
    primary: ['name', 'deleted'],
  },

  companies: {
    name: 'companies',
    columns: localizedColumns({
      name: {
        schema: 'TEXT',
        encoded: false,
      },
      current_date: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      next_serial: {
        schema: 'TEXT NOT NULL DEFAULT ""',
        encoded: false,
      },
      is_default: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    }),
    requiredFields: ['name', 'current_date', 'next_serial'],
    primary: ['name', 'deleted'],
  },

  products: {
    name: 'products',
    columns: localizedColumns({
      name: {
        schema: 'TEXT NOT NULL',
        encoded: true,
      },
      metal_type: {
        schema:
          "TEXT NOT NULL CHECK(metal_type IN ('Gold', 'Silver', 'Other'))",
        encoded: false,
      },
      product_type: {
        schema:
          "TEXT NOT NULL CHECK(product_type IN ('product', 'quality', 'seal'))",
        encoded: false,
      },
    }),
    requiredFields: ['name', 'metal_type', 'product_type'],
    primary: ['name', 'metal_type', 'deleted'],
  },

  customers: {
    name: 'customers',
    columns: localizedColumns({
      id: {
        schema: 'TEXT',
        encoded: false,
      },
      address1: {
        schema: 'TEXT',
        encoded: true,
      },
      address2: {
        schema: 'TEXT',
        encoded: true,
      },
      area: {
        schema: 'TEXT',
        encoded: true,
      },
      phone_no: {
        schema: 'TEXT',
        encoded: false,
      },
      fhtitle: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      fhname: {
        schema: 'TEXT NOT NULL',
        encoded: true,
      },
      name: {
        schema: 'TEXT NOT NULL',
        encoded: true,
      },
      id_proof: {
        schema: 'TEXT',
        encoded: false,
      },
      id_proof_value: {
        schema: 'TEXT',
        encoded: false,
      },
      door_no: {
        schema: 'TEXT',
        encoded: false,
      },
    }),
    requiredFields: ['id', 'fhtitle', 'fhname', 'name'],
    primary: ['id', 'deleted'],
  },

  account_head: {
    name: 'account_head',
    columns: localizedColumns({
      code: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      opening_balance: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      name: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      hisaab_group: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      company: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
    }),
    requiredFields: ['code', 'opening_balance', 'name', 'company'],
    unique: ['code', 'company', 'deleted'],
    primary: ['code', 'company', 'deleted'],
  },

  daily_entries: {
    name: 'daily_entries',
    columns: localizedColumns({
      debit: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      credit: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      main_code: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      sub_code: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      sort_order: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      description: {
        schema: 'TEXT',
        encoded: false,
      },
      company: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      date: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
    }),
    requiredFields: [],
    primary: [
      'date',
      'company',
      'main_code',
      'sub_code',
      'sort_order',
      'deleted',
    ],
  },

  bills: {
    name: 'bills',
    columns: localizedColumns({
      serial: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      loan_no: {
        schema: 'INTEGER NOT NULL',
        encoded: false,
      },
      date: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      customer_id: {
        schema: 'TEXT',
        encoded: false,
      },
      loan_amount: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      interest_rate: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      first_month_interest: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      doc_charges: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      metal_type: {
        schema:
          "TEXT NOT NULL CHECK(metal_type IN ('Gold', 'Silver', 'Other'))",
        encoded: false,
      },
      released: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
      company: {
        schema: 'TEXT',
        encoded: false,
      },
    }),
    requiredFields: [
      'serial',
      'loan_no',
      'date',
      'loan_amount',
      'interest_rate',
      'first_month_interest',
      'doc_charges',
      'metal_type',
      'company',
    ],
    unique: ['serial', 'loan_no', 'deleted'],
    primary: ['serial', 'loan_no', 'deleted'],
  },

  bill_items: {
    name: 'bill_items',
    columns: localizedColumns({
      serial: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      loan_no: {
        schema: 'INTEGER NOT NULL',
        encoded: false,
      },
      sort_order: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      product: {
        schema: 'TEXT NOT NULL',
        encoded: true,
      },
      quality: {
        schema: 'TEXT',
        encoded: true,
      },
      extra: {
        schema: 'TEXT',
        encoded: true,
      },
      quantity: {
        schema: 'INTEGER NOT NULL',
        encoded: false,
      },
      gross_weight: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      net_weight: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      ignore_weight: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
    }),
    requiredFields: [
      'serial',
      'loan_no',
      'product',
      'quantity',
      'gross_weight',
      'net_weight',
      'ignore_weight',
    ],
    primary: ['serial', 'loan_no', 'deleted', 'sort_order'],
  },

  releases: {
    name: 'releases',
    columns: localizedColumns({
      serial: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      loan_no: {
        schema: 'INTEGER NOT NULL',
        encoded: false,
      },
      date: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      loan_date: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      interest_amount: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      tax_interest_amount: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      loan_amount: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      total_amount: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      company: {
        schema: 'TEXT',
        encoded: false,
      },
    }),
    requiredFields: [
      'serial',
      'loan_no',
      'date',
      'interest_amount',
      'loan_amount',
      'total_amount',
    ],
    unique: ['serial', 'loan_no', 'deleted'],
    primary: ['serial', 'loan_no', 'deleted'],
  },

  interest_rates: {
    name: 'interest_rates',
    columns: localizedColumns({
      metal_type: {
        schema:
          "TEXT NOT NULL CHECK(metal_type IN ('Gold', 'Silver', 'Other'))",
        encoded: false,
      },
      rate: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      from_: {
        schema: 'INTEGER NOT NULL',
        encoded: false,
      },
      to_: {
        schema: 'INTEGER NOT NULL',
        encoded: false,
      },
      doc_charges: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      doc_charges_type: {
        schema:
          "TEXT NOT NULL CHECK(doc_charges_type IN ('Fixed', 'Percentage'))",
        encoded: false,
      },
    }),
    requiredFields: [
      'metal_type',
      'rate',
      'from_',
      'to_',
      'doc_charges',
      'doc_charges_type',
    ],
    unique: ['rate', 'from_', 'to_', 'deleted'],
    primary: ['rate', 'from_', 'to_', 'deleted'],
  },
} as const;

export const decodeRecord = <
  K extends TableName,
  T extends Tables[K] | LocalTables<K>,
>(
  tableName: K,
  record: T,
  shouldEncodeDecode = false
): T =>
  shouldEncodeDecode ? encodeDecodeRecord(tableName, record, 'decode') : record;

export const encodeRecord = <
  K extends TableName,
  T extends Tables[K] | LocalTables<K>,
>(
  tableName: K,
  record: T,
  shouldEncodeDecode = false
): T =>
  shouldEncodeDecode ? encodeDecodeRecord(tableName, record, 'encode') : record;

export function encodeDecodeRecord<
  K extends TableName,
  T extends Tables[K] | LocalTables<K>,
>(tableName: K, record: T, type: 'encode' | 'decode'): T {
  const columnSchema = TablesSQliteSchema[tableName].columns;
  const encodedKeys = Object.keys(record).filter(
    (key) => columnSchema[key]?.encoded
  ) as (keyof T)[];

  if (encodedKeys.length === 0) {
    return record;
  }

  const method: <T extends string | null | undefined>(input: T) => T =
    type === 'encode' ? encode : decode;

  const encodedRecord = { ...record };
  for (const key of encodedKeys) {
    encodedRecord[key] = method(record[key] as string) as T[typeof key];
  }

  return encodedRecord;
}
