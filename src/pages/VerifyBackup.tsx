import { useEffect, useState } from 'react';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  XCircleIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.tsx';
import { errorToast, viewableDate } from '@/lib/myUtils.tsx';
import type {
  BackupVerifyProgress,
  BackupVerifyReport,
  VerifyTableReport,
} from '../../shared-types';

const progressLabel = (progress: BackupVerifyProgress | null) => {
  if (!progress) return 'Starting...';
  if (progress.step === 'backup') return 'Backing up pending changes...';
  return `Checking ${progress.table} (${progress.index + 1}/${progress.total})...`;
};

const formatValue = (value: unknown) =>
  value === null || value === undefined ? 'null' : JSON.stringify(value);

function StatusBadge({ status }: { status: VerifyTableReport['status'] }) {
  if (status === 'match') {
    return (
      <Badge className="bg-green-600 text-white">
        <CheckCircle2Icon /> Match
      </Badge>
    );
  }
  if (status === 'mismatch') {
    return (
      <Badge variant="destructive">
        <XCircleIcon /> Mismatch
      </Badge>
    );
  }
  return (
    <Badge className="bg-yellow-500 text-white">
      <AlertTriangleIcon /> Error
    </Badge>
  );
}

function SampleList({
  title,
  total,
  items,
}: {
  title: string;
  total: number;
  items: string[];
}) {
  if (!total) return null;
  return (
    <div>
      <div className="font-medium">
        {title} ({total})
      </div>
      <ul className="list-disc pl-5 font-mono text-xs">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
        {total > items.length && <li>…and {total - items.length} more</li>}
      </ul>
    </div>
  );
}

function TableDetails({ report }: { report: VerifyTableReport }) {
  if (report.status === 'error') {
    return <div className="text-sm text-red-700">{report.error}</div>;
  }
  if (report.status === 'match' && !report.pendingCount) return null;

  return (
    <div className="flex flex-col gap-2 text-sm">
      {report.pendingCount > 0 && (
        <div>
          {report.pendingCount} row(s) are still waiting to be backed up.
        </div>
      )}
      {report.missingRemoteColumns.length > 0 && (
        <div className="text-red-700">
          Columns missing on Supabase:{' '}
          <span className="font-mono">
            {report.missingRemoteColumns.join(', ')}
          </span>
        </div>
      )}
      {(report.duplicateLocalKeys > 0 || report.duplicateRemoteKeys > 0) && (
        <div className="text-red-700">
          Rows sharing the same key: {report.duplicateLocalKeys} locally,{' '}
          {report.duplicateRemoteKeys} on Supabase
        </div>
      )}
      <SampleList
        title="Missing on Supabase"
        total={report.missingOnSupabase}
        items={report.samples.missingOnSupabase}
      />
      <SampleList
        title="Only on Supabase"
        total={report.missingLocally}
        items={report.samples.missingLocally}
      />
      {report.different > 0 && (
        <div>
          <div className="font-medium">
            Different values ({report.different})
          </div>
          <ul className="list-disc pl-5 font-mono text-xs">
            {report.samples.different.map((diff) => (
              <li key={diff.key}>
                {diff.key}
                <ul className="pl-4">
                  {diff.columns.map((c) => (
                    <li key={c.column}>
                      {c.column}: local {formatValue(c.local)} → Supabase{' '}
                      {formatValue(c.remote)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {report.different > report.samples.different.length && (
              <li>
                …and {report.different - report.samples.different.length} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function VerifyBackup() {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BackupVerifyProgress | null>(null);
  const [report, setReport] = useState<BackupVerifyReport | null>(null);

  useEffect(() => window.api.supabase.onVerifyProgress(setProgress), []);

  const run = async () => {
    setRunning(true);
    setProgress(null);
    setReport(null);
    try {
      const resp = await window.api.supabase.verifyBackup();
      if (!resp.success || !resp.data) {
        errorToast(resp.success ? 'No data returned' : resp.error);
        return;
      }
      setReport(resp.data);
    } catch (e) {
      errorToast(e);
    } finally {
      setRunning(false);
    }
  };

  const failing = report?.tables.filter((t) => t.status !== 'match') ?? [];

  return (
    <div className="p-6 flex flex-col gap-4">
      <div className="text-2xl font-bold tracking-tight">Verify Backup</div>
      <div className="text-sm text-muted-foreground max-w-3xl">
        Backs up any pending changes, then downloads every table from Supabase
        and compares a hash of each row with the local database. Avoid entering
        data while it runs, or new entries will show up as differences.
      </div>
      <div className="flex items-center gap-3">
        <Button className="w-min" disabled={running} onClick={() => void run()}>
          {running ? 'Verifying...' : 'Run Verification'}
        </Button>
        {running && (
          <span className="flex items-center gap-2 text-sm">
            <Loader2Icon className="animate-spin" size={16} />
            {progressLabel(progress)}
          </span>
        )}
      </div>

      {report && (
        <>
          <div
            className={`flex items-center gap-2 rounded-md border p-4 font-medium ${
              report.inSync
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-800'
            }`}
          >
            {report.inSync ? (
              <>
                <CheckCircle2Icon size={20} /> Supabase matches the local
                database.
              </>
            ) : (
              <>
                <XCircleIcon size={20} /> {failing.length} table(s) don't match:{' '}
                {failing.map((t) => t.table).join(', ')}
              </>
            )}
          </div>
          <div className="text-sm">
            Backup step:{' '}
            {report.backup.ok ? (
              'completed'
            ) : (
              <span className="text-red-700">
                failed — {report.backup.error}
              </span>
            )}
            {' · '}Checked at {viewableDate(new Date(report.finishedAt), true)}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Table</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Local rows</TableHead>
                <TableHead className="text-right">Supabase rows</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead>Local hash</TableHead>
                <TableHead>Supabase hash</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.tables.map((t) => (
                <TableRow key={t.table} className="align-top">
                  <TableCell className="font-medium">{t.table}</TableCell>
                  <TableCell>
                    <StatusBadge status={t.status} />
                  </TableCell>
                  <TableCell className="text-right">{t.localCount}</TableCell>
                  <TableCell className="text-right">{t.remoteCount}</TableCell>
                  <TableCell className="text-right">{t.pendingCount}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {t.localHash.slice(0, 12)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {t.remoteHash.slice(0, 12)}
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <TableDetails report={t} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
