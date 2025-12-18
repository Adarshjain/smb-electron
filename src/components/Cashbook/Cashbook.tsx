import CashbookSpreadSheet from '@/components/Cashbook/CashbookSpreadSheet.tsx';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { useTabs } from '@/TabManager.tsx';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Tables } from '../../../tables';
import { query, read } from '@/hooks/dbUtil.ts';
import { errorToast } from '@/lib/myUtils.tsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.tsx';
import DatePicker from '@/components/DatePicker.tsx';
import { updateTodayLoansAndReleases } from '@/components/Cashbook/utils/cashbookUtils.ts';

const CASH_ACCOUNT_NAME = 'CASH';

export default function Cashbook() {
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
    <div className="mx-2 mt-3 pb-5 h-full">
      <div className="flex gap-3 mb-4 mx-24 items-center">
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
          showDay
        />
      </div>
      <CashbookSpreadSheet
        accountHeads={entryableAccountHeads}
        openingBalance={openingBalance}
        entries={todaysEntries}
        currentAccountHead={currentAccountHead}
        date={date}
        onLoadToday={async () => {
          await updateTodayLoansAndReleases(date, company?.name ?? '');
          await loadDailyEntries();
        }}
        refreshEntries={loadDailyEntries}
      />
    </div>
  );
}
