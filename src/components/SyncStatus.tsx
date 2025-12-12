import { useEffect, useState } from 'react';
import { viewableDate } from '@/lib/myUtils.tsx';

export default function SyncStatus() {
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

  const formatDate = (date: Date | null) => {
    if (!date) return 'N/A';
    return viewableDate(date, true);
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
    <div className="flex flex-col gap-2 border rounded-md p-4">
      <div className="text-lg font-semibold">Sync Status</div>
      <div>Sync Enabled: {isSyncEnabled}</div>
      {syncInfo && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Last Sync:</span>
            <span className="text-sm">{formatDate(syncInfo.lastSyncTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Next Sync:</span>
            <span className="text-sm">{formatDate(syncInfo.nextSyncTime)}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Time Remaining:</span>
            <span className="text-sm font-mono">{getTimeRemaining()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Sync Interval:</span>
            <span className="text-sm">{syncInfo.interval / 60000} minutes</span>
          </div>
        </>
      )}
    </div>
  );
}
