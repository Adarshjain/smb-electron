import { FACTS, type QueryContext } from '@/lib/analytics/facts.ts';

export const GROUPINGS = {
  bracket: 'Principal',
  metal: 'Metal',
  company: 'Company',
  customer: 'Customer type',
  repledge: 'Re-pledge',
  year: 'Year taken',
  rate: 'Interest rate',
} as const;

export type Grouping = keyof typeof GROUPINGS;

const groupExpr: Record<Grouping, string> = {
  bracket: 'CAST(bracket AS TEXT)',
  metal: 'metal_type',
  company: 'company',
  customer: "CASE WHEN is_new THEN 'First loan' ELSE 'Repeat customer' END",
  repledge: "CASE WHEN is_repledge THEN 'Re-pledge' ELSE 'Fresh loan' END",
  year: 'substr(loan_date, 1, 4)',
  rate: "interest_rate || '%'",
};

export interface ReleaseRows {
  /** Survival counts by extra months, for loans taken in the period. */
  km: { t: number; events: number; censored: number };
  kmDays: { t: number; events: number; censored: number };
  kmGroups: {
    dim: Grouping;
    g: string;
    t: number;
    events: number;
    censored: number;
  };
  /** Loans released in the period, by extra months. */
  released: { t: number; n: number };
  releasedByBracket: { bracket: number; t: number; n: number };
  yearMonth: { kind: 'loan' | 'release'; y: number; m: number; n: number };
  weekday: { kind: 'loan' | 'release'; dow: number; n: number };
  dayOfMonth: { kind: 'loan' | 'release'; dom: number; n: number };
  renewals: { n: number; renewed: number; same_day: number };
}

const survival = (t: string) =>
  `${t} AS t, SUM(release_date IS NOT NULL) AS events, SUM(release_date IS NULL) AS censored`;

export function releaseQueries(ctx: QueryContext) {
  const range = [ctx.from, ctx.to];
  const kmGroups = (Object.keys(groupExpr) as Grouping[])
    .map(
      (
        dim
      ) => `SELECT '${dim}' AS dim, ${groupExpr[dim]} AS g, ${survival('months')}
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ? GROUP BY g, months`
    )
    .join(' UNION ALL ');
  const calendar = (select: string, group: string) =>
    `SELECT 'loan' AS kind, ${select.replaceAll('$d', 'loan_date')}
       FROM ${FACTS} WHERE loan_date BETWEEN ? AND ? GROUP BY ${group}
     UNION ALL
     SELECT 'release' AS kind, ${select.replaceAll('$d', 'release_date')}
       FROM ${FACTS} WHERE release_date BETWEEN ? AND ? GROUP BY ${group}`;
  return {
    km: {
      sql: `SELECT ${survival('months')} FROM ${FACTS}
        WHERE loan_date BETWEEN ? AND ? GROUP BY months ORDER BY months`,
      params: range,
    },
    kmDays: {
      sql: `SELECT ${survival('days')} FROM ${FACTS}
        WHERE loan_date BETWEEN ? AND ? GROUP BY days ORDER BY days`,
      params: range,
    },
    kmGroups: {
      sql: kmGroups,
      params: (Object.keys(groupExpr) as Grouping[]).flatMap(() => range),
    },
    released: {
      sql: `SELECT months AS t, COUNT(*) AS n FROM ${FACTS}
        WHERE release_date BETWEEN ? AND ? GROUP BY months ORDER BY months`,
      params: range,
    },
    releasedByBracket: {
      sql: `SELECT bracket, months AS t, COUNT(*) AS n FROM ${FACTS}
        WHERE release_date BETWEEN ? AND ? GROUP BY bracket, months`,
      params: range,
    },
    yearMonth: {
      sql: calendar(
        `CAST(substr($d, 1, 4) AS INTEGER) AS y, CAST(substr($d, 6, 2) AS INTEGER) AS m, COUNT(*) AS n`,
        'y, m'
      ),
      params: [...range, ...range],
    },
    weekday: {
      sql: calendar(
        `CAST(strftime('%w', $d) AS INTEGER) AS dow, COUNT(*) AS n`,
        'dow'
      ),
      params: [...range, ...range],
    },
    dayOfMonth: {
      sql: calendar(
        `CAST(substr($d, 9, 2) AS INTEGER) AS dom, COUNT(*) AS n`,
        'dom'
      ),
      params: [...range, ...range],
    },
    renewals: {
      sql: `SELECT COUNT(*) AS n, COALESCE(SUM(is_renewed), 0) AS renewed,
          COALESCE(SUM(release_date = loan_date), 0) AS same_day
        FROM ${FACTS} WHERE release_date BETWEEN ? AND ?`,
      params: range,
    },
  };
}
