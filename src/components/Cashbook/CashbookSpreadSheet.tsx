import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Column, RenderEditCellProps } from 'react-data-grid';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import type { Tables } from '../../../tables';
import { formatCurrency, getAccountById, jsNumberFix } from '@/lib/myUtils.tsx';

interface CashbookRow {
  accountHead: Tables['account_head'] | string | undefined;
  description: string | null;
  credit: number | null;
  debit: number | null;
  sort_order: number;
}

const SORT_ORDER = {
  OPENING_BALANCE: -1,
  CLOSING_BALANCE: -2,
  EMPTY_ROW: 0,
} as const;

const isRowEmpty = (row: CashbookRow): boolean =>
  !row.accountHead || (!row.credit && !row.debit);

const isSpecialRow = (sortOrder: number): boolean =>
  sortOrder === SORT_ORDER.OPENING_BALANCE ||
  sortOrder === SORT_ORDER.CLOSING_BALANCE;

const createEmptyRow = (
  sortOrder: number = SORT_ORDER.EMPTY_ROW
): CashbookRow => ({
  accountHead: undefined,
  description: null,
  credit: null,
  debit: null,
  sort_order: sortOrder,
});

const createBalanceRow = (
  label: string,
  sortOrder: number,
  balance: number
): CashbookRow => ({
  accountHead: label,
  sort_order: sortOrder,
  credit: balance >= 0 ? balance : null,
  debit: balance < 0 ? balance : null,
  description: null,
});

const calculateBalance = (
  rows: CashbookRow[],
  openingBalance: number
): number =>
  rows.reduce(
    (sum, row) => jsNumberFix(sum + (row.credit ?? 0) - (row.debit ?? 0)),
    openingBalance
  );

const getInitialInputValue = (
  row: CashbookRow,
  key: keyof CashbookRow
): string => {
  const val = row[key];
  if (typeof val === 'number' || typeof val === 'string') return String(val);
  return val?.name ?? '';
};

function createAutoCompleteEditor(
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

function NumberEditor({
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
      className="h-full w-full border-none bg-white px-2 text-right text-sm outline-none focus:ring-2 focus:ring-blue-500"
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
  const [rows, setRows] = useState<CashbookRow[]>([]);
  const accountHeadsRef = useRef(accountHeads);
  accountHeadsRef.current = accountHeads;

  const AutoCompleteEditor = useMemo(
    () => createAutoCompleteEditor(accountHeadsRef),
    []
  );

  const isRowEditable = useCallback(
    (row: CashbookRow) => !isSpecialRow(row.sort_order),
    []
  );

  const columns = useMemo<Column<CashbookRow>[]>(
    () => [
      {
        key: 'accountHead',
        name: 'Account',
        width: 360,
        resizable: true,
        editable: isRowEditable,
        renderEditCell: AutoCompleteEditor,
        renderCell: ({ row }) => (
          <div className="truncate px-1 select-text">
            {typeof row.accountHead === 'string'
              ? row.accountHead
              : (row.accountHead?.name ?? '')}
          </div>
        ),
      },
      {
        key: 'description',
        name: 'Description',
        width: 360,
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
    ],
    [AutoCompleteEditor, isRowEditable]
  );

  useEffect(() => {
    const sortedEntries = [...entries].sort(
      (a, b) => a.sort_order - b.sort_order
    );
    const maxSortOrder = entries.reduce(
      (max, e) => Math.max(max, e.sort_order),
      0
    );

    const dataRows: CashbookRow[] = sortedEntries.map((entry) => ({
      accountHead: getAccountById(accountHeads, entry.sub_code),
      description: entry.description,
      credit: entry.credit,
      debit: entry.debit,
      sort_order: entry.sort_order,
    }));

    const closingBalance = calculateBalance(dataRows, openingBalance);

    setRows([
      createBalanceRow(
        'Opening Balance',
        SORT_ORDER.OPENING_BALANCE,
        openingBalance
      ),
      ...dataRows,
      createEmptyRow(maxSortOrder + 1),
      createBalanceRow(
        'Closing Balance',
        SORT_ORDER.CLOSING_BALANCE,
        closingBalance
      ),
    ]);
  }, [accountHeads, entries, openingBalance]);

  const handleRowsChange = useCallback(
    (newRows: CashbookRow[]) => {
      const dataRows = newRows.filter((r) => !isSpecialRow(r.sort_order));
      const hasEmptyRow = dataRows.some(isRowEmpty);
      const filledRows = dataRows.filter((r) => !isRowEmpty(r));
      const closingBalance = calculateBalance(filledRows, openingBalance);

      let updatedRows = newRows.map((row) =>
        row.sort_order === SORT_ORDER.CLOSING_BALANCE
          ? {
              ...row,
              credit: closingBalance >= 0 ? closingBalance : null,
              debit: closingBalance < 0 ? closingBalance : null,
            }
          : row
      );

      if (!hasEmptyRow) {
        const closingIdx = updatedRows.findIndex(
          (r) => r.sort_order === SORT_ORDER.CLOSING_BALANCE
        );
        const maxSortOrder = Math.max(...dataRows.map((r) => r.sort_order), 0);
        updatedRows = [
          ...updatedRows.slice(0, closingIdx),
          createEmptyRow(maxSortOrder + 1),
          ...updatedRows.slice(closingIdx),
        ];
      }

      setRows(updatedRows);
    },
    [openingBalance]
  );

  return (
    <DataGrid
      columns={columns}
      rows={rows}
      onRowsChange={handleRowsChange}
      rowKeyGetter={(row) => row.sort_order}
      className="rdg-light min-h-full !bg-transparent m-3"
      style={{ fontSize: '14px' }}
      rowHeight={35}
      headerRowHeight={40}
    />
  );
}
