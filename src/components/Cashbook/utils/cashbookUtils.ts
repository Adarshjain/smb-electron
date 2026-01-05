import {
  errorToast,
  jsNumberFix,
  sortOrderPromise,
  successToast,
} from '@/lib/myUtils.tsx';
import type { CashbookRow } from '../types';
import type { LocalTables, Tables } from '@/../tables';
import { create, deleteRecord, query } from '@/hooks/dbUtil.ts';

export const SORT_ORDER = {
  OPENING_BALANCE: -1,
  CLOSING_BALANCE: -2,
  EMPTY_ROW: 0,
} as const;

const LOAN_AMOUNT = 'LOAN  AMOUNT';
const REDEMPTION_AMOUNT = 'REDEMPTION AMOUNT';
const BEING_REDEEMED_LOAN_INTEREST = 'BEING REDEEMED LOAN INTEREST';
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

export const fetchDeletedRecords = (
  oldEntries: Tables['daily_entries'][],
  newEntries: CashbookRow[]
): Tables['daily_entries'][] => {
  const arr2SortOrders = new Set(
    newEntries.map((item) => {
      if (!item.accountHead || typeof item.accountHead === 'string')
        return item.sort_order;
      return `${item.sort_order}-${item.accountHead.code}`;
    })
  );
  return oldEntries.filter(
    (item) => !arr2SortOrders.has(`${item.sort_order}-${item.sub_code}`)
  );
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
  entries: Tables['daily_entries'][],
  company: string,
  date: string
): Promise<boolean> => {
  try {
    const queries: PromiseLike<any>[] = [];
    for (const entry of entries) {
      const currentAccountCode = entry.main_code;
      const entryCode = entry.sub_code;
      const main = deleteRecord('daily_entries', {
        main_code: currentAccountCode,
        sub_code: entryCode,
        sort_order: entry.sort_order,
        company,
        date,
      });
      const inverted = deleteRecord('daily_entries', {
        main_code: entryCode,
        sub_code: currentAccountCode,
        sort_order: entry.sort_order,
        company,
        date,
      });
      queries.push(main, inverted);
    }
    await Promise.all(queries);
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
    for (const entry of entries) {
      const currentAccountCode = currentAccountHead.code;
      const entryCode = (entry.accountHead as Tables['account_head']).code;

      await updateDualEntry(
        currentAccountCode,
        entryCode,
        entry.credit ?? 0,
        entry.debit ?? 0,
        date,
        company,
        entry.description ?? '',
        entry.sort_order
      );
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
  description: string,
  sort_order: number
) => {
  await create('daily_entries', {
    main_code: main_code,
    sub_code: sub_code,
    credit: credit,
    debit: debit,
    date,
    company,
    description: description,
    sort_order: sort_order,
  });
  await create('daily_entries', {
    main_code: sub_code,
    sub_code: main_code,
    credit: debit,
    debit: credit,
    date,
    company,
    description: description,
    sort_order: sort_order,
  });
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
  const updateQuery = `UPDATE daily_entries
       SET credit      = ?,
           debit       = ?,
           description = ?,
           synced      = 0
       WHERE company = ?
         AND date = ?
         AND main_code = ?
         AND sub_code = ?
         AND sort_order = ?
         AND deleted IS NULL`;
  const main = query(
    updateQuery,
    [
      credit,
      debit,
      description,
      company,
      date,
      main_code,
      sub_code,
      sort_order,
    ],
    true
  );

  const inverted = query(
    updateQuery,
    [
      debit,
      credit,
      description,
      company,
      date,
      sub_code,
      main_code,
      sort_order,
    ],
    true
  );
  await Promise.all([main, inverted]);
};

interface UpsertDualEntryParams {
  existingEntry?: LocalTables<'daily_entries'>;
  total: number | null;
  date: string;
  company: string;
  sortOrder: number;
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
  sortOrder,
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
      description,
      sortOrder
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
  company: string,
  sortOrder: number
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
    sortOrder: sortOrder,
  });
  if (!existingLoanEntry && loanTotal) sortOrder += 1;
  return sortOrder;
};

const updateReleasesPrincipal = async (
  releaseEntries: LocalTables<'daily_entries'>[],
  releaseTotal: number | null,
  date: string,
  company: string,
  sortOrder: number
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
    sortOrder: sortOrder,
  });
  if (!existingReleaseEntry && releaseTotal) sortOrder += 1;
  return sortOrder;
};

const updateReleasesInterest = async (
  releaseEntries: LocalTables<'daily_entries'>[],
  releaseTotal: number | null,
  date: string,
  company: string,
  sortOrder: number
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
    sortOrder: sortOrder,
  });
};

const updateTodaysEntries = async (
  loanEntries: LocalTables<'daily_entries'>[],
  loanTotal: number | null,
  releaseTotal: number | null,
  interestTotal: number | null,
  date: string,
  company: string,
  latestSortOrder: number
) => {
  latestSortOrder = await updateLoan(
    loanEntries,
    loanTotal,
    date,
    company,
    latestSortOrder
  );

  latestSortOrder = await updateReleasesPrincipal(
    loanEntries,
    releaseTotal,
    date,
    company,
    latestSortOrder
  );

  await updateReleasesInterest(
    loanEntries,
    interestTotal,
    date,
    company,
    latestSortOrder
  );
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
    sortOrderPromise(),
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
    const [
      loanAmountTotal,
      releaseTotalResponse,
      sortOrderResponse,
      loanEntries,
    ] = await fetchTodaysLoans(date, company);
    const latestSortOrder = sortOrderResponse?.[0].sort_order;
    if (!latestSortOrder) {
      throw Error('Something went wrong');
    }
    await updateTodaysEntries(
      loanEntries ?? [],
      loanAmountTotal?.[0].total ?? null,
      releaseTotalResponse?.[0].principal ?? null,
      releaseTotalResponse?.[0].interest ?? null,
      date,
      company,
      latestSortOrder
    );
    successToast('Updated!');
  } catch (e) {
    errorToast(e);
  }
};
