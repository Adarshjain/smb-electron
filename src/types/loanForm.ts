import * as z from 'zod';
import type { FullCustomer } from '@/../tables';

export const newLoanSchema = z.object({
  serial: z.string().length(1),
  loan_no: z.string(),
  old_serial: z.string().optional(),
  old_loan_no: z.string().optional(),
  loan_amount: z.string(),
  interest_rate: z.string(),
  first_month_interest: z.string(),
  total: z.string(),
  date: z.string(),
  doc_charges: z.string(),
  customer: z.custom<FullCustomer>().nullable(),
  metal_type: z.enum(['Gold', 'Silver', 'Other']),
  company: z.string(),
  released: z.union([z.literal(0), z.literal(1)]),
  billing_items: z
    .array(
      z.object({
        product: z.string(),
        quality: z.string().nullable(),
        extra: z.string().nullable(),
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

export const releaseLoanSchema = z.object({
  serial: z.string().length(1),
  loan_no: z.string(),
  date: z.string(),
  loan_amount: z.string(),
  interest_amount: z.string(),
  interest_rate: z.string(),
  total_amount: z.string(),
  released: z.number(),
  total_months: z.number(),
  company: z.string(),
});
export type ReleaseLoan = z.infer<typeof releaseLoanSchema>;
