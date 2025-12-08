import FYPicker from '@/components/FYPicker.tsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { query, read } from '@/hooks/dbUtil.ts';
import { useCompany } from '@/context/CompanyProvider.tsx';
import {
  datesToRange,
  errorToast,
  formatCurrency,
  jsNumberFix,
  viewableDate,
} from '@/lib/myUtils.tsx';
import type { LocalTables } from '../../tables';
import { cn } from '@/lib/utils.ts';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PrinterIcon, SearchIcon } from 'lucide-react';
import EntriesByHead from '@/components/EntriesByHead.tsx';
import { useTabs } from '@/TabManager.tsx';
import { usePrintSection } from '@/hooks/usePrintSection.ts';
import ProfitAndLoss from '@/components/ProfitAndLoss.tsx';

const TypeVsHisaabGroup = {
  liabilities: ['Bank OD A/c', 'Sundry Creditors'],
  assets: [
    'Loans & Advances',
    'Fixed Assets',
    'Sundry Debtors',
    'Bank Account',
  ],
};

const HisaabGroupVsType: Record<string, 'liabilities' | 'assets'> = {
  'Bank OD A/c': 'liabilities',
  'Sundry Creditors': 'liabilities',
  'Loans & Advances': 'assets',
  'Fixed Assets': 'assets',
  'Sundry Debtors': 'assets',
  'Bank Account': 'assets',
};

