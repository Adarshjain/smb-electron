import { useEffect, useRef } from 'react';
import type { RenderEditCellProps } from 'react-data-grid';
import type { CashbookRow } from '../types';

export function StringEditor({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<CashbookRow>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const value = row[column.key as keyof CashbookRow];
  const inputValue = typeof value === 'string' ? value : '';

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
      className="h-full w-full border-none px-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
      value={inputValue}
      onChange={(e) => {
        onRowChange({ ...row, [column.key]: e.target.value || null });
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => onClose(true)}
    />
  );
}
