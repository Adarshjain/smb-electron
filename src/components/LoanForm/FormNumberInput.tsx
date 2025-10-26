import {
  Controller,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import type { ChangeEvent, FocusEvent } from 'react';

interface FormNumberInputProps<T extends FieldValues> {
  name: Path<T>;
  control: Control<T>;
  label: string;
  placeholder?: string;
  disabled?: boolean;
  currency?: string;
  percent?: boolean;
  rightAlign?: boolean;
  onCustomChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  onCustomBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  decimalPlaces?: number;
  className?: string;
}

export function FormNumberInput<T extends FieldValues>({
  name,
  control,
  label,
  placeholder = '',
  disabled = false,
  currency,
  percent,
  rightAlign = true,
  onCustomChange,
  onCustomBlur,
  decimalPlaces = 2,
  className = '',
}: FormNumberInputProps<T>) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field }) => (
        <InputGroup>
          <InputGroupInput
            {...field}
            disabled={disabled}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onChange={(e) => {
              field.onChange(e);
              if (onCustomChange) {
                onCustomChange(e);
              }
            }}
            onBlur={(e) => {
              if (onCustomBlur) {
                onCustomBlur(e);
              } else {
                field.onChange(
                  parseFloat(field.value || '0').toFixed(decimalPlaces)
                );
              }
            }}
            id={name}
            name={name}
            type="number"
            placeholder={placeholder}
            className={`${rightAlign ? 'text-right' : ''} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
          />
          <InputGroupAddon>{label}</InputGroupAddon>
          {currency && (
            <InputGroupAddon align="inline-end" className="!pl-0 w-6.5">
              {currency}
            </InputGroupAddon>
          )}
          {percent && (
            <InputGroupAddon align="inline-end" className="!pl-0 w-6.5">
              %
            </InputGroupAddon>
          )}
        </InputGroup>
      )}
    />
  );
}
