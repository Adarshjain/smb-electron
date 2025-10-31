import { memo } from 'react';
import { type Control, useWatch } from 'react-hook-form';
import type { Loan } from '@/types/loanForm';
import { SerialNumber } from '@/components/LoanForm/SerialNumber.tsx';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import type { Tables } from '../../../tables';
import { loadBillWithDeps } from '@/lib/myUtils.tsx';
import { cn } from '@/lib/utils.ts';

interface OldLoanFillerProps {
  control: Control<Loan>;
  onLoanLoad: (loan: Tables['full_bill']['Row']) => void;
  serialFieldName: 'serial' | 'old_serial';
  numberFieldName: 'loan_no' | 'old_loan_no';
  showButton?: boolean;
  className?: string;
}

export const LoanNumber = memo(function LoanNumber({
  control,
  onLoanLoad,
  numberFieldName,
  serialFieldName,
  showButton,
  className,
}: OldLoanFillerProps) {
  const serialValue = useWatch({ control, name: serialFieldName });
  const numberValue = useWatch({ control, name: numberFieldName });

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
    onLoanLoad(loan);
  };

  return (
    <div className={cn('flex gap-1', className)}>
      <SerialNumber
        control={control}
        serialFieldName={serialFieldName}
        numberFieldName={numberFieldName}
        onNumFieldKeyDown={() => void fillFromOldLoan()}
      />
      {showButton && (
        <Button
          variant="outline"
          className="!px-4"
          onClick={() => void fillFromOldLoan()}
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
      )}
    </div>
  );
});
