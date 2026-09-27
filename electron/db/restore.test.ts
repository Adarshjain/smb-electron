// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { bill, fakeSupabase } from './fakeSupabase.testutil';

const dbHolder = vi.hoisted(() => ({
  current: null as Database.Database | null,
}));

vi.mock('./database', () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { migrateSchema } from './localDB';
import { restoreFromSupabase } from './restore';

const company = {
  name: 'SMB',
  current_date: '2026-01-01',
  next_serial: 'A',
  is_default: true,
};

const item = (sort_order: number, product = 'Ring') => ({
  serial: 'A',
  loan_no: 1,
  product,
  quality: null,
  extra: null,
  quantity: 1,
  gross_weight: 2.5,
  net_weight: 2.25,
  ignore_weight: 0.25,
  sort_order,
});

const count = (table: string) =>
  (
    dbHolder.current?.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as {
      n: number;
    }
  ).n;

describe('restoreFromSupabase', () => {
  beforeEach(() => {
    dbHolder.current = new Database(':memory:');
    migrateSchema();
  });

  afterEach(() => {
    dbHolder.current?.close();
    dbHolder.current = null;
  });

  it('restores every page of every table and verifies the result', async () => {
    const bills = Array.from({ length: 1200 }, (_, i) =>
      bill(i + 1, { released: false })
    );
    const progress = vi.fn();

    const report = await restoreFromSupabase(
      fakeSupabase(
        {
          companies: [company],
          bills,
          bill_items: [item(1), item(2, 'Chain')],
        },
        500
      ),
      ['companies', 'bills', 'bill_items'],
      progress
    );

    expect(report).toMatchObject({ rowsRestored: 1203, inSync: true });
    expect(count('bills')).toBe(1200);
    expect(count('bill_items')).toBe(2);
    expect(
      dbHolder.current?.prepare('SELECT * FROM companies').get()
    ).toMatchObject({ is_default: 1, synced: 1, deleted: null });
    expect(
      dbHolder.current
        ?.prepare(
          'SELECT COUNT(*) AS n FROM bills WHERE synced = 1 AND deleted IS NULL'
        )
        .get()
    ).toEqual({ n: 1200 });
    expect(
      progress.mock.calls.map(([p]) => (p as { step: string }).step)
    ).toEqual(['check', 'download', 'download', 'download', 'write', 'verify']);
  });

  it('ignores extra columns Supabase has', async () => {
    const report = await restoreFromSupabase(
      fakeSupabase({
        bills: [bill(1, { created_at: '2026-01-01T00:00:00Z' })],
      }),
      ['bills'],
      vi.fn()
    );
    expect(report.inSync).toBe(true);
    expect(count('bills')).toBe(1);
  });

  it('refuses to run when the local database already has rows', async () => {
    dbHolder.current
      ?.prepare("INSERT INTO areas (name, synced) VALUES ('Town', 1)")
      .run();

    await expect(
      restoreFromSupabase(
        fakeSupabase({ bills: [bill(1)] }),
        ['areas', 'bills'],
        vi.fn()
      )
    ).rejects.toThrow('These tables already have rows: areas');
    expect(count('bills')).toBe(0);
  });

  it('writes nothing when Supabase is missing a column', async () => {
    const { sort_order: _, ...withoutSortOrder } = item(1);

    await expect(
      restoreFromSupabase(
        fakeSupabase({ companies: [company], bill_items: [withoutSortOrder] }),
        ['companies', 'bill_items'],
        vi.fn()
      )
    ).rejects.toThrow('Supabase table bill_items has no sort_order column(s)');
    expect(count('companies')).toBe(0);
  });

  it('rolls back every table when a write fails part way', async () => {
    await expect(
      restoreFromSupabase(
        // The last bill breaks the local CHECK on metal_type.
        fakeSupabase({
          companies: [company],
          bills: [bill(1), bill(2), bill(3, { metal_type: 'Platinum' })],
        }),
        ['companies', 'bills'],
        vi.fn()
      )
    ).rejects.toThrow(/CHECK constraint failed/);
    expect(count('companies')).toBe(0);
    expect(count('bills')).toBe(0);
  });

  it('writes nothing if data is entered while downloading', async () => {
    const enterDataMidway = vi.fn((progress: { step: string }) => {
      if (progress.step === 'download') {
        dbHolder.current
          ?.prepare(
            "INSERT OR IGNORE INTO areas (name, synced) VALUES ('Town', 0)"
          )
          .run();
      }
    });

    await expect(
      restoreFromSupabase(
        fakeSupabase({ companies: [company] }),
        ['areas', 'companies'],
        enterDataMidway
      )
    ).rejects.toThrow('These tables already have rows: areas');
    expect(count('companies')).toBe(0);
  });
});
