import * as z from 'zod';
import type { Tables } from '../../tables';

export const newLoanSchema = z.object({
  serial: z.string().min(1).max(1),
  loan_no: z.number().min(1).max(10000),
  loan_amount: z.string(),
  interest_rate: z.string(),
  first_month_interest: z.string(),
  total: z.string(),
  date: z.string(),
  doc_charges: z.string(),
  customer: z.custom<Tables['customers']['Row']>().nullable(),
  metal_type: z.enum(['Gold', 'Silver']),
  company: z.string(),
  released: z.union([z.literal(0), z.literal(1)]),
  billing_items: z
    .array(
      z.object({
        product: z.string(),
        quality: z.string(),
        extra: z.string(),
        quantity: z.number(),
        gross_weight: z.string(),
        net_weight: z.string(),
        ignore_weight: z.string(),
      })
    )
    .min(1),
});

export type Loan = z.infer<typeof newLoanSchema>;
export type BillingItem = Loan['billing_items'][number];

// Field name types for better type safety
export type LoanFieldName = keyof Loan;
export type BillingItemFieldName = keyof BillingItem;
export type FormFieldName =
  | LoanFieldName
  | `billing_items.${number}.${BillingItemFieldName}`;

