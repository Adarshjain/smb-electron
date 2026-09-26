import { FACTS, type QueryContext } from '@/lib/analytics/facts.ts';

export interface CohortRows {
  /** Loans taken per month, and how many were released at each age. */
  cohorts: { cohort: string; t: number; released: number; n: number };
  customers: {
    cohort: string;
    customers: number;
    back12: number;
    back: number;
  };
}

export function cohortQueries(ctx: QueryContext) {
  const range = [ctx.from, ctx.to];
  return {
    cohorts: {
      sql: `SELECT loan_month AS cohort, months AS t,
          SUM(release_date IS NOT NULL) AS released, COUNT(*) AS n
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY loan_month, months ORDER BY loan_month, months`,
      params: range,
    },
    // First visit month of each customer and whether they came back for
    // another loan on a later day.
    customers: {
      sql: `WITH d AS (SELECT DISTINCT customer_id, loan_date FROM ${FACTS}),
        o AS (SELECT customer_id, loan_date,
                DENSE_RANK() OVER (PARTITION BY customer_id ORDER BY loan_date) AS rk
              FROM d),
        firsts AS (SELECT customer_id,
                     MAX(CASE WHEN rk = 1 THEN loan_date END) AS first,
                     MAX(CASE WHEN rk = 2 THEN loan_date END) AS second
                   FROM o WHERE rk <= 2 GROUP BY customer_id)
        SELECT substr(first, 1, 7) AS cohort, COUNT(*) AS customers,
          SUM(second IS NOT NULL AND julianday(second) - julianday(first) <= 365) AS back12,
          SUM(second IS NOT NULL) AS back
        FROM firsts WHERE first BETWEEN ? AND ?
        GROUP BY cohort ORDER BY cohort`,
      params: range,
    },
  };
}
