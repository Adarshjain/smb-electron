import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CellKeyboardEvent, CellKeyDownArgs, Column } from 'react-data-grid';
import { DataGrid } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import {
  errorToast,
  formatCurrency,
  getAccountById,
  successToast,
} from '@/lib/myUtils.tsx';
import type { CashbookRow, CashbookSpreadSheetProps } from './types';
import {
  calculateBalance,
  createBalanceRow,
  createDailyEntries,
  createEmptyRow,
  deleteDailyEntries,
  fetchDeletedRecords,
  fetchModifiedEntries,
  isFullyEmpty,
  isRowEmpty,
  isSpecialRow,
  SORT_ORDER,
  updateDailyEntries,
  validateRows,
} from './utils/cashbookUtils';
import { createAutoCompleteEditor } from './editors/AutoCompleteEditor';
import { NumberEditor } from './editors/NumberEditor';
import { StringEditor } from './editors/StringEditor';
import { Button } from '@/components/ui/button.tsx';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { query } from '@/hooks/dbUtil.ts';

const EMPTY_ROW_START = -3;

export default function CashbookSpreadSheet({
  entries,
  openingBalance,
  accountHeads,
  currentAccountHead,
  onLoadToday,
  date,
  refreshEntries,
}: CashbookSpreadSheetProps) {
  const { company } = useCompany();
  const [rows, setRows] = useState<CashbookRow[]>([]);
  const accountHeadsRef = useRef(accountHeads);
  accountHeadsRef.current = accountHeads;
  const nextEmptyRowSortOrderRef = useRef(EMPTY_ROW_START);

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
        renderEditCell: StringEditor,
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
      // {
      //   key: 'sort_order',
      //   name: 'Debit',
      //   width: 130,
      //   resizable: true,
      //   renderCell: ({ row }) => (
      //     <div className="text-right pr-2 select-text">{row.sort_order}</div>
      //   ),
      // },
    ],
    [AutoCompleteEditor, isRowEditable]
  );

  useEffect(() => {
    // Reset empty row counter when props change
    nextEmptyRowSortOrderRef.current = EMPTY_ROW_START;

    const sortedEntries = [...entries].sort(
      (a, b) => a.sort_order - b.sort_order
    );

    const dataRows: CashbookRow[] = sortedEntries.map((entry) => ({
      accountHead: getAccountById(accountHeads, entry.sub_code),
      description: entry.description,
      credit: entry.credit,
      debit: entry.debit,
      sort_order: entry.sort_order,
    }));

    const closingBalance = calculateBalance(dataRows, openingBalance);

    const emptyRowSortOrder = nextEmptyRowSortOrderRef.current--;

    setRows([
      createBalanceRow(
        'Opening Balance',
        SORT_ORDER.OPENING_BALANCE,
        openingBalance
      ),
      ...dataRows,
      createEmptyRow(emptyRowSortOrder),
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
        const emptyRowSortOrder = nextEmptyRowSortOrderRef.current--;
        updatedRows = [
          ...updatedRows.slice(0, closingIdx),
          createEmptyRow(emptyRowSortOrder),
          ...updatedRows.slice(closingIdx),
        ];
      }

      setRows(updatedRows);
    },
    [openingBalance]
  );

  const handleCellKeyDown = useCallback(
    (args: CellKeyDownArgs<CashbookRow>, event: CellKeyboardEvent) => {
      const { row, column, rowIdx } = args;

      // Handle Enter key to move to next cell (only in SELECT mode)
      if (event.key === 'Enter' && args.mode === 'SELECT') {
        event.preventGridDefault();

        const columnKeys = columns.map((col) => col.key);
        const currentColIdx = columnKeys.indexOf(column.key);
        const lastColIdx = columnKeys.length - 1;

        if (currentColIdx < lastColIdx) {
          // Move to next column in same row
          args.selectCell({ rowIdx, idx: currentColIdx + 1 });
        } else {
          // Move to first column of next row
          const nextRowIdx = rowIdx + 1;
          if (nextRowIdx < rows.length) {
            args.selectCell({ rowIdx: nextRowIdx, idx: 0 });
          }
        }
        return;
      }

      // Handle Delete key
      if (event.key !== 'Delete') {
        return;
      }
      if (isSpecialRow(row.sort_order)) return;
      event.preventDefault();
      setRows((currentRows) => {
        const newRows = currentRows.filter(
          (r) => r.sort_order !== row.sort_order
        );
        const dataRows = newRows.filter((r) => !isSpecialRow(r.sort_order));
        const hasEmptyRow = dataRows.some(isRowEmpty);
        const filledRows = dataRows.filter((r) => !isRowEmpty(r));
        const closingBalance = calculateBalance(filledRows, openingBalance);

        let updatedRows = newRows.map((r) =>
          r.sort_order === SORT_ORDER.CLOSING_BALANCE
            ? {
                ...r,
                credit: closingBalance >= 0 ? closingBalance : null,
                debit: closingBalance < 0 ? closingBalance : null,
              }
            : r
        );

        // Ensure there's always an empty row
        if (!hasEmptyRow) {
          const closingIdx = updatedRows.findIndex(
            (r) => r.sort_order === SORT_ORDER.CLOSING_BALANCE
          );
          const emptyRowSortOrder = nextEmptyRowSortOrderRef.current--;
          updatedRows = [
            ...updatedRows.slice(0, closingIdx),
            createEmptyRow(emptyRowSortOrder),
            ...updatedRows.slice(closingIdx),
          ];
        }

        return updatedRows;
      });
    },
    [columns, openingBalance, rows.length]
  );

  const onUpdate = async () => {
    if (!validateRows(rows) || !company || currentAccountHead == null) {
      return;
    }
    const newEntries = rows.filter(
      (row) => row.sort_order < -2 && !isFullyEmpty(row)
    );
    const oldEntries = rows.filter((row) => row.sort_order > 0);
    const deletedEntryIds = fetchDeletedRecords(entries, oldEntries);
    const modifiedRows = fetchModifiedEntries(entries, oldEntries);

    let isDone = true;

    if (newEntries.length) {
      try {
        const sortOrderResp = await query<[{ sort_order: number }]>(
          `SELECT sort_order
           FROM daily_entries
           ORDER BY sort_order DESC
           LIMIT 1`
        );

        const sortOrder = sortOrderResp?.[0]?.sort_order;
        if (!sortOrder) {
          errorToast('Something went wrong!');
          return;
        }
        const created = await createDailyEntries(
          newEntries,
          sortOrder,
          currentAccountHead,
          date,
          company.name
        );
        isDone &&= created;
      } catch (e) {
        errorToast(e);
        isDone = false;
      }
    }
    if (modifiedRows.length) {
      const updated = await updateDailyEntries(
        modifiedRows,
        currentAccountHead,
        date,
        company.name
      );
      isDone &&= updated;
    }
    if (deletedEntryIds.length) {
      const deleted = await deleteDailyEntries(deletedEntryIds, company.name);
      isDone &&= deleted;
    }
    if (isDone) {
      successToast('Updated!');
      await refreshEntries();
    }
  };

  return (
    <>
      <DataGrid
        columns={columns}
        rows={rows}
        onRowsChange={handleRowsChange}
        onCellKeyDown={handleCellKeyDown}
        rowKeyGetter={(row) => row.sort_order}
        className="rdg-light min-h-full pb-20 !bg-transparent m-3"
        style={{ fontSize: '14px' }}
        rowHeight={42}
        headerRowHeight={35}
      />
      <div className="flex justify-center gap-12 fixed bottom-0 left-0 right-0 py-3 border-t border-gray-200">
        {currentAccountHead?.name === 'CASH' ? (
          <Button
            className="border-black"
            variant="outline"
            onClick={() => void onLoadToday()}
          >
            Load Today's Entries
          </Button>
        ) : null}
        <Button className="border-black" onClick={() => void onUpdate()}>
          Update
        </Button>
      </div>
    </>
  );
}
