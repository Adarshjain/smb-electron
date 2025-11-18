import { cn } from '@/lib/utils';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Input } from '@/components/ui/input.tsx';
import { useThanglish } from '@/context/ThanglishProvider.tsx';

const DefaultStringRenderer = ({ item }: { item: string }) => <div>{item}</div>;

interface SearchableSelectProps<T = string> {
  options: T[];
  value?: T;
  onChange?: (value: T) => void;
  onSearchChange?: (searchValue: string) => void;
  placeholder?: string;
  renderRow?: (item: T, isSelected: boolean) => React.ReactNode;
  getKey?: (item: T) => string | number;
  transformInput?: (value: string) => string;
  triggerWidth?: string;
  popoverWidth?: string;
  autoFocus?: boolean;
  inputId?: string;
  inputName?: string;
  estimatedRowHeight?: number;
  onKeyDown?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void;
}

export default function SearchSelect<T = string>({
  options,
  value,
  onChange,
  onSearchChange,
  placeholder = 'Search...',
  renderRow,
  getKey,
  transformInput,
  triggerWidth = 'w-[500px]',
  popoverWidth = 'w-[500px]',
  autoFocus = false,
  inputId,
  inputName,
  estimatedRowHeight = 34,
  onKeyDown,
  onFocus,
}: SearchableSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<T | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const { convert } = useThanglish();

  // Sync internal state with external value prop
  useEffect(() => {
    if (value !== undefined) {
      setSelected(value);
      setSearch(
        // @ts-expect-error area
        typeof value === 'string' ? value : (value.name as string)
      );
    }
  }, [value]);

  const defaultGetKey = (item: T, index: number): string | number => {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return item;
    if (item && typeof item === 'object' && 'id' in item)
      return (item as Record<string, string>).id;
    return index;
  };

  const defaultRenderRow = (item: T, _isSelected: boolean): React.ReactNode => {
    if (typeof item === 'string') {
      return <DefaultStringRenderer item={item} />;
    }
    // For objects, try to display a name property or stringify
    if (item && typeof item === 'object' && 'name' in item) {
      return <div>{String((item as Record<string, string>).name)}</div>;
    }
    return <div>{String(item)}</div>;
  };

  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 5,
  });

  useEffect(() => {
    if (options.length > 0) {
      setHighlightedIndex(0);
      setIsKeyboardNavigating(true);
    } else {
      setHighlightedIndex(-1);
      setIsKeyboardNavigating(false);
    }
  }, [options]);

  useEffect(() => {
    if (highlightedIndex >= 0 && highlightedIndex < options.length) {
      virtualizer.scrollToIndex(highlightedIndex, {
        align: 'auto',
        behavior: 'smooth',
      });
    }
  }, [highlightedIndex, virtualizer, options.length]);

  const handleSelect = (opt: T) => {
    setSelected(opt);
    onChange?.(opt);
    setOpen(false);
    // @ts-expect-error area
    setSearch(opt && typeof opt === 'string' ? opt : (opt.name as string));
    onSearchChange?.(
      // @ts-expect-error area
      opt && typeof opt === 'string' ? opt : (opt.name as string)
    );
    setIsKeyboardNavigating(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (options.length === 0) {
      if (e.key === 'Enter') {
        onKeyDown?.(e);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsKeyboardNavigating(true);
        setHighlightedIndex((prev) => {
          if (prev === -1) return 0;
          return (prev + 1) % options.length;
        });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setIsKeyboardNavigating(true);
        setHighlightedIndex((prev) => {
          if (prev === -1) return options.length - 1;
          return (prev - 1 + options.length) % options.length;
        });
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && options[highlightedIndex]) {
          handleSelect(options[highlightedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setIsKeyboardNavigating(false);
        inputRef.current?.blur();
        break;
    }
    onKeyDown?.(e);
  };

  const renderer = renderRow ?? defaultRenderRow;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={triggerWidth}
        asChild
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <div className="search-select">
          <Input
            ref={inputRef}
            value={search}
            autoFocus={autoFocus}
            id={inputId}
            name={inputName}
            onChange={(e) => {
              e.stopPropagation();
              const value = transformInput
                ? transformInput(e.target.value)
                : e.target.value;
              setSearch(convert(value));
              onSearchChange?.(convert(value));
              setOpen(true);
            }}
            onBlur={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            onFocus={onFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent
        className={cn('p-0', popoverWidth)}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList ref={parentRef} className="max-h-40 overflow-auto">
            <CommandGroup>
              <div
                style={{
                  height: `${virtualizer.getTotalSize()}px`,
                  width: '100%',
                  position: 'relative',
                }}
              >
                {virtualizer.getVirtualItems().map((virtualItem) => {
                  const opt = options[virtualItem.index];
                  const index = virtualItem.index;
                  const key = getKey ? getKey(opt) : defaultGetKey(opt, index);
                  const isSelected = selected === opt;

                  return (
                    <CommandItem
                      key={key}
                      value={String(key)}
                      onSelect={() => handleSelect(opt)}
                      ref={(el) => {
                        itemRefs.current[index] = el;
                      }}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualItem.start}px)`,
                      }}
                      className={cn(
                        index % 2 === 1 && 'bg-accent',
                        'data-[selected=true]:bg-blue-200 px-2 py-1',
                        isKeyboardNavigating &&
                          highlightedIndex === index &&
                          'bg-blue-500 text-white data-[selected=true]:text-white data-[selected=true]:bg-blue-500'
                      )}
                    >
                      {renderer(opt, isSelected)}
                      {isSelected && <Check className="ml-auto h-4 w-4" />}
                    </CommandItem>
                  );
                })}
              </div>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
