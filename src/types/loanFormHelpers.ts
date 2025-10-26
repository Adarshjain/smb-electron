import type { Loan, BillingItem, BillingItemFieldName } from './loanForm';
import type { Tables } from '../../tables';

/**
 * Type guard to check if a customer is valid (not null)
 */
export function isValidCustomer(
  customer: Tables['customers']['Row'] | null
): customer is Tables['customers']['Row'] {
  return customer !== null;
}

/**
 * Type guard to check if billing item has valid product
 */
export function hasValidProduct(item: BillingItem): boolean {
  return item.product.trim().length > 0;
}

/**
 * Type guard to check if billing item has weight data
 */
export function hasWeightData(item: BillingItem): boolean {
  const grossWeight = parseFloat(item.gross_weight || '0');
  return grossWeight > 0;
}

/**
 * Validates if loan data is ready for submission
 */
export function isLoanReadyForSubmit(loan: Loan): boolean {
  // Check customer
  if (!isValidCustomer(loan.customer)) {
    return false;
  }

  // Check loan amount
  if (parseFloat(loan.loan_amount || '0') <= 0) {
    return false;
  }

  // Check billing items
  if (loan.billing_items.length === 0) {
    return false;
  }

  // Check at least one item has valid data
  const hasValidItems = loan.billing_items.some(
    (item) => hasValidProduct(item) && hasWeightData(item)
  );

  return hasValidItems;
}

/**
 * Creates a type-safe field name for billing items
 */
export function createBillingItemFieldName(
  index: number,
  fieldName: BillingItemFieldName
): `billing_items.${number}.${BillingItemFieldName}` {
  return `billing_items.${index}.${fieldName}`;
}

/**
 * Parses a billing item field name to extract the index
 */
export function parseBillingItemFieldName(
  fieldName: string
): { index: number; field: string } | null {
  const match = fieldName.match(/^billing_items\.(\d+)\.(.+)$/);
  if (match) {
    return {
      index: parseInt(match[1], 10),
      field: match[2],
    };
  }
  return null;
}

/**
 * Type-safe loan field value getter
 */
export function getLoanFieldValue<K extends keyof Loan>(
  loan: Loan,
  field: K
): Loan[K] {
  return loan[field];
}

/**
 * Formats a number value to a fixed decimal string
 */
export function formatDecimal(value: string | number, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value || '0') : value;
  return num.toFixed(decimals);
}

/**
 * Safely parses a string to a float, returning 0 if invalid
 */
export function safeParseFloat(value: string | number): number {
  if (typeof value === 'number') return value;
  const parsed = parseFloat(value || '0');
  return isNaN(parsed) ? 0 : parsed;
}

