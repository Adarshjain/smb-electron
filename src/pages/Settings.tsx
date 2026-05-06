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

export default function Settings() {
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<TableName>('bills');
  const [backfilling, setBackfilling] = useState(false);

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
