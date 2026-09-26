import { useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { useThanglish } from '@/context/ThanglishProvider.tsx';
import { cn } from '@/lib/utils.ts';

export interface Option<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

/** Checkbox list in a popover. An empty selection means "all". */
export default function MultiSelect<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  searchable = false,
  className,
}: {
  label: string;
  options: Option<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
  searchable?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { convert } = useThanglish();

  const summary =
    selected.length === 0
      ? `All`
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ??
          String(selected[0]))
        : `${selected.length} selected`;

  const toggle = (value: T) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'h-9 border-input font-normal justify-between gap-2',
            className
          )}
        >
          <span className="text-[#898781]">{label}</span>
          <span className="truncate max-w-[140px]">{summary}</span>
          <ChevronDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[260px]" align="start">
        <Command shouldFilter={searchable}>
          {searchable ? (
            <CommandInput
              placeholder="Search…"
              value={search}
              onValueChange={(v) => setSearch(convert(v))}
            />
          ) : null}
          <CommandList className="max-h-[300px]">
            <CommandEmpty>No match</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={String(option.value)}
                    value={`${option.label} ${option.value}`}
                    onSelect={() => toggle(option.value)}
                    className="cursor-pointer"
                  >
                    <span
                      className={cn(
                        'size-4 rounded border flex items-center justify-center',
                        isSelected
                          ? 'bg-primary border-primary text-white'
                          : 'border-input'
                      )}
                    >
                      {isSelected ? (
                        <Check className="size-3 text-white" />
                      ) : null}
                    </span>
                    <span className="flex-1 truncate">{option.label}</span>
                    {option.hint ? (
                      <span className="text-xs text-[#898781]">
                        {option.hint}
                      </span>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selected.length ? (
            <button
              type="button"
              className="w-full border-t text-xs py-2 text-[#52514e] hover:bg-accent cursor-pointer"
              onClick={() => onChange([])}
            >
              Clear ({selected.length})
            </button>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
