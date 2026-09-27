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

import {
  deleteLoan,
  migrateSchema,
  releaseLoan,
  saveLoan,
  unreleaseLoan,
} from './localDB';

const all = (sql: string) => dbHolder.current!.prepare(sql).all();

const BILL = (loan_no: number, loan_amount = 1000) => ({
  serial: 'F',
  loan_no,
  date: '2026-09-01',
  customer_id: 'c1',
  loan_amount,
  interest_rate: 2,
  first_month_interest: 20,
  doc_charges: 5,
  metal_type: 'Gold' as const,
  company: 'SMB',
});
const ITEM = (product = 'Ring') => ({
  product,
  quality: null,
  extra: null,
  quantity: 1,
  gross_weight: 1,
  net_weight: 1,
  ignore_weight: 0,
});
const RELEASE = (loan_no: number) => ({
  serial: 'F',
  loan_no,
  date: '2026-09-02',
  loan_date: '2026-09-01',
  interest_amount: 10,
  tax_interest_amount: 10,
  loan_amount: 1000,
  total_amount: 1010,
  company: 'SMB',
});

beforeEach(() => {
  dbHolder.current = new Database(':memory:');
  migrateSchema();
});

afterEach(() => {
  dbHolder.current?.close();
  dbHolder.current = null;
});

describe('saveLoan', () => {
  it('saves a new loan with its items after the highest item sort_order', () => {
    saveLoan({ original: null, bill: BILL(1), items: [ITEM(), ITEM('Chain')] });
    saveLoan({ original: null, bill: BILL(2), items: [ITEM()] });
    expect(
      all(
        `SELECT loan_no, sort_order, product FROM bill_items ORDER BY sort_order`
      )
    ).toEqual([
      { loan_no: 1, sort_order: 1, product: 'Ring' },
      { loan_no: 1, sort_order: 2, product: 'Chain' },
      { loan_no: 2, sort_order: 3, product: 'Ring' },
    ]);
  });

  it('refuses to save a new loan over one that exists (double save)', () => {
    saveLoan({ original: null, bill: BILL(1), items: [ITEM()] });
    expect(() =>
      saveLoan({ original: null, bill: BILL(1, 5), items: [ITEM()] })
    ).toThrow('Loan F1 already exists');
    expect(all(`SELECT loan_amount FROM bills`)).toEqual([
      { loan_amount: 1000 },
    ]);
    expect(all(`SELECT COUNT(*) AS n FROM bill_items`)).toEqual([{ n: 1 }]);
  });

  it('edits in place, replaces the items and keeps the release status', () => {
    saveLoan({ original: null, bill: BILL(1), items: [ITEM()] });
    releaseLoan(RELEASE(1) as never);
    saveLoan({
      original: { serial: 'F', loan_no: 1 },
      bill: BILL(1, 2000),
      items: [ITEM('Chain')],
    });
    expect(all(`SELECT loan_amount, released, deleted FROM bills`)).toEqual([
      { loan_amount: 2000, released: 1, deleted: null },
    ]);
    expect(
      all(`SELECT product, deleted FROM bill_items ORDER BY sort_order`)
    ).toEqual([
      { product: 'Ring', deleted: 1 },
      { product: 'Chain', deleted: null },
    ]);
  });

  it('moves a released loan, its items and its release to a new number', () => {
    saveLoan({ original: null, bill: BILL(1), items: [ITEM()] });
    releaseLoan(RELEASE(1) as never);
    saveLoan({
      original: { serial: 'F', loan_no: 1 },
      bill: BILL(2),
      items: [ITEM()],
    });
    const live = (t: string) =>
      all(`SELECT loan_no FROM ${t} WHERE deleted IS NULL`);
    expect(live('bills')).toEqual([{ loan_no: 2 }]);
    expect(live('bill_items')).toEqual([{ loan_no: 2 }]);
    expect(live('releases')).toEqual([{ loan_no: 2 }]);
    expect(all(`SELECT released FROM bills WHERE loan_no = 2`)).toEqual([
      { released: 1 },
    ]);
    // The old number is queued for deletion on Supabase in every table.
    for (const t of ['bills', 'bill_items', 'releases']) {
      expect(all(`SELECT deleted FROM ${t} WHERE loan_no = 1`)).toEqual([
        { deleted: 1 },
      ]);
    }
  });

  it('refuses to move a loan onto a number that is taken, changing nothing', () => {
    saveLoan({ original: null, bill: BILL(1), items: [ITEM()] });
    saveLoan({ original: null, bill: BILL(2), items: [ITEM()] });
    expect(() =>
      saveLoan({
        original: { serial: 'F', loan_no: 1 },
        bill: BILL(2),
        items: [ITEM()],
      })
    ).toThrow('Loan F2 already exists');
    expect(
      all(`SELECT COUNT(*) AS n FROM bills WHERE deleted IS NULL`)
    ).toEqual([{ n: 2 }]);
  });

  it('keeps the old loan untouched when saving under the new number fails', () => {
    saveLoan({ original: null, bill: BILL(1), items: [ITEM()] });
    expect(() =>
      saveLoan({
        original: { serial: 'F', loan_no: 1 },
        bill: BILL(2),
        items: [{ ...ITEM(), product: undefined } as never],
      })
    ).toThrow('Missing required field "product" in bill_items');
    expect(all(`SELECT loan_no, deleted FROM bills`)).toEqual([
      { loan_no: 1, deleted: null },
    ]);
    expect(all(`SELECT loan_no, deleted FROM bill_items`)).toEqual([
      { loan_no: 1, deleted: null },
    ]);
  });

  it('refuses to edit a loan that no longer exists', () => {
    expect(() =>
      saveLoan({
        original: { serial: 'F', loan_no: 1 },
        bill: BILL(1),
        items: [ITEM()],
      })
    ).toThrow('Loan F1 does not exist');
  });
});

describe('deleteLoan', () => {
  it('queues the loan and its items for deletion together', () => {
    saveLoan({ original: null, bill: BILL(1), items: [ITEM(), ITEM()] });
    deleteLoan({ serial: 'F', loan_no: 1 });
    expect(all(`SELECT deleted FROM bills`)).toEqual([{ deleted: 1 }]);
    expect(all(`SELECT deleted FROM bill_items`)).toEqual([
      { deleted: 1 },
      { deleted: 1 },
    ]);
  });

  it('refuses to delete a released loan', () => {
    saveLoan({ original: null, bill: BILL(1), items: [ITEM()] });
    releaseLoan(RELEASE(1) as never);
    expect(() => deleteLoan({ serial: 'F', loan_no: 1 })).toThrow(
      'Loan F1 is released. Unrelease it first, then delete.'
    );
    expect(all(`SELECT deleted FROM bills`)).toEqual([{ deleted: null }]);
    unreleaseLoan('F', 1);
    deleteLoan({ serial: 'F', loan_no: 1 });
    expect(all(`SELECT deleted FROM bills`)).toEqual([{ deleted: 1 }]);
  });

  it('refuses to delete a loan that does not exist', () => {
    expect(() => deleteLoan({ serial: 'F', loan_no: 1 })).toThrow(
      'Loan F1 does not exist'
    );
  });
});
