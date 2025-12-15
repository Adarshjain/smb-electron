import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import DatePicker from '@/components/DatePicker.tsx';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { create, deleteRecord, query, read } from '@/hooks/dbUtil.ts';
import type { LocalTables, Tables } from '../../tables';
import { errorToast, successToast } from '@/lib/myUtils.tsx';
import { DailyEntriesTables } from '@/components/DailyEntriesTables.tsx';
import { useTabs } from '@/TabManager.tsx';

// Constants
const LOAN_AMOUNT = 'LOAN  AMOUNT';
const REDEMPTION_AMOUNT = 'REDEMPTION AMOUNT';
const BEING_REDEEMED_LOAN_INTEREST = 'BEING REDEEMED LOAN INTEREST';
const CASH_ACCOUNT_NAME = 'CASH';
const CASH_ACCOUNT_CODE = 14;
const LOAN_ACCOUNT_CODE = 1;
const INTEREST_ACCOUNT_CODE = 9;

export default function DailyEntries() {
  const { company } = useCompany();
  const { closeTab } = useTabs();

  const [date, setDate] = useState(company?.current_date ?? '');
  const [accountHeads, setAccountHeads] = useState<Tables['account_head'][]>(
    []
  );
  const [currentAccountHead, setCurrentAccountHead] = useState<
    Tables['account_head'] | null
  >(null);
  const [todaysEntries, setTodaysEntries] = useState<Tables['daily_entries'][]>(
    []
  );
  const [openingBalance, setOpeningBalance] = useState(0);
  const entryableAccountHeads = useMemo<Tables['account_head'][]>(
    () => accountHeads.filter((head) => head.code !== currentAccountHead?.code),
    [accountHeads, currentAccountHead?.code]
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

  const getAccountByName = useCallback(
    (name: string) => accountHeads.find((head) => head.name === name),
    [accountHeads]
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
      setTimeout(() => {
        document.getElementById('account_head')?.focus();
      }, 100);
    } catch (error) {
      errorToast(error);
    }
  }, [company]);

  const loadOpeningBalance = useCallback(async () => {
    if (!company || !currentAccountHead || !date) return;

    try {
      const q = `
        select SUM(credit - debit) as balance
        from daily_entries
        where company = ?
          and date < ?
          and deleted IS NULL
          and main_code = ?;
      `;

      const dailyEntries = await query<[{ balance: number }]>(q, [
        company.name,
        date,
        currentAccountHead.code,
      ]);

      setOpeningBalance(
        currentAccountHead.opening_balance + (dailyEntries?.[0].balance ?? 0)
      );
    } catch (error) {
      errorToast(error);
    }
  }, [company, currentAccountHead, date]);

  const upsertDailyEntry = useCallback(
    async (
      description: string,
      credit: number,
      debit: number,
      existingEntry: LocalTables<'daily_entries'> | undefined,
      sort_order: number,
      isInterest = false
    ) => {
      if (!company?.name || !date) return;

      if (existingEntry) {
        const isCrissCross =
          credit === existingEntry.debit &&
          debit === existingEntry.credit &&
          existingEntry.main_code ===
            (isInterest ? INTEREST_ACCOUNT_CODE : LOAN_ACCOUNT_CODE) &&
          existingEntry.sub_code === CASH_ACCOUNT_CODE;
        if (credit !== existingEntry.credit || debit !== existingEntry.debit) {
          if (isCrissCross) {
            return;
          }
          if (credit === 0 && debit === 0) {
            await deleteRecord('daily_entries', {
              company: company?.name,
              sort_order: existingEntry.sort_order,
              main_code: existingEntry.main_code,
              sub_code: existingEntry.sub_code,
            });
            await deleteRecord('daily_entries', {
              company: company?.name,
              sort_order: existingEntry.sort_order,
              sub_code: existingEntry.main_code,
              main_code: existingEntry.sub_code,
            });
            return;
          }
          const updateQuery = `UPDATE daily_entries
                               SET credit = ?,
                                   debit = ?,
                                   description = ?,
                                   synced = 0
                               WHERE company = ?
                                 AND date = ?
                                 AND main_code = ?
                                 AND sub_code = ?
                                 AND sort_order = ?`;
          await query<null>(
            updateQuery,
            [
              credit,
              debit,
              description,
              company.name,
              date,
              existingEntry.main_code,
              existingEntry.sub_code,
              existingEntry.sort_order,
            ],
            true
          );
          await query<null>(
            updateQuery,
            [
              debit,
              credit,
              description,
              company.name,
              date,
              existingEntry.sub_code,
              existingEntry.main_code,
              existingEntry.sort_order,
            ],
            true
          );
        }
        return;
      }
      if (credit === 0 && debit === 0) {
        return;
      }
      await create('daily_entries', {
        company: company.name,
        date,
        main_code: CASH_ACCOUNT_CODE,
        sub_code: isInterest ? INTEREST_ACCOUNT_CODE : LOAN_ACCOUNT_CODE,
        description,
        credit,
        debit,
        sort_order,
      });
      await create('daily_entries', {
        company: company.name,
        date,
        main_code: isInterest ? INTEREST_ACCOUNT_CODE : LOAN_ACCOUNT_CODE,
        sub_code: CASH_ACCOUNT_CODE,
        description,
        debit: credit,
        credit: debit,
        sort_order,
      });
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
            query<[{ total: number }]>(
              `SELECT SUM(loan_amount) as total 
               FROM bills 
               WHERE "date" = ? AND company = ?`,
              [date, company.name]
            ),
            query<[{ principal: number; interest: number }]>(
              `SELECT SUM(loan_amount) AS principal,
                      FLOOR(SUM(tax_interest_amount)) AS interest
               FROM releases
               WHERE company = ? AND date = ?`,
              [company.name, date]
            ),
            query<[{ sort_order: number }]>(
              `SELECT sort_order
               FROM daily_entries
               ORDER BY sort_order DESC
               LIMIT 1`
            ),
          ]);
        let sortOrder = (sortOrderResponse?.[0].sort_order ?? 0) + 1;
        // Process loan amount
        const loanAmountEntry = dailyEntry?.find((entry) =>
          entry.description?.includes(LOAN_AMOUNT)
        );
        const newLoanAmount = loanAmountTotal?.[0].total ?? 0;
        await upsertDailyEntry(
          LOAN_AMOUNT,
          0,
          newLoanAmount,
          loanAmountEntry,
          sortOrder
        );
        if (newLoanAmount > 0 && !loanAmountEntry) sortOrder += 1;

        // Process redemption amount
        const redemptionAmountEntry = dailyEntry?.find((entry) =>
          entry.description?.trim().includes(REDEMPTION_AMOUNT)
        );
        const newReleaseAmount = releaseTotalResponse?.[0].principal ?? 0;
        await upsertDailyEntry(
          REDEMPTION_AMOUNT,
          newReleaseAmount,
          0,
          redemptionAmountEntry,
          sortOrder
        );
        if (newReleaseAmount > 0 && !redemptionAmountEntry) sortOrder += 1;

        // Process redemption interest
        const redemptionInterestEntry = dailyEntry?.find((entry) =>
          entry.description?.includes(BEING_REDEEMED_LOAN_INTEREST)
        );
        const newReleaseInterest = releaseTotalResponse?.[0].interest ?? 0;
        await upsertDailyEntry(
          BEING_REDEEMED_LOAN_INTEREST,
          newReleaseInterest,
          0,
          redemptionInterestEntry,
          sortOrder,
          true
        );
      } catch (error) {
        errorToast(error);
      }
    },
    [company?.name, date, upsertDailyEntry]
  );

  const loadTodayFromLoans = async () => {
    if (!company?.name || !date) return;

    const dailyEntriesResponse = await read('daily_entries', {
      company: company.name,
      date,
    });

    // Update with today's loans and releases
    await loadTodaysLoansAndReleases(dailyEntriesResponse);
    await loadDailyEntries();
    successToast('Loaded!');
  };

  const loadDailyEntries = useCallback(async () => {
    if (!company?.name || !date) return;

    try {
      // Reload entries after updates
      setTodaysEntries(
        (await read('daily_entries', {
          company: company.name,
          main_code: currentAccountHead?.code ?? 0,
          date,
        })) ?? []
      );
    } catch (error) {
      errorToast(error);
    }
  }, [company?.name, currentAccountHead?.code, date]);

  useEffect(() => {
    void loadAccountHeads();
  }, [loadAccountHeads]);

  useEffect(() => {
    void loadOpeningBalance();
  }, [loadOpeningBalance]);

  useEffect(() => {
    void loadDailyEntries();
  }, [loadDailyEntries]);

  return (
    <div className="mx-2 mt-3 pb-30 min-w-[820px] max-w-[85%]">
      <div className="flex gap-3 mb-4 mx-24">
        <div className="text-xl mr-auto">Cash Book</div>
        {currentAccountHead && (
          <Select
            value={currentAccountHead.name}
            onValueChange={(value) =>
              setCurrentAccountHead(getAccountByName(value) ?? null)
            }
          >
            <SelectTrigger className="min-w-[300px]" id="account_head">
              <SelectValue placeholder="Account Head" />
            </SelectTrigger>
            <SelectContent className="bg-gray-600 text-white">
              {accountHeads.map((head) => (
                <SelectItem key={head.name + head.code} value={head.name}>
                  {head.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <DatePicker
          className="w-27.5"
          value={date}
          onInputChange={setDate}
          navigated
        />
      </div>
      <DailyEntriesTables
        accountHeads={entryableAccountHeads}
        openingBalance={openingBalance}
        entries={todaysEntries}
        currentAccountHead={currentAccountHead}
        date={date}
        onLoadToday={loadTodayFromLoans}
      />
    </div>
  );
}
