import { useCallback, useEffect, useState } from 'react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import DatePicker from '@/components/DatePicker.tsx';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { create, query, read } from '@/hooks/dbUtil.ts';
import type { LocalTables, Tables } from '../../tables';
import { errorToast, formatCurrency } from '@/lib/myUtils.tsx';

interface Row {
  key: string;
  title: string;
  description: string;
  debit: string;
  credit: string;
}

const LOAN_AMOUNT = 'LOAN AMOUNT';
const REDEMPTION_AMOUNT = 'REDEMPTION AMOUNT';
const BEING_REDEEMED_LOAN_INTEREST = 'BEING REDEEMED LOAN INTEREST';

export default function DailyEntries() {
  const { company } = useCompany();

  const [date, setDate] = useState(company?.current_date ?? '');
  const [accountHeads, setAccountHeads] = useState<
    Tables['account_head']['Row'][]
  >([]);
  const [currentAccountHead, setCurrentAccountHead] = useState<
    Tables['account_head']['Row'] | null
  >(null);
  const [displayRows, setDisplayRows] = useState<Row[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

  const getAccountById = useCallback(
    (code: number) => accountHeads.find((head) => head.code === code),
    [accountHeads]
  );

  const getAccountByName = useCallback(
    (name: string) => accountHeads.find((head) => head.name === name),
    [accountHeads]
  );

  const calculateTransactionEffect = useCallback(
    (entry: Tables['daily_entries']['Row'], accCode: number) => {
      const isPrimary = accCode === entry.code_1;
      const credit = isPrimary ? entry.debit : entry.credit;
      const debit = isPrimary ? entry.credit : entry.debit;
      return { credit: Number(credit), debit: Number(debit) };
    },
    []
  );

  const loadAccountHeads = useCallback(async () => {
    if (!company?.name) return;
    const accountHead = await read('account_head', { company: company.name });

    const sorted =
      accountHead?.sort((a, b) => a.name.localeCompare(b.name)) ?? [];
    setAccountHeads(sorted);

    // Default to CASH account
    const cashAccount = sorted.find((head) => head.name === 'CASH') ?? null;
    setCurrentAccountHead(cashAccount);
  }, [company]);

  const loadOpeningBalance = useCallback(async () => {
    if (!company || !currentAccountHead || !date) return;

    const q = `
      SELECT *
      FROM daily_entries
      WHERE (code_1 = ${currentAccountHead.code} OR code_2 = ${currentAccountHead.code})
        AND "date" > '2020-03-31'
        AND "date" < '${date}'
        AND company = '${company.name}'
      ORDER BY sortOrder
    `;

    const dailyEntries = await query<Tables['daily_entries']['Row'][]>(q);

    const total =
      dailyEntries?.reduce((sum, entry) => {
        const { credit, debit } = calculateTransactionEffect(
          entry,
          currentAccountHead.code
        );
        return Number((sum + credit - debit).toFixed(2));
      }, 0) ?? 0;

    setOpeningBalance(currentAccountHead.openingBalance + total);
  }, [company, currentAccountHead, date, calculateTransactionEffect]);

  const loadTodaysLoansAndReleases = useCallback(
    async (
      dailyEntry: LocalTables<'daily_entries'>[] | null | undefined
    ): Promise<undefined> => {
      if (!company?.name || !date) return;

      try {
        const loanAmountTotal = await query<{ total: number }>(
          `select SUM(loan_amount) as total from bills where "date" = '${date}' AND company='${company.name}'`
        );

        const releaseTotalResponse = await query<{
          principal: number;
          interest: number;
        }>(
          `SELECT SUM(loan_amount) AS principal,
              FLOOR(SUM(tax_interest_amount)) AS interest
       FROM releases
       WHERE company = '${company.name}'
         AND date = '${date}'
      `
        );

        const sortOrderResponse = await query<{
          sortOrder: number;
        }>(`select sortOrder
        from daily_entries
        order by sortOrder desc limit 1;`);

        let sortOrder = (sortOrderResponse?.sortOrder ?? 0) + 1;
        const loanAmountIndex = dailyEntry?.findIndex(
          (entry) => entry.description === LOAN_AMOUNT
        );
        const newLoanAmount = loanAmountTotal?.total ?? 0;
        if (newLoanAmount > 0) {
          if (loanAmountIndex === -1) {
            await create('daily_entries', {
              company: company.name,
              date,
              code_1: 14,
              code_2: 1,
              description: LOAN_AMOUNT,
              credit: newLoanAmount,
              debit: 0,
              sortOrder,
              particular: null,
              particular1: null,
            });
            sortOrder += 1;
          } else {
            await query<null>(`UPDATE daily_entries
                           SET credit=${newLoanAmount}
                           WHERE company = '${company.name}'
                             AND date = '${date}'
                             AND description = ${LOAN_AMOUNT}`);
          }
        }

        const redemptionAmountIndex = dailyEntry?.findIndex(
          (entry) => entry.description === REDEMPTION_AMOUNT
        );
        const newReleaseAmount = releaseTotalResponse?.principal ?? 0;
        if (newReleaseAmount > 0) {
          if (redemptionAmountIndex === -1) {
            await create('daily_entries', {
              company: company.name,
              date,
              code_1: 14,
              code_2: 1,
              description: REDEMPTION_AMOUNT,
              credit: 0,
              debit: newReleaseAmount,
              sortOrder,
              particular: null,
              particular1: null,
            });
            sortOrder += 1;
          } else {
            await query<null>(`UPDATE daily_entries
                           SET debit=${newReleaseAmount}
                           WHERE company = '${company.name}'
                             AND date = '${date}'
                             AND description = ${REDEMPTION_AMOUNT}`);
          }
        }

        const redemptionInterestIndex = dailyEntry?.findIndex(
          (entry) => entry.description === BEING_REDEEMED_LOAN_INTEREST
        );
        const newReleaseInterest = releaseTotalResponse?.interest ?? 0;
        if (newReleaseInterest > 0) {
          if (redemptionInterestIndex === -1) {
            await create('daily_entries', {
              company: company.name,
              date,
              code_1: 14,
              code_2: 1,
              description: REDEMPTION_AMOUNT,
              credit: 0,
              debit: newReleaseInterest,
              sortOrder,
              particular: null,
              particular1: null,
            });
          } else {
            await query<null>(`UPDATE daily_entries
                           SET debit=${newReleaseInterest}
                           WHERE company = '${company.name}'
                             AND date = '${date}'
                             AND description = ${BEING_REDEEMED_LOAN_INTEREST}`);
          }
        }
      } catch (error) {
        errorToast(error);
      }
    },
    [company?.name, date]
  );

  const loadDailyEntries = useCallback(async () => {
    if (!company?.name || !date || !currentAccountHead) return;

    const dailyEntriesResponse = await read('daily_entries', {
      company: company.name,
      date,
    });

    await loadTodaysLoansAndReleases(dailyEntriesResponse);

    const dailyEntry = await read('daily_entries', {
      company: company.name,
      date,
    });

    let runningTotal = 0;

    const filteredEntries =
      dailyEntry
        ?.filter(
          (e) =>
            getAccountById(e.code_1)?.name === currentAccountHead.name ||
            getAccountById(e.code_2)?.name === currentAccountHead.name
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((entry) => {
          const { credit, debit } = calculateTransactionEffect(
            entry,
            currentAccountHead.code
          );
          runningTotal = Number((runningTotal + credit - debit).toFixed(2));

          const title =
            getAccountById(
              currentAccountHead.code === entry.code_1
                ? entry.code_2
                : entry.code_1
            )?.name ?? '';

          return {
            key: `${entry.code_1}-${entry.code_2}-${entry.credit}-${entry.debit}-${entry.sortOrder}`,
            title,
            description: entry.description,
            credit: credit === 0 ? '' : formatCurrency(credit, true),
            debit: debit === 0 ? '' : formatCurrency(debit, true),
          };
        }) ?? [];

    setDisplayRows(filteredEntries);
    setClosingBalance(runningTotal + openingBalance);
  }, [
    company,
    currentAccountHead,
    date,
    openingBalance,
    calculateTransactionEffect,
    getAccountById,
    loadTodaysLoansAndReleases,
  ]);

  useEffect(() => {
    void loadAccountHeads();
  }, [loadAccountHeads]);

  useEffect(() => {
    void loadOpeningBalance();
  }, [loadOpeningBalance]);

  useEffect(() => {
    void loadDailyEntries();
  }, [loadDailyEntries]);

  const renderBalanceRow = (label: string, amount: number) => (
    <tr className="border-b">
      <td className="p-2">{label}</td>
      <td className="p-2"></td>
      <td className="p-2 text-right">
        {amount >= 0 ? formatCurrency(amount, true) : null}
      </td>
      <td className="p-2 text-right">
        {amount < 0 ? formatCurrency(-amount, true) : null}
      </td>
    </tr>
  );

  return (
    <div className="p-3">
      <div className="flex justify-between mb-4">
        {currentAccountHead && (
          <NativeSelect
            value={currentAccountHead.name}
            onChange={(e) =>
              setCurrentAccountHead(getAccountByName(e.target.value) ?? null)
            }
          >
            {accountHeads.map((head) => (
              <NativeSelectOption key={head.name} value={head.name}>
                {head.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <div className="text-xl">Daily Entry</div>
        <DatePicker
          className="w-27.5"
          value={date}
          onInputChange={setDate}
          navigated
        />
      </div>

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Title</th>
            <th className="text-left p-2">Description</th>
            <th className="text-right p-2">Credit</th>
            <th className="text-right p-2">Debit</th>
          </tr>
        </thead>
        <tbody>
          {renderBalanceRow('Opening Balance', openingBalance)}
          {displayRows.map((row) => (
            <tr key={row.key} className="border-b">
              <td className="p-2">{row.title}</td>
              <td className="p-2">{row.description}</td>
              <td className="p-2 text-right">{row.credit}</td>
              <td className="p-2 text-right">{row.debit}</td>
            </tr>
          ))}
          {renderBalanceRow('Closing Balance', closingBalance)}
        </tbody>
      </table>
    </div>
  );
}
