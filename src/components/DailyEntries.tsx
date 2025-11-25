import { useCallback, useEffect, useState } from 'react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
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
const CAPITAL_ACCOUNT_CODE = 1;

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
    } catch (error) {
      console.error(error);
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
        currentAccountHead.openingBalance + (dailyEntries?.[0].balance ?? 0)
      );
    } catch (error) {
      console.error(error);
      errorToast(error);
    }
  }, [company, currentAccountHead, date]);

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
        if (credit !== existingEntry.credit || debit !== existingEntry.debit) {
          if (credit === 0 && debit === 0) {
            await deleteRecord('daily_entries', {
              company: company?.name,
              sortOrder: existingEntry.sortOrder,
            });
            // await query<null>(
            //   `DELETE
            //          FROM daily_entries
            //          WHERE company = ?
            //            AND sortOrder = ?`,
            //   [company?.name, existingEntry.sortOrder],
            //   true
            // );
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
                                 AND sortOrder = ?`;
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
              existingEntry.sortOrder,
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
              existingEntry.sortOrder,
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
        sub_code: CAPITAL_ACCOUNT_CODE,
        description,
        credit,
        debit,
        sortOrder,
      });
      await create('daily_entries', {
        company: company.name,
        date,
        main_code: CAPITAL_ACCOUNT_CODE,
        sub_code: CASH_ACCOUNT_CODE,
        description,
        debit: credit,
        credit: debit,
        sortOrder,
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
            query<[{ sortOrder: number }]>(
              `SELECT sortOrder
               FROM daily_entries
               ORDER BY sortOrder DESC
               LIMIT 1`
            ),
          ]);
        let sortOrder = (sortOrderResponse?.[0].sortOrder ?? 0) + 1;
        // Process loan amount
        const loanAmountEntry = dailyEntry?.find(
          (entry) => entry.description === LOAN_AMOUNT
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
        const redemptionAmountEntry = dailyEntry?.find(
          (entry) => entry.description?.trim() === REDEMPTION_AMOUNT
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
        const redemptionInterestEntry = dailyEntry?.find(
          (entry) => entry.description === BEING_REDEEMED_LOAN_INTEREST
        );
        const newReleaseInterest = releaseTotalResponse?.[0].interest ?? 0;
        await upsertDailyEntry(
          BEING_REDEEMED_LOAN_INTEREST,
          newReleaseInterest,
          0,
          redemptionInterestEntry,
          sortOrder
        );
      } catch (error) {
        console.error(error);
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
      console.error(error);
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
    <div className="p-3 pb-30">
      <div className="flex gap-3 mb-4 mx-24">
        <div className="text-xl mr-auto">Cash Book</div>
        {currentAccountHead && (
          <NativeSelect
            value={currentAccountHead.name}
            onChange={(e) =>
              setCurrentAccountHead(getAccountByName(e.target.value) ?? null)
            }
          >
            {accountHeads.map((head) => (
              <NativeSelectOption key={head.name + head.code} value={head.name}>
                {head.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        )}
        <DatePicker
          className="w-27.5"
          value={date}
          onInputChange={setDate}
          navigated
        />
      </div>
      <DailyEntriesTables
        accountHeads={accountHeads}
        openingBalance={openingBalance}
        entries={todaysEntries}
        currentAccountHead={currentAccountHead}
        date={date}
        onLoadToday={loadTodayFromLoans}
      />
    </div>
  );
}
