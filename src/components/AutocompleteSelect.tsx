import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useThanglish } from '@/context/ThanglishProvider.tsx';
import { Kbd } from '@/components/ui/kbd';

interface AutocompleteSelectProps<T> {
  options: T[];
  onSelect?: (value: T) => void;
  onSearchChange?: (searchValue: string) => void;
  placeholder?: string;
  inputClassName?: string;
  inputName?: string;
  autofocus?: boolean;
  showShortcut?: string;
  getDisplayValue?: (item: T) => string;
  renderRow?: (item: T) => React.ReactNode;
  getKey?: (item: T) => string | number;
  estimatedRowHeight?: number;
  dropdownWidth?: string;
  triggerWidth?: string;
  autoConvert: boolean;
}

export default function AutocompleteSelect<T = string>({
  options,
  onSelect,
  onSearchChange,
  placeholder = 'Search...',
  inputClassName,
  inputName,
  autofocus = false,
  showShortcut,
  getDisplayValue,
  renderRow,
  getKey,
  estimatedRowHeight = 34,
  dropdownWidth = 'w-[610px]',
  triggerWidth = 'w-[500px]',
  autoConvert,
}: AutocompleteSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isKeyboardNavigating, setIsKeyboardNavigating] = useState(false);

  const { convert } = useThanglish();
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const segmenter = new Intl.Segmenter('ta', { granularity: 'grapheme' });

  const deleteLastGrapheme = (str: string) => {
    const g = [...segmenter.segment(str)].map((s) => s.segment);
    g.pop();
    return g.join('');
  };

  // Default implementations for string arrays
  const defaultGetDisplayValue = (item: T): string => {
    if (typeof item === 'string') return item;
    if (item && typeof item === 'object' && 'name' in item) {
      return String((item as Record<string, unknown>).name);
    }
    return String(item);
  };

  const defaultRenderRow = (item: T): React.ReactNode => {
    return <div>{defaultGetDisplayValue(item)}</div>;
  };

  const defaultGetKey = (item: T, index: number): string | number => {
    if (typeof item === 'string') return item;
    if (typeof item === 'number') return item;
    if (item && typeof item === 'object' && 'id' in item) {
      return String((item as Record<string, unknown>).id);
    }
    return index;
  };

  const displayValueGetter = getDisplayValue ?? defaultGetDisplayValue;
  const rowRenderer = renderRow ?? defaultRenderRow;
  const keyGetter = getKey ?? defaultGetKey;

  const virtualizer = useVirtualizer({
    count: options.length,
    getScrollElement: () => panelRef.current,
    estimateSize: () => estimatedRowHeight,
    overscan: 5,
  });

  useEffect(() => {
    if (options.length > 0 && document.activeElement === inputRef.current) {
      setHighlightedIndex(0);
      setIsKeyboardNavigating(true);
      setOpen(true);

      requestAnimationFrame(() => {
        setTimeout(() => {
          virtualizer.scrollToIndex(0, { align: 'start', behavior: 'auto' });
        }, 0);
      });
    } else {
      setHighlightedIndex(-1);
    }
  }, [options.length, virtualizer]);

  useEffect(() => {
    if (
      highlightedIndex >= 0 &&
      highlightedIndex < options.length &&
      isKeyboardNavigating
    ) {
      virtualizer.scrollToIndex(highlightedIndex, {
        align: 'auto',
        behavior: 'auto',
      });
    }
  }, [highlightedIndex, options.length, isKeyboardNavigating, virtualizer]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      const path = e.composedPath?.() || (e as any).path || [];

      const clickedInsideInput =
        inputRef.current &&
        (path.includes(inputRef.current) ||
          inputRef.current.contains(e.target as Node));

      const clickedInsidePanel =
        panelRef.current &&
        (path.includes(panelRef.current) ||
          panelRef.current.contains(e.target as Node));

      if (!clickedInsideInput && !clickedInsidePanel) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    return () =>
      document.removeEventListener('pointerdown', onPointerDown, true);
  }, []);

  const handleSelect = (opt: T) => {
    onSelect?.(opt);
    setSearch(displayValueGetter(opt));
    setHighlightedIndex(-1);
    setIsKeyboardNavigating(false);
    requestAnimationFrame(() => {
      setOpen(false);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      const cursorAtEnd =
        inputRef.current &&
        inputRef.current.selectionStart === inputRef.current.value.length &&
        inputRef.current.selectionEnd === inputRef.current.value.length;

      if (cursorAtEnd) {
        e.preventDefault();
        setSearch((prev) => deleteLastGrapheme(prev));
        return;
      }
    }

    if ((!open || options.length === 0) && e.key !== 'Enter') return;

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
        break;

      case 'ArrowRight': {
        if (inlineSuggestion && options.length > 0) {
          const full = search + inlineSuggestion;
          setSearch(full);
          onSearchChange?.(full);
          setOpen(false);
          e.preventDefault();
        }
        break;
      }
    }
  };

  const inlineSuggestion = (() => {
    if (!search) return '';
    if (highlightedIndex < 0 || highlightedIndex >= options.length) return '';

    const item = options[highlightedIndex];
    if (!item) return '';

    const displayValue = displayValueGetter(item);
    if (displayValue.toLowerCase().startsWith(search.toLowerCase())) {
      return displayValue.slice(search.length);
    }

    return '';
  })();

  return (
    <div className={cn('relative search-select', triggerWidth)}>
      <InputGroup className={inputClassName}>
        <div style={{ position: 'relative', width: '100%' }}>
          {inlineSuggestion && open ? (
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                paddingLeft: '12px',
                width: '100%',
                marginTop: '-0.5px',
                zIndex: 10,
              }}
            >
              <div className="text-sm">
                <span className="opacity-0">{search}</span>
                <span className="text-blue-600 bg-blue-200">
                  {inlineSuggestion}
                </span>
              </div>
            </div>
          ) : null}

          <InputGroupInput
            ref={inputRef}
            value={search}
            autoFocus={autofocus}
            className="!z-20 relative"
            id="autocomplete_select"
            name={inputName}
            onChange={(e) => {
              const value = autoConvert
                ? convert(e.target.value)
                : e.target.value;
              setSearch(value);
              onSearchChange?.(value);
              setOpen(true);
            }}
            onFocus={(e) => {
              e.currentTarget.select();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
          />
        </div>

        {showShortcut ? (
          <InputGroupAddon align="inline-end">
            <Kbd>{showShortcut}</Kbd>
          </InputGroupAddon>
        ) : null}
      </InputGroup>

      {open && options.length > 0 ? (
        <div
          ref={panelRef}
          className={cn(
            'absolute z-50 mt-1 max-h-80 overflow-auto rounded-md border bg-white shadow-lg',
            dropdownWidth
          )}
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const index = row.index;
              const opt = options[index];
              if (!opt) return null;

              const isActive = highlightedIndex === index;

              return (
                <div
                  key={keyGetter(opt, index)}
                  onMouseEnter={() => {
                    setIsKeyboardNavigating(false);
                    setHighlightedIndex(index);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(opt);
                  }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${row.start}px)`,
                  }}
                  className={cn(
                    'cursor-pointer px-2 py-1 flex gap-2 items-center',
                    isActive && 'bg-blue-600 text-white'
                  )}
                >
                  {rowRenderer(opt)}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
