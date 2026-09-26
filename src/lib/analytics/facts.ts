import type { MetalType } from '../../../tables';

// The analytics screen never pulls raw rows into the page. Each refresh runs
// one db:batch call that first materializes the filtered loans into a TEMP
// table (one row per loan, ~100ms on the full book) and then runs small
// aggregate queries against it. TEMP tables live only on this connection and
// are rebuilt at the start of every batch, so there is nothing to clean up.

export const FACTS = 'temp.analytics_facts';

export interface DateRange {
  from: string;
  to: string;
}

export type LoanStatus = 'all' | 'open' | 'released';

export interface AnalyticsFilters {
  /** Date range for the event each chart is about (loan date, release date, …). */
  period: DateRange | null;
  /** Only loans taken in this range. */
  loanPeriod: DateRange | null;
  companies: string[];
  metals: MetalType[];
  status: LoanStatus;
  amountMin: number | null;
  amountMax: number | null;
  rates: number[];
  areas: string[];
  customerType: 'all' | 'new' | 'repeat';
  repledge: 'all' | 'repledge' | 'fresh';
  monthsMin: number | null;
  monthsMax: number | null;
}

export const DEFAULT_FILTERS: AnalyticsFilters = {
  period: null,
  loanPeriod: null,
  companies: [],
  metals: [],
  status: 'all',
  amountMin: null,
  amountMax: null,
  rates: [],
  areas: [],
  customerType: 'all',
  repledge: 'all',
  monthsMin: null,
  monthsMax: null,
};

/**
 * Principal brackets. The ₹1,100 and ₹5,000 edges are where the interest slabs
 * in interest_rates change.
 */
export const BRACKETS: {
  id: number;
  label: string;
  min: number;
  max: number | null;
}[] = [
  { id: 1, label: 'Up to ₹1,100', min: 0, max: 1100 },
  { id: 2, label: '₹1,101 – ₹4,999', min: 1101, max: 4999.99 },
  { id: 3, label: '₹5,000 – ₹9,999', min: 5000, max: 9999.99 },
  { id: 4, label: '₹10,000 – ₹24,999', min: 10000, max: 24999.99 },
  { id: 5, label: '₹25,000 and above', min: 25000, max: null },
];

const bracketSql = `CASE
  WHEN b.loan_amount <= 1100 THEN 1
  WHEN b.loan_amount < 5000 THEN 2
  WHEN b.loan_amount < 10000 THEN 3
  WHEN b.loan_amount < 25000 THEN 4
  ELSE 5 END`;

const part = (fmt: string, date: string) =>
  `CAST(strftime('${fmt}', ${date}) AS INTEGER)`;

/**
 * SQL version of getMonthDiff() in myUtils: months charged on top of the first
 * month's interest. Kept in step with it by facts.sql.test.ts.
 */
export function monthDiffSql(from: string, to: string): string {
  return `(CASE WHEN julianday(${to}) - julianday(${from}) <= 0 THEN 0 ELSE
    ((${part('%Y', to)} - ${part('%Y', from)}) * 12 + ${part('%m', to)} - ${part('%m', from)})
    - (${part('%d', to)} < ${part('%d', from)})
    - (${part('%d', to)} = ${part('%d', from)}) END)`;
}

/**
 * A date as a SQL literal, for expressions that use it several times (where
 * positional parameters get unwieldy). Only accepts YYYY-MM-DD.
 */
