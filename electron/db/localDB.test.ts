// @vitest-environment node

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';
import Database from 'better-sqlite3';

const dbHolder = vi.hoisted(() => ({
  current: null as Database.Database | null,
}));

vi.mock('./database', () => ({
  get db() {
    return dbHolder.current;
  },
}));

vi.mock('../../tableSchema', () => ({
  TablesSQliteSchema: {},
}));

import { createDailyEntries, type DailyEntryPair } from './localDB';

const SCHEMA = `
  CREATE TABLE daily_entries (
    debit REAL NOT NULL,
    credit REAL NOT NULL,
    main_code REAL NOT NULL,
    sub_code REAL NOT NULL,
    sort_order REAL NOT NULL,
    description TEXT,
    company TEXT NOT NULL,
    date TEXT NOT NULL,
    synced BOOLEAN NOT NULL DEFAULT 0,
    deleted BOOLEAN,
    PRIMARY KEY (date, company, main_code, sub_code, sort_order, deleted)
  );
  -- Defense-in-depth: SQLite treats NULL in PK columns as distinct, so the
  -- 'deleted' column inside the PK does not enforce uniqueness for live rows.
  -- A partial unique index on the live-row subset is what actually prevents
  -- duplicates if anything bypasses createDailyEntries. sort_order is globally
  -- unique per pair; (main_code, sub_code) suffix differentiates main from
  -- inverted within a pair.
  CREATE UNIQUE INDEX daily_entries_live_unique
  ON daily_entries (sort_order, main_code, sub_code)
  WHERE deleted IS NULL;
`;

interface Row {
  date: string;
  company: string;
  main_code: number;
  sub_code: number;
  sort_order: number;
  credit: number;
  debit: number;
  description: string | null;
  synced: number;
  deleted: number | null;
}

const allRows = (where = '1 = 1', params: unknown[] = []): Row[] => {
  return dbHolder
    .current!.prepare(
      `SELECT * FROM daily_entries WHERE ${where} ORDER BY sort_order, main_code`
    )
    .all(...params) as Row[];
};

const PAIR = (overrides: Partial<DailyEntryPair> = {}): DailyEntryPair => ({
  main_code: 14,
  sub_code: 1,
  credit: 100,
  debit: 0,
  description: 'test',
  ...overrides,
});

beforeEach(() => {
  dbHolder.current = new Database(':memory:');
  dbHolder.current.exec(SCHEMA);
});

afterEach(() => {
  dbHolder.current?.close();
  dbHolder.current = null;
});

