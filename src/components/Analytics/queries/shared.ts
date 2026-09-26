import {
  FACTS,
  monthDiffSql,
  type Query,
  type QueryContext,
} from '@/lib/analytics/facts.ts';

/** Loan was open at the end of day `d` (a SQL expression). */
export const openAt = (d: string) =>
  `loan_date <= ${d} AND (release_date IS NULL OR release_date > ${d})`;

/** Interest owed on an open loan at date `d`, the way Release Loan computes it. */
export const dueAt = (d: string) =>
  `ROUND(loan_amount * interest_rate / 100.0 * ${monthDiffSql('loan_date', d)})`;

export interface OutstandingRow {
  ym: string;
  company: string;
  n: number;
  amt: number;
}

/**
 * Principal outstanding at each month end in the period (the last month is
 * cut at the snapshot date): a running total of money lent minus money
 * returned. Months with no activity for a company are missing; fill forward.
 */
export function outstandingSeries(ctx: QueryContext): Query {
  return {
    sql: `WITH ev AS (
        SELECT substr(loan_date, 1, 7) AS ym, company, loan_amount AS amt, 1 AS n
        FROM ${FACTS} WHERE loan_date <= ?
        UNION ALL
        SELECT substr(release_date, 1, 7), company, -loan_amount, -1
        FROM ${FACTS} WHERE release_date <= ?
      ),
      m AS (SELECT ym, company, SUM(amt) AS amt, SUM(n) AS n FROM ev GROUP BY ym, company),
      c AS (SELECT ym, company,
              SUM(amt) OVER (PARTITION BY company ORDER BY ym) AS amt,
              SUM(n) OVER (PARTITION BY company ORDER BY ym) AS n
            FROM m)
      SELECT ym, company, n, amt FROM c WHERE ym >= substr(?, 1, 7) ORDER BY ym`,
    params: [ctx.snapshot, ctx.snapshot, ctx.from],
  };
}

/** Month-end outstanding per company, filled forward across quiet months. */
export function outstandingByCompany(rows: OutstandingRow[], months: string[]) {
  const companies = [...new Set(rows.map((r) => r.company))].sort().reverse();
  const byKey = new Map(rows.map((r) => [`${r.ym}|${r.company}`, r]));
  return companies.map((company) => {
    let last = 0;
    const values = months.map((ym) => {
      const row = byKey.get(`${ym}|${company}`);
      if (row) last = row.amt;
      return last;
    });
    return { company, values };
  });
}
