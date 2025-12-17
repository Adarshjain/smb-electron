import { useEffect, useRef, useState } from 'react';
import type { RenderEditCellProps } from 'react-data-grid';
import type { CashbookRow } from '../types';

export function NumberEditor({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<CashbookRow>) {
  const [inputValue, setInputValue] = useState<string>(() => {
    const val = row[column.key as keyof CashbookRow];
    return typeof val === 'number' ? String(val) : '';
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const commit = () => {
    const numVal = inputValue ? parseFloat(inputValue) : null;
    onRowChange({ ...row, [column.key]: numVal }, true);
    onClose(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      commit();
    } else if (e.key === 'Escape') {
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
        if (/^-?\d*\.?\d*$/.test(e.target.value)) {
          setInputValue(e.target.value);
        }
      }}
      onKeyDown={handleKeyDown}
      onBlur={commit}
    />
  );
}
