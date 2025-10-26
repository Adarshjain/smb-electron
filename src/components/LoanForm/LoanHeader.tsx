import { memo } from 'react';
import { Controller, type Control } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import type { Loan } from '@/types/loanForm';
import { VALIDATION_CONSTRAINTS, FIELD_WIDTHS } from '@/constants/loanForm';

interface LoanHeaderProps {
  control: Control<Loan>;
}

export const LoanHeader = memo(function LoanHeader({ control }: LoanHeaderProps) {
  return (
    <div className="flex">
      {/* Serial Number */}
      <Controller
        name="serial"
        control={control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            id="serial"
            name="serial"
            autoFocus
            maxLength={VALIDATION_CONSTRAINTS.SERIAL_LENGTH.MAX}
            placeholder="A"
            aria-invalid={fieldState.invalid}
            className={`${FIELD_WIDTHS.SERIAL_INPUT} rounded-r-none text-center uppercase focus-visible:z-10`}
          />
        )}
      />

      {/* Loan Number */}
      <Controller
        name="loan_no"
        control={control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            id="loan_no"
            name="loan_no"
            type="number"
            placeholder="1"
            aria-invalid={fieldState.invalid}
            className={`${FIELD_WIDTHS.LOAN_NO_INPUT} rounded-l-none border-l-0 text-center focus-visible:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            onChange={(e) => {
              const val = e.target.value;
              if (VALIDATION_CONSTRAINTS.LOAN_NO_REGEX.test(val)) {
                field.onChange(val ? parseInt(val) : 1);
              }
            }}
          />
        )}
      />
    </div>
  );
});

