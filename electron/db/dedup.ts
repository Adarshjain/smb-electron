import { db } from './database';

export interface DedupeOptions {
  // When true (default), reports what would change without writing.
  dryRun?: boolean;
  // When true (default false) and no orphans remain, creates the partial unique
  // index that prevents duplicates from ever being persisted again.
  addUniqueIndex?: boolean;
}

export interface DedupeReport {
  dryRun: boolean;
  duplicateGroups: number;
  pairsKept: number;
  pairsMoved: number;
  rowsAffected: number;
  orphans: {
    date: string;
    company: string;
    sort_order: number;
    main_code: number;
    sub_code: number;
    description: string | null;
  }[];
  movedAssignments: {
    date: string;
    company: string;
    fromSortOrder: number;
    toSortOrder: number;
    description: string | null;
    main_code: number;
    sub_code: number;
  }[];
  uniqueIndexCreated: boolean;
  uniqueIndexSkippedReason?: string;
}

interface DbRow {
  rowid: number;
  date: string;
  company: string;
  sort_order: number;
  main_code: number;
  sub_code: number;
  credit: number;
  debit: number;
  description: string | null;
}

const findPair = (
  rows: DbRow[],
  a: DbRow,
  used: Set<number>
): DbRow | undefined =>
  rows.find(
    (b) =>
      !used.has(b.rowid) &&
      b.rowid !== a.rowid &&
      b.main_code === a.sub_code &&
      b.sub_code === a.main_code &&
      (b.description ?? null) === (a.description ?? null) &&
      b.credit === a.debit &&
      b.debit === a.credit
  );

// Repairs existing duplicates in daily_entries.sort_order. The contract is
// global: each sort_order should belong to exactly one logical entry =
// exactly 2 rows (main + inverted) anywhere in the table.
//
// Strategy: for every sort_order with > 2 live rows, bucket the rows by
// (date, company) — pairs always live within a single date+company since the
// race that creates these duplicates is one save per day. Inside each bucket,
// pair rows by the dual-entry contract (swapped main/sub, swapped credit/
// debit, matching description). Keep one pair at the original sort_order;
// every other pair gets a fresh, globally unique sort_order = MAX+1, MAX+2…
//
// Pure UPDATE — no inserts, no soft-deletes, no writes to deleted/synced.
// Row count is preserved exactly. The caller handles sync coordination.
//
// Unpaired rows are reported as orphans and left untouched.
//
// Whole operation runs in one transaction. dryRun=true (default) reports
// without writing.
export function dedupeDailyEntriesSortOrder(
  opts: DedupeOptions = {}
): DedupeReport {
  const localDb = db;
  if (!localDb) throw new Error('DB not initialized');

  const dryRun = opts.dryRun ?? true;
  const addUniqueIndex = opts.addUniqueIndex ?? false;

  const work = (): DedupeReport => {
    const groups = localDb
      .prepare(
        `SELECT sort_order
         FROM daily_entries
         WHERE deleted IS NULL
         GROUP BY sort_order
         HAVING COUNT(*) > 2
         ORDER BY sort_order`
      )
      .all() as { sort_order: number }[];

    const orphans: DedupeReport['orphans'] = [];
    const movedAssignments: DedupeReport['movedAssignments'] = [];
    let pairsKept = 0;
    let pairsMoved = 0;

    // Single global counter. We compute MAX across ALL rows (including
    // tombstones) once so the new sort_order can never collide with any
    // pre-existing PK in the table. Then we increment locally as we allocate.
    let nextOrder =
      (
        localDb
          .prepare(
            `SELECT COALESCE(MAX(sort_order), 0) AS m FROM daily_entries`
          )
          .get() as { m: number }
      ).m + 1;
    const allocOrder = (): number => {
      const v = nextOrder;
      nextOrder += 1;
      return v;
    };

    const updateOrder = localDb.prepare(
      `UPDATE daily_entries
       SET sort_order = ?
       WHERE rowid = ?`
    );

    for (const g of groups) {
      const rows = localDb
        .prepare(
          `SELECT rowid, date, company, sort_order, main_code, sub_code, credit, debit, description
           FROM daily_entries
           WHERE sort_order = ? AND deleted IS NULL
           ORDER BY date, company, rowid`
        )
        .all(g.sort_order) as DbRow[];

      // A pair always lives within one (date, company). Two saves on
      // different dates that raced both reading the same global MAX produce
      // a duplicate sort_order group spanning multiple (date, company)s.
      const buckets = new Map<string, DbRow[]>();
      for (const r of rows) {
        const key = `${r.date}|${r.company}`;
        const arr = buckets.get(key);
        if (arr) arr.push(r);
        else buckets.set(key, [r]);
      }

      const allPairs: [DbRow, DbRow][] = [];
      for (const bucketRows of buckets.values()) {
        const used = new Set<number>();
        for (const a of bucketRows) {
          if (used.has(a.rowid)) continue;
          const partner = findPair(bucketRows, a, used);
          if (partner) {
            allPairs.push([a, partner]);
            used.add(a.rowid);
            used.add(partner.rowid);
          }
        }
        for (const r of bucketRows) {
          if (!used.has(r.rowid)) {
            orphans.push({
              date: r.date,
              company: r.company,
              sort_order: r.sort_order,
              main_code: r.main_code,
              sub_code: r.sub_code,
              description: r.description,
            });
          }
        }
      }

      if (allPairs.length === 0) continue;

      // First pair stays at the original sort_order; rest get fresh globally
      // unique values.
      pairsKept += 1;
      for (let i = 1; i < allPairs.length; i++) {
        const [main, inverted] = allPairs[i];
        const newOrder = allocOrder();
        movedAssignments.push({
          date: main.date,
          company: main.company,
          fromSortOrder: g.sort_order,
          toSortOrder: newOrder,
          description: main.description,
          main_code: main.main_code,
          sub_code: main.sub_code,
        });
        pairsMoved++;

        if (!dryRun) {
          updateOrder.run(newOrder, main.rowid);
          updateOrder.run(newOrder, inverted.rowid);
        }
      }
    }

    let uniqueIndexCreated = false;
    let uniqueIndexSkippedReason: string | undefined;
    if (addUniqueIndex) {
      if (dryRun) {
        uniqueIndexSkippedReason = 'dryRun=true';
      } else if (orphans.length > 0) {
        uniqueIndexSkippedReason = `${orphans.length} orphan rows still present — fix manually first`;
      } else {
        const stillDup = localDb
          .prepare(
            `SELECT COUNT(*) AS c FROM (
               SELECT 1 FROM daily_entries
               WHERE deleted IS NULL
               GROUP BY sort_order
               HAVING COUNT(*) > 2
             )`
          )
          .get() as { c: number };
        if (stillDup.c > 0) {
          uniqueIndexSkippedReason = `${stillDup.c} duplicate groups still present after dedupe — investigate`;
        } else {
          // sort_order is globally unique per pair; the (main_code, sub_code)
          // suffix differentiates the main row from its inverted twin.
          localDb.exec(
            `CREATE UNIQUE INDEX IF NOT EXISTS daily_entries_live_unique
             ON daily_entries (sort_order, main_code, sub_code)
             WHERE deleted IS NULL`
          );
          uniqueIndexCreated = true;
        }
      }
    }

    return {
      dryRun,
      duplicateGroups: groups.length,
      pairsKept,
      pairsMoved,
      rowsAffected: pairsMoved * 2,
      orphans,
      movedAssignments,
      uniqueIndexCreated,
      uniqueIndexSkippedReason,
    };
  };

  return localDb.transaction(work)();
}
