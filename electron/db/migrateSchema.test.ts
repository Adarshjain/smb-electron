// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';

const dbHolder = vi.hoisted(() => ({
  current: null as Database.Database | null,
}));

vi.mock('./database', () => ({
  get db() {
    return dbHolder.current;
  },
}));

import { create, migrateSchema } from './localDB';

const db = () => dbHolder.current!;

// releases as the shop database has it, from before the live-key index.
const OLD_RELEASES = `
  CREATE TABLE releases (
    serial TEXT NOT NULL, loan_no INTEGER NOT NULL, date TEXT NOT NULL,
    loan_date TEXT NOT NULL, interest_amount REAL NOT NULL,
    tax_interest_amount REAL NOT NULL, loan_amount REAL NOT NULL,
    total_amount REAL NOT NULL, company TEXT,
    synced BOOLEAN NOT NULL DEFAULT 0, deleted BOOLEAN,
    UNIQUE(serial, loan_no, deleted)
  )`;

const release = (loan_amount = 2070) => ({
  serial: 'F',
  loan_no: 1871,
  date: '2026-09-05',
  loan_date: '2026-08-01',
  interest_amount: 10,
  tax_interest_amount: 10,
  loan_amount,
  total_amount: loan_amount + 10,
  company: 'SMB',
});

const insertRelease = (r: ReturnType<typeof release>, synced = 1) =>
  db()
    .prepare(
      `INSERT INTO releases (serial, loan_no, date, loan_date, interest_amount,
         tax_interest_amount, loan_amount, total_amount, company, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(...Object.values(r), synced);

const indexNames = () =>
  (
    db()
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'index'`)
      .all() as { name: string }[]
  ).map((r) => r.name);

beforeEach(() => {
  dbHolder.current = new Database(':memory:');
});

afterEach(() => {
  dbHolder.current?.close();
  dbHolder.current = null;
});

describe('migrateSchema live-key indexes', () => {
  it('stops a second live copy of a record on a fresh database', () => {
    migrateSchema();
    create('releases', release() as never);
    create('releases', release(3000) as never);
    expect(db().prepare(`SELECT loan_amount FROM releases`).all()).toEqual([
      { loan_amount: 3000 },
    ]);
    expect(indexNames()).toContain('daily_entries_live_unique');
  });

  it('still allows a tombstone next to a live row with the same key', () => {
    migrateSchema();
    create('releases', release() as never);
    db().exec(`UPDATE releases SET deleted = 1`);
    create('releases', release() as never);
    expect(
      db().prepare(`SELECT deleted FROM releases ORDER BY rowid`).all()
    ).toEqual([{ deleted: 1 }, { deleted: null }]);
  });

  it('removes exact duplicates and queues the kept copy for upload', () => {
    db().exec(OLD_RELEASES);
    insertRelease(release());
    insertRelease(release());
    migrateSchema();
    expect(db().prepare(`SELECT rowid, synced FROM releases`).all()).toEqual([
      { rowid: 1, synced: 0 },
    ]);
    expect(indexNames()).toContain('releases_live_key');
  });

  it('leaves copies that differ alone and skips the index for that table', () => {
    db().exec(OLD_RELEASES);
    insertRelease(release());
    insertRelease(release(3000));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    migrateSchema();
    expect(db().prepare(`SELECT COUNT(*) AS n FROM releases`).get()).toEqual({
      n: 2,
    });
    expect(indexNames()).not.toContain('releases_live_key');
    expect(indexNames()).toContain('bills_live_key');
  });
});
