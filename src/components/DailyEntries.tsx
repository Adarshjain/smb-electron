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

// Constants
const LOAN_AMOUNT = 'LOAN AMOUNT';
const REDEMPTION_AMOUNT = 'REDEMPTION AMOUNT';
const BEING_REDEEMED_LOAN_INTEREST = 'BEING REDEEMED LOAN INTEREST';
const CASH_ACCOUNT_NAME = 'CASH';
const DEFAULT_ACCOUNT_CODE_1 = 14;
const DEFAULT_ACCOUNT_CODE_2 = 1;
const MIN_DATE = '2020-03-31';

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

    try {
      const accountHead = await read('account_head', { company: company.name });

      const sorted =
        accountHead?.sort((a, b) => a.name.localeCompare(b.name)) ?? [];
      setAccountHeads(sorted);

      // Default to CASH account
      const cashAccount =
        sorted.find((head) => head.name === CASH_ACCOUNT_NAME) ?? null;
      setCurrentAccountHead(cashAccount);
    } catch (error) {
      errorToast(error);
    }
  }, [company]);

  const loadOpeningBalance = useCallback(async () => {
    if (!company || !currentAccountHead || !date) return;

    try {
      const q = `
        SELECT *
        FROM daily_entries
        WHERE (code_1 = ? OR code_2 = ?)
          AND "date" > ?
          AND "date" < ?
          AND company = ?
        ORDER BY sortOrder
      `;

      const dailyEntries = await query<Tables['daily_entries']['Row'][]>(q, [
        currentAccountHead.code,
        currentAccountHead.code,
        MIN_DATE,
        date,
        company.name,
      ]);

      const total =
        dailyEntries?.reduce((sum, entry) => {
          const { credit, debit } = calculateTransactionEffect(
            entry,
            currentAccountHead.code
          );
          return Number((sum + credit - debit).toFixed(2));
        }, 0) ?? 0;

      setOpeningBalance(currentAccountHead.openingBalance + total);
    } catch (error) {
      errorToast(error);
    }
  }, [company, currentAccountHead, date, calculateTransactionEffect]);

  const upsertDailyEntry = useCallback(
    async (
      description: string,
      credit: number,
      debit: number,
      existingEntry: LocalTables<'daily_entries'> | undefined,
      sortOrder: number
    ) => {
      if (!company?.name || !date) return;

      if (existingEntry) {
        // Update existing entry using parameterized query
        await query<null>(
          `UPDATE daily_entries
           SET credit = ?, debit = ?
           WHERE company = ? AND date = ? AND description = ?`,
          [credit, debit, company.name, date, description]
        );
      } else {
        // Create new entry
        await create('daily_entries', {
          company: company.name,
          date,
          code_1: DEFAULT_ACCOUNT_CODE_1,
          code_2: DEFAULT_ACCOUNT_CODE_2,
          description,
          credit,
          debit,
          sortOrder,
          particular: null,
          particular1: null,
        });
      }
    },
    [company?.name, date]
  );

  const loadTodaysLoansAndReleases = useCallback(
    async (
      dailyEntry: LocalTables<'daily_entries'>[] | null | undefined
    ): Promise<void> => {
      if (!company?.name || !date) return;

      try {
        // Fetch all required data in parallel
        const [loanAmountTotal, releaseTotalResponse, sortOrderResponse] =
          await Promise.all([
            query<{ total: number }>(
              `SELECT SUM(loan_amount) as total 
               FROM bills 
               WHERE "date" = ? AND company = ?`,
              [date, company.name]
            ),
            query<{
              principal: number;
              interest: number;
            }>(
              `SELECT SUM(loan_amount) AS principal,
                      FLOOR(SUM(tax_interest_amount)) AS interest
               FROM releases
               WHERE company = ? AND date = ?`,
              [company.name, date]
            ),
            query<{ sortOrder: number }>(
              `SELECT sortOrder
               FROM daily_entries
               ORDER BY sortOrder DESC
               LIMIT 1`
            ),
          ]);

        let sortOrder = (sortOrderResponse?.sortOrder ?? 0) + 1;

        // Process loan amount
        const loanAmountEntry = dailyEntry?.find(
          (entry) => entry.description === LOAN_AMOUNT
        );
        const newLoanAmount = loanAmountTotal?.total ?? 0;
        if (newLoanAmount > 0) {
          await upsertDailyEntry(
            LOAN_AMOUNT,
            newLoanAmount,
            0,
            loanAmountEntry,
            sortOrder
          );
          if (!loanAmountEntry) sortOrder += 1;
        }

        // Process redemption amount
        const redemptionAmountEntry = dailyEntry?.find(
          (entry) => entry.description === REDEMPTION_AMOUNT
        );
        const newReleaseAmount = releaseTotalResponse?.principal ?? 0;
        if (newReleaseAmount > 0) {
          await upsertDailyEntry(
            REDEMPTION_AMOUNT,
            0,
            newReleaseAmount,
            redemptionAmountEntry,
            sortOrder
          );
          if (!redemptionAmountEntry) sortOrder += 1;
        }

        // Process redemption interest
        const redemptionInterestEntry = dailyEntry?.find(
          (entry) => entry.description === BEING_REDEEMED_LOAN_INTEREST
        );
        const newReleaseInterest = releaseTotalResponse?.interest ?? 0;
        if (newReleaseInterest > 0) {
          await upsertDailyEntry(
            BEING_REDEEMED_LOAN_INTEREST,
            0,
            newReleaseInterest,
            redemptionInterestEntry,
            sortOrder
          );
        }
      } catch (error) {
        errorToast(error);
      }
    },
    [company?.name, date, upsertDailyEntry]
  );

  const loadDailyEntries = useCallback(async () => {
    if (!company?.name || !date || !currentAccountHead) return;

    try {
      // Load initial entries
      const dailyEntriesResponse = await read('daily_entries', {
        company: company.name,
        date,
      });

      // Update with today's loans and releases
      await loadTodaysLoansAndReleases(dailyEntriesResponse);

      // Reload entries after updates
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
    } catch (error) {
      errorToast(error);
    }
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

  const renderBalanceRow = useCallback(
    (label: string, amount: number) => (
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
    ),
    []
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
