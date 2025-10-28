import { memo } from 'react';
import { type Control, useWatch } from 'react-hook-form';
import type { Loan } from '@/types/loanForm';
import { SerialNumber } from '@/components/LoanForm/SerialNumber.tsx';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import type { Tables } from '../../../tables';
import loadBillWithDeps from '@/lib/myUtils.tsx';

interface OldLoanFillerProps {
  control: Control<Loan>;
  onOldLoanLoad: (loan: Tables['full_bill']['Row']) => void;
}

export const OldLoanFiller = memo(function OldLoanFiller({
  control,
  onOldLoanLoad,
}: OldLoanFillerProps) {
  const serialValue = useWatch({ control, name: 'old_serial' });
  const numberValue = useWatch({ control, name: 'old_loan_no' });

  const fillFromOldLoan = async (
    e?: React.MouseEvent<HTMLButtonElement>
  ): Promise<void> => {
    if (e) e.preventDefault();
    if (!serialValue || !numberValue) {
      return;
    }
    const loan = await loadBillWithDeps(serialValue, numberValue);
    if (!loan) {
      return;
    }
    onOldLoanLoad(loan);
  };

  return (
    <div className="flex gap-1">
      <SerialNumber
        control={control}
        serialFieldName="old_serial"
        numberFieldName="old_loan_no"
        onNumFieldKeyDown={fillFromOldLoan}
      />
      <Button
        variant="outline"
        className="!px-4"
        onClick={fillFromOldLoan}
        disabled={
          !(
            serialValue?.length &&
            numberValue &&
            numberValue > 0 &&
            numberValue < 10000
          )
        }
      >
        Fill
        <ArrowDown />
      </Button>
    </div>
  );
});
