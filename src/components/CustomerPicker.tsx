import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
import { useEffect, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { query } from '@/hooks/dbUtil.ts';
import type { Tables } from '@/../tables';
import { useThanglish } from '@/context/ThanglishProvider.tsx';
import { Kbd } from '@/components/ui/kbd';

interface SearchableSelectProps {
  onSelect?: (value: Tables['customers']) => void;
  placeholder?: string;
  inputClassName?: string;
  autofocus?: boolean;
  showShortcut?: string;
}

export default function CustomerPicker({
  onSelect,
  placeholder = 'Customer',
  inputClassName,
  autofocus = false,
  showShortcut,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<Tables['customers'][]>([]);
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

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => panelRef.current,
    estimateSize: () => 34,
    overscan: 5,
  });

  useEffect(() => {
    let active = true;

    const run = async () => {
      const customers = await query<Tables['customers'][]>(
        `select * from customers where name LIKE '${search}%' order by name, area`
      );
      if (active) setItems(customers ?? []);
    };

    if (search.length === 0) {
      setItems([]);
      setHighlightedIndex(-1);
      return;
    }

    void run();

    return () => {
      active = false;
    };
  }, [search]);

  useEffect(() => {
    if (items.length > 0) {
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
  }, [items.length, virtualizer]);

  useEffect(() => {
    if (
      highlightedIndex >= 0 &&
      highlightedIndex < items.length &&
      isKeyboardNavigating
    ) {
      virtualizer.scrollToIndex(highlightedIndex, {
        align: 'auto',
        behavior: 'auto',
      });
    }
  }, [highlightedIndex, items.length, isKeyboardNavigating, virtualizer]);

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

  const handleSelect = (opt: Tables['customers']) => {
    onSelect?.(opt);
    setOpen(false);
    setSearch('');
    setHighlightedIndex(-1);
    setIsKeyboardNavigating(false);
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

    if ((!open || items.length === 0) && e.key !== 'Enter') return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsKeyboardNavigating(true);
        setHighlightedIndex((prev) => {
          if (prev === -1) return 0;
          return (prev + 1) % items.length;
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        setIsKeyboardNavigating(true);
        setHighlightedIndex((prev) => {
          if (prev === -1) return items.length - 1;
          return (prev - 1 + items.length) % items.length;
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && items[highlightedIndex]) {
          handleSelect(items[highlightedIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setOpen(false);
        break;

      case 'ArrowRight': {
        if (inlineSuggestion && items.length > 0) {
          const full = search + inlineSuggestion;
          setSearch(full);
          setOpen(false);
          e.preventDefault();
        }
        break;
      }
    }
  };

  const inlineSuggestion = (() => {
    if (!search) return '';
    if (highlightedIndex < 0 || highlightedIndex >= items.length) return '';

    const item = items[highlightedIndex];
    if (!item) return '';

    const name = item.name ?? '';
    if (name.toLowerCase().startsWith(search.toLowerCase())) {
      return name.slice(search.length);
    }

    return '';
  })();

  return (
    <div className="relative w-[500px]">
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
            id="customer_picker"
            name="customer_picker"
            onChange={(e) => {
              setSearch(convert(e.target.value));
              setOpen(true);
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

      {open && items.length > 0 ? (
        <div
          ref={panelRef}
          className="absolute z-50 mt-1 w-[610px] max-h-80 overflow-auto rounded-md border bg-white shadow-lg"
        >
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((row) => {
              const index = row.index;
              const opt = items[index];
              if (!opt) return null;

              const isActive = highlightedIndex === index;

              return (
                <div
                  key={opt.id}
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
                  <div style={{ width: 160 }}>{opt.name}</div>
                  <div style={{ width: 30 }}>{opt.fhtitle}</div>
                  <div style={{ width: 160 }}>{opt.fhname}</div>
                  <div style={{ width: 200 }}>{opt.area}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
