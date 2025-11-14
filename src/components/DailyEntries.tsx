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
    const res = await read('account_head', { company: company.name });
    if (!res.success) return toastElectronResponse(res);

    const sorted = res.data?.sort((a, b) => a.name.localeCompare(b.name)) ?? [];
    setAccountHeads(sorted);

    // Default to CASH account
    const cashAccount = sorted.find((head) => head.name === 'CASH') ?? null;
    setCurrentAccountHead(cashAccount);
  }, [company]);

  const loadOpeningBalance = useCallback(async () => {
    if (!company || !currentAccountHead || !date) return;

    const q = `
      SELECT * FROM daily_entries 
      WHERE 
        (code_1 = ${currentAccountHead.code} OR code_2 = ${currentAccountHead.code})
        AND "date" > '2020-03-31'
        AND "date" < '${date}'
        AND company='${company.name}'
      ORDER BY sortOrder ASC
    `;

    const res = await query<Tables['daily_entries']['Row'][]>(q);
    if (!res.success) return toastElectronResponse(res);

    const total =
      res.data?.reduce((sum, entry) => {
        const { credit, debit } = calculateTransactionEffect(
          entry,
          currentAccountHead.code
        );
        return Number((sum + credit - debit).toFixed(2));
      }, 0) ?? 0;

    setOpeningBalance(currentAccountHead.openingBalance + total);
  }, [company, currentAccountHead, date, calculateTransactionEffect]);

  const loadDailyEntries = useCallback(async () => {
    if (!company?.name || !date || !currentAccountHead) return;

    const res = await read('daily_entries', {
      company: company.name,
      date,
    });

    if (!res.success) return toastElectronResponse(res);

    let runningTotal = 0;

    const filteredEntries =
      res.data
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
