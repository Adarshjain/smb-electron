import { FACTS, type QueryContext } from '@/lib/analytics/facts.ts';
import { dueAt, openAt } from './shared.ts';

export interface CustomerRows {
  summary: {
    customers: number;
    loans: number;
    repeat_customers: number;
    active: number;
  };
  concentration: {
    gini: number;
    top1: number;
    top10: number;
    customers: number;
    total: number;
  };
  lorenz: { x: number; y: number };
  topOutstanding: {
    customer_id: string;
    name: string;
    relation: string;
    area: string;
    loans: number;
    amt: number;
    due: number;
  };
  topLifetime: {
    customer_id: string;
    name: string;
    relation: string;
    area: string;
    loans: number;
    amt: number;
  };
  loansPerCustomer: { k: number; n: number };
  gaps: { bin: number; n: number };
  newVsRepeat: { ym: string; first: number; repeat: number; repledge: number };
  renewalMonthly: { ym: string; n: number; renewed: number };
  areas: {
    area: string;
    town: string | null;
    loans: number;
    amt: number;
    customers: number;
    open_amt: number;
  };
  lapsed: { bin: number; n: number };
}

/** Months since last activity for customers with nothing open. */
export const LAPSED_BINS = [
  'Under 6 months',
  '6–12 months',
  '1–2 years',
  '2–3 years',
  '3+ years',
];

export function customerQueries(ctx: QueryContext) {
  const range = [ctx.from, ctx.to];
  const openCustomers = `WITH p(d) AS (SELECT ?),
    c AS (SELECT customer_id, SUM(loan_amount) AS amt FROM ${FACTS}, p
          WHERE ${openAt('p.d')} GROUP BY customer_id),
    r AS (SELECT amt, ROW_NUMBER() OVER (ORDER BY amt) AS rn, COUNT(*) OVER () AS n,
            SUM(amt) OVER (ORDER BY amt ROWS UNBOUNDED PRECEDING) AS cum,
            SUM(amt) OVER () AS total FROM c)`;
  const who = `customer_name AS name, fhtitle || ' ' || fhname AS relation, area`;
  return {
    summary: {
      sql: `WITH p(d) AS (SELECT ?),
        per AS (SELECT customer_id, COUNT(*) AS n FROM ${FACTS}
                WHERE loan_date BETWEEN ? AND ? GROUP BY customer_id)
        SELECT COUNT(*) AS customers, COALESCE(SUM(n), 0) AS loans,
          COALESCE(SUM(n > 1), 0) AS repeat_customers,
          (SELECT COUNT(DISTINCT customer_id) FROM ${FACTS}, p WHERE ${openAt('p.d')}) AS active
        FROM per`,
      params: [ctx.snapshot, ...range],
    },
    concentration: {
      sql: `${openCustomers}
        SELECT 1 - SUM(2 * cum - amt) / (MAX(total) * MAX(n)) AS gini,
          SUM(CASE WHEN rn > n * 0.99 THEN amt END) / MAX(total) AS top1,
          SUM(CASE WHEN rn > n * 0.9 THEN amt END) / MAX(total) AS top10,
          MAX(n) AS customers, MAX(total) AS total
        FROM r`,
      params: [ctx.snapshot],
    },
    lorenz: {
      sql: `${openCustomers}
        SELECT 0.0 AS x, 0.0 AS y
        UNION ALL
        SELECT CAST(rn AS REAL) / n AS x, cum / total AS y FROM r
        WHERE rn % MAX(1, n / 100) = 0 OR rn = n`,
      params: [ctx.snapshot],
    },
    topOutstanding: {
      sql: `WITH p(d) AS (SELECT ?)
        SELECT customer_id, ${who}, COUNT(*) AS loans, SUM(loan_amount) AS amt,
          SUM(${dueAt('p.d')}) AS due
        FROM ${FACTS}, p WHERE ${openAt('p.d')}
        GROUP BY customer_id ORDER BY amt DESC LIMIT 20`,
      params: [ctx.snapshot],
    },
    topLifetime: {
      sql: `SELECT customer_id, ${who}, COUNT(*) AS loans, SUM(loan_amount) AS amt
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY customer_id ORDER BY amt DESC LIMIT 20`,
      params: range,
    },
    loansPerCustomer: {
      sql: `SELECT MIN(n, 15) AS k, COUNT(*) AS n FROM (
          SELECT customer_id, COUNT(*) AS n FROM ${FACTS}
          WHERE loan_date BETWEEN ? AND ? GROUP BY customer_id)
        GROUP BY k ORDER BY k`,
      params: range,
    },
    // Months between a customer's visits (loans on the same day count once).
    gaps: {
      sql: `WITH d AS (SELECT DISTINCT customer_id, loan_date FROM ${FACTS}),
        o AS (SELECT loan_date, LAG(loan_date) OVER (
                PARTITION BY customer_id ORDER BY loan_date) AS prev FROM d)
        SELECT MIN(CAST((julianday(loan_date) - julianday(prev)) / 30.44 AS INTEGER), 36) AS bin,
          COUNT(*) AS n
        FROM o WHERE prev IS NOT NULL AND loan_date BETWEEN ? AND ?
        GROUP BY bin ORDER BY bin`,
      params: range,
    },
    newVsRepeat: {
      sql: `SELECT loan_month AS ym, SUM(is_new) AS first, SUM(1 - is_new) AS repeat,
          SUM(is_repledge) AS repledge
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY loan_month ORDER BY loan_month`,
      params: range,
    },
    renewalMonthly: {
      sql: `SELECT release_month AS ym, COUNT(*) AS n, SUM(is_renewed) AS renewed
        FROM ${FACTS} WHERE release_date BETWEEN ? AND ?
        GROUP BY release_month ORDER BY release_month`,
      params: range,
    },
    areas: {
      sql: `SELECT COALESCE(area, 'Unknown') AS area, MAX(town) AS town, COUNT(*) AS loans,
          SUM(loan_amount) AS amt, COUNT(DISTINCT customer_id) AS customers,
          COALESCE(SUM(CASE WHEN release_date IS NULL THEN loan_amount END), 0) AS open_amt
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY area ORDER BY amt DESC`,
      params: range,
    },
    lapsed: {
      sql: `WITH p(d) AS (SELECT ?),
        c AS (SELECT customer_id,
                MAX(MAX(CASE WHEN loan_date <= p.d THEN loan_date END),
                    COALESCE(MAX(CASE WHEN release_date <= p.d THEN release_date END), '')) AS last,
                SUM(${openAt('p.d')}) AS open
              FROM ${FACTS}, p WHERE loan_date <= p.d GROUP BY customer_id)
        SELECT CASE
            WHEN last > date(p.d, '-6 months') THEN 0
            WHEN last > date(p.d, '-12 months') THEN 1
            WHEN last > date(p.d, '-24 months') THEN 2
            WHEN last > date(p.d, '-36 months') THEN 3
            ELSE 4 END AS bin, COUNT(*) AS n
        FROM c, p WHERE open = 0 GROUP BY bin ORDER BY bin`,
      params: [ctx.snapshot],
    },
  };
}
