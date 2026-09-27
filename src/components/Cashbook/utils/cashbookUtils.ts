import { errorToast, jsNumberFix, successToast } from '@/lib/myUtils.tsx';
import type { CashbookRow } from '../types';
import type { LocalTables, Tables } from '@/../tables';
import {
  createDailyEntries as createDailyEntriesAtomic,
  type DailyEntryPair,
  deleteDailyEntry,
  query,
  updateDailyEntry,
} from '@/hooks/dbUtil.ts';

export const SORT_ORDER = {
  OPENING_BALANCE: -1,
  CLOSING_BALANCE: -2,
  EMPTY_ROW: 0,
} as const;

export const LOAN_AMOUNT = 'LOAN  AMOUNT';
export const REDEMPTION_AMOUNT = 'REDEMPTION AMOUNT';
export const BEING_REDEEMED_LOAN_INTEREST = 'BEING REDEEMED LOAN INTEREST';
const CASH_ACCOUNT_CODE = 14;
const LOAN_ACCOUNT_CODE = 1;
const INTEREST_ACCOUNT_CODE = 9;

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
  credit: balance > 0 ? balance : balance === 0 ? 0 : null,
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

const hasAccount = (
  row: CashbookRow
): row is CashbookRow & { accountHead: Tables['account_head'] } =>
  !!row.accountHead && typeof row.accountHead !== 'string';

// Saved entries whose row is gone or was cleared. A row whose account was
// changed is still there and is handled as a modification.
export const fetchDeletedRecords = (
  oldEntries: Tables['daily_entries'][],
  newEntries: CashbookRow[]
): Tables['daily_entries'][] => {
  const kept = new Set(
    newEntries.filter(hasAccount).map((item) => item.sort_order)
  );
  return oldEntries.filter((item) => !kept.has(item.sort_order));
};

export interface ModifiedEntry {
  entry: CashbookRow & { accountHead: Tables['account_head'] };
  oldSubCode: number;
}

