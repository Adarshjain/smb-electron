import React, { memo } from 'react';
import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { VALIDATION_CONSTRAINTS, FIELD_WIDTHS } from '@/constants/loanForm';

interface SerialNumberInputProps<T extends FieldValues> {
  control: Control<T>;
  serialFieldName: FieldPath<T>;
  numberFieldName: FieldPath<T>;
  autoFocus?: boolean;
  defaultNumberValue?: number;
  onChange?: {
    serial?: (value: string) => void;
    number?: (value: number) => void;
  };
}

export const SerialNumber = memo(function SerialNumberInput<
  T extends FieldValues,
>({
  control,
  serialFieldName,
  numberFieldName,
  autoFocus = false,
  defaultNumberValue = 1,
  onChange,
}: SerialNumberInputProps<T>) {
  return (
    <div className="flex">
      <Controller
        name={serialFieldName}
        control={control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            id={serialFieldName}
            name={serialFieldName}
            autoFocus={autoFocus}
            maxLength={VALIDATION_CONSTRAINTS.SERIAL_LENGTH.MAX}
            aria-invalid={fieldState.invalid}
            className={`${FIELD_WIDTHS.SERIAL_INPUT} rounded-r-none text-center uppercase focus-visible:z-10`}
            onChange={(e) => {
              field.onChange(e);
              onChange?.serial?.(e.target.value);
            }}
          />
        )}
      />

      <Controller
        name={numberFieldName}
        control={control}
        render={({ field, fieldState }) => (
          <Input
            {...field}
            id={numberFieldName}
            name={numberFieldName}
            type="number"
            aria-invalid={fieldState.invalid}
            className={`${FIELD_WIDTHS.LOAN_NO_INPUT} rounded-l-none border-l-0 text-center focus-visible:z-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            onChange={(e) => {
              const val = e.target.value;
              if (VALIDATION_CONSTRAINTS.LOAN_NO_REGEX.test(val)) {
                const numValue = val ? parseInt(val) : defaultNumberValue;
                field.onChange(numValue);
                onChange?.number?.(numValue);
              }
            }}
          />
        )}
      />
    </div>
  );
}) as <T extends FieldValues>(
  props: SerialNumberInputProps<T>
) => React.ReactElement;
