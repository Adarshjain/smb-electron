import React, { memo } from 'react';
import {
  type Control,
  Controller,
  type FieldPath,
  type FieldValues,
  useController,
} from 'react-hook-form';
import { VALIDATION_CONSTRAINTS } from '@/constants/loanForm';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group.tsx';

interface SerialNumberInputProps<T extends FieldValues> {
  control: Control<T>;
  serialFieldName: FieldPath<T>;
  numberFieldName: FieldPath<T>;
  autoFocus?: boolean;
  defaultNumberValue?: number;
  onNumFieldKeyDown?: (e?: React.KeyboardEvent<HTMLInputElement>) => void;
  onChange?: {
    serial?: (value: string) => void;
    number?: (value: string) => void;
  };
}

export const SerialNumber = memo(function SerialNumberInput<
  T extends FieldValues,
>({
  control,
  serialFieldName,
  numberFieldName,
  autoFocus = false,
  onChange,
  onNumFieldKeyDown,
}: SerialNumberInputProps<T>) {
  const serialField = useController({ control, name: serialFieldName });
  return (
    <Controller
      name={numberFieldName}
      control={control}
      render={({ field }) => (
        <InputGroup className="w-24">
          <InputGroupInput
            {...field}
            id={numberFieldName}
            name={numberFieldName}
            className="!pl-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                field.onChange(val);
                onChange?.number?.(val);
              }
            }}
            placeholder="Loan No."
            autoFocus={autoFocus}
          />
          <InputGroupAddon
            align="inline-start"
            className="w-6.5 text-black mt-0.5 text-sm"
          >
            {serialField.field.value}
          </InputGroupAddon>
        </InputGroup>
      )}
    />
  );
}) as <T extends FieldValues>(
  props: SerialNumberInputProps<T>
) => React.ReactElement;
