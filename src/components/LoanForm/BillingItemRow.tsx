import { memo } from 'react';
import { type Control, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import ProductSelector from '@/components/ProductSelector';
import type { MetalType } from '@/../tables';
import type { Loan } from '@/types/loanForm';
import { KEYBOARD_SHORTCUTS } from '@/constants/loanForm';

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
  const handleAddItemKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === KEYBOARD_SHORTCUTS.ADD_BILLING_ITEM) {
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
        onRemoveItem();
      }
    }
  };

  return (
    <div className="flex">
      {/* Product */}
      <Controller
        name={`billing_items.${index}.product`}
        control={control}
        render={({ field }) => (
          <ProductSelector
            value={field.value}
            onChange={field.onChange}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            productType="product"
            metalType={metalType}
            inputName={`billing_items.${index}.product`}
            placeholder=""
            triggerWidth="min-w-[280px]"
          />
        )}
      />

      {/* Quality */}
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
            productType="quality"
            metalType="Other"
            inputName={`billing_items.${index}.quality`}
            placeholder=""
            triggerWidth="min-w-[280px]"
          />
        )}
      />

      {/* Seal/Extra */}
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
            productType="seal"
            metalType="Other"
            inputName={`billing_items.${index}.extra`}
            placeholder=""
            triggerWidth="min-w-[120px] w-[120px] max-w-[120px]"
          />
        )}
      />

      {/* Quantity */}
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

      {/* Ignore Weight */}
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
              field.onChange(parseFloat(field.value || '0').toFixed(2));
            }}
            id={`billing_items.${index}.ignore_weight`}
            name={`billing_items.${index}.ignore_weight`}
            type="number"
            placeholder=""
            className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
        )}
      />

      {/* Gross Weight */}
      <Controller
        name={`billing_items.${index}.gross_weight`}
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
                field.onChange(parseFloat(field.value || '0').toFixed(2));
              }}
              id={`billing_items.${index}.gross_weight`}
              name={`billing_items.${index}.gross_weight`}
              type="number"
              placeholder=""
              className="w-24 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        )}
      />
    </div>
  );
});
