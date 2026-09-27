// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';

const localTables = vi.hoisted(() => ({
  current: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock('./localDB', () => ({
  executeSql: (sql: string) => {
    const table = /FROM (\w+)/.exec(sql)?.[1] ?? '';
    const rows = localTables.current[table] ?? [];
    if (sql.includes('COUNT(*)')) {
      return [
        { n: rows.filter((r) => r.synced === 0 || r.deleted != null).length },
      ];
    }
    return rows.filter((r) => r.deleted == null);
  },
}));

import { canonicalValue, compareTable, verifyBackup } from './verifyBackup';

// Minimal stand-in for the supabase-js query builder, capped at `pageCap`
// rows per response like PostgREST.
function fakeSupabase(
  remote: Record<string, Record<string, unknown>[]>,
  pageCap = 1000
) {
  return {
    from(table: string) {
      const rows = remote[table] ?? [];
      const orders: string[] = [];
      let limit: number | undefined;
      let head = false;
      const builder = {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          head = Boolean(opts?.head);
          return builder;
        },
        order(column: string) {
          orders.push(column);
          return builder;
        },
        limit(n: number) {
          limit = n;
          return builder;
        },
        range(from: number, to: number) {
          const sorted = [...rows].sort((a, b) => {
            for (const c of orders) {
              if (a[c] === b[c]) continue;
              return String(a[c]) < String(b[c]) ? -1 : 1;
            }
            return 0;
          });
          const end = Math.min(to + 1, from + pageCap);
          return Promise.resolve({
            data: sorted.slice(from, end),
            error: null,
          });
        },
        then(resolve: (value: unknown) => void) {
          if (head) resolve({ count: rows.length, error: null });
          else resolve({ data: rows.slice(0, limit), error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

const bill = (loan_no: number, overrides: Record<string, unknown> = {}) => ({
  serial: 'A',
  loan_no,
  date: '2026-01-01',
  customer_id: 'c1',
  loan_amount: 1000,
  interest_rate: 2,
  first_month_interest: 20,
  doc_charges: 5,
  metal_type: 'Gold',
  released: 0,
  company: 'SMB',
  ...overrides,
});

describe('canonicalValue', () => {
  it('treats SQLite and Postgres representations of the same value alike', () => {
    expect(canonicalValue(1, true)).toBe(canonicalValue(true, true));
    expect(canonicalValue(0, true)).toBe(canonicalValue(false, true));
    expect(canonicalValue('5', true)).toBe(canonicalValue(5.0, true));
    expect(canonicalValue(null, false)).toBe(canonicalValue(undefined, false));
    expect(canonicalValue(null, false)).not.toBe(canonicalValue('', false));
  });
});

describe('compareTable', () => {
  it('matches when rows are equal apart from local-only columns and types', () => {
    const local = [
      { ...bill(1), synced: 1, deleted: null },
      { ...bill(2), synced: 1, deleted: null },
    ];
    const remote = [bill(2, { released: false }), bill(1, { released: false })];
    const report = compareTable('bills', local, remote, 0);
    expect(report.status).toBe('match');
    expect(report.localHash).toBe(report.remoteHash);
  });

  it('reports missing, extra and changed rows', () => {
    const local = [bill(1), bill(2, { loan_amount: 1500 }), bill(3)];
    const remote = [bill(1), bill(2), bill(4)];
    const report = compareTable('bills', local, remote, 0);
    expect(report.status).toBe('mismatch');
    expect(report.samples.missingOnSupabase).toEqual(['serial=A, loan_no=3']);
    expect(report.samples.missingLocally).toEqual(['serial=A, loan_no=4']);
    expect(report.samples.different).toEqual([
      {
        key: 'serial=A, loan_no=2',
        columns: [{ column: 'loan_amount', local: 1500, remote: 1000 }],
      },
    ]);
  });

  it('flags columns Supabase does not have and duplicate keys', () => {
    const item = {
      serial: 'A',
      loan_no: 1,
      product: 'Ring',
      quality: null,
      extra: null,
      quantity: 1,
      gross_weight: 2,
      net_weight: 2,
      ignore_weight: 0,
    };
    const local = [
      { ...item, sort_order: 1 },
      { ...item, sort_order: 2, product: 'Chain' },
    ];
    const remote = [item];
    const report = compareTable('bill_items', local, remote, 0);
    expect(report.status).toBe('mismatch');
    expect(report.missingRemoteColumns).toEqual(['sort_order']);
  });
});

describe('verifyBackup', () => {
  beforeEach(() => {
    localTables.current = {};
  });

  it('backs up first, pages through large tables and reports a match', async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => bill(i + 1));
    localTables.current.bills = rows.map((r) => ({
      ...r,
      synced: 1,
      deleted: null,
    }));
    const pushAll = vi.fn().mockResolvedValue(undefined);
    const progress = vi.fn();

    const report = await verifyBackup(
      { client: fakeSupabase({ bills: rows }, 500), pushAll },
      ['bills'],
      progress
    );

    expect(pushAll).toHaveBeenCalledOnce();
    expect(progress).toHaveBeenNthCalledWith(1, { step: 'backup' });
    expect(report.backup).toEqual({ ok: true });
    expect(report.tables[0]).toMatchObject({
      status: 'match',
      localCount: 2345,
      remoteCount: 2345,
      pendingCount: 0,
    });
    expect(report.inSync).toBe(true);
  });

  it('still verifies when the backup fails and reports pending rows', async () => {
    localTables.current.bills = [
      { ...bill(1), synced: 1, deleted: null },
      { ...bill(2), synced: 0, deleted: null },
    ];
    const report = await verifyBackup(
      {
        client: fakeSupabase({ bills: [bill(1)] }),
        pushAll: () => Promise.reject(new Error('offline')),
      },
      ['bills'],
      vi.fn()
    );

    expect(report.backup).toEqual({ ok: false, error: 'offline' });
    expect(report.tables[0]).toMatchObject({
      status: 'mismatch',
      pendingCount: 1,
      missingOnSupabase: 1,
    });
    expect(report.inSync).toBe(false);
  });

  it('marks a table as errored when Supabase fails', async () => {
    const client = {
      from: () => ({
        select: () =>
          Promise.resolve({
            count: null,
            error: { message: 'relation missing' },
          }),
      }),
    } as unknown as SupabaseClient;
    const report = await verifyBackup(
      { client, pushAll: () => Promise.resolve() },
      ['areas'],
      vi.fn()
    );
    expect(report.tables[0]).toMatchObject({
      status: 'error',
      error: 'relation missing',
    });
    expect(report.inSync).toBe(false);
  });
});
