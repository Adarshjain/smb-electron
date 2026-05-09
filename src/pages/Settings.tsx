import CompanySettings from '@/components/CompanySettings.tsx';
import { Button } from '@/components/ui/button.tsx';
import ConfirmationDialog from '@/components/ConfirmationDialog.tsx';
import { AlertTriangleIcon } from 'lucide-react';
import {
  backfillReleaseTaxInterest,
  errorToast,
  successToast,
  tables,
  toastElectronResponse,
} from '@/lib/myUtils.tsx';
import { useNavigate } from 'react-router-dom';
import GoHome from '@/components/GoHome.tsx';
import SyncStatus from '@/components/SyncStatus.tsx';
import type { TableName } from '../../tables';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select.tsx';
import { useState } from 'react';

interface DedupeReport {
  dryRun: boolean;
  duplicateGroups: number;
  pairsKept: number;
  pairsMoved: number;
  rowsAffected: number;
  orphans: {
    date: string;
    company: string;
    sort_order: number;
    main_code: number;
    sub_code: number;
    description: string | null;
  }[];
  movedAssignments: {
    date: string;
    company: string;
    fromSortOrder: number;
    toSortOrder: number;
    description: string | null;
    main_code: number;
    sub_code: number;
  }[];
  uniqueIndexCreated: boolean;
  uniqueIndexSkippedReason?: string;
}

