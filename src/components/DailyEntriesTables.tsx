import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  type KeyboardEvent,
  memo,
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
import { errorToast, jsNumberFix, successToast } from '@/lib/myUtils.tsx';

const dailyEntrySchema = z.object({
  entries: z.array(
    z.object({
      title: z.string().optional().nullable(),
      description: z.string().optional(),
      credit: z.string().optional(),
      debit: z.string().optional(),
      sort_order: z.number(),
    })
  ),
});
export type DailyEntry = z.infer<typeof dailyEntrySchema>;

export const DailyEntriesTables = memo(function DailyEntriesTables({
  currentAccountHead,
  accountHeads,
  entries,
  openingBalance,
  date,
  onLoadToday,
}: {
  currentAccountHead: Tables['account_head'] | null;
  accountHeads: Tables['account_head'][];
  entries: Tables['daily_entries'][];
  openingBalance: number;
  date: string;
  onLoadToday: () => Promise<void>;
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
    (code: number) => accountHeads.find((head) => head.code === code),
    [accountHeads]
  );

  const initialLoad = useCallback(() => {
    if (!currentAccountHead) return;
    let runningTotal = 0;

    const filteredEntries: DailyEntry['entries'] =
      entries
        ?.sort((a, b) => a.sort_order - b.sort_order)
        .map((entry) => {
          runningTotal = jsNumberFix(runningTotal + entry.credit - entry.debit);

          const title = getAccountById(entry.sub_code)?.name ?? '';

          return {
            title,
            description: entry.description ?? undefined,
            credit: entry.credit === 0 ? '' : entry.credit.toFixed(2),
            debit: entry.debit === 0 ? '' : entry.debit.toFixed(2),
            sort_order: entry.sort_order,
          };
        }) ?? [];

    while (filteredEntries.length <= 10) {
      filteredEntries.push({
        title: '',
        debit: '',
        credit: '',
        description: '',
        sort_order: 0,
      });
    }

    reset({ entries: filteredEntries });
    setClosingBalance(runningTotal + openingBalance);
  }, [getAccountById, currentAccountHead, entries, openingBalance, reset]);

  const calculateClosingBalance = useCallback(() => {
    let runningTotal = 0;
    enteredValues
      .filter(
        (entry) =>
          entry.title &&
          (parseFloat(entry.debit ?? '0') || parseFloat(entry.credit ?? '0'))
      )
      .forEach((entry) => {
        runningTotal = jsNumberFix(
          runningTotal +
            parseFloat(!entry.credit ? '0' : '' + entry.credit) -
            parseFloat(!entry.debit ? '0' : '' + entry.debit)
        );
      });
    setClosingBalance(runningTotal + openingBalance);
  }, [enteredValues, openingBalance]);

  const getAccountByName = useCallback(
    (name: string) => accountHeads.find((head) => head.name === name),
    [accountHeads]
  );

  useEffect(() => initialLoad(), [initialLoad]);
  useEffect(() => calculateClosingBalance(), [calculateClosingBalance]);

  const fetchDeletedRecords = (
    filteredEntries: DailyEntry['entries']
  ): number[] => {
    const arr2SortOrders = new Set(
      filteredEntries.map((item) => item.sort_order)
    );
    return entries
      .filter((item) => !arr2SortOrders.has(item.sort_order))
      .map((item) => item.sort_order);
  };

  const doEntriesMatch = (
    entry1: Tables['daily_entries'],
    entry2: Tables['daily_entries']
  ): boolean => {
    if (entry1.description !== entry2.description) {
      return false;
    }
    return (
      entry1.debit === entry2.debit &&
      entry1.credit === entry2.credit &&
      entry1.main_code === entry2.main_code &&
      entry1.sub_code === entry2.sub_code
    );
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
        const finalEntry = {
          company: company.name ?? '',
          date: date,
          sort_order: entry.sort_order,
          description: entry.description ?? null,
        };
        const debit = parseFloat('' + entry.debit || '0');
        const credit = parseFloat('' + entry.credit || '0');
        const main_code = currentAccountHead?.code ?? 0;
        const sub_code = account?.code ?? 0;

        if (finalEntry.sort_order === 0) {
          if (latestSortOrder === 0) {
            const sortOrderResp = await query<[{ sort_order: number }]>(
              `SELECT sort_order
               FROM daily_entries
               ORDER BY sort_order DESC
               LIMIT 1`
            );
            latestSortOrder = sortOrderResp?.[0].sort_order ?? 0;
          }
          latestSortOrder += 1;
          finalEntry.sort_order = latestSortOrder;
          await create('daily_entries', {
            ...finalEntry,
            credit,
            debit,
            main_code,
            sub_code,
          });
          await create('daily_entries', {
            ...finalEntry,
            debit: credit,
            credit: debit,
            sub_code: main_code,
            main_code: sub_code,
          });
        } else {
          const matchedEntry = entries.find(
            (entry) => entry.sort_order === finalEntry.sort_order
          );
          const shouldUpdate =
            !matchedEntry ||
            !doEntriesMatch(
              {
                ...finalEntry,
                credit,
                debit,
                main_code,
                sub_code,
              },
              matchedEntry
            );
          if (shouldUpdate) {
            const updateQuery = `UPDATE daily_entries
                               SET credit = ?,
                                   debit = ?,
                                   description = ?
                               WHERE company = ?
                                 AND date = ?
                                 AND main_code = ?
                                 AND sub_code = ?
                                 AND sort_order = ?
                                 AND deleted IS NULL`;
            await query<null>(
              updateQuery,
              [
                credit,
                debit,
                finalEntry.description,
                company.name,
                date,
                main_code,
                sub_code,
                finalEntry.sort_order,
              ],
              true
            );
            await query<null>(
              updateQuery,
              [
                debit,
                credit,
                finalEntry.description,
                company.name,
                date,
                sub_code,
                main_code,
                finalEntry.sort_order,
              ],
              true
            );
          }
        }
      }
      const sortOrders = fetchDeletedRecords(filteredEntries);
      for (const order of sortOrders) {
        await query<null>(
          `UPDATE daily_entries
           SET synced  = 0,
               deleted = 1
           WHERE company = ?
             AND date = ?
             AND sort_order = ?
             AND deleted IS NULL`,
          [company.name, date, order],
          true
        );
      }
      successToast('Success!');
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
        sort_order: 0,
      });
    }
  };

  return (
    <>
      <form ref={setFormRef} className="de-input-matrix mx-24">
        <div className="flex">
          <div className="px-3 py-1 min-w-[300px]">Title</div>
          <div className="px-3 py-1 flex-1">Description</div>
          <div className="px-3 py-1 min-w-39 text-right">Credit</div>
          <div className="px-3 py-1 min-w-39 text-right">Debit</div>
        </div>
        <div className="flex">
          <Input
            defaultValue="Opening Balance"
            disabled
            className="w-[300px] !opacity-100"
          />
          <div className="flex-1"></div>
          <Input
            disabled
            placeholder=""
            className="text-right w-39 !opacity-100"
            value={openingBalance >= 0 ? openingBalance.toFixed(2) : ''}
          />
          <Input
            disabled
            placeholder=""
            className="text-right w-39 !opacity-100"
            value={openingBalance < 0 ? (-openingBalance).toFixed(2) : ''}
          />
        </div>
        {fieldArray.fields.map((row, index) => (
          <div key={row.sort_order} className="flex">
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
                  options={accountHeads.map((account) => account.name)}
                  inputName={`entries.${index}.title`}
                  placeholder=""
                  triggerWidth="min-w-[300px]"
                  autoConvert={false}
                  inputClassName="!border-0"
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
                  className="min-w-39 w-39 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                  className="min-w-39 w-39 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              )}
            />
          </div>
        ))}
        <div className="flex">
          <Input
            defaultValue="Closing Balance"
            disabled
            className="w-[300px] !opacity-100"
          />
          <div className="flex-1"></div>
          <Input
            disabled
            placeholder=""
            className="text-right w-39 !opacity-100"
            value={closingBalance >= 0 ? closingBalance.toFixed(2) : ''}
          />
          <Input
            disabled
            placeholder=""
            className="text-right w-39 !opacity-100"
            value={closingBalance < 0 ? (-closingBalance).toFixed(2) : ''}
          />
        </div>
      </form>
      <div className="flex justify-center gap-12 fixed bottom-0 left-0 right-0 py-3 border-t border-gray-200">
        <Button
          className="border-black"
          variant="outline"
          onClick={() => void onLoadToday()}
        >
          Load Today's Entries
        </Button>
        <Button className="border-black" onClick={() => void saveDailyEntry()}>
          Update
        </Button>
      </div>
    </>
  );
});
