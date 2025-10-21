export type TableName = keyof Tables;

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
        Delete: { name: string }
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
        Delete: { name: string }
    };

    customers: {
        Row: {
            id: string;
            address1: string | null;
            address2: string | null;
            area: string | null;
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

    balances: {
        Row: {
            date: string;
            opening: number;
            closing: number;
            company: string | null;
        };
        Insert: Tables['balances']['Row'];
        Update: Partial<Tables['balances']['Row']>;
        Delete: { date: string; company: string | null };
    };

    billings: {
        Row: {
            serial: string;
            loan_no: number;
            date: string;
            customer_id: string | null;
            loan_amount: number;
            interest_rate: number;
            first_month_interest: number;
            doc_charges: number;
            metal_type: MetalType;
            released: boolean;
            company: string | null;
        };
        Insert: Tables['billings']['Row'];
        Update: Partial<Tables['billings']['Row']>;
        Delete: { serial: string; loan_no: number }
    };

    billing_items: {
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
        Insert: Tables['billing_items']['Row'];
        Update: Partial<Tables['billing_items']['Row']>;
        Delete: { serial: string; loan_no: number; }
    };

    releases: {
        Row: {
            serial: string;
            loan_no: number;
            date: string;
            interest_amount: number;
            total_amount: number;
        };
        Insert: Tables['releases']['Row'];
        Update: Partial<Tables['releases']['Row']>;
        Delete: { serial: string; loan_no: number; }
    };

    interest_rates: {
        Row: {
            metal_type: MetalType;
            rate: number;
            from: number;
            to: number;
            doc_charges: number;
            doc_charges_type: DocChargesType;
        };
        Insert: Tables['interest_rates']['Row'];
        Update: Partial<Tables['interest_rates']['Row']>;
        Delete: { metal_type: MetalType; from: number; to: number; }
    };

    products: {
        Row: {
            name: string;
            metal_type: MetalType;
            product_type: ProductType;
        };
        Insert: Tables['products']['Row'];
        Update: Partial<Tables['products']['Row']>;
        Delete: { name: string; metal_type: MetalType; product_type: ProductType; }
    };

    address_lines: {
        Row: {
            address: string;
        };
        Insert: Tables['address_lines']['Row'];
        Update: Partial<Tables['address_lines']['Row']>;
        Delete: { address: string; }
    };
}

export type LocalTables<K extends TableName> = Tables[K]['Row'] & { synced: 0 | 1 };
export type RowOrDeleteOrUpdate<K extends TableName> = Tables[K]['Row'] | Tables[K]['Delete'] | Tables[K]['Update'];
