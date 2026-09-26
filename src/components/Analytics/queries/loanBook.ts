import {
  FACTS,
  monthDiffSql,
  type QueryContext,
} from '@/lib/analytics/facts.ts';
import { openAt } from './shared.ts';

/** Age buckets on "extra months" (months charged after the first). */
export const AGE_BUCKETS = [
  { id: 1, label: 'Up to 3 months', min: 0, max: 2 },
  { id: 2, label: '3–6 months', min: 3, max: 5 },
  { id: 3, label: '6–12 months', min: 6, max: 11 },
  { id: 4, label: '1–1½ years', min: 12, max: 17 },
  { id: 5, label: '1½–2 years', min: 18, max: 23 },
  { id: 6, label: '2–3 years', min: 24, max: 35 },
  { id: 7, label: '3+ years', min: 36, max: null },
];

const ageBucketSql = (months: string) =>
  `CASE ${AGE_BUCKETS.map((b) =>
    b.max === null ? `ELSE ${b.id}` : `WHEN ${months} <= ${b.max} THEN ${b.id}`
  ).join(' ')} END`;

/** ₹250-wide bins up to ₹20,000; everything above goes in the last bin. */
export const AMOUNT_BIN = 250;
export const AMOUNT_BINS = 80;

export interface LoanBookRows {
  aging: {
    bucket: number;
    metal_type: string;
    n: number;
    amt: number;
    due: number;
  };
  brackets: { bracket: number; n: number; amt: number };
  amountHist: { bin: number; n: number };
  topAmounts: { loan_amount: number; n: number; take_home: number };
  grossUp: { y: string; n: number; gross: number };
  perGram: { ym: string; metal_type: string; rate: number; grams: number };
  rates: { interest_rate: number; metal_type: string; n: number; amt: number };
  products: { product: string; n: number; qty: number; grams: number };
}

// A loan is "grossed up" when the customer's take-home (principal minus the
// first month's interest and document charges) lands within ₹15 of a round
// ₹500, while the principal itself is not round.
const takeHome = 'loan_amount - first_month_interest - doc_charges';
const grossUpSql = `(ABS((${takeHome}) - ROUND((${takeHome}) / 500.0) * 500) <= 15
  AND CAST(loan_amount AS INTEGER) % 500 <> 0)`;

export function loanBookQueries(ctx: QueryContext) {
  const range = [ctx.from, ctx.to];
  const age = monthDiffSql('loan_date', 'p.d');
  return {
    aging: {
      sql: `WITH p(d) AS (SELECT ?)
        SELECT ${ageBucketSql(age)} AS bucket, metal_type, COUNT(*) AS n,
          SUM(loan_amount) AS amt,
          SUM(ROUND(loan_amount * interest_rate / 100.0 * ${age})) AS due
        FROM ${FACTS}, p WHERE ${openAt('p.d')}
        GROUP BY bucket, metal_type ORDER BY bucket`,
      params: [ctx.snapshot],
    },
    brackets: {
      sql: `WITH p(d) AS (SELECT ?)
        SELECT bracket, COUNT(*) AS n, SUM(loan_amount) AS amt
        FROM ${FACTS}, p WHERE ${openAt('p.d')}
        GROUP BY bracket ORDER BY bracket`,
      params: [ctx.snapshot],
    },
    amountHist: {
      sql: `SELECT MIN(CAST(loan_amount / ${AMOUNT_BIN} AS INTEGER), ${AMOUNT_BINS}) AS bin,
          COUNT(*) AS n
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY bin ORDER BY bin`,
      params: range,
    },
    topAmounts: {
      sql: `SELECT loan_amount, COUNT(*) AS n,
          ROUND(AVG(${takeHome})) AS take_home
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY loan_amount ORDER BY n DESC LIMIT 20`,
      params: range,
    },
    grossUp: {
      sql: `SELECT substr(loan_date, 1, 4) AS y, COUNT(*) AS n,
          SUM(${grossUpSql}) AS gross
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY y ORDER BY y`,
      params: range,
    },
    perGram: {
      sql: `SELECT loan_month AS ym, metal_type,
          SUM(loan_amount) / SUM(net_weight) AS rate, SUM(net_weight) AS grams
        FROM ${FACTS}
        WHERE loan_date BETWEEN ? AND ? AND net_weight > 0 AND metal_type <> 'Other'
        GROUP BY loan_month, metal_type ORDER BY loan_month`,
      params: range,
    },
    rates: {
      sql: `SELECT interest_rate, metal_type, COUNT(*) AS n, SUM(loan_amount) AS amt
        FROM ${FACTS} WHERE loan_date BETWEEN ? AND ?
        GROUP BY interest_rate, metal_type ORDER BY interest_rate`,
      params: range,
    },
    products: {
      sql: `SELECT TRIM(i.product) AS product, COUNT(DISTINCT f.serial || '-' || f.loan_no) AS n,
          SUM(i.quantity) AS qty, SUM(i.net_weight) AS grams
        FROM bill_items i
        JOIN ${FACTS} f ON f.serial = i.serial AND f.loan_no = i.loan_no
        WHERE i.deleted IS NULL AND f.loan_date BETWEEN ? AND ?
        GROUP BY TRIM(i.product) ORDER BY n DESC LIMIT 15`,
      params: range,
    },
  };
}

export { grossUpSql, ageBucketSql };