export const fetchModifiedEntries = (
  oldEntries: Tables['daily_entries'][],
  newEntries: CashbookRow[]
): ModifiedEntry[] => {
  const existingEntries = newEntries
    .filter(hasAccount)
    .filter((entry) => entry.sort_order > 0);
  const updatedRows: ModifiedEntry[] = [];
  for (const entry of existingEntries) {
    const matched = oldEntries.find(
      (oldEntry) => oldEntry.sort_order === entry.sort_order
    );
    if (!matched) {
      continue;
    }
    const accountChanged = matched.sub_code !== entry.accountHead.code;
    const descriptionChanged = matched.description !== entry.description;
    const creditChanged = matched.credit !== entry.credit;
    const debitChanged = matched.debit !== entry.debit;
    if (accountChanged || descriptionChanged || creditChanged || debitChanged) {
      updatedRows.push({ entry, oldSubCode: matched.sub_code });
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
  currentAccountHead: Tables['account_head'],
  date: string,
  company: string
): Promise<boolean> => {
  try {
    const pairs: DailyEntryPair[] = entries.map((entry) => ({
      main_code: currentAccountHead.code,
      sub_code: (entry.accountHead as Tables['account_head']).code,
      credit: entry.credit ?? 0,
      debit: entry.debit ?? 0,
      description: entry.description ?? null,
    }));
    await createDailyEntriesAtomic(date, company, pairs);
    return true;
  } catch (e) {
    errorToast(e);
    return false;
  }
};

export const deleteDailyEntries = async (
  entries: Tables['daily_entries'][],
  company: string,
  date: string
): Promise<boolean> => {
  try {
    for (const entry of entries) {
      await deleteDailyEntry(
        date,
        company,
        entry.sort_order,
        entry.main_code,
        entry.sub_code
      );
    }
    return true;
  } catch (e) {
    errorToast(e);
    return false;
  }
};

export const updateDailyEntries = async (
  entries: ModifiedEntry[],
  currentAccountHead: Tables['account_head'],
  date: string,
  company: string
): Promise<boolean> => {
  try {
    for (const { entry, oldSubCode } of entries) {
      await updateDailyEntry(date, company, entry.sort_order, oldSubCode, {
        main_code: currentAccountHead.code,
        sub_code: entry.accountHead.code,
        credit: entry.credit ?? 0,
        debit: entry.debit ?? 0,
        description: entry.description ?? '',
      });
    }
    return true;
  } catch (e) {
    errorToast(e);
    return false;
  }
};

const createDualEntry = async (
  main_code: number,
  sub_code: number,
  credit: number,
  debit: number,
  date: string,
  company: string,
  description: string
) => {
  await createDailyEntriesAtomic(date, company, [
    { main_code, sub_code, credit, debit, description },
  ]);
};

const updateDualEntry = async (
  main_code: number,
  sub_code: number,
  credit: number,
  debit: number,
  date: string,
  company: string,
  description: string,
  sort_order: number
) => {
  await updateDailyEntry(date, company, sort_order, sub_code, {
    main_code,
    sub_code,
    credit,
    debit,
    description,
  });
};

interface UpsertDualEntryParams {
  existingEntry?: LocalTables<'daily_entries'>;
  total: number | null;
  date: string;
  company: string;
  mainAccountCode: number;
  subAccountCode: number;
  debitAmount: number;
  creditAmount: number;
  description: string;
}

export const upsertDualEntry = async ({
  existingEntry,
  total,
  date,
  company,
  mainAccountCode,
  subAccountCode,
  debitAmount,
  creditAmount,
  description,
}: UpsertDualEntryParams) => {
  if (!existingEntry) {
    if (!total) return;

    await createDualEntry(
      mainAccountCode,
      subAccountCode,
      debitAmount,
      creditAmount,
      date,
      company,
      description
    );
    return;
  }

  if (total) {
    await updateDualEntry(
      mainAccountCode,
      subAccountCode,
      debitAmount,
      creditAmount,
      date,
      company,
      description,
      existingEntry.sort_order
    );
  } else {
    await deleteDailyEntries([existingEntry], company, date);
  }
};

const updateLoan = async (
  loanEntries: LocalTables<'daily_entries'>[],
  loanTotal: number | null,
  date: string,
  company: string
) => {
  const existingLoanEntry = loanEntries.find((entry) =>
    entry.description?.toLowerCase().startsWith(LOAN_AMOUNT.toLowerCase())
  );
  await upsertDualEntry({
    existingEntry: existingLoanEntry,
    total: loanTotal,
    date,
    company,
    creditAmount: 0,
    debitAmount: loanTotal ?? 0,
    mainAccountCode: LOAN_ACCOUNT_CODE,
    subAccountCode: CASH_ACCOUNT_CODE,
    description: LOAN_AMOUNT,
  });
};

const updateReleasesPrincipal = async (
  releaseEntries: LocalTables<'daily_entries'>[],
  releaseTotal: number | null,
  date: string,
  company: string
) => {
  const existingReleaseEntry = releaseEntries.find((entry) =>
    entry.description?.toLowerCase().startsWith(REDEMPTION_AMOUNT.toLowerCase())
  );
  await upsertDualEntry({
    existingEntry: existingReleaseEntry,
    total: releaseTotal,
    date,
    company,
    creditAmount: releaseTotal ?? 0,
    debitAmount: 0,
    mainAccountCode: LOAN_ACCOUNT_CODE,
    subAccountCode: CASH_ACCOUNT_CODE,
    description: REDEMPTION_AMOUNT,
  });
};

const updateReleasesInterest = async (
  releaseEntries: LocalTables<'daily_entries'>[],
  releaseTotal: number | null,
  date: string,
  company: string
) => {
  const existingReleaseEntry = releaseEntries.find((entry) =>
    entry.description
      ?.toLowerCase()
      .startsWith(BEING_REDEEMED_LOAN_INTEREST.toLowerCase())
  );
  await upsertDualEntry({
    existingEntry: existingReleaseEntry,
    total: releaseTotal,
    date,
    company,
    creditAmount: releaseTotal ?? 0,
    debitAmount: 0,
    mainAccountCode: INTEREST_ACCOUNT_CODE,
    subAccountCode: CASH_ACCOUNT_CODE,
    description: BEING_REDEEMED_LOAN_INTEREST,
  });
};

const updateTodaysEntries = async (
  loanEntries: LocalTables<'daily_entries'>[],
  loanTotal: number | null,
  releaseTotal: number | null,
  interestTotal: number | null,
  date: string,
  company: string
) => {
  await updateLoan(loanEntries, loanTotal, date, company);
  await updateReleasesPrincipal(loanEntries, releaseTotal, date, company);
  await updateReleasesInterest(loanEntries, interestTotal, date, company);
};

const fetchTodaysLoans = async (date: string, company: string) => {
  return Promise.all([
    query<[{ total: number }]>(
      `SELECT SUM(loan_amount) as total
               FROM bills
               WHERE "date" = ? AND company = ? AND deleted IS NULL`,
      [date, company]
    ),
    query<[{ principal: number; interest: number }]>(
      `SELECT SUM(loan_amount) AS principal,
                      FLOOR(SUM(tax_interest_amount)) AS interest
               FROM releases
               WHERE company = ? AND date = ? AND deleted IS NULL`,
      [company, date]
    ),
    query<LocalTables<'daily_entries'>[] | null>(
      `select *
           from daily_entries
           where date = ?
             and company = ?
             and main_code = ?
             and (sub_code = ? or sub_code = ?)
             AND deleted IS NULL`,
      [
        date,
        company,
        CASH_ACCOUNT_CODE,
        LOAN_ACCOUNT_CODE,
        INTEREST_ACCOUNT_CODE,
      ]
    ),
  ]);
};

export const updateTodayLoansAndReleases = async (
  date: string,
  company: string
) => {
  try {
    const [loanAmountTotal, releaseTotalResponse, loanEntries] =
      await fetchTodaysLoans(date, company);
    await updateTodaysEntries(
      loanEntries ?? [],
      loanAmountTotal?.[0].total ?? null,
      releaseTotalResponse?.[0].principal ?? null,
      releaseTotalResponse?.[0].interest ?? null,
      date,
      company
    );
    successToast('Updated!');
  } catch (e) {
    errorToast(e);
  }
};