export function sqlDate(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Not a date: ${date}`);
  return `'${date}'`;
}

export interface Query {
  sql: string;
  params?: unknown[];
  justRun?: boolean;
}

function placeholders(values: unknown[]): string {
  return values.map(() => '?').join(', ');
}

/** WHERE clauses for everything except the chart period. */
export function filterClauses(filters: AnalyticsFilters): {
  sql: string;
  params: unknown[];
} {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, ...values: unknown[]) => {
    clauses.push(sql);
    params.push(...values);
  };
  if (filters.companies.length)
    add(
      `company IN (${placeholders(filters.companies)})`,
      ...filters.companies
    );
  if (filters.metals.length)
    add(`metal_type IN (${placeholders(filters.metals)})`, ...filters.metals);
  if (filters.status === 'open') add('release_date IS NULL');
  if (filters.status === 'released') add('release_date IS NOT NULL');
  if (filters.amountMin !== null) add('loan_amount >= ?', filters.amountMin);
  if (filters.amountMax !== null) add('loan_amount <= ?', filters.amountMax);
  if (filters.rates.length)
    add(`interest_rate IN (${placeholders(filters.rates)})`, ...filters.rates);
  if (filters.areas.length)
    add(`area IN (${placeholders(filters.areas)})`, ...filters.areas);
  if (filters.customerType === 'new') add('is_new = 1');
  if (filters.customerType === 'repeat') add('is_new = 0');
  if (filters.repledge === 'repledge') add('is_repledge = 1');
  if (filters.repledge === 'fresh') add('is_repledge = 0');
  if (filters.monthsMin !== null) add('months >= ?', filters.monthsMin);
  if (filters.monthsMax !== null) add('months <= ?', filters.monthsMax);
  if (filters.loanPeriod)
    add(
      'loan_date BETWEEN ? AND ?',
      filters.loanPeriod.from,
      filters.loanPeriod.to
    );
  return {
    sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params,
  };
}

/**
 * Statements that (re)build the facts table. `asOf` is the business date that
 * open loans are aged to.
 */
export function buildFactsQueries(
  filters: AnalyticsFilters,
  asOf: string
): Query[] {
  const where = filterClauses(filters);
  const releaseOrAsOf = `COALESCE(r.date, :asOf)`;
  const sql = `CREATE TEMP TABLE analytics_facts AS
    WITH first_loan AS (
      SELECT customer_id, MIN(date) AS first_date
      FROM bills WHERE deleted IS NULL GROUP BY customer_id
    ),
    weights AS (
      SELECT serial, loan_no, SUM(gross_weight) AS gross_weight,
             SUM(net_weight) AS net_weight, SUM(quantity) AS quantity
      FROM bill_items WHERE deleted IS NULL GROUP BY serial, loan_no
    ),
    release_days AS (
      SELECT b2.customer_id, r2.date, COUNT(*) AS n
      FROM releases r2
      JOIN bills b2 ON b2.serial = r2.serial AND b2.loan_no = r2.loan_no
        AND b2.deleted IS NULL
      WHERE r2.deleted IS NULL
      GROUP BY b2.customer_id, r2.date
    ),
    f AS (
      SELECT b.serial, b.loan_no, b.date AS loan_date,
        substr(b.date, 1, 7) AS loan_month,
        b.company, b.metal_type, b.loan_amount, b.interest_rate,
        b.first_month_interest, b.doc_charges, b.customer_id,
        c.name AS customer_name, c.fhtitle, c.fhname, c.phone_no,
        c.area, a.town,
        r.date AS release_date, substr(r.date, 1, 7) AS release_month,
        r.interest_amount, r.tax_interest_amount,
        ${monthDiffSql('b.date', releaseOrAsOf)} AS months,
        CAST(julianday(${releaseOrAsOf}) - julianday(b.date) AS INTEGER) AS days,
        (b.date = fl.first_date) AS is_new,
        (COALESCE(rd.n, 0) - COALESCE(r.date = b.date, 0)) > 0 AS is_repledge,
        EXISTS (
          SELECT 1 FROM bills b3
          WHERE b3.customer_id = b.customer_id AND b3.date = r.date
            AND b3.deleted IS NULL
            AND NOT (b3.serial = b.serial AND b3.loan_no = b.loan_no)
        ) AS is_renewed,
        ROUND(b.loan_amount * b.interest_rate / 100.0
              * ${monthDiffSql('b.date', releaseOrAsOf)}) AS due_interest,
        COALESCE(w.gross_weight, 0) AS gross_weight,
        COALESCE(w.net_weight, 0) AS net_weight,
        COALESCE(w.quantity, 0) AS quantity,
        ${bracketSql} AS bracket
      FROM bills b
      LEFT JOIN releases r ON r.serial = b.serial AND r.loan_no = b.loan_no
        AND r.deleted IS NULL
      LEFT JOIN customers c ON c.id = b.customer_id AND c.deleted IS NULL
      LEFT JOIN areas a ON a.name = c.area AND a.deleted IS NULL
      LEFT JOIN first_loan fl ON fl.customer_id = b.customer_id
      LEFT JOIN weights w ON w.serial = b.serial AND w.loan_no = b.loan_no
      LEFT JOIN release_days rd ON rd.customer_id = b.customer_id
        AND rd.date = b.date
      WHERE b.deleted IS NULL
    )
    SELECT * FROM f ${where.sql}`;
  // better-sqlite3 can't mix named and positional parameters, so inline the
  // asOf date as a positional parameter at each use.
  const asOfUses = sql.split(':asOf').length - 1;
  const positional = sql.split(':asOf').join('?');
  // :asOf appears before the WHERE clause, so its values come first.
  return [
    { sql: `DROP TABLE IF EXISTS ${FACTS}`, justRun: true },
    {
      sql: positional,
      params: [...new Array<string>(asOfUses).fill(asOf), ...where.params],
      justRun: true,
    },
  ];
}

/** Resolved dates every tab's queries share. */
export interface QueryContext {
  asOf: string;
  from: string;
  to: string;
  /** Date that snapshot views (outstanding, aging) are taken on. */
  snapshot: string;
}

export function resolveContext(
  filters: AnalyticsFilters,
  asOf: string
): QueryContext {
  const from = filters.period?.from ?? '0000-01-01';
  const to = filters.period?.to ?? asOf;
  return { asOf, from, to, snapshot: to < asOf ? to : asOf };
}

export function countActiveFilters(filters: AnalyticsFilters): number {
  let n = 0;
  if (filters.loanPeriod) n++;
  if (filters.companies.length) n++;
  if (filters.metals.length) n++;
  if (filters.status !== 'all') n++;
  if (filters.amountMin !== null || filters.amountMax !== null) n++;
  if (filters.rates.length) n++;
  if (filters.areas.length) n++;
  if (filters.customerType !== 'all') n++;
  if (filters.repledge !== 'all') n++;
  if (filters.monthsMin !== null || filters.monthsMax !== null) n++;
  return n;
}
