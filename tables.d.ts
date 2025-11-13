export type TableName = Exclude<keyof Tables, 'full_bill'>;

export type MetalType = 'Gold' | 'Silver' | 'Other';
export type DocChargesType = 'Fixed' | 'Percentage';
export type ProductType = 'product' | 'quality' | 'seal';

export interface Tables {
  areas: {
    Row: {
      name: string;
      post: string | null;
      town: string | null;
      pincode: string | null;
    };
    Insert: {
      name: string;
      post?: string | null;
      town?: string | null;
      pincode?: string | null;
    };
    Update: Partial<Tables['areas']['Row']>;
    Delete: { name: string };
  };

  companies: {
    Row: {
      name: string;
      current_date: string;
      next_serial: string;
      is_default: 0 | 1;
    };
    Insert: {
      name: string;
      current_date: string;
      next_serial: string;
      is_default: 0 | 1;
    };
    Update: {
      name: string;
      current_date?: string;
      next_serial?: string;
      is_default?: 0 | 1;
    };
    Delete: { name: string };
  };

  customers: {
    Row: {
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
    Insert: Omit<Tables['customers']['Row'], 'id'> & { id?: string };
    Update: Partial<Tables['customers']['Row']>;
    Delete: { id: string };
  };

  daily_balances: {
    Row: {
      date: string;
      opening: number;
      closing: number;
      company: string;
    };
    Insert: Tables['daily_balances']['Row'];
    Update: Partial<Tables['daily_balances']['Row']>;
    Delete: { date: string; company: string };
  };

  account_head: {
    Row: {
      code: number;
      name: string;
      openingBalance: number;
      company: string;
      hisaabGroup: string;
    };
    Insert: Tables['account_head']['Row'];
    Update: Partial<Tables['account_head']['Row']>;
    Delete: { code: number };
  };

  daily_entries: {
    Row: {
      particular: string;
      description: string;
      debit: number;
      credit: number;
      date: string;
      company: string;
      code_1: number;
      code_2: number;
      particular1: string;
    };
    Insert: Tables['daily_entries']['Row'];
    Update: Partial<Tables['daily_entries']['Row']>;
    Delete: { code: number };
  };

  bills: {
    Row: {
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
    Insert: Tables['bills']['Row'];
    Update: Partial<Tables['bills']['Row']>;
    Delete: { serial: string; loan_no: number };
  };

  bill_items: {
    Row: {
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
    Insert: Tables['bill_items']['Row'];
    Update: Partial<Tables['bill_items']['Row']>;
    Delete: { serial: string; loan_no: number };
  };

  releases: {
    Row: {
      serial: string;
      loan_no: number;
      date: string;
      loan_amount: number;
      interest_amount: number;
      total_amount: number;
      company: string;
    };
    Insert: Tables['releases']['Row'];
    Update: Partial<Tables['releases']['Row']>;
    Delete: { serial: string; loan_no: number };
  };

  interest_rates: {
    Row: {
      metal_type: MetalType;
      rate: number;
      from_: number;
      to_: number;
      doc_charges: number;
      doc_charges_type: DocChargesType;
    };
    Insert: Tables['interest_rates']['Row'];
    Update: Partial<Tables['interest_rates']['Row']>;
    Delete: { metal_type: MetalType; from: number; to: number };
  };

  products: {
    Row: {
      name: string;
      metal_type: MetalType;
      product_type: ProductType;
    };
    Insert: Tables['products']['Row'];
    Update: Partial<Tables['products']['Row']>;
    Delete: { name: string; metal_type: MetalType; product_type: ProductType };
  };

  address_lines: {
    Row: {
      address: string;
    };
    Insert: Tables['address_lines']['Row'];
    Update: Partial<Tables['address_lines']['Row']>;
    Delete: { address: string };
  };

  full_bill: {
    Row: Tables['bills']['Row'] & {
      full_customer: FullCustomer;
      bill_items: Tables['bill_items']['Row'][];
      releasedEntry?: Tables['releases']['Row'];
    };
  };
}

export interface FullCustomer {
  customer: Tables['customers']['Row'];
  area: Tables['areas']['Row'];
}

export type LocalTables<K extends TableName> = Tables[K]['Row'] & {
  synced: 0 | 1;
};
export type RowOrDeleteOrUpdate<K extends TableName> =
  | Tables[K]['Row']
  | Tables[K]['Delete']
  | Tables[K]['Update'];
