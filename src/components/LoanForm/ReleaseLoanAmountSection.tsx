import { type ChangeEvent, memo } from 'react';
import { type Control } from 'react-hook-form';
import { FormNumberInput } from './FormNumberInput';
import type { ReleaseLoan } from '@/types/loanForm';
import { FIELD_WIDTHS } from '@/constants/loanForm';
import { cn } from '@/lib/utils.ts';

interface LoanAmountSectionProps {
  control: Control<ReleaseLoan>;
  onInterestChange: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

export const ReleaseLoanAmountSection = memo(function ReleaseLoanAmountSection({
  control,
  onInterestChange,
  className,
}: LoanAmountSectionProps) {
  return (
    <div
      className={cn(
        `flex flex-col ${FIELD_WIDTHS.AMOUNT_COLUMN} input-column`,
        className
      )}
    >
      <FormNumberInput
        name="loan_amount"
        control={control}
        label="Amount"
        suffix="₹"
        placeholder="Amount"
        className="!opacity-100 tabular-nums"
        disabled
      />

      <FormNumberInput
        name="interest_rate"
        control={control}
        label="Percent"
        suffix="%"
        placeholder=""
        className="!opacity-100 tabular-nums"
        disabled
      />

      <FormNumberInput
        name="interest_amount"
        control={control}
        label="Interest"
        suffix="₹"
        placeholder="Interest"
        className="!opacity-100 tabular-nums"
        onCustomChange={onInterestChange}
      />

      <FormNumberInput
        name="total_amount"
        control={control}
        label="Total"
        suffix="₹"
        placeholder="Total"
        className="!opacity-100 tabular-nums"
        disabled
      />
    </div>
  );
});
