import { jsNumberFix } from '@/lib/myUtils.tsx';
import type { CashbookRow } from '../types';

export const SORT_ORDER = {
  OPENING_BALANCE: -1,
  CLOSING_BALANCE: -2,
  EMPTY_ROW: 0,
} as const;

export const isRowEmpty = (row: CashbookRow): boolean =>
  !row.accountHead || (!row.credit && !row.debit);

export const isSpecialRow = (sortOrder: number): boolean =>
  sortOrder === SORT_ORDER.OPENING_BALANCE ||
  sortOrder === SORT_ORDER.CLOSING_BALANCE;

export const createEmptyRow = (
  sortOrder: number = SORT_ORDER.EMPTY_ROW
): CashbookRow => ({
  accountHead: undefined,
  description: null,
  credit: null,
  debit: null,
  sort_order: sortOrder,
});

export const createBalanceRow = (
  label: string,
  sortOrder: number,
  balance: number
): CashbookRow => ({
  accountHead: label,
  sort_order: sortOrder,
  credit: balance >= 0 ? balance : null,
  debit: balance < 0 ? balance : null,
  description: null,
});

export const calculateBalance = (
  rows: CashbookRow[],
  openingBalance: number
): number =>
  rows.reduce(
    (sum, row) => jsNumberFix(sum + (row.credit ?? 0) - (row.debit ?? 0)),
    openingBalance
  );

export const getInitialInputValue = (
  row: CashbookRow,
  key: keyof CashbookRow
): string => {
  const val = row[key];
  if (typeof val === 'number' || typeof val === 'string') return String(val);
  return val?.name ?? '';
};
