// @vitest-environment node

import { beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { TablesSQliteSchema } from '../../../tableSchema';
import {
  buildFactsQueries,
  DEFAULT_FILTERS,
  FACTS,
  monthDiffSql,
} from './facts';
import { getMonthDiff } from '@/lib/myUtils.tsx';

function isoDay(offset: number): string {
  const date = new Date(Date.UTC(2023, 0, 1 + offset));
  return date.toISOString().slice(0, 10);
}

describe('monthDiffSql', () => {
  const db = new Database(':memory:');
  const stmt = db.prepare(
    `WITH p (a, b) AS (SELECT ?, ?) SELECT ${monthDiffSql('p.a', 'p.b')} AS months FROM p`
  );
  const sqlMonths = (from: string, to: string) =>
    (stmt.get(from, to) as { months: number }).months;

  it('matches getMonthDiff for every pair over two years', () => {
    const mismatches: string[] = [];
    for (let start = 0; start < 400; start += 3) {
      for (let length = -3; length < 800; length += 7) {
        const from = isoDay(start);
        const to = isoDay(start + length);
        const expected = getMonthDiff(from, to);
        const actual = sqlMonths(from, to);
        if (expected !== actual)
          mismatches.push(`${from}→${to}: ${expected} vs ${actual}`);
      }
    }
    expect(mismatches).toEqual([]);
  });
});

describe('buildFactsQueries', () => {
  let db: Database.Database;

  const run = (filters = DEFAULT_FILTERS) => {
    for (const q of buildFactsQueries(filters, '2024-06-01')) {
      db.prepare(q.sql).run(...(q.params ?? []));
    }
    return db
      .prepare(`SELECT * FROM ${FACTS} ORDER BY serial, loan_no`)
      .all() as Record<string, unknown>[];
  };

  beforeEach(() => {
    db = new Database(':memory:');
    for (const table of Object.values(TablesSQliteSchema)) {
      const cols = Object.entries(table.columns)
        .map(([name, def]) => `${name} ${def.schema}`)
        .join(', ');
      db.exec(`CREATE TABLE ${table.name} (${cols})`);
    }
    db.exec(`
      INSERT INTO areas (name, town) VALUES ('North', 'Town A');
      INSERT INTO customers (id, name, fhtitle, fhname, area)
        VALUES ('c1', 'Ravi', 'S/O', 'Kumar', 'North');
      INSERT INTO bills (serial, loan_no, date, customer_id, loan_amount,
        interest_rate, first_month_interest, doc_charges, metal_type, company)
      VALUES
        ('A', 1, '2024-01-10', 'c1', 5000, 2, 100, 25, 'Gold', 'X'),
        ('A', 2, '2024-03-15', 'c1', 3000, 2.5, 75, 9, 'Gold', 'X'),
        ('A', 3, '2024-05-20', 'c1', 1000, 3, 30, 3, 'Silver', 'Y');
      INSERT INTO releases (serial, loan_no, date, loan_date, interest_amount,
        tax_interest_amount, loan_amount, total_amount, company)
      VALUES ('A', 1, '2024-03-15', '2024-01-10', 200, 100, 5000, 5200, 'X');
      INSERT INTO bill_items (serial, loan_no, sort_order, product, quantity,
        gross_weight, net_weight, ignore_weight)
      VALUES ('A', 1, 1, 'Ring', 1, 10, 9, 1), ('A', 1, 2, 'Chain', 2, 5, 4, 1);
    `);
  });

  it('builds one row per loan with durations and flags', () => {
    const rows = run();
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      months: 2,
      release_date: '2024-03-15',
      is_new: 1,
      is_renewed: 1, // same customer borrowed again the day it was released
      is_repledge: 0,
      net_weight: 13,
      bracket: 3,
      area: 'North',
      town: 'Town A',
    });
    // Taken the day loan 1 was released: a re-pledge.
    expect(rows[1]).toMatchObject({
      is_new: 0,
      is_repledge: 1,
      release_date: null,
    });
    // Still open, aged to the as-of date.
    expect(rows[2]).toMatchObject({ months: 0, days: 12, bracket: 1 });
  });

  it('applies filters', () => {
    expect(run({ ...DEFAULT_FILTERS, status: 'open' })).toHaveLength(2);
    expect(run({ ...DEFAULT_FILTERS, metals: ['Silver'] })).toHaveLength(1);
    expect(
      run({ ...DEFAULT_FILTERS, amountMin: 2000, companies: ['X'] })
    ).toHaveLength(2);
    expect(run({ ...DEFAULT_FILTERS, repledge: 'repledge' })).toHaveLength(1);
  });
});
