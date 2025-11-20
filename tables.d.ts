export type TableName = Exclude<keyof Tables, 'full_bill'>;

export type MetalType = 'Gold' | 'Silver' | 'Other';
export type DocChargesType = 'Fixed' | 'Percentage';
export type ProductType = 'product' | 'quality' | 'seal';

export interface Tables {
  areas: {
    name: string;
    post: string | null;
    town: string | null;
    pincode: string | null;
  };

  companies: {
    name: string;
    current_date: string;
    next_serial: string;
    is_default: 0 | 1;
  };

  customers: {
    id: string;
    address1: string | null;
    address2: string | null;
    area: string;
    phone_no: string | null;
    fhtitle: string;
    fhname: string;
    name: string;
    id_proof: string | null;
    id_proof_value: string | null;
    door_no: string | null;
  };

  daily_balances: {
    date: string;
    opening: number;
    closing: number;
    company: string;
  };

  account_head: {
    code: number;
    name: string;
    openingBalance: number;
    company: string;
    hisaabGroup: string;
  };

  daily_entries: {
    reference: string;
    description: string | null;
    debit: number;
    credit: number;
    date: string;
    company: string;
    main_code: number;
    sub_code: number;
    sortOrder: number;
  };

  bills: {
    serial: string;
    loan_no: number;
    date: string;
    customer_id: string;
    loan_amount: number;
    interest_rate: number;
    first_month_interest: number;
    doc_charges: number;
    metal_type: MetalType;
    released: 0 | 1;
    company: string;
  };

  bill_items: {
    serial: string;
    loan_no: number;
    product: string;
    quality: string | null;
    extra: string | null;
    quantity: number;
    gross_weight: number;
    net_weight: number;
    ignore_weight: number;
  };

  releases: {
    serial: string;
    loan_no: number;
    date: string;
    loan_date: string;
    loan_amount: number;
    interest_amount: number;
    tax_interest_amount: number;
    total_amount: number;
    company: string;
  };

  interest_rates: {
    metal_type: MetalType;
    rate: number;
    from_: number;
    to_: number;
    doc_charges: number;
    doc_charges_type: DocChargesType;
  };

  products: {
    name: string;
    metal_type: MetalType;
    product_type: ProductType;
  };

  full_bill: Tables['bills'] & {
    full_customer: FullCustomer;
    bill_items: Tables['bill_items'][];
    releasedEntry?: Tables['releases'];
  };
}

export interface TablesInsert {
  areas: {
    name: string;
    post?: string | null;
    town?: string | null;
    pincode?: string | null;
  };
  companies: {
    name: string;
    current_date: string;
    next_serial: string;
    is_default: 0 | 1;
  };

  customers: Omit<Tables['customers'], 'id'> & { id?: string };

  daily_balances: Tables['daily_balances'];

  account_head: Tables['account_head'];

  daily_entries: Tables['daily_entries'];

  bills: Tables['bills'];

  bill_items: Tables['bill_items'];

  releases: Tables['releases'];

  interest_rates: Tables['interest_rates'];

  products: Tables['products'];
}

export interface TablesDelete {
  areas: { name: string };
  companies: { name: string };

  customers: { id: string };

  daily_balances: { date: string; company: string };

  account_head: { code: number };

  daily_entries: { code: number };

  bills: { serial: string; loan_no: number };

  bill_items: { serial: string; loan_no: number };

  releases: { serial: string; loan_no: number };

  interest_rates: { metal_type: MetalType; from: number; to: number };

  products: { name: string; metal_type: MetalType; product_type: ProductType };
}

export interface TablesUpdate {
  areas: Partial<Tables['areas']>;
  companies: {
    name: string;
    current_date?: string;
    next_serial?: string;
    is_default?: 0 | 1;
  };

  customers: Partial<Tables['customers']>;

  daily_balances: Partial<Tables['daily_balances']>;

  account_head: Partial<Tables['account_head']>;

  daily_entries: Partial<Tables['daily_entries']>;

  bills: Partial<Tables['bills']>;

  bill_items: Partial<Tables['bill_items']>;

  releases: Partial<Tables['releases']>;

  interest_rates: Partial<Tables['interest_rates']>;

  products: Partial<Tables['products']>;
}

export interface FullCustomer {
  customer: Tables['customers'];
  area: Tables['areas'];
}

export type LocalTables<K extends TableName> = Tables[K] & {
  synced: 0 | 1;
};
export type RowOrDeleteOrUpdate<K extends TableName> =
  | Tables[K]
  | TablesDelete[K]
  | TablesUpdate[K];
