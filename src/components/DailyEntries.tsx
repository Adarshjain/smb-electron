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
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [closingBalance, setClosingBalance] = useState<number>(0);

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
    if (!currentAccountHead || !company || !currentAccountHead || date === '') {
      return;
    }
    const run = async () => {
      const q = `SELECT * FROM daily_entries 
         where 
           (code_1 = ${currentAccountHead.code} or code_2 = ${currentAccountHead.code}) 
           AND "date" > '2020-03-31' AND "date" < '${date}' AND company='${company.name}' order by sortOrder asc`;
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
        total = Number(
          (Number(total) + Number(credit) - Number(debit)).toFixed(2)
        );
      });
      setOpeningBalance(currentAccountHead.openingBalance + total);
    };
    void run();
  }, [company, currentAccountHead, date]);

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
    if (!company?.name || !date || !currentAccountHead) return;

    const run = async () => {
      const dailyEntryResponse = await read('daily_entries', {
        company: company.name,
        date,
      });
      if (!dailyEntryResponse.success) {
        toastElectronResponse(dailyEntryResponse);
        return;
      }
      let total = 0;
      setDisplayRows(
        dailyEntryResponse.data
          ?.filter(
            (entry) =>
              getAccountById(entry.code_1)?.name === currentAccountHead.name ||
              getAccountById(entry.code_2)?.name === currentAccountHead.name
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
            total = Number(
              (Number(total) + Number(credit) - Number(debit)).toFixed(2)
            );
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
      setClosingBalance(total + openingBalance);
    };
    void run();
  }, [company, currentAccountHead, date, getAccountById, openingBalance]);

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
          <tr className="border-b">
            <td className="p-2">Opening Balance</td>
            <td className="p-2"></td>
            <td className="p-2 text-right">
              {openingBalance > 0 || openingBalance === 0
                ? formatCurrency(openingBalance, true)
                : null}
            </td>
            <td className="p-2 text-right">
              {openingBalance > 0 || openingBalance === 0
                ? null
                : formatCurrency(-openingBalance, true)}
            </td>
          </tr>
          {displayRows.map((row) => (
            <tr key={row.key} className="border-b">
              <td className="p-2">{row.title}</td>
              <td className="p-2">{row.description}</td>
              <td className="p-2 text-right">{row.credit}</td>
              <td className="p-2 text-right">{row.debit}</td>
            </tr>
          ))}
          <tr className="border-b">
            <td className="p-2">Closing Balance</td>
            <td className="p-2"></td>
            <td className="p-2 text-right">
              {closingBalance > 0 || closingBalance === 0
                ? formatCurrency(closingBalance, true)
                : null}
            </td>
            <td className="p-2 text-right">
              {closingBalance > 0 || closingBalance === 0
                ? null
                : formatCurrency(-closingBalance, true)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