describe('createDailyEntries', () => {
  it('starts sort_order at 1 when (date, company) is empty', () => {
    createDailyEntries('2026-05-09', 'CompanyA', [PAIR()]);

    const rows = allRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.sort_order === 1)).toBe(true);
  });

  it('inserts a main + inverted pair sharing one sort_order, with codes and amounts swapped', () => {
    createDailyEntries('2026-05-09', 'CompanyA', [
      PAIR({ main_code: 14, sub_code: 1, credit: 100, debit: 0 }),
    ]);

    const rows = allRows();
    expect(rows).toHaveLength(2);
    const main = rows.find((r) => r.main_code === 14)!;
    const inverted = rows.find((r) => r.main_code === 1)!;
    expect(main).toMatchObject({
      main_code: 14,
      sub_code: 1,
      credit: 100,
      debit: 0,
      sort_order: 1,
    });
    expect(inverted).toMatchObject({
      main_code: 1,
      sub_code: 14,
      credit: 0,
      debit: 100,
      sort_order: 1,
    });
  });

  it('assigns sequential sort_orders to multiple pairs in one call', () => {
    createDailyEntries('2026-05-09', 'CompanyA', [
      PAIR({ sub_code: 1 }),
      PAIR({ sub_code: 2 }),
      PAIR({ sub_code: 3 }),
    ]);

    const orders = [...new Set(allRows().map((r) => r.sort_order))].sort();
    expect(orders).toEqual([1, 2, 3]);
    expect(allRows()).toHaveLength(6); // 3 pairs × 2 rows each
  });

  it('continues the sequence across multiple calls — no duplicates', () => {
    createDailyEntries('2026-05-09', 'CompanyA', [PAIR({ sub_code: 1 })]);
    createDailyEntries('2026-05-09', 'CompanyA', [PAIR({ sub_code: 2 })]);
    createDailyEntries('2026-05-09', 'CompanyA', [PAIR({ sub_code: 3 })]);

    const orders = [...new Set(allRows().map((r) => r.sort_order))].sort();
    expect(orders).toEqual([1, 2, 3]);
  });

  it('sort_order is globally unique across all (date, company) combinations', () => {
    createDailyEntries('2026-05-09', 'CompanyA', [
      PAIR({ sub_code: 1 }),
      PAIR({ sub_code: 2 }),
    ]);
    createDailyEntries('2026-05-10', 'CompanyA', [PAIR({ sub_code: 1 })]);
    createDailyEntries('2026-05-09', 'CompanyB', [PAIR({ sub_code: 1 })]);

    // 4 logical entries × 2 rows each = 8 rows, sort_orders 1..4 globally
    const all = allRows();
    expect(all).toHaveLength(8);
    const orders = [...new Set(all.map((r) => r.sort_order))].sort();
    expect(orders).toEqual([1, 2, 3, 4]);
  });

  it('skips past tombstoned sort_orders so they cannot be reused', () => {
    // First insert occupies sort_order=1 globally
    createDailyEntries('2026-05-09', 'CompanyA', [PAIR({ description: 'v1' })]);
    expect(allRows()).toHaveLength(2);

    // Soft-delete those rows (sync path: set deleted=1, synced=0)
    dbHolder.current!.exec(
      `UPDATE daily_entries SET deleted = 1, synced = 0 WHERE sort_order = 1`
    );

    // Global MAX is still 1 (includes tombstones) — next insert goes to 2
    createDailyEntries('2026-05-09', 'CompanyA', [PAIR({ description: 'v2' })]);

    const live = allRows('deleted IS NULL');
    expect(live).toHaveLength(2);
    expect(live.every((r) => r.sort_order === 2)).toBe(true);
    expect(live.every((r) => r.description === 'v2')).toBe(true);

    // Tombstones still occupy their slot
    const tombstones = allRows('deleted = 1');
    expect(tombstones).toHaveLength(2);
    expect(tombstones.every((r) => r.sort_order === 1)).toBe(true);
  });

  it('is a no-op for an empty pairs array', () => {
    createDailyEntries('2026-05-09', 'CompanyA', []);
    expect(allRows()).toHaveLength(0);
  });

  it('preserves null description', () => {
    createDailyEntries('2026-05-09', 'CompanyA', [PAIR({ description: null })]);
    expect(allRows().every((r) => r.description === null)).toBe(true);
  });

  it('rolls back the entire batch if any insert throws (atomicity)', () => {
    // Seed a successful first pair so we can verify rollback affects the
    // *whole* helper call, not just the failing pair.
    createDailyEntries('2026-05-09', 'CompanyA', [
      PAIR({ main_code: 14, sub_code: 1, credit: 100, debit: 0 }),
    ]);
    expect(allRows()).toHaveLength(2);

    // Now invoke with a pair where main_code === sub_code: the helper will
    // try to insert (14, 14, sort_order=N) twice — main and inverted are the
    // same PK — which violates the live-rows unique index. Even though pair
    // 0 succeeds momentarily, transaction rollback should leave only the
    // original two rows.
    expect(() =>
      createDailyEntries('2026-05-09', 'CompanyA', [
        PAIR({ main_code: 99, sub_code: 100 }),
        PAIR({ main_code: 14, sub_code: 14 }),
      ])
    ).toThrow(/UNIQUE constraint failed/);

    // No rows from the failed helper call should remain.
    const rows = allRows();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => [14, 1].includes(r.main_code))).toBe(true);
  });

  it('serializes concurrent calls — N calls produce N distinct sort_order ranges', () => {
    // Better-sqlite3 transactions are synchronous and serialize within a process,
    // so even when callers do not await between calls, sort_orders never repeat.
    for (let i = 0; i < 50; i++) {
      createDailyEntries('2026-05-09', 'CompanyA', [
        PAIR({ sub_code: 100 + i, description: `entry-${i}` }),
      ]);
    }

    const liveRows = allRows('deleted IS NULL');
    expect(liveRows).toHaveLength(100); // 50 pairs × 2

    const sortOrders = liveRows.map((r) => r.sort_order);
    const uniqueOrders = new Set(sortOrders);
    expect(uniqueOrders.size).toBe(50);
    expect([...uniqueOrders].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, i) => i + 1)
    );
  });

  it('returns null and inserts nothing when db is uninitialized', () => {
    dbHolder.current?.close();
    dbHolder.current = null;

    expect(createDailyEntries('2026-05-09', 'CompanyA', [PAIR()])).toBeNull();
  });
});

