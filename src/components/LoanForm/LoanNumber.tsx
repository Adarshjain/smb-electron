import {
  type Control,
  type FieldPath,
  type FieldValues,
  useWatch,
} from 'react-hook-form';
import { SerialNumber } from '@/components/LoanForm/SerialNumber.tsx';
import { Button } from '@/components/ui/button';
import { ArrowDown } from 'lucide-react';
import type { Tables } from '@/../tables';
import { loadBillWithDeps } from '@/lib/myUtils.tsx';
import { cn } from '@/lib/utils.ts';
import { type KeyboardEvent } from 'react';
import { read } from '@/hooks/dbUtil.ts';

interface LoanNumberProps<T extends FieldValues> {
  control: Control<T>;
  onLoanLoad: (loan: Tables['full_bill']) => void | Promise<void>;
  serialFieldName: FieldPath<T>;
  numberFieldName: FieldPath<T>;
  showButton?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export function LoanNumber<T extends FieldValues>({
  control,
  onLoanLoad,
  numberFieldName,
  serialFieldName,
  showButton,
  className,
  autoFocus,
}: LoanNumberProps<T>) {
  const [serialValue, numberValue] = useWatch({
    control,
    name: [serialFieldName, numberFieldName],
  });

  const fillFromOldLoan = async (
    e?: KeyboardEvent<HTMLInputElement>
  ): Promise<void> => {
    if (e) e.preventDefault();
    if (!serialValue || !numberValue) {
      return;
    }
    const resp = await read('bills', {
      serial: serialValue,
      loan_no: parseInt(numberValue),
    });
    // If this is true, then loan does not exist
    if (!resp?.length) {
      return;
    }
    const loan = await loadBillWithDeps(serialValue, numberValue);
    if (!loan) {
      return;
    }
    void onLoanLoad(loan);
  };

  return (
    <div className={cn('flex gap-1', className)}>
      <SerialNumber
        control={control}
        serialFieldName={serialFieldName}
        numberFieldName={numberFieldName}
        onNumFieldKeyDown={(e) => void fillFromOldLoan(e)}
        autoFocus={autoFocus}
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
}
