import { errorToast, jsNumberFix } from '@/lib/myUtils.tsx';
import type { CashbookRow } from '../types';
import type { Tables } from '@/../tables';
import { create, query } from '@/hooks/dbUtil.ts';

export const SORT_ORDER = {
  OPENING_BALANCE: -1,
  CLOSING_BALANCE: -2,
  EMPTY_ROW: 0,
} as const;

export const isRowEmpty = (row: CashbookRow): boolean =>
  !row.accountHead || (!row.credit && !row.debit);

export const isFullyEmpty = (row: CashbookRow): boolean =>
  !row.accountHead && !row.credit && !row.debit && !row.description;

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

export const fetchDeletedRecords = (
  oldEntries: Tables['daily_entries'][],
  newEntries: CashbookRow[]
): number[] => {
  const arr2SortOrders = new Set(newEntries.map((item) => item.sort_order));
  return oldEntries
    .filter((item) => !arr2SortOrders.has(item.sort_order))
    .map((item) => item.sort_order);
};

export const fetchModifiedEntries = (
  oldEntries: Tables['daily_entries'][],
  newEntries: CashbookRow[]
): CashbookRow[] => {
  const existingEntries = newEntries.filter((entry) => entry.sort_order > 0);
  const updatedRows: CashbookRow[] = [];
  for (const entry of existingEntries) {
    const matched = oldEntries.find(
      (oldEntry) => oldEntry.sort_order === entry.sort_order
    );
    if (!matched) {
      continue;
    }
    const accountChanged =
      matched.sub_code !== (entry.accountHead as Tables['account_head']).code;
    const descriptionChanged = matched.description !== entry.description;
    const creditChanged = matched.credit !== entry.credit;
    const debitChanged = matched.debit !== entry.debit;
    if (accountChanged || descriptionChanged || creditChanged || debitChanged) {
      updatedRows.push(entry);
    }
  }
  return updatedRows;
};

export const validateRows = (rows: CashbookRow[]): boolean => {
  for (const row of rows) {
    if (isSpecialRow(row.sort_order)) continue;
    if (isRowEmpty(row)) {
      if (!isFullyEmpty(row)) {
        errorToast('Invalid entry found');
        return false;
      }
    }
  }
  return true;
};

export const createDailyEntries = async (
  entries: CashbookRow[],
  sortOrder: number,
  currentAccountHead: Tables['account_head'],
  date: string,
  company: string
): Promise<boolean> => {
  try {
    const queries: PromiseLike<any>[] = [];
    let latestSortOrder = sortOrder;
    for (const entry of entries) {
      const currentAccountCode = currentAccountHead.code;
      const entryCode = (entry.accountHead as Tables['account_head']).code;
      const main = create('daily_entries', {
        main_code: currentAccountCode,
        sub_code: entryCode,
        description: entry.description,
        credit: entry.credit ?? 0,
        debit: entry.debit ?? 0,
        sort_order: latestSortOrder,
        date,
        company,
      });

      const inverted = create('daily_entries', {
        main_code: entryCode,
        sub_code: currentAccountCode,
        description: entry.description,
        credit: entry.debit ?? 0,
        debit: entry.credit ?? 0,
        sort_order: latestSortOrder,
        date,
        company,
      });
      latestSortOrder += 1;
      queries.push(main, inverted);
    }
    await Promise.all(queries);
    return true;
  } catch (e) {
    errorToast(e);
    return false;
  }
};

export const deleteDailyEntries = async (
  sortOrders: number[],
  company: string
): Promise<boolean> => {
  try {
    for (const order of sortOrders) {
      await query<null>(
        `UPDATE daily_entries
       SET synced  = 0,
           deleted = 1
       WHERE company = ?
         AND sort_order = ?
         AND deleted IS NULL`,
        [company, order],
        true
      );
    }
    return true;
  } catch (e) {
    errorToast(e);
    return false;
  }
};

export const updateDailyEntries = async (
  entries: CashbookRow[],
  currentAccountHead: Tables['account_head'],
  date: string,
  company: string
): Promise<boolean> => {
  try {
    const queries: PromiseLike<any>[] = [];
    const updateQuery = `UPDATE daily_entries
       SET credit      = ?,
           debit       = ?,
           description = ?
       WHERE company = ?
         AND date = ?
         AND main_code = ?
         AND sub_code = ?
         AND sort_order = ?
         AND deleted IS NULL`;
    for (const entry of entries) {
      const currentAccountCode = currentAccountHead.code;
      const entryCode = (entry.accountHead as Tables['account_head']).code;

      const main = query(
        updateQuery,
        [
          entry.credit,
          entry.debit,
          entry.description,
          company,
          date,
          currentAccountCode,
          entryCode,
          entry.sort_order,
        ],
        true
      );

      const inverted = query(
        updateQuery,
        [
          entry.debit,
          entry.credit,
          entry.description,
          company,
          date,
          entryCode,
          currentAccountCode,
          entry.sort_order,
        ],
        true
      );
      queries.push(main, inverted);
    }
    await Promise.all(queries);
    return true;
  } catch (e) {
    errorToast(e);
    return false;
  }
};
