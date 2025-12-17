import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Column } from 'react-data-grid';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import { formatCurrency, getAccountById } from '@/lib/myUtils.tsx';
import type { CashbookRow, CashbookSpreadSheetProps } from './types';
import {
  SORT_ORDER,
  isRowEmpty,
  isSpecialRow,
  createEmptyRow,
  createBalanceRow,
  calculateBalance,
} from './utils/cashbookUtils';
import { createAutoCompleteEditor } from './editors/AutoCompleteEditor';
import { NumberEditor } from './editors/NumberEditor';

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
