import { describe, expect, it } from 'vitest';
import { newLoanSchema } from './loanForm';

const item = (quantity: number) => ({
  product: 'Ring',
  quality: null,
  extra: null,
  quantity,
  gross_weight: '0.5',
  net_weight: '0.5',
  ignore_weight: '0.1',
});

describe('newLoanSchema billing item quantity', () => {
  const quantityIssue = (quantity: number) =>
    newLoanSchema
      .pick({ billing_items: true })
      .safeParse({ billing_items: [item(quantity)] })
      .error?.issues.map((i) => i.message);

  it('accepts a whole number', () => {
    expect(quantityIssue(2)).toBeUndefined();
  });

  // Supabase stores quantity as an integer; one decimal fails the whole
  // bill_items backup and everything backed up after it.
  it('rejects a decimal', () => {
    expect(quantityIssue(2.2)).toEqual(['Quantity must be a whole number']);
  });
});
