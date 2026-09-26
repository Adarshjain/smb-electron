import { monthDiffSql } from '@/lib/analytics/facts.ts';

// Consistency checks over the whole database (they ignore the filters: a
// problem row is a problem whatever you are looking at). Each check has a
// SELECT that lists the offending rows; the count is taken from it.

export interface HealthCheck {
  id: string;
  label: string;
  detail: string;
  /** 'error' = the books are wrong; 'warning' = worth a look. */
  level: 'error' | 'warning';
  sql: string;
  /** Column summed into the headline (e.g. a rupee difference). */
  amountColumn?: string;
}

/** Posting interest to the day book from releases started on this date. */
export const LEDGER_RECON_FROM = '2025-12-01';

const liveBills = `bills b WHERE b.deleted IS NULL`;
const releaseJoin = `JOIN releases r ON r.serial = b.serial AND r.loan_no = b.loan_no AND r.deleted IS NULL`;
const expectedInterest = `ROUND(b.loan_amount * b.interest_rate / 100.0 * ${monthDiffSql('b.date', 'r.date')})`;
const loanCols = `b.serial || ' ' || b.loan_no AS "Loan", b.date AS "Loan date", b.company AS "Company",
  b.metal_type AS "Metal", b.loan_amount AS "Principal", b.interest_rate AS "Rate %"`;

