import FYPicker from '@/components/FYPicker.tsx';
import { useCallback, useEffect, useState } from 'react';
import { query, read } from '@/hooks/dbUtil.ts';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { errorToast, jsNumberFix } from '@/lib/myUtils.tsx';
import type { LocalTables, Tables } from '../../tables';

export default function BalanceSheet() {
  const { company } = useCompany();
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const calculateTransactionEffect = useCallback(
    (entry: Tables['daily_entries'], accCode: number) => {
      const isPrimary = accCode === entry.main_code;
      const credit = isPrimary ? entry.debit : entry.credit;
      const debit = isPrimary ? entry.credit : entry.debit;
      return Number((credit - debit).toFixed(2));
    },
    []
  );

  const calcCapitalAcc = async (
    accountHeads: LocalTables<'account_head'>[],
    entries: LocalTables<'daily_entries'>[]
  ): Promise<number> => {
    if (!company || !startDate || !endDate) return 0;
    const netProfitResponse = await query<
      [{ netProfit: number }]
    >(`SELECT (SELECT SUM(ABS(de.credit - de.debit))
                         FROM daily_entries de
                                JOIN account_head ah
                                     ON ah.code = de.main_code OR ah.code = de.sub_code
                         WHERE de.company = '${company.name}'
                           AND de.date < '${startDate}'
                           AND ah.company = '${company.name}'
                           AND ah.hisaabGroup = 'Income')
                          -
                        (SELECT SUM(de.credit - de.debit)
                         FROM daily_entries de
                                JOIN account_head ah
                                     ON ah.code = de.main_code OR ah.code = de.sub_code
                         WHERE de.company = '${company.name}'
                           AND de.date < '${startDate}'
                           AND ah.company = '${company.name}'
                           AND ah.hisaabGroup = 'Expenses')
                          AS netProfit`);
    const netProfit = jsNumberFix(netProfitResponse?.[0].netProfit ?? 0);

    const capitalAccountCodes = accountHeads
      .filter((accountHead) => accountHead.hisaabGroup === 'Capital Account')
      .map((accountHead) => accountHead.code);

    const accountHeadByID: Record<number, LocalTables<'account_head'>> = {};

    accountHeads?.forEach((accountHead) => {
      if (accountHead.name !== 'ASHOK KUMAR CAPITAL A/C') {
        accountHead.openingBalance = 0;
      }
      accountHeadByID[accountHead.code] = JSON.parse(
        JSON.stringify(accountHead)
      ) as LocalTables<'account_head'>;
    });

    entries
      .filter((entry) => entry.date < startDate)
      .forEach((entry) => {
        if (
          !capitalAccountCodes.includes(entry.main_code) &&
          !capitalAccountCodes.includes(entry.sub_code)
        ) {
          return;
        }
        const sum = calculateTransactionEffect(entry, entry.main_code);
        accountHeadByID[entry.main_code].openingBalance = jsNumberFix(
          (accountHeadByID[entry.main_code].openingBalance ?? 0) + sum
        );
        accountHeadByID[entry.sub_code].openingBalance = jsNumberFix(
          (accountHeadByID[entry.sub_code].openingBalance ?? 0) - sum
        );
      });
    const mainAcc = accountHeads.find(
      (accountHead) => accountHead.name === 'ASHOK KUMAR CAPITAL A/C'
    );
    const capSum = Object.values(accountHeadByID).reduce((sum, accountHead) => {
      if (
        accountHead.openingBalance &&
        accountHead.hisaabGroup === 'Capital Account' &&
        accountHead.name !== 'ASHOK KUMAR CAPITAL A/C'
      ) {
        sum = jsNumberFix(sum + accountHead.openingBalance);
      }
      return sum;
    }, 0);
    console.log({ capSum, netProfit, main: mainAcc?.openingBalance ?? 0 });
    return jsNumberFix(-capSum + netProfit + (mainAcc?.openingBalance ?? 0));
  };

  useEffect(() => {
    if (!startDate || !endDate || !company) return;
    const fetchDetails = async () => {
      try {
        const [accountHeads, entries] = await Promise.all([
          read('account_head', {
            company: company.name,
          }),
          query<LocalTables<'daily_entries'>[]>(
            `SELECT * FROM daily_entries WHERE company = ? AND date <= ? order by sortOrder`,
            [company.name, endDate]
          ),
        ]);
        if (!accountHeads?.length || !entries?.length) {
          return;
        }
        // const accountHeadByID: Record<
        console.log(
          'calcCapitalAcc',
          await calcCapitalAcc(accountHeads, entries)
        );
        //   number,
        //   { total: number; entry: LocalTables<'account_head'> }
        // > = {};
        // accountHeads?.forEach((accountHead) => {
        //   accountHeadByID[accountHead.code] = {
        //     entry: JSON.parse(
        //       JSON.stringify(accountHead)
        //     ) as LocalTables<'account_head'>,
        //     total: 0,
        //   };
        // });
        // entries.forEach((entry) => {
        //   const sum = calculateTransactionEffect(entry, entry.main_code);
        //   if (
        //     !(
        //       accountHeadByID[entry.main_code].entry.hisaabGroup ===
        //         'Capital Account' &&
        //       (entry.date < startDate || entry.date > endDate)
        //     )
        //   ) {
        //     accountHeadByID[entry.main_code].total = jsNumberFix(
        //       accountHeadByID[entry.main_code].total + sum
        //     );
        //   }
        //   if (
        //     !(
        //       accountHeadByID[entry.main_code].entry.hisaabGroup ===
        //         'Capital Account' &&
        //       (entry.date < startDate || entry.date > endDate)
        //     )
        //   ) {
        //     accountHeadByID[entry.sub_code].total = jsNumberFix(
        //       accountHeadByID[entry.sub_code].total - sum
        //     );
        //   }
        // });
        // const filteredEntries = Object.values(accountHeadByID)
        //   .filter((accountHead) => {
        //     debugger;
        //     return (
        //       accountHead.total !== 0 &&
        //       accountHead.entry.hisaabGroup !== 'Income' &&
        //       accountHead.entry.hisaabGroup !== 'Expenses'
        //     );
        //   })
        //   .sort((a, b) => a.entry.name.localeCompare(b.entry.name));
        // // console.table(filteredEntries);
        // const byHisaabGroup: Record<
        //   string,
        //   {
        //     total: number;
        //     entries: Tables['account_head'][];
        //   }
        // > = {};
        // filteredEntries.forEach((entry) => {
        //   if (entry.entry.name === 'ASHOK KUMAR CAPITAL A/C') {
        //     return;
        //   }
        //   if (
        //     entry.entry.hisaabGroup === 'Cash Transaction' ||
        //     entry.entry.hisaabGroup === 'Sundry Debtors' ||
        //     entry.entry.hisaabGroup === 'Bank Account'
        //   ) {
        //     entry.entry.hisaabGroup = 'Current Assets';
        //   }
        //   if (!byHisaabGroup[entry.entry.hisaabGroup]) {
        //     byHisaabGroup[entry.entry.hisaabGroup] = {
        //       total: entry.total,
        //       entries: [entry.entry],
        //     };
        //   } else {
        //     byHisaabGroup[entry.entry.hisaabGroup].total = jsNumberFix(
        //       byHisaabGroup[entry.entry.hisaabGroup].total + entry.total
        //     );
        //     byHisaabGroup[entry.entry.hisaabGroup].entries = [
        //       ...byHisaabGroup[entry.entry.hisaabGroup].entries,
        //       entry.entry,
        //     ];
        //   }
        // });
        // console.log(byHisaabGroup);
      } catch (error) {
        console.log(error);
        errorToast(error);
      }
    };
    void fetchDetails();
  });

  return (
    <div className="p-4">
      <FYPicker
        onChange={([start, end]) => {
          setStartDate(start);
          setEndDate(end);
        }}
      />
    </div>
  );
}
