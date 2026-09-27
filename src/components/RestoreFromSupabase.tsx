import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import ConfirmationDialog from '@/components/ConfirmationDialog.tsx';
import { errorToast, successToast } from '@/lib/myUtils.tsx';
import type { RestoreProgress } from '../../shared-types';

const progressLabel = (progress: RestoreProgress | null) => {
  switch (progress?.step) {
    case 'download':
      return `Downloading ${progress.table} (${progress.index + 1}/${progress.total})...`;
    case 'write':
      return 'Writing to local database...';
    case 'verify':
      return 'Verifying...';
    default:
      return 'Checking local database...';
  }
};

export default function RestoreFromSupabase() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<RestoreProgress | null>(null);

  useEffect(() => window.api.supabase.onRestoreProgress(setProgress), []);

  const restore = async () => {
    setRunning(true);
    setProgress(null);
    try {
      const resp = await window.api.supabase.restore();
      if (!resp.success || !resp.data) {
        errorToast(resp.success ? 'No data returned' : resp.error);
        return;
      }
      const { rowsRestored, inSync, tables } = resp.data;
      if (inSync) {
        successToast(
          `Restored and verified ${rowsRestored} rows. Reloading...`
        );
        // Screens cache companies and other lookups; start fresh.
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const failing = tables.filter((t) => t.status !== 'match');
        errorToast(
          `Restored ${rowsRestored} rows, but ${failing.map((t) => t.table).join(', ')} don't match Supabase. Open Verify Backup for details.`
        );
      }
    } catch (e) {
      errorToast(e);
    } finally {
      setRunning(false);
    }
  };

  return (
    <ConfirmationDialog
      trigger={
        <Button
          variant="destructive"
          size="sm"
          className="cursor-pointer w-min"
          disabled={running}
        >
          {running ? progressLabel(progress) : 'Restore from Supabase'}
        </Button>
      }
      title="Restore all data from Supabase?"
      description="Only runs when the local database is empty, e.g. on a new install. Downloads every table, writes it all in one go and checks the result. If any step fails, nothing is written."
      onConfirm={restore}
      confirmText="Restore"
      isDestructive
    />
  );
}
