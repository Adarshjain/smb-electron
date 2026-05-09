import { useEffect, useState } from 'react';
import { batchQuery } from '@/hooks/dbUtil.ts';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  currentIsoDate,
  errorToast,
  formatCurrency,
  viewableDate,
} from '@/lib/myUtils.tsx';
import GoHome from '@/components/GoHome.tsx';
import { cn } from '@/lib/utils.ts';

type RangeKey = '7d' | '1m' | '3m' | 'all';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '1m', label: 'Last 1 month' },
  { key: '3m', label: 'Last 3 months' },
  { key: 'all', label: 'All time' },
];

interface DiffRow {
  date: string;
  loanDiff: number;
  interestDiff: number;
  releaseDiff: number;
}

interface BillsAggRow {
  date: string;
  company: string;
  total: number;
}

interface ReleasesAggRow {
  date: string;
  company: string;
  total_loan: number;
  total_int: number;
}

interface DailyEntriesAggRow {
  date: string;
  company: string;
  total_credit?: number;
  total_debit: number;
}

const THRESHOLD = 1;

function startDateFor(range: RangeKey): string {
  if (range === 'all') {
    return '2020-01-01';
  }
  const d = new Date();
  if (range === '7d') {
    d.setDate(d.getDate() - 7);
  } else if (range === '1m') {
    d.setMonth(d.getMonth() - 1);
  } else {
    d.setMonth(d.getMonth() - 3);
  }
  return d.toISOString().split('T')[0];
}

