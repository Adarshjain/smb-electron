import { errorToast, sortOrderPromise } from '@/lib/myUtils.tsx';
import { query } from '@/hooks/dbUtil.ts';
import type { LocalTables } from '../../../../tables';
import { upsertDualEntry } from '@/components/Cashbook/utils/cashbookUtils.ts';

interface RapipayData {
  bonus: number;
  charges: number;
  comission: number;
  principal: number;
  tdsTotal: number;
}

const RAPIPAY_CODE = 59;
const RAPIPAY_CUSTOMER_CODE = 60;
const RAPIPAY_COMISSION_CODE = 61;
const RAPIPAY_BONUS_CODE = 62;
const RAPIPAY_CHARGES_CODE = 64;
const RAPIPAY_TDS_CODE = 81;
const CASH_CODE = 14;

const fetchData = async (date: string, company: string) => {
  return Promise.all([
    query<LocalTables<'daily_entries'>[]>(
      `SELECT *
       FROM daily_entries de
       WHERE de.company = ?
         AND de.date = ?
         AND de.deleted IS NULL
         AND EXISTS (SELECT 1
                     FROM account_head ah
                     WHERE ah.code = de.sub_code
                       AND ah.company = de.company
                       AND ah.name LIKE 'RAPIPAY %')`,
      [company, date]
    ),
    sortOrderPromise(),
  ]);
};

const updateEntry = async (
  rapipayEntries: LocalTables<'daily_entries'>[] | null,
  date: string,
  company: string,
  mainCode: number,
  subCode: number,
  total: number,
  sortOrder: number,
  isDebit: boolean
) => {
  const existingEntry = rapipayEntries?.find(
    (entry) => entry.main_code === mainCode && entry.sub_code === subCode
  );

  await upsertDualEntry({
    existingEntry,
    total,
    date,
    company,
    creditAmount: isDebit ? 0 : (total ?? 0),
    debitAmount: isDebit ? (total ?? 0) : 0,
    mainAccountCode: mainCode,
    subAccountCode: subCode,
    description: '',
    sortOrder,
  });
  if (!existingEntry && total) sortOrder += 1;
  return sortOrder;
};

export const loadRapipay = async (company: string, date: string) => {
  try {
    const { bonus, charges, principal, tdsTotal, comission } = JSON.parse(
      await navigator.clipboard.readText()
    ) as RapipayData;
    // TODO: have non zero check
    if (
      isNaN(bonus) ||
      isNaN(charges) ||
      isNaN(principal) ||
      isNaN(tdsTotal) ||
      isNaN(comission)
    ) {
      throw Error('Invalid data format');
    }
    const [rapipayEntries, sortOrderResponse] = await fetchData(date, company);
    let latestSortOrder = sortOrderResponse?.[0].sort_order;
    if (!latestSortOrder) {
      throw Error('Something went wrong');
    }
    const entriesMapping: {
      mainCode: number;
      subCode: number;
      total: number;
      isDebit: boolean;
    }[] = [
      {
        mainCode: RAPIPAY_CODE,
        subCode: RAPIPAY_CUSTOMER_CODE,
        total: principal,
        isDebit: true,
      },
      {
        mainCode: RAPIPAY_CODE,
        subCode: RAPIPAY_COMISSION_CODE,
        total: comission,
        isDebit: true,
      },
      {
        mainCode: RAPIPAY_CODE,
        subCode: RAPIPAY_BONUS_CODE,
        total: bonus,
        isDebit: true,
      },
      {
        mainCode: RAPIPAY_CODE,
        subCode: RAPIPAY_CHARGES_CODE,
        total: charges,
        isDebit: false,
      },
      {
        mainCode: RAPIPAY_CODE,
        subCode: RAPIPAY_TDS_CODE,
        total: tdsTotal,
        isDebit: false,
      },
      {
        mainCode: CASH_CODE,
        subCode: RAPIPAY_CUSTOMER_CODE,
        total: principal,
        isDebit: false,
      },
    ];
    for (const entry of entriesMapping) {
      latestSortOrder = await updateEntry(
        rapipayEntries,
        date,
        company,
        entry.mainCode,
        entry.subCode,
        entry.total,
        latestSortOrder,
        entry.isDebit
      );
    }
  } catch (err) {
    errorToast(err);
    return null;
  }
};