describe('createDailyEntries — negative cases', () => {
  it('rolls back when a NOT NULL field is undefined at runtime', () => {
    // Simulate a bug upstream that lets undefined slip past TypeScript.
    const bad = PAIR();
    (bad as { credit: unknown }).credit = undefined;

    expect(() =>
      createDailyEntries('2026-05-09', 'CompanyA', [PAIR(), bad])
    ).toThrow();

    // The first (valid) pair's writes were rolled back along with the bad one.
    expect(allRows()).toHaveLength(0);
  });

  it('rejects a pair where main_code === sub_code (self-loop violates unique index)', () => {
    expect(() =>
      createDailyEntries('2026-05-09', 'CompanyA', [
        PAIR({ main_code: 14, sub_code: 14 }),
      ])
    ).toThrow(/UNIQUE constraint failed/);
    expect(allRows()).toHaveLength(0);
  });

  it('reproduces the original race on bypass paths and the partial unique index catches it', () => {
    // This test simulates the OLD-bug behavior: a code path that computes
    // MAX outside a transaction and then INSERTs directly. Proves the partial
    // unique index is what stops a duplicate from being persisted, even when
    // a future contributor accidentally bypasses createDailyEntries.
    createDailyEntries('2026-05-09', 'CompanyA', [PAIR({ sub_code: 1 })]);

    const max = (
      dbHolder
        .current!.prepare(
          `SELECT COALESCE(MAX(sort_order), 0) AS m
           FROM daily_entries
           WHERE date = ? AND company = ? AND deleted IS NULL`
        )
        .get('2026-05-09', 'CompanyA') as { m: number }
    ).m;

    // Two would-be racers both compute next = max + 1 = 2.
    const insert = dbHolder.current!.prepare(
      `INSERT INTO daily_entries
       (debit, credit, main_code, sub_code, sort_order, description, company, date, synced, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`
    );
    insert.run(0, 50, 14, 2, max + 1, 'racer A', 'CompanyA', '2026-05-09');

    expect(() =>
      insert.run(0, 75, 14, 2, max + 1, 'racer B', 'CompanyA', '2026-05-09')
    ).toThrow(/UNIQUE constraint failed/);
  });

  it('does not deduplicate two pairs that have identical content — they get distinct sort_orders', () => {
    const dup = PAIR({ main_code: 14, sub_code: 1, credit: 100, debit: 0 });
    createDailyEntries('2026-05-09', 'CompanyA', [dup, dup]);

    const rows = allRows();
    expect(rows).toHaveLength(4); // 2 pairs × 2 rows
    const orders = rows.map((r) => r.sort_order);
    expect(new Set(orders).size).toBe(2); // sort_orders 1 and 2
  });

  it('skips past tombstone sort_orders when allocating new ones', () => {
    // Manually seed only tombstoned rows at sort_orders 5 and 6.
    const insert = dbHolder.current!.prepare(
      `INSERT INTO daily_entries
       (debit, credit, main_code, sub_code, sort_order, description, company, date, synced, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`
    );
    insert.run(0, 100, 14, 1, 5, 'tombstone', 'CompanyA', '2026-05-09');
    insert.run(100, 0, 1, 14, 5, 'tombstone', 'CompanyA', '2026-05-09');
    insert.run(0, 200, 14, 2, 6, 'tombstone', 'CompanyA', '2026-05-09');
    insert.run(200, 0, 2, 14, 6, 'tombstone', 'CompanyA', '2026-05-09');

    createDailyEntries('2026-05-09', 'CompanyA', [
      PAIR({ description: 'new' }),
    ]);

    // Global MAX includes tombstones (max=6) → next is 7
    const live = allRows('deleted IS NULL');
    expect(live).toHaveLength(2);
    expect(live.every((r) => r.sort_order === 7)).toBe(true);
  });

  it('handles a large batch (1000 pairs) without duplicates', () => {
    const pairs: DailyEntryPair[] = Array.from({ length: 1000 }, (_, i) =>
      PAIR({ sub_code: 100 + i, description: `bulk-${i}` })
    );
    createDailyEntries('2026-05-09', 'CompanyA', pairs);

    const rows = allRows();
    expect(rows).toHaveLength(2000);
    const sortOrders = new Set(rows.map((r) => r.sort_order));
    expect(sortOrders.size).toBe(1000);
    expect([...sortOrders].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 1000 }, (_, i) => i + 1)
    );
  });

  it('rolls back when a sort_order computed by the helper would collide with a row inserted by a bypass path', () => {
    // A bypass path inserted a live row at sort_order=2 (e.g., a legacy
    // import). The helper sees MAX(live)=2, computes next=3 — fine. But
    // imagine the bypass path also inserted at sort_order=4. Helper picks 3,
    // pair 2 lands at 4 — collides with bypass row, transaction rolls back.
    const insert = dbHolder.current!.prepare(
      `INSERT INTO daily_entries
       (debit, credit, main_code, sub_code, sort_order, description, company, date, synced, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`
    );
    insert.run(0, 50, 14, 99, 2, 'bypass-low', 'CompanyA', '2026-05-09');
    insert.run(50, 0, 99, 14, 2, 'bypass-low', 'CompanyA', '2026-05-09');
    insert.run(0, 75, 14, 100, 4, 'bypass-high', 'CompanyA', '2026-05-09');
    insert.run(75, 0, 100, 14, 4, 'bypass-high', 'CompanyA', '2026-05-09');

    expect(() =>
      createDailyEntries('2026-05-09', 'CompanyA', [
        PAIR({ sub_code: 1 }), // would land at sort_order=5 (MAX=4)
        PAIR({ sub_code: 2 }), // sort_order=6
      ])
    ).not.toThrow();

    // Both pairs land cleanly above MAX=4
    const helperRows = allRows('description LIKE ?', ['test']);
    const helperOrders = [
      ...new Set(helperRows.map((r) => r.sort_order)),
    ].sort();
    expect(helperOrders).toEqual([5, 6]);
  });
});

// Silence unused-import warning when keeping Mock available for future expansion
void ({} as Mock);
