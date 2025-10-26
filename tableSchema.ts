import type { TableName } from './tables';

export const TablesSQliteSchema: Record<
  TableName,
  {
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
> = {
  areas: {
    name: 'areas',
    columns: {
      name: {
        schema: 'TEXT PRIMARY KEY UNIQUE',
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
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: ['name'],
    primary: ['name'],
  },

  companies: {
    name: 'companies',
    columns: {
      name: {
        schema: 'TEXT PRIMARY KEY UNIQUE',
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
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: ['name', 'current_date', 'next_serial'],
    primary: ['name'],
  },

  products: {
    name: 'products',
    columns: {
      name: {
        schema: 'TEXT PRIMARY KEY',
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
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: ['name', 'metal_type', 'product_type'],
    primary: ['name'],
  },

  customers: {
    name: 'customers',
    columns: {
      id: {
        schema: 'TEXT PRIMARY KEY',
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
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: ['id', 'fhtitle', 'fhname', 'name'],
    primary: ['id'],
  },

  balances: {
    name: 'balances',
    columns: {
      date: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      opening: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      closing: {
        schema: 'REAL NOT NULL',
        encoded: false,
      },
      company: {
        schema: 'TEXT NOT NULL DEFAULT 0',
        encoded: false,
      },
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: ['date', 'opening', 'closing', 'company'],
    unique: ['date', 'company'],
    primary: ['date', 'company'],
  },

  bills: {
    name: 'bills',
    columns: {
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
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
      // Composite primary key → emulate with UNIQUE
    },
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
    unique: ['serial', 'loan_no'],
    primary: ['serial', 'loan_no'],
  },

  bill_items: {
    name: 'bill_items',
    columns: {
      serial: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      loan_no: {
        schema: 'INTEGER NOT NULL',
        encoded: false,
      },
      product: {
        schema: 'TEXT NOT NULL',
        encoded: false,
      },
      quality: {
        schema: 'TEXT',
        encoded: false,
      },
      extra: {
        schema: 'TEXT',
        encoded: false,
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
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: [
      'serial',
      'loan_no',
      'product',
      'quantity',
      'gross_weight',
      'net_weight',
      'ignore_weight',
    ],
    primary: ['serial', 'loan_no'],
  },

  releases: {
    name: 'releases',
    columns: {
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
      interest_amount: {
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
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: [
      'serial',
      'loan_no',
      'date',
      'interest_amount',
      'loan_amount',
      'total_amount',
    ],
    unique: ['serial', 'loan_no'],
    primary: ['serial', 'loan_no'],
  },

  interest_rates: {
    name: 'interest_rates',
    columns: {
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
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: [
      'metal_type',
      'rate',
      'from_',
      'to_',
      'doc_charges',
      'doc_charges_type',
    ],
    unique: ['rate', 'from_', 'to_'],
    primary: ['rate', 'from_', 'to_'],
  },

  address_lines: {
    name: 'address_lines',
    columns: {
      address: {
        schema: 'TEXT PRIMARY KEY UNIQUE',
        encoded: true,
      },
      synced: {
        schema: 'BOOLEAN NOT NULL DEFAULT 0',
        encoded: false,
      },
    },
    requiredFields: ['address'],
    primary: ['address'],
  },
} as const;
