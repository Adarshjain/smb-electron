import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import ProductSelector from '@/components/ProductSelector.tsx';
import type { Tables } from '../../tables';
import { useThanglish } from '@/context/ThanglishProvider.tsx';
import '../styles/DailyEntries.css';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { create, query } from '@/hooks/dbUtil.ts';
import { errorToast } from '@/lib/myUtils.tsx';

const dailyEntrySchema = z.object({
  entries: z.array(
    z.object({
      title: z.string().optional().nullable(),
      description: z.string().optional(),
      credit: z.string().optional(),
      debit: z.string().optional(),
      sortOrder: z.number(),
    })
  ),
});
export type DailyEntry = z.infer<typeof dailyEntrySchema>;

export function DailyEntriesTables(props: {
  currentAccountHead: Tables['account_head']['Row'] | null;
  accountHeads: Tables['account_head']['Row'][];
  entries: Tables['daily_entries']['Row'][];
  openingBalance: number;
  date: string;
}) {
  const { setIsTamil } = useThanglish();
  const { company } = useCompany();
  const [closingBalance, setClosingBalance] = useState(0);
  useEffect(() => {
    setIsTamil(false);
  }, [setIsTamil]);

  const defaultValues = useMemo<DailyEntry>(
    () => ({
      entries: [],
    }),
    []
  );
  const { control, reset } = useForm<DailyEntry>({
    resolver: zodResolver(dailyEntrySchema),
    defaultValues,
  });
  const fieldArray = useFieldArray({
    name: 'entries',
    control,
  });

  const enteredValues = useWatch({
    name: 'entries',
    control,
  });

  const dailyEntryItems = useMemo(() => {
    return fieldArray.fields
      .map((_, index) =>
        ['title', 'description', 'credit', 'debit'].map(
          (field) => `entries.${index}.${field}`
        )
      )
      .flat();
  }, [fieldArray.fields]);

  const { setFormRef } = useEnterNavigation<DailyEntry>({
    fields: dailyEntryItems,
  });

  const getAccountById = useCallback(
    (code: number) => props.accountHeads.find((head) => head.code === code),
    [props.accountHeads]
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

  useEffect(() => {
    if (!props.currentAccountHead) return;
    let runningTotal = 0;

    const filteredEntries: DailyEntry['entries'] =
      props.entries
        ?.filter(
          (e) =>
            getAccountById(e.code_1)?.name === props.currentAccountHead?.name ||
            getAccountById(e.code_2)?.name === props.currentAccountHead?.name
        )
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((entry) => {
          const { credit, debit } = calculateTransactionEffect(
            entry,
            props.currentAccountHead?.code ?? 0
          );
          runningTotal = Number((runningTotal + credit - debit).toFixed(2));

          const title =
            getAccountById(
              props.currentAccountHead?.code === entry.code_1
                ? entry.code_2
                : entry.code_1
            )?.name ?? '';

          return {
            title,
            description: entry.description ?? undefined,
            credit: credit === 0 ? '' : credit.toFixed(2),
            debit: debit === 0 ? '' : debit.toFixed(2),
            sortOrder: entry.sortOrder,
          };
        }) ?? [];

    while (filteredEntries.length <= 10) {
      filteredEntries.push({
        title: '',
        debit: '',
        credit: '',
        description: '',
        sortOrder: 0,
      });
    }

    reset({ entries: filteredEntries });
    setClosingBalance(runningTotal + props.openingBalance);
  }, [
    calculateTransactionEffect,
    getAccountById,
    props.currentAccountHead,
    props.entries,
    props.openingBalance,
    reset,
  ]);

  useEffect(() => {
    let runningTotal = 0;
    enteredValues
      .filter(
        (entry) =>
          entry.title &&
          (parseFloat(entry.debit ?? '0') || parseFloat(entry.credit ?? '0'))
      )
      .forEach((entry) => {
        runningTotal = Number(
          (
            runningTotal +
            parseFloat(!entry.credit ? '0' : '' + entry.credit) -
            parseFloat(!entry.debit ? '0' : '' + entry.debit)
          ).toFixed(2)
        );
      });
    setClosingBalance(runningTotal + props.openingBalance);
  }, [
    calculateTransactionEffect,
    enteredValues,
    props.currentAccountHead?.code,
    props.openingBalance,
  ]);

  const getAccountByName = useCallback(
    (name: string) => props.accountHeads.find((head) => head.name === name),
    [props.accountHeads]
  );

  const doEntriesMatch = (
    entry1: Tables['daily_entries']['Row'],
    entry2: Tables['daily_entries']['Row']
  ): boolean => {
    if (entry1.description !== entry2.description) {
      return false;
    }
    if (
      entry1.debit === entry2.debit &&
      entry1.credit === entry2.credit &&
      entry1.code_1 === entry2.code_1 &&
      entry1.code_2 === entry2.code_2
    ) {
      return true;
    }
    return (
      entry1.debit === entry2.credit &&
      entry2.debit === entry1.credit &&
      entry1.code_1 === entry2.code_2 &&
      entry1.code_2 === entry2.code_1
    );
  };

  const fetchDeletedRecords = (
    filteredEntries: DailyEntry['entries']
  ): number[] => {
    const arr2SortOrders = new Set(
      filteredEntries.map((item) => item.sortOrder)
    );
    return props.entries
      .filter((item) => !arr2SortOrders.has(item.sortOrder))
      .map((item) => item.sortOrder);
  };

  const saveDailyEntry = async () => {
    if (!company) return;
    try {
      let latestSortOrder = 0;
      const filteredEntries: DailyEntry['entries'] = enteredValues.filter(
        (entry) =>
          entry.title &&
          (parseFloat(entry.debit ?? '0') || parseFloat(entry.credit ?? '0'))
      );

      for (const entry of filteredEntries) {
        const account = getAccountByName(entry.title ?? '');
        const finalEntry: Tables['daily_entries']['Row'] = {
          // intentionally switched
          debit: parseFloat('' + entry.credit || '0'),
          // intentionally switched
          credit: parseFloat('' + entry.debit || '0'),
          company: company.name ?? '',
          date: props.date,
          sortOrder: entry.sortOrder,
          description: entry.description ?? null,
          code_1: props.currentAccountHead?.code ?? 0,
          code_2: account?.code ?? 0,
        };

        if (finalEntry.sortOrder === 0) {
          if (latestSortOrder === 0) {
            const sortOrderResp = await query<[{ sortOrder: number }]>(
              `SELECT sortOrder
               FROM daily_entries
               ORDER BY sortOrder DESC
               LIMIT 1`
            );
            latestSortOrder = sortOrderResp?.[0].sortOrder ?? 0;
          }
          latestSortOrder += 1;
          finalEntry.sortOrder = latestSortOrder;
          await create('daily_entries', finalEntry);
        } else {
          const matchedEntry = props.entries.find(
            (entry) => entry.sortOrder === finalEntry.sortOrder
          );
          const shouldUpdate =
            !matchedEntry || !doEntriesMatch(finalEntry, matchedEntry);
          if (shouldUpdate) {
            await query<null>(
              `UPDATE daily_entries
                       SET credit = ?, debit = ?, description = ?, code_1 = ?, code_2 = ?
                       WHERE company = ? AND date = ? AND sortOrder = ?`,
              [
                finalEntry.credit,
                finalEntry.debit,
                finalEntry.description,
                finalEntry.code_1,
                finalEntry.code_2,
                company.name,
                props.date,
                finalEntry.sortOrder,
              ],
              true
            );
          }
        }
      }
      const sortOrders = fetchDeletedRecords(filteredEntries);
      for (const order of sortOrders) {
        await query<null>(
          `DELETE FROM daily_entries where sortOrder = ? AND company = ? AND date = ?`,
          [order, company.name, props.date],
          true
        );
      }
      alert('Success!');
    } catch (e) {
      errorToast(e);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent, index: number) => {
    if (event.key === 'Delete') {
      fieldArray.remove(index);
      fieldArray.append({
        title: '',
        debit: '',
        credit: '',
        description: '',
        sortOrder: 0,
      });
    }
  };

  return (
    <>
      <form ref={setFormRef} className="de-input-matrix mx-24">
        <div className="flex">
          <div className="px-3 py-1 min-w-[480px]">Title</div>
          <div className="px-3 py-1 flex-1">Description</div>
          <div className="px-3 py-1 min-w-48 text-right">Credit</div>
          <div className="px-3 py-1 min-w-48 text-right">Debit</div>
        </div>
        <div className="flex">
          <Input
            defaultValue="Opening Balance"
            disabled
            className="w-[480px] !opacity-100"
          />
          <div className="flex-1"></div>
          <Input
            disabled
            placeholder=""
            className="text-right w-48 !opacity-100"
            value={
              props.openingBalance >= 0 ? props.openingBalance.toFixed(2) : ''
            }
          />
          <Input
            disabled
            placeholder=""
            className="text-right w-48 !opacity-100"
            value={
              props.openingBalance < 0 ? (-props.openingBalance).toFixed(2) : ''
            }
          />
        </div>
        {fieldArray.fields.map((row, index) => (
          <div key={JSON.stringify(row)} className="flex">
            <Controller
              name={`entries.${index}.title`}
              control={control}
              render={({ field }) => (
                <ProductSelector
                  value={field.value ?? undefined}
                  onChange={field.onChange}
                  onFocus={(e) => {
                    e.currentTarget.select();
                  }}
                  options={props.accountHeads.map((account) => account.name)}
                  inputName={`entries.${index}.title`}
                  placeholder=""
                  triggerWidth={`min-w-[480px]`}
                />
              )}
            />
            <Controller
              name={`entries.${index}.description`}
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  onKeyDown={(e) => handleInputKeyDown(e, index)}
                  onFocus={(e) => {
                    e.currentTarget.select();
                  }}
                  id={`entries.${index}.description`}
                  name={`entries.${index}.description`}
                  placeholder=""
                  className=""
                />
              )}
            />
            <Controller
              name={`entries.${index}.credit`}
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  onFocus={(e) => {
                    e.currentTarget.select();
                  }}
                  onBlur={() => {
                    field.onChange(
                      field.value
                        ? parseFloat(field.value || '0').toFixed(2)
                        : ''
                    );
                  }}
                  onKeyDown={(e) => handleInputKeyDown(e, index)}
                  id={`entries.${index}.credit`}
                  name={`entries.${index}.credit`}
                  type="number"
                  placeholder=""
                  className="min-w-48 w-48 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            />
            <Controller
              name={`entries.${index}.debit`}
              control={control}
              render={({ field }) => (
                <Input
                  {...field}
                  onFocus={(e) => {
                    e.currentTarget.select();
                  }}
                  onBlur={() => {
                    field.onChange(
                      field.value
                        ? parseFloat(field.value || '0').toFixed(2)
                        : ''
                    );
                  }}
                  onKeyDown={(e) => handleInputKeyDown(e, index)}
                  id={`entries.${index}.debit`}
                  name={`entries.${index}.debit`}
                  type="number"
                  placeholder=""
                  className="min-w-48 w-48 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            />
          </div>
        ))}
        <div className="flex">
          <Input
            defaultValue="Closing Balance"
            disabled
            className="w-[480px] !opacity-100"
          />
          <div className="flex-1"></div>
          <Input
            disabled
            placeholder=""
            className="text-right w-48 !opacity-100"
            value={closingBalance >= 0 ? closingBalance.toFixed(2) : ''}
          />
          <Input
            disabled
            placeholder=""
            className="text-right w-48 !opacity-100"
            value={closingBalance < 0 ? (-closingBalance).toFixed(2) : ''}
          />
        </div>
      </form>
      <div className="flex justify-center fixed bottom-0 left-0 right-0 py-3 border-t bg-gray-100 border-gray-200">
        <Button className="border-black" onClick={() => void saveDailyEntry()}>
          Update
        </Button>
      </div>
    </>
  );
}
