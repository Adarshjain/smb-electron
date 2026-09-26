import {
  FACTS,
  type AnalyticsFilters,
  type QueryContext,
} from '@/lib/analytics/facts.ts';
import { outstandingSeries, type OutstandingRow } from './shared.ts';

export interface RevenueRows {
  byLoanMonth: { ym: string; first_month: number; doc: number };
  byReleaseMonth: {
    ym: string;
    interest: number;
    tax_interest: number;
    due: number;
    waived: number;
    extra: number;
    discounted: number;
    n: number;
  };
  outstanding: OutstandingRow;
  yieldBy: {
    dim: 'bracket' | 'metal';
    g: string;
    n: number;
    interest: number;
    loan_months: number;
    principal: number;
  };
  waivers: { bin: number; n: number; amt: number };
  ledger: {
    ym: string;
    grp: 'Income' | 'Expenses';
    credit: number;
    debit: number;
  };
  heads: { grp: 'Income' | 'Expenses'; name: string; net: number };
}

/** Waiver bins in rupees: ≤50, ≤100, ≤250, ≤500, ≤1000, ≤2500, more. */
export const WAIVER_BINS = [
  'Up to ₹50',
  '₹51–100',
  '₹101–250',
  '₹251–500',
  '₹501–1,000',
  '₹1,001–2,500',
  'Over ₹2,500',
];

const waiverBin = (
  x: string
) => `CASE WHEN ${x} <= 50 THEN 0 WHEN ${x} <= 100 THEN 1
  WHEN ${x} <= 250 THEN 2 WHEN ${x} <= 500 THEN 3 WHEN ${x} <= 1000 THEN 4
  WHEN ${x} <= 2500 THEN 5 ELSE 6 END`;

function companyClause(filters: AnalyticsFilters, column: string) {
  return filters.companies.length
    ? {
        sql: ` AND ${column} IN (${filters.companies.map(() => '?').join(', ')})`,
        params: filters.companies,
      }
    : { sql: '', params: [] as string[] };
}

export function revenueQueries(ctx: QueryContext, filters: AnalyticsFilters) {
  const range = [ctx.from, ctx.to];
  const company = companyClause(filters, 'de.company');
  // Interest earned per loan: first month (taken upfront) plus what was paid
  // at release. Loan-months is principal × months the money was out.
  const yieldSelect = `COUNT(*) AS n,
    SUM(first_month_interest + interest_amount) AS interest,
    SUM(loan_amount * (months + 1)) AS loan_months,
    SUM(loan_amount) AS principal`;
  return {
    byLoanMonth: {
      sql: `SELECT loan_month AS ym, SUM(first_month_interest) AS first_month,
          SUM(doc_charges) AS doc
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY loan_month ORDER BY loan_month`,
      params: range,
    },
    byReleaseMonth: {
      sql: `SELECT release_month AS ym, SUM(interest_amount) AS interest,
          SUM(tax_interest_amount) AS tax_interest, SUM(due_interest) AS due,
          SUM(MAX(due_interest - interest_amount, 0)) AS waived,
          SUM(MAX(interest_amount - due_interest, 0)) AS extra,
          SUM(interest_amount < due_interest - 1) AS discounted,
          COUNT(*) AS n
        FROM ${FACTS} WHERE release_date BETWEEN ? AND ?
        GROUP BY release_month ORDER BY release_month`,
      params: range,
    },
    outstanding: outstandingSeries(ctx),
    yieldBy: {
      sql: `SELECT 'bracket' AS dim, CAST(bracket AS TEXT) AS g, ${yieldSelect}
          FROM ${FACTS} WHERE release_date BETWEEN ? AND ? GROUP BY bracket
        UNION ALL
        SELECT 'metal' AS dim, metal_type AS g, ${yieldSelect}
          FROM ${FACTS} WHERE release_date BETWEEN ? AND ? GROUP BY metal_type`,
      params: [...range, ...range],
    },
    waivers: {
      sql: `SELECT ${waiverBin('(due_interest - interest_amount)')} AS bin, COUNT(*) AS n,
          SUM(due_interest - interest_amount) AS amt
        FROM ${FACTS}
        WHERE release_date BETWEEN ? AND ? AND interest_amount < due_interest - 1
        GROUP BY bin ORDER BY bin`,
      params: range,
    },
    // Books: same rules as Profit & Loss (income = debits, expenses = credits
    // net of the other side), by month.
    ledger: {
      sql: `SELECT substr(de.date, 1, 7) AS ym, ah.hisaab_group AS grp,
          SUM(de.credit) AS credit, SUM(de.debit) AS debit
        FROM daily_entries de
        JOIN account_head ah ON ah.code = de.main_code AND ah.company = de.company
          AND ah.deleted IS NULL
        WHERE de.deleted IS NULL AND ah.hisaab_group IN ('Income', 'Expenses')
          AND de.date BETWEEN ? AND ?${company.sql}
        GROUP BY ym, grp ORDER BY ym`,
      params: [...range, ...company.params],
    },
    heads: {
      sql: `SELECT ah.hisaab_group AS grp, ah.name,
          CASE WHEN ah.hisaab_group = 'Income' THEN ABS(SUM(de.credit) - SUM(de.debit))
               ELSE SUM(de.credit) - SUM(de.debit) END AS net
        FROM daily_entries de
        JOIN account_head ah ON ah.code = de.main_code AND ah.company = de.company
          AND ah.deleted IS NULL
        WHERE de.deleted IS NULL AND ah.hisaab_group IN ('Income', 'Expenses')
          AND de.date BETWEEN ? AND ?${company.sql}
        GROUP BY ah.hisaab_group, ah.name
        HAVING net <> 0
        ORDER BY net DESC`,
      params: [...range, ...company.params],
    },
  };
}