export default function Settings() {
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<TableName>('bills');
  const [backfilling, setBackfilling] = useState(false);
  const [dedupeReport, setDedupeReport] = useState<DedupeReport | null>(null);
  const [dedupeRunning, setDedupeRunning] = useState(false);

  const runBackfillReleaseTaxInterest = async () => {
    setBackfilling(true);
    try {
      const { scanned, updated, failed } = await backfillReleaseTaxInterest();
      if (failed > 0) {
        errorToast(
          `Backfill finished with errors — scanned ${scanned}, updated ${updated}, failed ${failed}`
        );
      } else {
        successToast(
          `Backfill complete — scanned ${scanned}, updated ${updated}`
        );
      }
    } catch (e) {
      errorToast(e);
    } finally {
      setBackfilling(false);
    }
  };

  const sync = async () => {
    try {
      const resp = await window.api.supabase.sync();
      if (!resp.success) {
        errorToast(resp.error);
      } else {
        successToast('Backup Complete');
      }
    } catch (error) {
      errorToast(error);
    }
  };

  const syncTable = async (tableName: TableName) => {
    try {
      const resp = await window.api.supabase.syncTable(tableName);
      if (!resp.success) {
        errorToast(resp.error);
      } else {
        successToast(`Backup Complete: ${tableName}`);
      }
    } catch (error) {
      errorToast(error);
    }
  };

  const previewDedupe = async () => {
    setDedupeRunning(true);
    try {
      const resp = await window.api.db.dedupeDailyEntries({ dryRun: true });
      if (!resp.success || !resp.data) {
        errorToast(resp.success ? 'No data returned' : resp.error);
        return;
      }
      setDedupeReport(resp.data);
    } catch (e) {
      errorToast(e);
    } finally {
      setDedupeRunning(false);
    }
  };

  const applyDedupe = async () => {
    setDedupeRunning(true);
    try {
      const resp = await window.api.db.dedupeDailyEntries({
        dryRun: false,
        addUniqueIndex: true,
      });
      if (!resp.success || !resp.data) {
        errorToast(resp.success ? 'No data returned' : resp.error);
        return;
      }
      const r = resp.data;
      const indexNote = r.uniqueIndexCreated
        ? ' + unique index created'
        : r.uniqueIndexSkippedReason
          ? ` (index skipped: ${r.uniqueIndexSkippedReason})`
          : '';
      successToast(
        `Dedupe complete — moved ${r.pairsMoved} pair(s), ${r.orphans.length} orphan(s)${indexNote}`
      );
      setDedupeReport(null);
    } catch (e) {
      errorToast(e);
    } finally {
      setDedupeRunning(false);
    }
  };

  return (
    <div className="p-6 flex flex-col gap-3">
      <div className="flex">
        <GoHome />
        <div className="text-2xl font-bold tracking-tight ml-4">Settings</div>
      </div>
      <CompanySettings />
      <SyncStatus />
      <Button variant="outline" className="w-32" onClick={() => void sync()}>
        Back Up
      </Button>
      <div className="flex gap-3">
        <NativeSelect
          value={selectedTable}
          onChange={(e) => setSelectedTable(e.target.value as TableName)}
        >
          {tables.map((table) => (
            <NativeSelectOption key={table} value={table}>
              {table}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button variant="outline" onClick={() => void syncTable(selectedTable)}>
          Back Up `{selectedTable}`
        </Button>
      </div>
      <ConfirmationDialog
        trigger={
          <Button variant="outline" className="w-min" disabled={backfilling}>
            {backfilling ? 'Backfilling...' : 'Backfill Release Tax Interest'}
          </Button>
        }
        title="Recompute tax_interest_amount for all releases?"
        onConfirm={runBackfillReleaseTaxInterest}
        confirmText="Run"
      />
      <Button
        variant="outline"
        className="w-min"
        disabled={dedupeRunning}
        onClick={() => void previewDedupe()}
      >
        {dedupeRunning ? 'Scanning...' : 'Dedupe daily_entries sort_order'}
      </Button>
      <ConfirmationDialog
        isOpen={dedupeReport !== null}
        onChange={(open) => {
          if (!open) setDedupeReport(null);
        }}
        title="Repair daily_entries.sort_order duplicates?"
        description={
          dedupeReport
            ? `Found ${dedupeReport.duplicateGroups} duplicate group(s). ` +
              `${dedupeReport.pairsMoved} pair(s) will be moved to fresh sort_orders. ` +
              `${dedupeReport.orphans.length} orphan row(s) will be left untouched. ` +
              `A unique index will be installed if no orphans remain.`
            : ''
        }
        confirmText={dedupeRunning ? 'Applying...' : 'Apply'}
        onConfirm={applyDedupe}
      >
        {dedupeReport && dedupeReport.orphans.length > 0 && (
          <div className="text-sm border rounded p-2 max-h-48 overflow-auto bg-yellow-50">
            <div className="font-medium mb-1 flex items-center gap-1">
              <AlertTriangleIcon size={14} />
              {dedupeReport.orphans.length} orphan row(s) — review manually:
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {dedupeReport.orphans.slice(0, 20).map((o, i) => (
                <li key={i}>
                  {o.date} / {o.company} / sort_order={o.sort_order} /{' '}
                  {o.main_code}→{o.sub_code}
                  {o.description ? ` — ${o.description}` : ''}
                </li>
              ))}
              {dedupeReport.orphans.length > 20 && (
                <li>…and {dedupeReport.orphans.length - 20} more</li>
              )}
            </ul>
          </div>
        )}
        {dedupeReport && dedupeReport.movedAssignments.length > 0 && (
          <div className="text-sm border rounded p-2 max-h-48 overflow-auto">
            <div className="font-medium mb-1">
              Moves ({dedupeReport.movedAssignments.length}):
            </div>
            <ul className="list-disc pl-5 space-y-0.5">
              {dedupeReport.movedAssignments.slice(0, 20).map((m, i) => (
                <li key={i}>
                  {m.date} / {m.company} / {m.main_code}→{m.sub_code}:{' '}
                  sort_order {m.fromSortOrder} → {m.toSortOrder}
                  {m.description ? ` — ${m.description}` : ''}
                </li>
              ))}
              {dedupeReport.movedAssignments.length > 20 && (
                <li>…and {dedupeReport.movedAssignments.length - 20} more</li>
              )}
            </ul>
          </div>
        )}
      </ConfirmationDialog>
      <div className="text-xl font-medium flex items-center gap-1 mt-12">
        <AlertTriangleIcon size={20} /> Danger Zone
      </div>
      <Button
        variant="outline"
        className="w-32"
        onClick={() => void navigate('/table-view')}
      >
        View Database
      </Button>
      <ConfirmationDialog
        trigger={
          <Button
            variant="destructive"
            size="sm"
            className="cursor-pointer w-min"
          >
            Delete and Init DB
          </Button>
        }
        title={`Delete all entries and refresh?`}
        onConfirm={async () =>
          void toastElectronResponse(await window.api.db.initSeed())
        }
        confirmText="Delete"
        isDestructive
      />
    </div>
  );
}
