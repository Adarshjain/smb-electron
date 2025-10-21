import {TableNames} from "./tables";

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
            current_date: "TEXT NOT NULL",
            next_serial: "TEXT NOT NULL DEFAULT \"\"",
            is_default: "BOOLEAN NOT NULL DEFAULT 0",
            synced: "BOOLEAN NOT NULL DEFAULT 0",
        },
        requiredFields: ["name", "current_date", "next_serial"],
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