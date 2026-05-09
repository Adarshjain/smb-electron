// @vitest-environment node

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
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

import { dedupeDailyEntriesSortOrder } from './dedup';
import { createDailyEntries } from './localDB';

// Production schema WITHOUT the partial unique index — this matches the
// current production state, where existing duplicates are sitting in the table.
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
`;

interface Row {
  rowid: number;
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

const liveRows = (where = '1 = 1', params: unknown[] = []): Row[] =>
  dbHolder
    .current!.prepare(
      `SELECT rowid, * FROM daily_entries
       WHERE deleted IS NULL AND ${where}
       ORDER BY date, company, sort_order, main_code`
    )
    .all(...params) as Row[];

const allRows = (where = '1 = 1', params: unknown[] = []): Row[] =>
  dbHolder
    .current!.prepare(
      `SELECT rowid, * FROM daily_entries
       WHERE ${where}
       ORDER BY date, company, sort_order, main_code`
    )
    .all(...params) as Row[];

// Insert a logical entry as a colliding duplicate at a chosen sort_order
// (bypasses createDailyEntries — that's the point of these test fixtures).
const seedPair = (
  date: string,
  company: string,
  main_code: number,
  sub_code: number,
  sort_order: number,
  credit: number,
  debit: number,
  description: string | null = null
) => {
  const stmt = dbHolder.current!.prepare(
    `INSERT INTO daily_entries
     (date, company, main_code, sub_code, sort_order, credit, debit, description, synced, deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`
  );
  stmt.run(date, company, main_code, sub_code, sort_order, credit, debit, description);
  stmt.run(date, company, sub_code, main_code, sort_order, debit, credit, description);
};

beforeEach(() => {
  dbHolder.current = new Database(':memory:');
  dbHolder.current.exec(SCHEMA);
});

afterEach(() => {
  dbHolder.current?.close();
  dbHolder.current = null;
});

describe('dedupeDailyEntriesSortOrder — happy path', () => {
  it('is a no-op on an empty table', () => {
    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r).toMatchObject({
      duplicateGroups: 0,
      pairsMoved: 0,
      rowsAffected: 0,
      orphans: [],
    });
    expect(allRows()).toHaveLength(0);
  });

  it('is a no-op on a clean table with no duplicates', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'first');
    seedPair('2026-05-09', 'A', 14, 2, 2, 200, 0, 'second');

    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r.duplicateGroups).toBe(0);
    expect(r.pairsMoved).toBe(0);
    expect(allRows()).toHaveLength(4);
  });

  it('splits a 2-pair duplicate group: keeps one, moves the other (UPDATE in place)', () => {
    // Two distinct logical entries, both stuck at sort_order=1
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'cash-loan-100');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'cash-loan-200');

    const beforeAll = allRows().length;
    expect(beforeAll).toBe(4);

    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r.duplicateGroups).toBe(1);
    expect(r.pairsKept).toBe(1);
    expect(r.pairsMoved).toBe(1);
    expect(r.orphans).toEqual([]);
    expect(r.rowsAffected).toBe(2);

    // Total row count is unchanged — pure UPDATE
    expect(allRows()).toHaveLength(beforeAll);

    // No tombstones created
    expect(allRows('deleted = 1')).toHaveLength(0);

    // sort_orders now distributed: one pair at 1, one pair at 2
    const live = liveRows();
    expect(live).toHaveLength(4);
    const orders = [...new Set(live.map((r) => r.sort_order))].sort();
    expect(orders).toEqual([1, 2]);

    // Each sort_order has exactly 1 pair (2 rows)
    for (const order of orders) {
      expect(live.filter((r) => r.sort_order === order)).toHaveLength(2);
    }
  });

  it('handles a 3-pair duplicate group: keeps one, moves two', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');
    seedPair('2026-05-09', 'A', 14, 3, 1, 300, 0, 'p3');

    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r.pairsMoved).toBe(2);

    const live = liveRows();
    expect(live).toHaveLength(6); // 3 pairs × 2 rows
    expect([...new Set(live.map((r) => r.sort_order))].sort()).toEqual([1, 2, 3]);
  });

  it('does not lose any data — total live rows after = 2 × valid pairs', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');
    seedPair('2026-05-09', 'A', 14, 3, 1, 300, 0, 'p3');
    seedPair('2026-05-09', 'A', 14, 4, 1, 400, 0, 'p4');

    const beforeLive = liveRows().length;
    expect(beforeLive).toBe(8);

    dedupeDailyEntriesSortOrder({ dryRun: false });

    const afterLive = liveRows().length;
    expect(afterLive).toBe(beforeLive);
  });
});

describe('dedupeDailyEntriesSortOrder — per-(date, company) scoping', () => {
  it('handles multiple duplicate groups in the same day independently', () => {
    seedPair('2026-05-09', 'A', 14, 1, 5, 100, 0, 'g1-p1');
    seedPair('2026-05-09', 'A', 14, 2, 5, 200, 0, 'g1-p2');
    seedPair('2026-05-09', 'A', 14, 3, 7, 300, 0, 'g2-p1');
    seedPair('2026-05-09', 'A', 14, 4, 7, 400, 0, 'g2-p2');

    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r.duplicateGroups).toBe(2);
    expect(r.pairsMoved).toBe(2);

    const live = liveRows();
    expect(live).toHaveLength(8);
    // Existing slots 5, 7 + two new slots above MAX (was 7) → 8, 9
    const orders = [...new Set(live.map((r) => r.sort_order))].sort(
      (a, b) => a - b
    );
    expect(orders).toEqual([5, 7, 8, 9]);
  });

  it('handles a duplicate sort_order that spans multiple (date, company) buckets', () => {
    // The classic race: two saves on different dates both got the same global
    // MAX and both wrote their pair at sort_order=1. We end up with 6 rows at
    // sort_order=1 (one pair per bucket) and need 2 of them moved.
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'day-A');
    seedPair('2026-05-10', 'A', 14, 2, 1, 200, 0, 'day-B');
    seedPair('2026-05-09', 'B', 14, 3, 1, 300, 0, 'co-B');

    expect(liveRows()).toHaveLength(6);
    expect(
      liveRows().every((r) => r.sort_order === 1)
    ).toBe(true);

    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r.duplicateGroups).toBe(1);
    expect(r.pairsKept).toBe(1);
    expect(r.pairsMoved).toBe(2);
    expect(r.orphans).toEqual([]);

    // Globally unique sort_orders 1, 2, 3 — exactly one pair per slot
    const live = liveRows();
    expect(live).toHaveLength(6);
    const orders = [...new Set(live.map((r) => r.sort_order))].sort(
      (a, b) => a - b
    );
    expect(orders).toEqual([1, 2, 3]);
    for (const order of orders) {
      expect(live.filter((r) => r.sort_order === order)).toHaveLength(2);
    }
  });

  it('moved pairs stay within their original (date, company)', () => {
    // The same race pattern — verify the moved pair keeps its date/company
    // identity, only sort_order changes.
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'stays');
    seedPair('2026-05-10', 'B', 99, 1, 1, 200, 0, 'moves');

    dedupeDailyEntriesSortOrder({ dryRun: false });

    // Whichever pair moved, both its rows kept their (date, company)
    const movedRows = liveRows('sort_order = 2');
    expect(movedRows).toHaveLength(2);
    const movedKey = `${movedRows[0].date}|${movedRows[0].company}`;
    expect(movedRows.every((r) => `${r.date}|${r.company}` === movedKey)).toBe(
      true
    );
  });
});

describe('dedupeDailyEntriesSortOrder — orphan handling', () => {
  it('reports rows with no matching partner without touching them', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'good');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'good-dup');
    // Inject an unmatched row (no inverted partner)
    dbHolder.current!.prepare(
      `INSERT INTO daily_entries
       (date, company, main_code, sub_code, sort_order, credit, debit, description, synced, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`
    ).run('2026-05-09', 'A', 14, 99, 1, 999, 0, 'orphan');

    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r.orphans).toHaveLength(1);
    expect(r.orphans[0]).toMatchObject({
      date: '2026-05-09',
      company: 'A',
      sort_order: 1,
      main_code: 14,
      sub_code: 99,
      description: 'orphan',
    });

    // Orphan still present and untouched
    const orphanRow = liveRows('main_code = ? AND sub_code = ?', [14, 99]);
    expect(orphanRow).toHaveLength(1);
    expect(orphanRow[0].sort_order).toBe(1);
  });

  it('does not match rows whose credit/debit do not invert correctly', () => {
    // Row A: credit=100, debit=0
    // Row B: credit=0, debit=99 — should NOT pair with A (off-by-one amount)
    dbHolder.current!.prepare(
      `INSERT INTO daily_entries (date, company, main_code, sub_code, sort_order, credit, debit, description, synced, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`
    ).run('2026-05-09', 'A', 14, 1, 1, 100, 0, 'broken');
    dbHolder.current!.prepare(
      `INSERT INTO daily_entries (date, company, main_code, sub_code, sort_order, credit, debit, description, synced, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`
    ).run('2026-05-09', 'A', 1, 14, 1, 0, 99, 'broken');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'good');

    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r.orphans).toHaveLength(2);
    expect(r.pairsMoved).toBe(0); // only one valid pair → nothing to move
  });
});

describe('dedupeDailyEntriesSortOrder — dryRun', () => {
  it('reports moves without writing anything when dryRun is true', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');
    seedPair('2026-05-09', 'A', 14, 3, 1, 300, 0, 'p3');

    const before = allRows().map((r) => ({ ...r }));
    const r = dedupeDailyEntriesSortOrder({ dryRun: true });

    expect(r.dryRun).toBe(true);
    expect(r.duplicateGroups).toBe(1);
    expect(r.pairsMoved).toBe(2);
    expect(r.movedAssignments).toHaveLength(2);

    // Database is unchanged
    const after = allRows();
    expect(after).toEqual(before);
  });

  it('defaults to dryRun=true when no options are passed', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');

    const before = allRows().length;
    const r = dedupeDailyEntriesSortOrder();
    expect(r.dryRun).toBe(true);
    expect(allRows()).toHaveLength(before);
  });
});

describe('dedupeDailyEntriesSortOrder — leaves deleted/synced alone', () => {
  it('does not modify the synced column on moved rows', () => {
    // seedPair inserts with synced=1
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');

    dedupeDailyEntriesSortOrder({ dryRun: false });

    // All rows (kept + moved) keep synced=1 — the caller handles sync themselves
    const everything = allRows();
    expect(everything.every((r) => r.synced === 1)).toBe(true);
  });

  it('does not create tombstones (deleted column untouched)', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');
    seedPair('2026-05-09', 'A', 14, 3, 1, 300, 0, 'p3');

    dedupeDailyEntriesSortOrder({ dryRun: false });

    expect(allRows('deleted = 1')).toHaveLength(0);
    expect(allRows()).toHaveLength(6); // 3 pairs × 2 — exactly what was seeded
  });

  it('skips already-tombstoned rows when looking for duplicates', () => {
    // Seed a clean pair, then a tombstone copy at the same sort_order. The
    // tombstone is invisible to the dedupe — no duplicate group should be
    // detected.
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'live');
    dbHolder
      .current!.prepare(
        `INSERT INTO daily_entries
       (date, company, main_code, sub_code, sort_order, credit, debit, description, synced, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 1)`
      )
      .run('2026-05-09', 'A', 14, 1, 1, 100, 0, 'tombstone-copy');

    const r = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r.duplicateGroups).toBe(0);
    expect(r.pairsMoved).toBe(0);
  });
});

describe('dedupeDailyEntriesSortOrder — idempotency', () => {
  it('a second run is a no-op', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');
    seedPair('2026-05-09', 'A', 14, 3, 1, 300, 0, 'p3');

    const r1 = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r1.pairsMoved).toBe(2);

    const r2 = dedupeDailyEntriesSortOrder({ dryRun: false });
    expect(r2.duplicateGroups).toBe(0);
    expect(r2.pairsMoved).toBe(0);
    expect(r2.orphans).toEqual([]);
  });

  it('the post-dedupe state is compatible with the production createDailyEntries helper', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');

    dedupeDailyEntriesSortOrder({ dryRun: false });

    // Now simulate the user adding a fresh entry — should land at MAX+1
    createDailyEntries('2026-05-09', 'A', [
      { main_code: 14, sub_code: 99, credit: 999, debit: 0, description: 'new' },
    ]);

    const live = liveRows();
    const orders = [...new Set(live.map((r) => r.sort_order))].sort();
    expect(orders).toEqual([1, 2, 3]);
  });
});

describe('dedupeDailyEntriesSortOrder — partial unique index', () => {
  it('creates the live-rows unique index after a clean run', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');

    const r = dedupeDailyEntriesSortOrder({
      dryRun: false,
      addUniqueIndex: true,
    });
    expect(r.uniqueIndexCreated).toBe(true);
    expect(r.uniqueIndexSkippedReason).toBeUndefined();

    const indexes = dbHolder.current!.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`
    ).all('daily_entries_live_unique');
    expect(indexes).toHaveLength(1);
  });

  it('skips index creation when orphans remain', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');
    dbHolder.current!.prepare(
      `INSERT INTO daily_entries (date, company, main_code, sub_code, sort_order, credit, debit, description, synced, deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NULL)`
    ).run('2026-05-09', 'A', 14, 99, 1, 999, 0, 'orphan');

    const r = dedupeDailyEntriesSortOrder({
      dryRun: false,
      addUniqueIndex: true,
    });
    expect(r.uniqueIndexCreated).toBe(false);
    expect(r.uniqueIndexSkippedReason).toMatch(/orphan/);
  });

  it('skips index creation in dryRun mode', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');

    const r = dedupeDailyEntriesSortOrder({
      dryRun: true,
      addUniqueIndex: true,
    });
    expect(r.uniqueIndexCreated).toBe(false);
    expect(r.uniqueIndexSkippedReason).toMatch(/dryRun/);
  });

  it('once index is in place, future bypass writes are rejected', () => {
    seedPair('2026-05-09', 'A', 14, 1, 1, 100, 0, 'p1');
    seedPair('2026-05-09', 'A', 14, 2, 1, 200, 0, 'p2');
    dedupeDailyEntriesSortOrder({ dryRun: false, addUniqueIndex: true });

    // Now anyone bypassing createDailyEntries would be caught
    expect(() =>
      dbHolder.current!.prepare(
        `INSERT INTO daily_entries (date, company, main_code, sub_code, sort_order, credit, debit, description, synced, deleted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL)`
      ).run('2026-05-09', 'A', 14, 1, 1, 50, 0, 'bypass-attempt')
    ).toThrow(/UNIQUE constraint failed/);
  });
});

// Atomicity is provided by db.transaction() and is exhaustively covered for
// the same pattern in localDB.test.ts. Re-engineering a forced failure inside
// dedupeDailyEntriesSortOrder is not feasible without contorting the test
// schema — allocOrder always picks above MAX(sort_order), so no static blocker
// can collide with it, and NOT NULL fields can't be seeded as NULL.
