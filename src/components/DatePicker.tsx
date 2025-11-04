import * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils.ts';
import { Input } from '@/components/ui/input.tsx';

export interface IPropsDatePicker {
  onInputChange?: (date: string) => void;
  defaultValue?: string;
  isError?: boolean;
  className?: string;
}

export default function DatePicker({
  onInputChange,
  defaultValue,
  isError,
  className,
  ...props
}: React.ComponentProps<'input'> & IPropsDatePicker) {
  const [isInternalError, setIsError] = useState<boolean>(false);
  return (
    <Input
      {...props}
      type="date"
      defaultValue={defaultValue}
      onInput={(e) => {
        setIsError(!e.currentTarget.value);
        onInputChange?.(e.currentTarget.value);
      }}
      className={cn(
        `tabular-nums selection:bg-primary selection:text-primary-foreground !opacity-100 ${isInternalError || isError ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50 focus-visible:ring-[3px]' : 'border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'} h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 aria-invalid:border-destructive [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none`,
        className
      )}
    />
  );
}
