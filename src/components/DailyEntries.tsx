import { useCallback, useEffect, useState } from 'react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import DatePicker from '@/components/DatePicker.tsx';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { query, read } from '@/hooks/dbUtil.ts';
import type { Tables } from '../../tables';
import { formatCurrency, toastElectronResponse } from '@/lib/myUtils.tsx';

interface Row {
  key: string;
  title: string;
  description: string;
  debit: string;
  credit: string;
}

export default function DailyEntries() {
  const { company } = useCompany();
  const [date, setDate] = useState(company?.current_date);
  const [accountHeads, setAccountHeads] = useState<
    Tables['account_head']['Row'][]
  >([]);
  const [currentAccountHead, setCurrentAccountHead] = useState<
    Tables['account_head']['Row'] | null
  >(null);
  const [displayRows, setDisplayRows] = useState<Row[]>([]);

  const getAccountById = useCallback(
    (code: number): Tables['account_head']['Row'] | undefined => {
      return accountHeads.find((head) => head.code === code);
    },
    [accountHeads]
  );

  const getAccountByName = useCallback(
    (name: string): Tables['account_head']['Row'] | undefined => {
      return accountHeads.find((head) => head.name === name);
    },
    [accountHeads]
  );

  useEffect(() => {
    if (!currentAccountHead || !company) {
      return;
    }
    const run = async () => {
      const start = performance.now();
      const q = `SELECT * FROM daily_entries 
         where 
           (code_1 = ${currentAccountHead.code} or code_2 = ${currentAccountHead.code}) 
           AND "date" > '2020-03-01' AND "date" < '${company.current_date}' `;
      const queryResponse = await query<Tables['daily_entries']['Row'][]>(q);
      if (!queryResponse.success) {
        toastElectronResponse(queryResponse);
        return;
      }
      let total = 0;
      queryResponse.data?.forEach((entry) => {
        const credit =
          currentAccountHead?.code === entry.code_1
            ? entry.debit
            : entry.credit;
        const debit =
          currentAccountHead?.code === entry.code_1
            ? entry.credit
            : entry.debit;
        total += credit - debit;
      });
      console.log(
        currentAccountHead.openingBalance + total,
        performance.now() - start
      );
    };
    void run();
  }, [company, currentAccountHead]);

  useEffect(() => {
    if (!company?.name) return;

    const run = async () => {
      const accountHeadResponse = await read('account_head', {
        company: company.name,
      });
      if (!accountHeadResponse.success) {
        toastElectronResponse(accountHeadResponse);
        return;
      }
      const sortedHeads =
        accountHeadResponse.data?.sort((a, b) =>
          a.name.localeCompare(b.name)
        ) ?? [];

      setAccountHeads(sortedHeads);

      setCurrentAccountHead(
        accountHeadResponse.data?.find((head) => head.name === 'CASH') ?? null
      );
    };
    void run();
  }, [company?.name]);

  useEffect(() => {
    if (!company?.name || !date) return;

    const run = async () => {
      const dailyEntryResponse = await read('daily_entries', {
        company: company.name,
        date,
      });
      if (!dailyEntryResponse.success) {
        toastElectronResponse(dailyEntryResponse);
        return;
      }
      setDisplayRows(
        dailyEntryResponse.data
          ?.filter(
            (entry) =>
              getAccountById(entry.code_1)?.name === currentAccountHead?.name ||
              getAccountById(entry.code_2)?.name === currentAccountHead?.name
          )
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((entry) => {
            const credit =
              currentAccountHead?.code === entry.code_1
                ? entry.debit
                : entry.credit;
            const debit =
              currentAccountHead?.code === entry.code_1
                ? entry.credit
                : entry.debit;
            return {
              key: `${entry.code_1}-${entry.code_2}-${entry.credit}-${entry.debit}-${entry.sortOrder}`,
              title:
                getAccountById(
                  currentAccountHead?.code === entry.code_1
                    ? entry.code_2
                    : entry.code_1
                )?.name ?? '',
              description: entry.description,
              credit: credit === 0 ? '' : formatCurrency(credit, true),
              debit: debit === 0 ? '' : formatCurrency(debit, true),
            };
          }) ?? []
      );
    };
    void run();
  }, [
    company?.name,
    currentAccountHead?.code,
    currentAccountHead?.name,
    date,
    getAccountById,
  ]);

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
      {displayRows.length > 0 ? (
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
            {displayRows.map((row) => (
              <tr key={row.key} className="border-b">
                <td className="p-2">{row.title}</td>
                <td className="p-2">{row.description}</td>
                <td className="p-2 text-right">{row.credit}</td>
                <td className="p-2 text-right">{row.debit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="text-center text-gray-500 mt-4">No entries found</div>
      )}
    </div>
  );
}
