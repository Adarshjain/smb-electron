import { useCallback, useEffect, useState } from 'react';
import { useCompany } from '@/context/CompanyProvider.tsx';
import FYPicker from '@/components/FYPicker.tsx';
import { query, read } from '@/hooks/dbUtil.ts';
import type { Tables } from '../../tables';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { errorToast, formatCurrency, viewableDate } from '@/lib/myUtils.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTabs } from '@/TabManager.tsx';

const cache: Record<number, Tables['account_head'] | undefined> = {};

export default function EntriesByHead({
  accountHeadCode,
  year,
  range,
}: {
  accountHeadCode: number;
  year?: number;
  range?: [string, string];
}) {
  const { company } = useCompany();
  const { closeTab } = useTabs();
  const [currentAccountHead, setCurrentAccountHead] = useState<
    Tables['account_head'] | null
  >(null);
  const [accountHeads, setAccountHeads] = useState<Tables['account_head'][]>(
    []
  );
  const [entries, setEntries] = useState<Tables['daily_entries'][]>([]);

  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);

  const [openingBalance, setOpeningBalance] = useState(0);
  const [closingBalance, setClosingBalance] = useState(0);

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

  const getAccountByCode = useCallback(
    (code: number) => {
      if (cache[code]) {
        return cache[code];
      }
      const match = accountHeads.find((head) => head.code === code);
      cache[code] = match;
      return match;
    },
    [accountHeads]
  );

  const loadAccountHeads = useCallback(async () => {
    if (!company?.name) return;

    try {
      const accountHead = await read('account_head', { company: company.name });

      const sorted =
        accountHead?.sort((a, b) => a.name.localeCompare(b.name)) ?? [];
      setAccountHeads(sorted);

      const matchedAccount =
        sorted.find((head) => head.code === accountHeadCode) ?? null;
      setCurrentAccountHead(matchedAccount);
    } catch (error) {
      console.error(error);
      errorToast(error);
    }
  }, [company?.name, accountHeadCode]);

  const loadBalances = useCallback(async () => {
    if (!company || !currentAccountHead || !startDate) return;

    try {
      const openingBalanceQuery = `
        select SUM(credit - debit) as balance
        from daily_entries
        where company = ?
          and date < ?
          and main_code = ?;
      `;
      const closingBalanceQuery = `
        select SUM(credit - debit) as balance
        from daily_entries
        where company = ?
          and date <= ?
          and main_code = ?;
      `;

      const [openingBalanceResponse, closingBalanceResponse] =
        await Promise.all([
          query<[{ balance: number }]>(openingBalanceQuery, [
            company.name,
            startDate,
            currentAccountHead.code,
          ]),
          query<[{ balance: number }]>(closingBalanceQuery, [
            company.name,
            endDate,
            currentAccountHead.code,
          ]),
        ]);

      setOpeningBalance(
        currentAccountHead.openingBalance +
          (openingBalanceResponse?.[0].balance ?? 0)
      );
      setClosingBalance(
        currentAccountHead.openingBalance +
          (closingBalanceResponse?.[0].balance ?? 0)
      );
    } catch (error) {
      console.error(error);
      errorToast(error);
    }
  }, [company, currentAccountHead, endDate, startDate]);

  useEffect(() => {
    void loadAccountHeads();
  }, [loadAccountHeads]);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    if (!company) return;
    const fetchData = async () => {
      const response = await query<Tables['daily_entries'][]>(
        `select *
         from daily_entries
         where company = ?
           and main_code = ?
           and date >= ?
           and date <= ?
           and deleted IS NULL
         order by date`,
        [company.name, currentAccountHead?.code, startDate, endDate]
      );
      setEntries(response ?? []);
    };
    void fetchData();
  }, [currentAccountHead, company, endDate, startDate, loadAccountHeads]);

  return (
    <div className="flex gap-2 flex-col p-4 w-[70%] mx-auto">
      <div className="flex justify-center gap-12">
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
        <FYPicker
          year={year}
          range={range}
          onChange={([start, end]) => {
            setStartDate(start);
            setEndDate(end);
          }}
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="border-r py-1.5 h-[33px]">Date</TableHead>
            <TableHead className="border-r py-1.5 h-[33px]">Title</TableHead>
            <TableHead className="border-r py-1.5 h-[33px]">
              Description
            </TableHead>
            <TableHead className="border-r text-right py-1.5 h-[33px]">
              Credit
            </TableHead>
            <TableHead className="text-right py-1.5 h-[33px]">Debit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]">
              Opening Balance
            </TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r text-right py-1.5 h-[33px]">
              {openingBalance >= 0 ? formatCurrency(openingBalance, true) : ''}
            </TableCell>
            <TableCell className="text-right py-1.5 h-[33px]">
              {openingBalance < 0 ? formatCurrency(-openingBalance, true) : ''}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="py-1.5 h-[33px]"></TableCell>
          </TableRow>
          {entries.map((entry) => (
            <TableRow key={entry.sortOrder}>
              <TableCell className="border-r py-1.5 h-[33px]">
                {viewableDate(entry.date)}
              </TableCell>
              <TableCell className="border-r py-1.5 h-[33px]">
                {getAccountByCode(entry.sub_code)?.name}
              </TableCell>
              <TableCell className="border-r py-1.5 h-[33px]">
                {entry.description}
              </TableCell>
              <TableCell className="border-r text-right py-1.5 h-[33px]">
                {entry.credit !== 0 ? formatCurrency(entry.credit, true) : ''}
              </TableCell>
              <TableCell className="text-right py-1.5 h-[33px]">
                {entry.debit !== 0 ? formatCurrency(entry.debit, true) : ''}
              </TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]">
              Temp Balance
            </TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r text-right py-1.5 h-[33px]">
              {closingBalance - openingBalance >= 0
                ? formatCurrency(closingBalance - openingBalance, true)
                : ''}
            </TableCell>
            <TableCell className="text-right py-1.5 h-[33px]">
              {closingBalance - openingBalance < 0
                ? formatCurrency(-(closingBalance - openingBalance), true)
                : ''}
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="py-1.5 h-[33px]"></TableCell>
          </TableRow>
          <TableRow>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r py-1.5 h-[33px]">
              Closing Balance
            </TableCell>
            <TableCell className="border-r py-1.5 h-[33px]"></TableCell>
            <TableCell className="border-r text-right py-1.5 h-[33px]">
              {closingBalance >= 0 ? formatCurrency(closingBalance, true) : ''}
            </TableCell>
            <TableCell className="text-right py-1.5 h-[33px]">
              {closingBalance < 0 ? formatCurrency(-closingBalance, true) : ''}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
