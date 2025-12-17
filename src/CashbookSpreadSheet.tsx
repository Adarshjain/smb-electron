import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Column, RenderEditCellProps } from 'react-data-grid';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import type { Tables } from '../tables';
import { formatCurrency, getAccountById } from '@/lib/myUtils.tsx';

interface CashbookRow {
  accountHead: Tables['account_head'] | string | undefined;
  description: string | null;
  credit: number | null;
  debit: number | null;
  sort_order: number;
}

// Use a ref to access latest accountHeads without stale closures
function createAutoCompleteEditor(
  accountHeadsRef: React.RefObject<Tables['account_head'][]>
) {
  return function AutoCompleteEditor({
    row,
    column,
    onRowChange,
    onClose,
  }: RenderEditCellProps<CashbookRow>) {
    const [inputValue, setInputValue] = useState(() => {
      const val = row[column.key as keyof CashbookRow];
      if (typeof val === 'number' || typeof val === 'string') {
        return '' + val;
      }
      return val?.name ?? '';
    });
    const [isOpen, setIsOpen] = useState(true);
    const [highlightedIndex, setHighlightedIndex] = useState(0);
    const [dropdownPosition, setDropdownPosition] = useState({
      top: 0,
      left: 0,
    });
    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);

    const accountHeads = accountHeadsRef.current ?? [];
    const options = accountHeads.map((head) => head.name);
    const filteredOptions = options.filter((option) =>
      option.toLowerCase().startsWith(inputValue.toLowerCase())
    );

    useEffect(() => {
      inputRef.current?.focus();
      inputRef.current?.select();

      // Calculate dropdown position
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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          } else if (inputValue) {
            handleSelect(inputValue);
          }
          break;
        case 'Escape':
          onClose(false);
          break;
        case 'Tab':
          if (filteredOptions[highlightedIndex]) {
            handleSelect(filteredOptions[highlightedIndex]);
          } else if (inputValue) {
            handleSelect(inputValue);
          }
          break;
      }
    };

    const dropdown =
      isOpen && filteredOptions.length > 0
        ? createPortal(
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
          )
        : null;

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
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 150);
          }}
        />
        {dropdown}
      </div>
    );
  };
}

function NumberEditor({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<CashbookRow>) {
  const [inputValue, setInputValue] = useState<number | null>(() => {
    const val = row[column.key as keyof CashbookRow];
    return typeof val === 'number' ? val : null;
  });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      onRowChange({ ...row, [column.key]: inputValue ?? null }, true);
      onClose(true);
    } else if (e.key === 'Escape') {
      onClose(false);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="h-full w-full border-none bg-white px-2 text-right text-sm outline-none focus:ring-2 focus:ring-blue-500"
      value={'' + inputValue}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '') {
          setInputValue(null);
        }
        if (/^-?\d*\.?\d*$/.test(val)) {
          setInputValue(parseFloat(val));
        }
      }}
      onKeyDown={handleKeyDown}
      onBlur={() => {
        onRowChange({ ...row, [column.key]: inputValue ?? null }, true);
        onClose(true);
      }}
    />
  );
}

export interface CashbookSpreadSheetProps {
  currentAccountHead: Tables['account_head'] | null;
  accountHeads: Tables['account_head'][];
  entries: Tables['daily_entries'][];
  openingBalance: number;
  date: string;
  onLoadToday: () => Promise<void>;
}

export default function CashbookSpreadSheet({
  entries,
  openingBalance,
  accountHeads,
}: CashbookSpreadSheetProps) {
  const [rows, setRows] = useState<CashbookRow[]>([
    {
      accountHead: 'Opening Balance',
      sort_order: -1,
      credit: openingBalance >= 0 ? openingBalance : null,
      debit: openingBalance < 0 ? openingBalance : null,
      description: null,
    },
    ...entries
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((entry) => {
        return {
          accountHead: getAccountById(accountHeads, entry.sub_code),
          description: entry.description,
          credit: entry.credit,
          debit: entry.debit,
          sort_order: entry.sort_order,
        };
      }),
  ]);

  // Keep a ref to accountHeads that's always current
  const accountHeadsRef = useRef(accountHeads);
  accountHeadsRef.current = accountHeads;

  // Memoize the editor - it uses the ref internally so it always has fresh data
  const AutoCompleteEditor = useMemo(
    () => createAutoCompleteEditor(accountHeadsRef),
    [] // Empty deps - the ref pattern means we don't need to recreate
  );

  // Helper to check if row is editable
  const isRowEditable = (row: CashbookRow) => row.sort_order !== -1;

  const columns: Column<CashbookRow>[] = [
    {
      key: 'accountHead',
      name: 'Account',
      width: 300,
      resizable: true,
      editable: isRowEditable,
      renderEditCell: AutoCompleteEditor,
      renderCell: ({ row }) => {
        return (
          <div className="truncate px-1 select-text">
            {typeof row.accountHead === 'string'
              ? row.accountHead
              : (row.accountHead?.name ?? '')}
          </div>
        );
      },
    },
    {
      key: 'description',
      name: 'Description',
      width: 300,
      resizable: true,
      editable: isRowEditable,
      renderCell: ({ row }) => (
        <div className="truncate px-1 select-text">{row.description}</div>
      ),
    },
    {
      key: 'credit',
      name: 'Credit',
      width: 130,
      resizable: true,
      editable: isRowEditable,
      renderEditCell: NumberEditor,
      renderCell: ({ row }) => (
        <div className="text-right pr-2 select-text">
          {row.credit ? formatCurrency(row.credit, true) : null}
        </div>
      ),
    },
    {
      key: 'debit',
      name: 'Debit',
      width: 130,
      resizable: true,
      editable: isRowEditable,
      renderEditCell: NumberEditor,
      renderCell: ({ row }) => (
        <div className="text-right pr-2 select-text">
          {row.debit ? formatCurrency(row.debit, true) : null}
        </div>
      ),
    },
  ];

  useEffect(() => {
    setRows([
      {
        accountHead: 'Opening Balance',
        sort_order: -1,
        credit: openingBalance >= 0 ? openingBalance : null,
        debit: openingBalance < 0 ? openingBalance : null,
        description: null,
      },
      ...entries.map((entry) => ({
        accountHead: getAccountById(accountHeads, entry.sub_code),
        description: entry.description,
        credit: entry.credit,
        debit: entry.debit,
        sort_order: entry.sort_order,
      })),
    ]);
  }, [accountHeads, entries, openingBalance]);

  const handleRowsChange = useCallback((newRows: CashbookRow[]) => {
    setRows(newRows);
  }, []);

  // const handleAddRow = useCallback(() => {
  //   const newId = Math.max(...rows.map((r) => r.sort_order)) + 1;
  //   setRows([
  //     ...rows,
  //     {
  //       id: newId,
  //       accountHead: '',
  //       description: '',
  //       credit: null,
  //       debit: null,
  //     },
  //   ]);
  // }, [rows]);

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      onRowsChange={handleRowsChange}
      rowKeyGetter={(row) => row.sort_order}
      className="rdg-light h-full !bg-transparent m-3"
      style={{
        fontSize: '14px',
      }}
      rowHeight={35}
      headerRowHeight={40}
    />
  );
}