export const HEALTH_CHECKS: HealthCheck[] = [
  {
    id: 'released-no-record',
    label: 'Marked released, but no release entry',
    detail: 'bills.released = 1 with no row in releases.',
    level: 'error',
    sql: `SELECT ${loanCols} FROM ${liveBills} AND b.released = 1 AND NOT EXISTS (
      SELECT 1 FROM releases r WHERE r.serial = b.serial AND r.loan_no = b.loan_no AND r.deleted IS NULL)`,
  },
  {
    id: 'open-with-record',
    label: 'Marked open, but has a release entry',
    detail: 'bills.released = 0 while a release row exists.',
    level: 'error',
    sql: `SELECT ${loanCols}, r.date AS "Release date" FROM bills b ${releaseJoin}
      WHERE b.deleted IS NULL AND b.released = 0`,
  },
  {
    id: 'orphan-release',
    label: 'Release entry with no loan',
    detail: 'A release row whose serial and loan number match no loan.',
    level: 'error',
    sql: `SELECT r.serial || ' ' || r.loan_no AS "Loan", r.date AS "Release date",
        r.loan_date AS "Loan date", r.company AS "Company", r.loan_amount AS "Principal",
        r.interest_amount AS "Interest"
      FROM releases r WHERE r.deleted IS NULL AND NOT EXISTS (
        SELECT 1 FROM bills b WHERE b.serial = r.serial AND b.loan_no = r.loan_no AND b.deleted IS NULL)`,
  },
  {
    id: 'release-before-loan',
    label: 'Released before the loan date',
    detail: 'Release date earlier than the loan date.',
    level: 'error',
    sql: `SELECT ${loanCols}, r.date AS "Release date" FROM bills b ${releaseJoin}
      WHERE b.deleted IS NULL AND r.date < b.date`,
  },
  {
    id: 'release-copy-mismatch',
    label: 'Release copy of the loan differs',
    detail: "The release row's loan date or principal doesn't match the loan.",
    level: 'error',
    sql: `SELECT ${loanCols}, r.loan_date AS "Release: loan date", r.loan_amount AS "Release: principal"
      FROM bills b ${releaseJoin}
      WHERE b.deleted IS NULL AND (r.loan_date <> b.date OR ABS(r.loan_amount - b.loan_amount) > 0.5)`,
  },
  {
    id: 'total-mismatch',
    label: 'Release total ≠ principal + interest',
    detail:
      'total_amount differs from principal plus interest by more than ₹1.',
    level: 'error',
    amountColumn: 'Difference',
    sql: `SELECT ${loanCols}, r.date AS "Release date", r.interest_amount AS "Interest",
        r.total_amount AS "Total", r.total_amount - r.loan_amount - r.interest_amount AS "Difference"
      FROM bills b ${releaseJoin}
      WHERE b.deleted IS NULL AND ABS(r.total_amount - r.loan_amount - r.interest_amount) > 1`,
  },
  {
    id: 'interest-under',
    label: 'Charged less interest than the rate says',
    detail:
      'Release interest below principal × rate × months (Release Loan formula).',
    level: 'warning',
    amountColumn: 'Short by',
    sql: `SELECT ${loanCols}, r.date AS "Release date", ${expectedInterest} AS "Expected",
        r.interest_amount AS "Charged", ${expectedInterest} - r.interest_amount AS "Short by"
      FROM bills b ${releaseJoin}
      WHERE b.deleted IS NULL AND r.interest_amount < ${expectedInterest} - 1
      ORDER BY "Short by" DESC`,
  },
  {
    id: 'interest-over',
    label: 'Charged more interest than the rate says',
    detail: 'Release interest above principal × rate × months.',
    level: 'warning',
    amountColumn: 'Over by',
    sql: `SELECT ${loanCols}, r.date AS "Release date", ${expectedInterest} AS "Expected",
        r.interest_amount AS "Charged", r.interest_amount - ${expectedInterest} AS "Over by"
      FROM bills b ${releaseJoin}
      WHERE b.deleted IS NULL AND r.interest_amount > ${expectedInterest} + 1
      ORDER BY "Over by" DESC`,
  },
  {
    id: 'first-month-mismatch',
    label: "First month's interest doesn't match the rate",
    detail:
      'first_month_interest differs from principal × rate by more than ₹1.',
    level: 'warning',
    sql: `SELECT ${loanCols}, b.first_month_interest AS "First month",
        ROUND(b.loan_amount * b.interest_rate / 100.0) AS "Expected"
      FROM ${liveBills} AND ABS(b.first_month_interest - ROUND(b.loan_amount * b.interest_rate / 100.0)) > 1`,
  },
  {
    id: 'rate-off-slab',
    label: "Rate isn't the slab rate for the amount",
    detail: 'No interest_rates slab matches the metal, principal and rate.',
    level: 'warning',
    sql: `SELECT ${loanCols},
        (SELECT ir.rate FROM interest_rates ir WHERE ir.deleted IS NULL AND ir.metal_type = b.metal_type
           AND b.loan_amount BETWEEN ir.from_ AND ir.to_) AS "Slab rate %"
      FROM ${liveBills} AND NOT EXISTS (
        SELECT 1 FROM interest_rates ir WHERE ir.deleted IS NULL AND ir.metal_type = b.metal_type
          AND b.loan_amount BETWEEN ir.from_ AND ir.to_ AND ir.rate = b.interest_rate)`,
  },
  {
    id: 'no-items',
    label: 'Loan with no items',
    detail: 'No bill_items rows for the loan.',
    level: 'error',
    sql: `SELECT ${loanCols} FROM ${liveBills} AND NOT EXISTS (
      SELECT 1 FROM bill_items i WHERE i.serial = b.serial AND i.loan_no = b.loan_no AND i.deleted IS NULL)`,
  },
  {
    id: 'no-customer',
    label: 'Loan with no customer',
    detail: 'customer_id missing or pointing at no customer.',
    level: 'error',
    sql: `SELECT ${loanCols}, b.customer_id AS "Customer id" FROM ${liveBills} AND NOT EXISTS (
      SELECT 1 FROM customers c WHERE c.id = b.customer_id AND c.deleted IS NULL)`,
  },
  {
    id: 'net-over-gross',
    label: 'Net weight above gross weight',
    detail: 'An item whose net weight is more than its gross weight.',
    level: 'warning',
    sql: `SELECT i.serial || ' ' || i.loan_no AS "Loan", i.product AS "Item", i.quantity AS "Qty",
        i.gross_weight AS "Gross", i.net_weight AS "Net", i.ignore_weight AS "Ignored"
      FROM bill_items i WHERE i.deleted IS NULL AND i.net_weight > i.gross_weight + 0.001`,
  },
  {
    id: 'no-weight',
    label: 'Loan with no weight recorded',
    detail: 'All items on the loan have zero gross weight.',
    level: 'warning',
    sql: `SELECT ${loanCols} FROM ${liveBills} AND NOT EXISTS (
      SELECT 1 FROM bill_items i WHERE i.serial = b.serial AND i.loan_no = b.loan_no
        AND i.deleted IS NULL AND i.gross_weight > 0)`,
  },
  {
    id: 'duplicate-customers',
    label: 'Possible duplicate customers',
    detail:
      'Same name, father/husband name and area on more than one customer.',
    level: 'warning',
    sql: `SELECT c.name AS "Name", c.fhtitle || ' ' || c.fhname AS "Relation", c.area AS "Area",
        COUNT(*) AS "Customers", GROUP_CONCAT(DISTINCT c.phone_no) AS "Phones"
      FROM customers c WHERE c.deleted IS NULL
      GROUP BY c.name, c.fhname, c.area HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC`,
  },
  {
    id: 'serial-gaps',
    label: 'Gaps in loan numbers',
    detail: 'Loan numbers skipped within a serial.',
    level: 'warning',
    amountColumn: 'Missing',
    sql: `WITH s AS (SELECT serial, loan_no, LEAD(loan_no) OVER (
          PARTITION BY serial ORDER BY loan_no) AS next FROM bills WHERE deleted IS NULL)
      SELECT serial AS "Serial", loan_no + 1 AS "From", next - 1 AS "To", next - loan_no - 1 AS "Missing"
      FROM s WHERE next - loan_no > 1 ORDER BY serial, loan_no`,
  },
  {
    id: 'ledger-interest',
    label: 'Day book interest ≠ release interest',
    detail: `Interest posted to the day book (9 ↔ 14) vs the day's releases, from ${LEDGER_RECON_FROM}.`,
    level: 'error',
    amountColumn: 'Difference',
    sql: `WITH rel AS (
        SELECT date, company, FLOOR(SUM(tax_interest_amount)) AS interest FROM releases
        WHERE deleted IS NULL AND date >= '${LEDGER_RECON_FROM}' GROUP BY date, company),
      ent AS (
        SELECT date, company, SUM(debit) AS debit FROM daily_entries
        WHERE main_code = 9 AND sub_code = 14 AND deleted IS NULL AND date >= '${LEDGER_RECON_FROM}'
        GROUP BY date, company)
      SELECT COALESCE(rel.date, ent.date) AS "Date", COALESCE(rel.company, ent.company) AS "Company",
        COALESCE(rel.interest, 0) AS "Release interest", COALESCE(ent.debit, 0) AS "Day book",
        COALESCE(rel.interest, 0) - COALESCE(ent.debit, 0) AS "Difference"
      FROM rel FULL OUTER JOIN ent ON rel.date = ent.date AND rel.company = ent.company
      WHERE ABS(COALESCE(rel.interest, 0) - COALESCE(ent.debit, 0)) > 0.005
      ORDER BY "Date" DESC`,
  },
  {
    id: 'unsynced',
    label: 'Rows waiting to sync',
    detail: 'Local changes not yet pushed to the cloud backup.',
    level: 'warning',
    amountColumn: 'Rows',
    sql: [
      'bills',
      'bill_items',
      'releases',
      'customers',
      'areas',
      'daily_entries',
      'account_head',
      'companies',
      'products',
      'interest_rates',
    ]
      .map(
        (t) =>
          `SELECT '${t}' AS "Table", COUNT(*) AS "Rows" FROM ${t} WHERE synced = 0`
      )
      .join(' UNION ALL ')
      .replace(/^/, 'SELECT * FROM (')
      .concat(') WHERE "Rows" > 0'),
  },
];

export function healthCountQuery(check: HealthCheck) {
  return {
    sql: check.amountColumn
      ? `SELECT COUNT(*) AS n, COALESCE(SUM("${check.amountColumn}"), 0) AS amt FROM (${check.sql})`
      : `SELECT COUNT(*) AS n, NULL AS amt FROM (${check.sql})`,
  };
}