export default function LoanVerify() {
  const [range, setRange] = useState<RangeKey>('7d');
  const [results, setResults] = useState<Record<string, DiffRow[]> | null>(
    null
  );
  const [verifiedRange, setVerifiedRange] = useState<{
    start: string;
    end: string;
  } | null>(null);

  const runVerify = async () => {
    try {
      const start = startDateFor(range);
      const end = currentIsoDate();

      const [billsAgg, releasesAgg, de114, de914] = await batchQuery<
        [
          BillsAggRow[],
          ReleasesAggRow[],
          DailyEntriesAggRow[],
          DailyEntriesAggRow[],
        ]
      >([
        {
          sql: `SELECT date, company, SUM(loan_amount) AS total
                FROM bills
                WHERE deleted IS NULL AND date >= ? AND date <= ?
                GROUP BY date, company`,
          params: [start, end],
        },
        {
          sql: `SELECT date, company,
                       SUM(loan_amount) AS total_loan,
                       SUM(tax_interest_amount) AS total_int
                FROM releases
                WHERE deleted IS NULL AND date >= ? AND date <= ?
                GROUP BY date, company`,
          params: [start, end],
        },
        {
          sql: `SELECT date, company,
                       SUM(credit) AS total_credit,
                       SUM(debit) AS total_debit
                FROM daily_entries
                WHERE deleted IS NULL
                  AND main_code = 1 AND sub_code = 14
                  AND date >= ? AND date <= ?
                GROUP BY date, company`,
          params: [start, end],
        },
        {
          sql: `SELECT date, company, SUM(debit) AS total_debit
                FROM daily_entries
                WHERE deleted IS NULL
                  AND main_code = 9 AND sub_code = 14
                  AND date >= ? AND date <= ?
                GROUP BY date, company`,
          params: [start, end],
        },
      ]);

      interface Bucket {
        billsTotal: number;
        releasesLoan: number;
        releasesInt: number;
        de114Credit: number;
        de114Debit: number;
        de914Debit: number;
      }
      const buckets = new Map<string, Bucket>();
      const key = (date: string, company: string) => `${date}|${company}`;
      const ensure = (date: string, company: string): Bucket => {
        const k = key(date, company);
        let b = buckets.get(k);
        if (!b) {
          b = {
            billsTotal: 0,
            releasesLoan: 0,
            releasesInt: 0,
            de114Credit: 0,
            de114Debit: 0,
            de914Debit: 0,
          };
          buckets.set(k, b);
        }
        return b;
      };

      for (const r of billsAgg ?? []) {
        ensure(r.date, r.company).billsTotal = r.total ?? 0;
      }
      for (const r of releasesAgg ?? []) {
        const b = ensure(r.date, r.company);
        b.releasesLoan = r.total_loan ?? 0;
        b.releasesInt = r.total_int ?? 0;
      }
      for (const r of de114 ?? []) {
        const b = ensure(r.date, r.company);
        b.de114Credit = r.total_credit ?? 0;
        b.de114Debit = r.total_debit ?? 0;
      }
      for (const r of de914 ?? []) {
        ensure(r.date, r.company).de914Debit = r.total_debit ?? 0;
      }

      const byCompany: Record<string, DiffRow[]> = {};
      for (const [k, b] of buckets.entries()) {
        const [date, company] = k.split('|');
        const loanDiff = b.billsTotal - b.de114Credit;
        const interestDiff = b.releasesInt - b.de914Debit;
        const releaseDiff = b.releasesLoan - b.de114Debit;
        if (
          Math.abs(loanDiff) < THRESHOLD &&
          Math.abs(interestDiff) < THRESHOLD &&
          Math.abs(releaseDiff) < THRESHOLD
        ) {
          continue;
        }
        if (!byCompany[company]) byCompany[company] = [];
        byCompany[company].push({ date, loanDiff, interestDiff, releaseDiff });
      }
      for (const company of Object.keys(byCompany)) {
        byCompany[company].sort((a, b) => a.date.localeCompare(b.date));
      }

      setResults(byCompany);
      setVerifiedRange({ start, end });
    } catch (e) {
      errorToast(e);
    }
  };

  useEffect(() => {
    void runVerify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  return (
    <div className="p-3 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <GoHome />
        <div className="flex items-center gap-2">
          {RANGE_OPTIONS.map((opt) => (
            <Button
              key={opt.key}
              variant={range === opt.key ? 'default' : 'outline'}
              onClick={() => setRange(opt.key)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="w-8" />
      </div>

      {verifiedRange ? (
        <div className="text-sm text-gray-500 mb-3 text-center">
          Range: {viewableDate(verifiedRange.start)} –{' '}
          {viewableDate(verifiedRange.end)}
        </div>
      ) : null}

      {results === null ? null : Object.keys(results).length === 0 ? (
        <div className="mt-6 text-center text-green-600">
          No mismatches in the selected range.
        </div>
      ) : (
        Object.entries(results)
          .sort(([a], [b]) => {
            if (a === 'Sri Mahaveer Bankers') return -1;
            if (b === 'Sri Mahaveer Bankers') return 1;
            return a.localeCompare(b);
          })
          .map(([company, rows]) => (
            <div key={company} className="mt-6">
              <div className="mb-2 text-center font-medium">{company}</div>
              <Table className="table-auto">
                <TableHeader>
                  <TableRow>
                    <TableHead className="border-r">Date</TableHead>
                    <TableHead className="border-r text-right">
                      Loan Amount Diff
                    </TableHead>
                    <TableHead className="border-r text-right">
                      Interest Amount Diff
                    </TableHead>
                    <TableHead className="text-right">
                      Release Amount Diff
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.date}>
                      <TableCell className="border-r">
                        {viewableDate(r.date)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'border-r text-right',
                          Math.abs(r.loanDiff) >= THRESHOLD
                            ? 'text-red-600'
                            : ''
                        )}
                      >
                        {Math.abs(r.loanDiff) >= THRESHOLD
                          ? formatCurrency(r.loanDiff, true)
                          : '0.00'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'border-r text-right',
                          Math.abs(r.interestDiff) >= THRESHOLD
                            ? 'text-red-600'
                            : ''
                        )}
                      >
                        {Math.abs(r.interestDiff) >= THRESHOLD
                          ? formatCurrency(r.interestDiff, true)
                          : '0.00'}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right',
                          Math.abs(r.releaseDiff) >= THRESHOLD
                            ? 'text-red-600'
                            : ''
                        )}
                      >
                        {Math.abs(r.releaseDiff) >= THRESHOLD
                          ? formatCurrency(r.releaseDiff, true)
                          : '0.00'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))
      )}
    </div>
  );
}
