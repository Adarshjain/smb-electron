import { memo } from 'react';
import { type Control, type UseFieldArrayReturn } from 'react-hook-form';
import { FieldLabel } from '@/components/ui/field';
import { BillingItemRow } from './BillingItemRow';
import type { Loan, BillingItem as BillingItemType } from '@/types/loanForm';
import type { MetalType } from '@/../tables';
import { FIELD_WIDTHS, DEFAULT_BILLING_ITEM } from '@/constants/loanForm';

interface BillingItemsTableProps {
  control: Control<Loan>;
  metalType: MetalType;
  fieldArray: UseFieldArrayReturn<Loan, 'billing_items', 'id'>;
  onNavigateToField: (fieldName: string) => void;
}

export const BillingItemsTable = memo(function BillingItemsTable({
  control,
  metalType,
  fieldArray,
  onNavigateToField,
}: BillingItemsTableProps) {
  const { fields, append, remove } = fieldArray;

  return (
    <>
      <div>
        {/* Table Headers */}
        <div className="flex input-matrix-title">
          <FieldLabel className={`block px-3 py-1 ${FIELD_WIDTHS.PRODUCT_FIELD}`}>
            Product
          </FieldLabel>
          <FieldLabel className={`block px-3 py-1 ${FIELD_WIDTHS.QUALITY_FIELD}`}>
            Quality
          </FieldLabel>
          <FieldLabel className={`block px-3 py-1 ${FIELD_WIDTHS.SEAL_FIELD}`}>
            Seal
          </FieldLabel>
          <FieldLabel className={`block px-3 py-1 ${FIELD_WIDTHS.QUANTITY_FIELD} text-right`}>
            Qty
          </FieldLabel>
          <FieldLabel className={`block px-3 py-1 ${FIELD_WIDTHS.WEIGHT_FIELD} text-right`}>
            Ignore Wt
          </FieldLabel>
          <FieldLabel className={`block px-3 py-1 ${FIELD_WIDTHS.WEIGHT_FIELD} text-right`}>
            Gross Wt
          </FieldLabel>
        </div>

        {/* Table Rows */}
        <div className="flex input-matrix flex-col">
          {fields.map((field, i) => (
            <BillingItemRow
              key={field.id}
              index={i}
              control={control}
              metalType={metalType}
              fieldsLength={fields.length}
              onAddItem={() => append(DEFAULT_BILLING_ITEM as BillingItemType)}
              onRemoveItem={() => remove(i)}
              onNavigateToNext={onNavigateToField}
            />
          ))}
        </div>
      </div>
    </>
  );
});