export default function BalanceSheet() {
  const { company } = useCompany();
  const { openTab, closeTab } = useTabs();
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [displayLiabilitiesRows, setDisplayLiabilitiesRows] = useState<
    [string, string, string, number | undefined][]
  >([]);
  const [displayAssetRows, setDisplayAssetRows] = useState<
    [string, string, string, number | undefined][]
  >([]);

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = usePrintSection(
    printRef,
    `${company?.name} Balance Sheet.pdf`
  );

  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if (e.key === 'F6') {
        closeTab();
      }
    };

    window.addEventListener('keydown', listener);

    return () => {
      window.removeEventListener('keydown', listener);
    };
  }, [closeTab]);

  const calcCapitalAcc = useCallback(
    async (
      mainAccountHead: LocalTables<'account_head'> | undefined
    ): Promise<number> => {
      if (!company || !startDate || !endDate) return 0;
      const [netProfitResponse, capSumResponse] = await Promise.all([
        query<[{ netProfit: number }]>(
          `SELECT (SELECT ABS(SUM(de.credit - de.debit))
                 FROM daily_entries de
                        JOIN account_head ah
                             ON ah.code = de.main_code
                 WHERE de.company = ?
                   AND ah.company = ?
                   AND de.date < ?
                   AND ah.hisaab_group = 'Income')
                             -
                (SELECT SUM(de.credit - de.debit)
                 FROM daily_entries de
                        JOIN account_head ah
                             ON ah.code = de.main_code
                 WHERE de.company = ?
                   AND ah.company = ?
                   AND de.date < ?
                   AND ah.hisaab_group = 'Expenses')
                             AS netProfit`,
          [
            company.name,
            company.name,
            startDate,
            company.name,
            company.name,
            startDate,
          ]
        ),
        query<[{ cap_sum: number }]>(
          `SELECT SUM(de.credit - de.debit) AS cap_sum
         FROM account_head ah
                LEFT JOIN daily_entries de
                          ON de.main_code = ah.code
         WHERE ah.hisaab_group = 'Capital Account'
           ANd ah.company = ?
           ANd de.company = ?
           and de.date < ?`,
          [company.name, company.name, startDate]
        ),
      ]);

      const netProfit = jsNumberFix(netProfitResponse?.[0].netProfit ?? 0);
      const capSum = jsNumberFix(capSumResponse?.[0].cap_sum ?? 0);
      const openingBalance = mainAccountHead?.opening_balance ?? 0;

      return jsNumberFix(netProfit + openingBalance - capSum);
    },
    [company, endDate, startDate]
  );

  useEffect(() => {
    if (!startDate || !endDate || !company) return;
    const fetchDetails = async () => {
      const capitalEntriesQuery = query<
        { code: number; name: string; net: number }[]
      >(
        `SELECT ah.code,
                    ah.name,
                    -(SUM(de.credit) - SUM(de.debit)) AS net
             FROM account_head AS ah
                    LEFT JOIN daily_entries AS de
                              ON ah.code = de.main_code
                                AND de.company = ?
                                AND de.date >= ?
                                AND de.date <= ?
             WHERE ah.company = ?
               AND ah.hisaab_group = 'Capital Account'
             GROUP BY ah.code, ah.name, ah.hisaab_group
             HAVING (SUM(de.debit) IS NOT NULL
               OR SUM(de.credit) IS NOT NULL)
                AND net != 0
             ORDER BY ah.name;`,
        [company.name, startDate, endDate, company.name]
      );
      const entriesByHisaabGroupQuery = query<
        { code: number; name: string; hisaab_group: string; net: number }[]
      >(
        `SELECT ah.code,
                      ah.name,
                      ah.hisaab_group,
                      ah.opening_balance + (COALESCE(SUM(de.credit), 0) - COALESCE(SUM(de.debit), 0)) AS net
               FROM account_head AS ah
                      LEFT JOIN daily_entries AS de
                                ON ah.code = de.main_code
                                  AND de.company = ?
                                  AND de.date <= ?
               WHERE ah.company = ?
                 AND ah.hisaab_group NOT IN ('Income', 'Expenses', 'Capital Account')
               GROUP BY ah.code, ah.name, ah.hisaab_group, ah.opening_balance
               HAVING ABS(net) > 0.001
               ORDER BY ah.name;
              `,
        [company.name, endDate, company.name]
      );
      try {
        const [capitalEntries, entriesByHisaabGroup, mainAccountHead] =
          await Promise.all([
            capitalEntriesQuery,
            entriesByHisaabGroupQuery,
            read('account_head', {
              company: company.name,
              name: 'CAPITAL A/C',
            }),
          ]);

        const assetRows: [string, string, string, number | undefined][] = [];
        const liabilitiesRows: [string, string, string, number | undefined][] =
          [];

        const openingBalance = await calcCapitalAcc(mainAccountHead?.[0]);
        let capitalTotal = openingBalance;
        if (capitalEntries?.length) {
          const capitalRows: [string, string, string, number | undefined][] =
            [];

          capitalEntries.forEach((entry) => {
            capitalTotal = jsNumberFix(capitalTotal + entry.net);
            capitalRows.push([
              entry.name,
              formatCurrency(entry.net, true),
              '',
              entry.code,
            ]);
          });

          capitalRows.unshift([
            'Capital Account Opening Balance',
            formatCurrency(openingBalance, true),
            '',
            undefined,
          ]);
          capitalRows.unshift([
            'Capital Account',
            '',
            formatCurrency(capitalTotal, true),
            undefined,
          ]);
          liabilitiesRows.push(...capitalRows);
        }

        const entries: Record<
          string,
          {
            name: string;
            total: number;
            entries: [string, string, string, number | undefined][];
          }
        > = {};

        entriesByHisaabGroup?.forEach((entry) => {
          if (
            entry.name === 'CASH' ||
            entry.hisaab_group === 'Sundry Debtors'
          ) {
            entry.hisaab_group = 'Bank Account';
          }
          const netValue =
            HisaabGroupVsType[entry.hisaab_group] === 'liabilities'
              ? -entry.net
              : entry.net;
          const lineItem: [string, string, string, number | undefined] = [
            entry.name,
            formatCurrency(netValue, true),
            '',
            entry.code,
          ];
          if (!entries[entry.hisaab_group]) {
            entries[entry.hisaab_group] = {
              name: entry.hisaab_group,
              total: netValue,
              entries: [lineItem],
            };
          } else {
            entries[entry.hisaab_group].entries.push(lineItem);
            entries[entry.hisaab_group].total = jsNumberFix(
              entries[entry.hisaab_group].total + netValue
            );
          }
        });

        let liabilitesTotal = 0;
        let assetsTotal = 0;

        TypeVsHisaabGroup.liabilities.forEach((type) => {
          if (!entries[type]) {
            return;
          }
          liabilitesTotal = jsNumberFix(liabilitesTotal + entries[type].total);
          liabilitiesRows.push([
            type,
            '',
            formatCurrency(entries[type].total, true),
            undefined,
          ]);
          liabilitiesRows.push(...entries[type].entries);
        });
        TypeVsHisaabGroup.assets.forEach((type) => {
          if (!entries[type]) {
            return;
          }
          assetsTotal = jsNumberFix(assetsTotal + entries[type].total);

          assetRows.push([
            type,
            '',
            formatCurrency(entries[type].total, true),
            undefined,
          ]);
          assetRows.push(...entries[type].entries);
        });

        liabilitiesRows.push(['', '', '', undefined]);
        assetRows.push(['', '', '', undefined]);

        while (liabilitiesRows.length < assetRows.length) {
          liabilitiesRows.push(['', '', '', undefined]);
        }
        while (assetRows.length < liabilitiesRows.length) {
          assetRows.push(['', '', '', undefined]);
        }
        const netProfit = assetsTotal - liabilitesTotal - capitalTotal;
        liabilitiesRows.push([
          'Net Profit',
          '',
          formatCurrency(netProfit, true),
          -1,
        ]);
        liabilitiesRows.push([
          'Total',
          '',
          formatCurrency(netProfit + capitalTotal + liabilitesTotal, true),
          undefined,
        ]);
        liabilitiesRows.push([
          'Capital Account Closing Balance',
          '',
          formatCurrency(netProfit + capitalTotal, true),
          undefined,
        ]);
        assetRows.push(['', '', '', undefined]);
        assetRows.push([
          'Total',
          '',
          formatCurrency(assetsTotal, true),
          undefined,
        ]);
        assetRows.push(['', '', '', undefined]);

        setDisplayLiabilitiesRows(liabilitiesRows);
        setDisplayAssetRows(assetRows);
      } catch (error) {
        errorToast(error);
      }
    };
    void fetchDetails();
  }, [calcCapitalAcc, company, endDate, startDate]);

  return (
    <div className="p-4">
      <div className="flex justify-around">
        <div className="text-xl">Liabilities</div>
        <FYPicker
          onChange={([start, end]) => {
            setStartDate(start);
            setEndDate(end);
          }}
        />
        <div className="text-xl">Assets</div>
        <PrinterIcon onClick={handlePrint} className="cursor-pointer" />
      </div>
      <div className="flex mt-2 pdf flex-col" ref={printRef}>
        <div className="hidden pdf-header text-center pt-4">
          <div className="text-sm">{company?.name}</div>
          <div className="text-xs">Balance Sheet</div>
          <div className="text-xs">
            {viewableDate(startDate ?? '')} - {viewableDate(endDate ?? '')}
          </div>
        </div>
        <div className="flex gap-2">
          {[displayLiabilitiesRows, displayAssetRows].map((type, typeIndex) => (
            <Table key={typeIndex}>
              <TableBody>
                {type.map((row, outerIndex) => (
                  <TableRow
                    key={JSON.stringify(row) + outerIndex}
                    className="group"
                  >
                    {row.map((cell, index) =>
                      index < 3 ? (
                        <TableCell
                          key={JSON.stringify(cell) + index}
                          className={cn(
                            'py-1.5 h-[33px]',
                            index !== 0 ? 'text-right border-l' : ''
                          )}
                        >
                          <div className="flex justify-between">
                            {row[3] !== undefined &&
                              (row[3] === -1 ? index === 2 : index === 1) && (
                                <SearchIcon
                                  size={18}
                                  className="opacity-0 group-hover:opacity-100 cursor-pointer"
                                  onClick={() => {
                                    if (row[3] === -1) {
                                      openTab(
                                        'Profit & Loss',
                                        <ProfitAndLoss
                                          year={
                                            datesToRange(
                                              startDate ?? '',
                                              endDate ?? ''
                                            ).year
                                          }
                                          range={
                                            datesToRange(
                                              startDate ?? '',
                                              endDate ?? ''
                                            ).range
                                          }
                                        />
                                      );
                                    } else {
                                      openTab(
                                        'Entry Details',
                                        <EntriesByHead
                                          accountHeadCode={row[3]!}
                                          year={
                                            datesToRange(
                                              startDate ?? '',
                                              endDate ?? ''
                                            ).year
                                          }
                                          range={
                                            datesToRange(
                                              startDate ?? '',
                                              endDate ?? ''
                                            ).range
                                          }
                                        />
                                      );
                                    }
                                  }}
                                />
                              )}
                            <div className="flex-1">{cell}</div>
                          </div>
                        </TableCell>
                      ) : null
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
        </div>
      </div>
    </div>
  );
}
