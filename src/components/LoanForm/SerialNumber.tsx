import React, { memo } from 'react';
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
  useController,
} from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { FIELD_WIDTHS, VALIDATION_CONSTRAINTS } from '@/constants/loanForm';

interface SerialNumberInputProps<T extends FieldValues> {
  control: Control<T>;
  serialFieldName: FieldPath<T>;
  numberFieldName: FieldPath<T>;
  autoFocus?: boolean;
  defaultNumberValue?: number;
  onNumFieldKeyDown?: (e?: React.KeyboardEvent<HTMLInputElement>) => void;
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
  onNumFieldKeyDown,
}: SerialNumberInputProps<T>) {
  const serialField = useController({ control, name: serialFieldName });
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
            onKeyDown={(e) => {
              if (e.key === 'Enter')
                document.getElementsByName(numberFieldName)[0]?.focus();
            }}
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
            onKeyDown={(e) => {
              if (e.key === 'Enter') onNumFieldKeyDown?.(e);
              if (!(e.shiftKey || e.altKey || e.ctrlKey || e.metaKey)) {
                if (/^[a-zA-Z]$/.test(e.key)) {
                  serialField.field.onChange(e.key.toUpperCase());
                  setTimeout(() => {
                    if (e.target instanceof HTMLInputElement) {
                      e.target.select();
                    }
                  }, 10);
                }
              }
            }}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
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
