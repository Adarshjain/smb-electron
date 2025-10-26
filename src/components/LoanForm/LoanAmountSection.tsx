import { memo, type ChangeEvent } from 'react';
import { type Control } from 'react-hook-form';
import { FormNumberInput } from './FormNumberInput';
import type { Loan } from '@/types/loanForm';
import { FIELD_WIDTHS } from '@/constants/loanForm';

interface LoanAmountSectionProps {
  control: Control<Loan>;
  onLoanAmountChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onInterestChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onDocChargeChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const LoanAmountSection = memo(function LoanAmountSection({
  control,
  onLoanAmountChange,
  onInterestChange,
  onDocChargeChange,
}: LoanAmountSectionProps) {
  return (
    <div className={`flex flex-col ${FIELD_WIDTHS.AMOUNT_COLUMN} input-column`}>
      <FormNumberInput
        name="loan_amount"
        control={control}
        label="Amount"
        currency="₹"
        placeholder="Amount"
        onCustomChange={onLoanAmountChange}
      />

      <FormNumberInput
        name="interest_rate"
        control={control}
        label="Percent"
        percent
        placeholder=""
        onCustomChange={onInterestChange}
      />

      <FormNumberInput
        name="first_month_interest"
        control={control}
        label="Interest"
        currency="₹"
        placeholder="FMI"
        disabled={true}
      />

      <FormNumberInput
        name="doc_charges"
        control={control}
        label="Doc Charge"
        currency="₹"
        placeholder="FMI"
        onCustomChange={onDocChargeChange}
      />

      <FormNumberInput
        name="total"
        control={control}
        label="Total"
        currency="₹"
        placeholder="Total"
        disabled={true}
      />
    </div>
  );
});

