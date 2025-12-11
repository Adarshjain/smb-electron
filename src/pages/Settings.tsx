import CompanySettings from '@/components/CompanySettings.tsx';
import { Button } from '@/components/ui/button.tsx';
import ConfirmationDialog from '@/components/ConfirmationDialog.tsx';
import { AlertTriangleIcon } from 'lucide-react';
import {
  errorToast,
  successToast,
  toastElectronResponse,
} from '@/lib/myUtils.tsx';
import { useNavigate } from 'react-router-dom';
import GoHome from '@/components/GoHome.tsx';
import { useEffect, useState } from 'react';

export default function Settings() {
  const navigate = useNavigate();
  const [{ isSyncEnabled, syncInfo }, setSyncInfo] = useState<{
    syncInfo: {
      lastSyncTime: Date | null;
      nextSyncTime: Date | null;
      interval: number;
    } | null;
    isSyncEnabled: string;
  }>({
    isSyncEnabled: 'false',
    syncInfo: null,
  });

  useEffect(() => {
    const fetchSyncData = async () => {
      const syncInfoResponse = await window.api.supabase.getSyncInfo();
      if (syncInfoResponse.success && syncInfoResponse.data) {
        setSyncInfo(syncInfoResponse.data);
      }
    };
    void fetchSyncData();

    const interval = setInterval(() => {
      void (async () => {
        const syncInfoResponse = await window.api.supabase.getSyncInfo();
        if (syncInfoResponse.success && syncInfoResponse.data) {
          setSyncInfo(syncInfoResponse.data);
        }
      })();
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleString();
  };

  const getTimeRemaining = () => {
    if (!syncInfo?.nextSyncTime) return 'N/A';
    const now = Date.now();
    const next = new Date(syncInfo?.nextSyncTime).getTime();
    const diff = next - now;
    if (diff <= 0) return 'Soon...';
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <div className="p-6 flex flex-col gap-3">
      <div className="flex">
        <GoHome />
        <div className="text-2xl font-bold tracking-tight ml-4">Settings</div>
      </div>
      <CompanySettings />
      <div className="flex flex-col gap-2 border rounded-md p-4">
        <div className="text-lg font-semibold">Sync Status</div>
        <div>Sync Enabled: {isSyncEnabled}</div>
        {syncInfo && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Last Sync:</span>
              <span className="text-sm">
                {formatDate(syncInfo.lastSyncTime)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Next Sync:</span>
              <span className="text-sm">
                {formatDate(syncInfo.nextSyncTime)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Time Remaining:</span>
              <span className="text-sm font-mono">{getTimeRemaining()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sync Interval:</span>
              <span className="text-sm">
                {syncInfo.interval / 60000} minutes
              </span>
            </div>
          </>
        )}
      </div>
      <Button
        variant="outline"
        className="w-32"
        onClick={() => void navigate('/customer-crud')}
      >
        Customers
      </Button>
      <Button variant="outline" className="w-32" onClick={() => void sync()}>
        Back Up
      </Button>
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
