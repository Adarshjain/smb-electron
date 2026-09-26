import { useEffect, useState } from 'react';
import { Download, Loader } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { batchQuery } from '@/hooks/dbUtil.ts';
import { errorToast, viewableDate } from '@/lib/myUtils.tsx';
import {
  buildFactsQueries,
  type AnalyticsFilters,
} from '@/lib/analytics/facts.ts';
import type { Drill } from './AnalyticsContext.tsx';
import { count } from './format.ts';

const LIMIT = 500;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function display(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? value.toLocaleString('en-IN')
      : value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  const s = typeof value === 'string' ? value : JSON.stringify(value);
  return ISO_DATE.test(s) ? viewableDate(s) : s;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s =
      v === null || v === undefined
        ? ''
        : typeof v === 'string' || typeof v === 'number'
          ? String(v)
          : JSON.stringify(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    columns.map(escape).join(','),
    ...rows.map((r) => columns.map((c) => escape(r[c])).join(',')),
  ].join('\n');
}

export default function DrillDialog({
  drill,
  filters,
  asOf,
  onClose,
}: {
  drill: Drill | null;
  filters: AnalyticsFilters;
  asOf: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!drill) return;
    setLoading(true);
    setRows([]);
    const prelude = drill.usesFacts ? buildFactsQueries(filters, asOf) : [];
    batchQuery<unknown[][]>([
      ...prelude,
      { sql: `SELECT COUNT(*) AS n FROM (${drill.sql})`, params: drill.params },
      { sql: `${drill.sql} LIMIT ${LIMIT}`, params: drill.params },
    ])
      .then((results) => {
        setTotal((results[prelude.length][0] as { n: number }).n);
        setRows(results[prelude.length + 1] as Record<string, unknown>[]);
      })
      .catch(errorToast)
      .finally(() => setLoading(false));
  }, [drill, filters, asOf]);

  const exportCsv = async () => {
    if (!drill) return;
    try {
      const prelude = drill.usesFacts ? buildFactsQueries(filters, asOf) : [];
      const results = await batchQuery<unknown[][]>([
        ...prelude,
        { sql: drill.sql, params: drill.params },
      ]);
      const all = results[prelude.length] as Record<string, unknown>[];
      // BOM so Excel reads the Tamil text as UTF-8.
      const blob = new Blob(['﻿' + toCsv(all)], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${drill.title.replace(/[^\w-]+/g, '_')}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      errorToast(e);
    }
  };

  const columns = rows.length ? Object.keys(rows[0]) : [];

  return (
    <Dialog open={drill !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[min(1400px,95vw)] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{drill?.title}</DialogTitle>
          <DialogDescription>
            {loading
              ? 'Loading…'
              : total > LIMIT
                ? `${count(total)} rows · showing the first ${LIMIT}. Export to get all of them.`
                : `${count(total)} rows`}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end">
          <Button
            variant="outline"
            className="h-8"
            onClick={() => void exportCsv()}
            disabled={!total}
          >
            <Download />
            Export CSV
          </Button>
        </div>
        <div className="overflow-auto flex-1 min-h-0 border rounded-md">
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader className="animate-spin" />
            </div>
          ) : (
            <Table className="text-xs">
              <TableHeader className="sticky top-0 bg-white">
                <TableRow>
                  {columns.map((c) => (
                    <TableHead key={c} className="h-8 whitespace-nowrap">
                      {c}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row, i) => (
                  <TableRow key={i}>
                    {columns.map((c) => (
                      <TableCell
                        key={c}
                        className={
                          typeof row[c] === 'number'
                            ? 'text-right tabular-nums py-1'
                            : 'py-1 whitespace-nowrap'
                        }
                      >
                        {display(row[c])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
