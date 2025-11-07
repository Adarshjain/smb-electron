import * as React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils.ts';
import { Input } from '@/components/ui/input.tsx';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  currentIsoDate,
  nextIsoDate,
  previousIsoDate,
} from '@/lib/myUtils.tsx';

export interface IPropsDatePicker {
  onInputChange?: (date: string) => void;
  value?: string;
  isError?: boolean;
  className?: string;
  navigated?: boolean;
}

export default function DatePicker({
  onInputChange,
  value = currentIsoDate(),
  isError,
  className,
  navigated = false,
  ...props
}: React.ComponentProps<'input'> & IPropsDatePicker) {
  const [isInternalError, setIsError] = useState<boolean>(false);
  const input = (
    <Input
      {...props}
      type="date"
      value={value}
      onInput={(e) => {
        setIsError(!e.currentTarget.value);
        onInputChange?.(e.currentTarget.value);
      }}
      className={cn(
        `selection:bg-primary selection:text-primary-foreground !opacity-100 ${isInternalError || isError ? 'border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50 focus-visible:ring-[3px]' : 'border-input focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'} h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm aria-invalid:ring-destructive/20 aria-invalid:border-destructive [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none`,
        navigated ? 'rounded-none' : '',
        className
      )}
    />
  );
  if (!navigated) return input;
  return (
    <div className="flex">
      <Button
        variant="outline"
        className="border-input border-r-0 rounded-r-none"
        onClick={() => onInputChange?.(previousIsoDate(value))}
      >
        <ArrowLeft />
      </Button>
      {input}
      <Button
        variant="outline"
        className="border-input border-l-0 rounded-l-none"
        onClick={() => onInputChange?.(nextIsoDate(value))}
      >
        <ArrowRight />
      </Button>
    </div>
  );
}
