import { useEffect, useRef, useState } from 'react';
import type { RenderEditCellProps } from 'react-data-grid';
import type { CashbookRow } from '../types';

export function NumberEditor({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<CashbookRow>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const value = row[column.key as keyof CashbookRow];
  // Keep string representation for editing (allows typing "12." before completing "12.5")
  const [inputValue, setInputValue] = useState<string>(() =>
    typeof value === 'number' ? String(value) : ''
  );

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose(false);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="h-full w-full border-none px-2 text-right text-sm outline-none focus:ring-2 focus:ring-blue-500"
      value={inputValue}
      onChange={(e) => {
        const newValue = e.target.value;
        if (/^-?\d*\.?\d*$/.test(newValue)) {
          setInputValue(newValue);
          const numVal = newValue ? parseFloat(newValue) : null;
          // Only commit valid numbers (not incomplete like "12." or "-")
          if (numVal !== null && !isNaN(numVal)) {
            onRowChange({ ...row, [column.key]: numVal });
          } else if (newValue === '') {
            onRowChange({ ...row, [column.key]: null });
          }
        }
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => onClose(true)}
    />
  );
}
