import { memo, useEffect, useMemo, useState } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import ProductSelector from '@/components/ProductSelector';
import type { MetalType, Tables } from '@/../tables';
import type { Loan } from '@/types/loanForm';
import { FIELD_WIDTHS, KEYBOARD_SHORTCUTS } from '@/constants/loanForm';
import MyCache from '../../../MyCache.ts';
import { read } from '@/hooks/dbUtil.ts';
import { errorToast } from '@/lib/myUtils.tsx';
import { cn } from '@/lib/utils.ts';

interface BillingItemRowProps {
  index: number;
  control: Control<Loan>;
  metalType: MetalType;
  fieldsLength: number;
  onAddItem: () => void;
  onRemoveItem: () => void;
  onNavigateToNext: (fieldName: string) => void;
}

export const BillingItemRow = memo(function BillingItemRow({
  index,
  control,
  metalType,
  fieldsLength,
  onAddItem,
  onRemoveItem,
  onNavigateToNext,
}: BillingItemRowProps) {
  const [productsTable, setProductsTable] = useState<Tables['products'][]>([]);
  const products = useMemo(
    () =>
      productsTable
        .filter(
          (item) =>
            item.product_type === 'product' && item.metal_type === metalType
        )
        .map((item) => item.name),
    [metalType, productsTable]
  );

  const quality = useMemo(
    () =>
      productsTable
        .filter(
          (item) =>
            item.product_type === 'quality' && item.metal_type === 'Other'
        )
        .map((item) => item.name),
    [productsTable]
  );

  const extra = useMemo(
    () =>
      productsTable
        .filter(
          (item) => item.product_type === 'seal' && item.metal_type === 'Other'
        )
        .map((item) => item.name),
    [productsTable]
  );

  useEffect(() => {
    const run = async () => {
      const cacheKey = 'products';
      const cache = new MyCache<Tables['products'][]>(cacheKey);
      if (cache.has(cacheKey)) {
        setProductsTable(cache.get(cacheKey) ?? []);
        return;
      }
      const response = await read('products', {});
      try {
        if (response) {
          const productNames = response.sort((a, b) =>
            a.name.localeCompare(b.name)
          );
          setProductsTable(productNames);
          cache.set(cacheKey, productNames);
        } else {
          setProductsTable([]);
        }
      } catch (e) {
        errorToast(e);
      }
    };
    void run();
  }, []);

  const handleAddItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === KEYBOARD_SHORTCUTS.ADD_BILLING_ITEM) {
      e.preventDefault();
      onAddItem();
      queueMicrotask(() =>
        onNavigateToNext(`billing_items.${index + 1}.product`)
      );
    }
  };

  const handleRemoveItemKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === KEYBOARD_SHORTCUTS.REMOVE_BILLING_ITEM) {
      if (fieldsLength > 1) {
        e.preventDefault();
        onRemoveItem();
      }
    }
  };

  return (
    <div className="flex">
      <Controller
        name={`billing_items.${index}.product`}
        control={control}
        render={({ field }) => (
          <ProductSelector
            value={field.value}
            onChange={field.onChange}
            inputClassName={cn(
              FIELD_WIDTHS.PRODUCT_FIELD,
              'border-l-0 rounded-none !rounded-bl border-r-0'
            )}
            triggerWidth={FIELD_WIDTHS.PRODUCT_FIELD}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            options={products}
            inputName={`billing_items.${index}.product`}
            placeholder=""
            autoConvert
          />
        )}
      />

      <Controller
        name={`billing_items.${index}.quality`}
        control={control}
        render={({ field }) => (
          <ProductSelector
            value={field.value ?? undefined}
            onChange={field.onChange}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            options={quality}
            inputName={`billing_items.${index}.quality`}
            placeholder=""
            inputClassName={cn(
              FIELD_WIDTHS.QUALITY_FIELD,
              'border-l-0 !rounded-none border-r-0'
            )}
            triggerWidth={FIELD_WIDTHS.QUALITY_FIELD}
            autoConvert
          />
        )}
      />

      <Controller
        name={`billing_items.${index}.extra`}
        control={control}
        render={({ field }) => (
          <ProductSelector
            value={field.value ?? undefined}
            onKeyDown={handleAddItemKeyDown}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onChange={field.onChange}
            options={extra}
            inputName={`billing_items.${index}.extra`}
            placeholder=""
            inputClassName={cn(
              FIELD_WIDTHS.SEAL_FIELD,
              'border-l-0 !rounded-none'
            )}
            triggerWidth={FIELD_WIDTHS.SEAL_FIELD}
            autoConvert
          />
        )}
      />

      <Controller
        name={`billing_items.${index}.quantity`}
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onChange={(e) => {
              const val = e.target.value;
              field.onChange(val ? parseFloat(val) : 0);
            }}
            id={`billing_items.${index}.quantity`}
            name={`billing_items.${index}.quantity`}
            type="number"
            placeholder=""
            className="w-16 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        )}
      />

      <Controller
        name={`billing_items.${index}.ignore_weight`}
        control={control}
        render={({ field }) => (
          <Input
            {...field}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onBlur={() => {
              field.onChange(parseFloat(field.value || '0').toFixed(3));
            }}
            id={`billing_items.${index}.ignore_weight`}
            name={`billing_items.${index}.ignore_weight`}
            type="number"
            placeholder=""
            className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        )}
      />

      <Controller
        name={`billing_items.${index}.net_weight`}
        control={control}
        render={({ field }) => (
          <div>
            <Input
              onKeyDown={(e) => {
                handleAddItemKeyDown(e);
                handleRemoveItemKeyDown(e);
              }}
              {...field}
              onFocus={(e) => {
                e.currentTarget.select();
              }}
              onBlur={() => {
                field.onChange(parseFloat(field.value || '0').toFixed(3));
              }}
              id={`billing_items.${index}.net_weight`}
              name={`billing_items.${index}.net_weight`}
              type="number"
              placeholder=""
              className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}
      />

      <Controller
        name={`billing_items.${index}.gross_weight`}
        control={control}
        render={({ field }) => (
          <div>
            <Input
              {...field}
              disabled
              id={`billing_items.${index}.gross_weight`}
              name={`billing_items.${index}.gross_weight`}
              type="number"
              placeholder=""
              className="w-24 !opacity-100 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}
      />
    </div>
  );
});
