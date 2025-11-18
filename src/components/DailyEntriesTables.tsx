import { Controller, useFieldArray, useForm } from 'react-hook-form';
import * as z from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEnterNavigation } from '@/hooks/useEnterNavigation.ts';
import ProductSelector from '@/components/ProductSelector.tsx';
import type { Tables } from '../../tables';
import { useThanglish } from '@/context/ThanglishProvider.tsx';
import '../styles/DailyEntries.css';
import { Input } from '@/components/ui/input.tsx';
import { formatCurrency } from '@/lib/myUtils.tsx';

const dailyEntrySchema = z.object({
  entries: z.array(
    z.object({
      particular: z.string().optional().nullable(),
      description: z.string().optional(),
      credit: z.string().optional(),
      debit: z.string().optional(),
    })
  ),
});
export type DailyEntry = z.infer<typeof dailyEntrySchema>;

export function DailyEntriesTables(props: {
  currentAccountHead: Tables['account_head']['Row'] | null;
  accountHeads: Tables['account_head']['Row'][];
  entries: Tables['daily_entries']['Row'][];
  openingBalance: number;
}) {
  const { setIsTamil } = useThanglish();
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
  const { control, handleSubmit, reset } = useForm<DailyEntry>({
    resolver: zodResolver(dailyEntrySchema),
    defaultValues,
  });
  const fieldArray = useFieldArray({
    name: 'entries',
    control,
  });
  const dailyEntryItems = useMemo(() => {
    return fieldArray.fields
      .map((_, index) =>
        ['particular', 'description', 'credit', 'debit'].map(
          (field) => `entries.${index}.${field}`
        )
      )
      .flat();
  }, [fieldArray.fields]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const onSubmit = (data: DailyEntry) => {
    console.log(data);
  };

  const handleFormSubmit = useCallback(() => {
    void handleSubmit(onSubmit)();
  }, [handleSubmit, onSubmit]);

  const { setFormRef } = useEnterNavigation<DailyEntry>({
    fields: dailyEntryItems,
    onSubmit: handleFormSubmit,
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

    const filteredEntries =
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

          const particular =
            getAccountById(
              props.currentAccountHead?.code === entry.code_1
                ? entry.code_2
                : entry.code_1
            )?.name ?? '';

          return {
            particular,
            description: entry.description,
            credit: credit === 0 ? '' : credit.toFixed(2),
            debit: debit === 0 ? '' : debit.toFixed(2),
          };
        }) ?? [];

    while (filteredEntries.length <= 10) {
      filteredEntries.push({
        particular: '',
        debit: '',
        credit: '',
        description: '',
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

  return (
    <form ref={setFormRef} className="de-input-matrix">
      <div className="flex">
        <div className="px-3 py-1 min-w-[420px]">Title</div>
        <div className="px-3 py-1 flex-1">Description</div>
        <div className="px-3 py-1 min-w-48 text-right">Credit</div>
        <div className="px-3 py-1 min-w-48 text-right">Debit</div>
      </div>
      <div className="flex">
        <Input
          defaultValue="Opening Balance"
          disabled
          className="w-[420px] !opacity-100"
        />
        <div className="flex-1"></div>
        <Input
          disabled
          placeholder=""
          className="text-right w-48 !opacity-100"
          defaultValue={
            props.openingBalance >= 0
              ? formatCurrency(props.openingBalance, true)
              : ''
          }
        />
        <Input
          disabled
          placeholder=""
          className="text-right w-48 !opacity-100"
          defaultValue={
            props.openingBalance < 0
              ? formatCurrency(-props.openingBalance, true)
              : ''
          }
        />
      </div>
      {fieldArray.fields.map((_, index) => (
        <div key={index} className="flex">
          <Controller
            key={`entries.${index}.particular`}
            name={`entries.${index}.particular`}
            control={control}
            render={({ field }) => (
              <ProductSelector
                value={field.value ?? undefined}
                onChange={field.onChange}
                onFocus={(e) => {
                  e.currentTarget.select();
                }}
                options={props.accountHeads.map((account) => account.name)}
                inputName={`entries.${index}.particular`}
                placeholder=""
                triggerWidth={`min-w-[420px]`}
              />
            )}
          />
          <Controller
            name={`entries.${index}.description`}
            control={control}
            render={({ field }) => (
              <Input
                {...field}
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
                    field.value ? parseFloat(field.value || '0').toFixed(2) : ''
                  );
                }}
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
                    field.value ? parseFloat(field.value || '0').toFixed(2) : ''
                  );
                }}
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
          className="w-[420px] !opacity-100"
        />
        <div className="flex-1"></div>
        <Input
          disabled
          placeholder=""
          className="text-right w-48 !opacity-100"
          defaultValue={
            closingBalance >= 0 ? formatCurrency(closingBalance, true) : ''
          }
        />
        <Input
          disabled
          placeholder=""
          className="text-right w-48 !opacity-100"
          defaultValue={
            closingBalance < 0 ? formatCurrency(-closingBalance, true) : ''
          }
        />
      </div>
    </form>
  );
}
