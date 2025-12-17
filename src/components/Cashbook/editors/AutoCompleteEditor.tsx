import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { RenderEditCellProps } from 'react-data-grid';
import type { Tables } from '../../../../tables';
import type { CashbookRow } from '../types';
import { getInitialInputValue } from '../utils/cashbookUtils';

export function createAutoCompleteEditor(
  accountHeadsRef: React.RefObject<Tables['account_head'][]>
) {
  return function AutoCompleteEditor({
    row,
    column,
    onRowChange,
    onClose,
  }: RenderEditCellProps<CashbookRow>) {
    const [inputValue, setInputValue] = useState(() =>
      getInitialInputValue(row, column.key as keyof CashbookRow)
    );
    const [isOpen, setIsOpen] = useState(true);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState({
      top: 0,
      left: 0,
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const filteredOptions = useMemo(() => {
      const options = (accountHeadsRef.current ?? []).map((h) => h.name);
      const search = inputValue.toLowerCase();
      return options.filter((opt) => opt.toLowerCase().startsWith(search));
    }, [inputValue]);

    useEffect(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
        });
      }
    }, []);

    useEffect(() => {
      if (highlightedIndex >= 0 && listRef.current) {
        const items = listRef.current.querySelectorAll('[data-option]');
        items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
      }
    }, [highlightedIndex]);

    const handleSelect = useCallback(
      (value: string) => {
        onRowChange({ ...row, [column.key]: value }, true);
        onClose(true);
      },
      [column.key, onClose, onRowChange, row]
    );

    const commitSelection = () => {
      const value = filteredOptions[highlightedIndex] || inputValue;
      if (value) handleSelect(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((i) =>
            i < filteredOptions.length - 1 ? i + 1 : i
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((i) => (i > 0 ? i - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          commitSelection();
          break;
        case 'Tab':
          commitSelection();
          break;
        case 'Escape':
          onClose(false);
          break;
      }
    };

    return (
      <div className="relative h-full">
        <input
          ref={inputRef}
          className="h-full w-full border-none bg-white px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setHighlightedIndex(0);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onBlur={() => setTimeout(() => setIsOpen(false), 150)}
        />
        {isOpen &&
          filteredOptions.length > 0 &&
          createPortal(
            <div
              ref={listRef}
              style={{
                position: 'fixed',
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                zIndex: 9999,
              }}
              className="max-h-48 w-100 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
            >
              {filteredOptions.map((option, index) => (
                <div
                  key={option}
                  data-option
                  className={`cursor-pointer px-3 py-1.5 text-sm ${
                    index === highlightedIndex
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(option);
                  }}
                >
                  {option}
                </div>
              ))}
            </div>,
            document.body
          )}
      </div>
    );
  };
}
