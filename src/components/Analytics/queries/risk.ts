import {
  FACTS,
  monthDiffSql,
  type QueryContext,
} from '@/lib/analytics/facts.ts';
import { openAt } from './shared.ts';

export interface Prices {
  /** Value of one gram (net weight) of gold, in ₹. */
  gold: number | null;
  silver: number | null;
}

export interface RiskRows {
  coverage: {
    metal_type: string;
    bin: number;
    n: number;
    amt: number;
    owed: number;
  };
  noValue: { n: number; amt: number };
  dueRatio: { bin: number; n: number; amt: number };
  watchlist: {
    loan: string;
    loan_date: string;
    metal_type: string;
    loan_amount: number;
    owed: number;
    value: number | null;
    cover: number | null;
    age: number;
    customer: string;
    area: string;
    phone_no: string | null;
  };
  openByAge: {
    age: number;
    n: number;
    amt: number;
    interest_per_month: number;
  };
  recentHazard: { t: number; events: number; censored: number };
  recentReleases: { ym: string; n: number; amt: number; interest: number };
}

/** Loan-to-value bins of 10%; bin 15 is 150% and above. */
export const COVER_BINS = 16;

/** Interest owed as a share of principal, in 10% bins; bin 10 is 100%+. */
export const DUE_BINS = 11;

export function riskQueries(prices: Prices) {
  return (ctx: QueryContext) => {
    const age = monthDiffSql('loan_date', 'p.d');
    const owed = `(loan_amount + ROUND(loan_amount * interest_rate / 100.0 * ${age}))`;
    const value = `(net_weight * CASE metal_type WHEN 'Gold' THEN p.gold WHEN 'Silver' THEN p.silver END)`;
    const base = `WITH p(d, gold, silver) AS (SELECT ?, ?, ?),
      o AS (SELECT *, ${owed} AS owed, ${value} AS value, ${age} AS age
            FROM ${FACTS}, p WHERE ${openAt('p.d')})`;
    const params = [ctx.snapshot, prices.gold, prices.silver];
    return {
      coverage: {
        sql: `${base}
          SELECT metal_type, MIN(CAST(owed / value * 10 AS INTEGER), ${COVER_BINS - 1}) AS bin,
            COUNT(*) AS n, SUM(loan_amount) AS amt, SUM(owed) AS owed
          FROM o WHERE value > 0 GROUP BY metal_type, bin ORDER BY bin`,
        params,
      },
      noValue: {
        sql: `${base}
          SELECT COUNT(*) AS n, COALESCE(SUM(loan_amount), 0) AS amt
          FROM o WHERE net_weight <= 0`,
        params,
      },
      dueRatio: {
        sql: `${base}
          SELECT MIN(CAST((owed - loan_amount) / loan_amount * 10 AS INTEGER), ${DUE_BINS - 1}) AS bin,
            COUNT(*) AS n, SUM(loan_amount) AS amt
          FROM o GROUP BY bin ORDER BY bin`,
        params,
      },
      watchlist: {
        sql: `${base}
          SELECT serial || ' ' || loan_no AS loan, loan_date, metal_type, loan_amount,
            owed, value, CASE WHEN value > 0 THEN owed / value END AS cover, age,
            customer_name || ' ' || fhtitle || ' ' || fhname AS customer, area, phone_no
          FROM o
          ORDER BY CASE WHEN value > 0 THEN owed / value ELSE (owed - loan_amount) / loan_amount END DESC
          LIMIT 100`,
        params,
      },
      openByAge: {
        sql: `WITH p(d) AS (SELECT ?)
          SELECT ${age} AS age, COUNT(*) AS n, SUM(loan_amount) AS amt,
            SUM(loan_amount * interest_rate / 100.0) AS interest_per_month
          FROM ${FACTS}, p WHERE ${openAt('p.d')} GROUP BY age ORDER BY age`,
        params: [ctx.snapshot],
      },
      // Release behaviour of loans from the three years before the snapshot,
      // used to project what the open book will do next.
      recentHazard: {
        sql: `WITH p(d) AS (SELECT ?)
          SELECT (CASE WHEN release_date IS NOT NULL AND release_date <= p.d THEN months ELSE ${age} END) AS t,
            SUM(release_date IS NOT NULL AND release_date <= p.d) AS events,
            SUM(release_date IS NULL OR release_date > p.d) AS censored
          FROM ${FACTS}, p
          WHERE loan_date <= p.d AND loan_date > date(p.d, '-36 months')
          GROUP BY t ORDER BY t`,
        params: [ctx.snapshot],
      },
      recentReleases: {
        sql: `WITH p(d) AS (SELECT ?)
          SELECT release_month AS ym, COUNT(*) AS n, SUM(loan_amount) AS amt,
            SUM(interest_amount) AS interest
          FROM ${FACTS}, p
          WHERE release_date < date(p.d, 'start of month')
            AND release_date >= date(p.d, 'start of month', '-12 months')
          GROUP BY release_month ORDER BY release_month`,
        params: [ctx.snapshot],
      },
    };
  };
}
