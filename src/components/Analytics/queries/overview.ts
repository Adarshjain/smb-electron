import { FACTS, type QueryContext } from '@/lib/analytics/facts.ts';
import {
  dueAt,
  openAt,
  outstandingSeries,
  type OutstandingRow,
} from './shared.ts';

export interface OverviewRows {
  snapshot: {
    loans: number;
    principal: number;
    due: number;
    gold: number;
    silver: number;
    customers: number;
  };
  lent: {
    loans: number;
    principal: number;
    first_month: number;
    doc: number;
    customers: number;
    new_customers: number;
  };
  released: {
    loans: number;
    principal: number;
    interest: number;
    renewed: number;
  };
  monthlyLoans: { ym: string; n: number; amt: number };
  monthlyReleases: { ym: string; n: number; amt: number; interest: number };
  outstanding: OutstandingRow;
  mix: { metal_type: string; company: string; n: number; amt: number };
}

export function overviewQueries(ctx: QueryContext) {
  const range = [ctx.from, ctx.to];
  return {
    snapshot: {
      sql: `WITH p(d) AS (SELECT ?)
        SELECT COUNT(*) AS loans, COALESCE(SUM(loan_amount), 0) AS principal,
          COALESCE(SUM(${dueAt('p.d')}), 0) AS due,
          COALESCE(SUM(CASE WHEN metal_type = 'Gold' THEN net_weight END), 0) AS gold,
          COALESCE(SUM(CASE WHEN metal_type = 'Silver' THEN net_weight END), 0) AS silver,
          COUNT(DISTINCT customer_id) AS customers
        FROM ${FACTS}, p WHERE ${openAt('p.d')}`,
      params: [ctx.snapshot],
    },
    lent: {
      sql: `SELECT COUNT(*) AS loans, COALESCE(SUM(loan_amount), 0) AS principal,
          COALESCE(SUM(first_month_interest), 0) AS first_month,
          COALESCE(SUM(doc_charges), 0) AS doc,
          COUNT(DISTINCT customer_id) AS customers,
          COUNT(DISTINCT CASE WHEN is_new THEN customer_id END) AS new_customers
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?`,
      params: range,
    },
    released: {
      sql: `SELECT COUNT(*) AS loans, COALESCE(SUM(loan_amount), 0) AS principal,
          COALESCE(SUM(interest_amount), 0) AS interest,
          COALESCE(SUM(is_renewed), 0) AS renewed
        FROM ${FACTS} WHERE release_date BETWEEN ? AND ?`,
      params: range,
    },
    monthlyLoans: {
      sql: `SELECT loan_month AS ym, COUNT(*) AS n, SUM(loan_amount) AS amt
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY loan_month ORDER BY loan_month`,
      params: range,
    },
    monthlyReleases: {
      sql: `SELECT release_month AS ym, COUNT(*) AS n, SUM(loan_amount) AS amt,
          SUM(interest_amount) AS interest
        FROM ${FACTS} WHERE release_date BETWEEN ? AND ?
        GROUP BY release_month ORDER BY release_month`,
      params: range,
    },
    outstanding: outstandingSeries(ctx),
    mix: {
      sql: `WITH p(d) AS (SELECT ?)
        SELECT metal_type, company, COUNT(*) AS n, SUM(loan_amount) AS amt
        FROM ${FACTS}, p WHERE ${openAt('p.d')}
        GROUP BY metal_type, company`,
      params: [ctx.snapshot],
    },
  };
}
