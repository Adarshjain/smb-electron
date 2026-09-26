import { FACTS } from '@/lib/analytics/facts.ts';
import type { Drill } from './AnalyticsContext.tsx';

/** A drill into the filtered loans matching `where`. */
export function factsDrill(
  title: string,
  where: string,
  params: unknown[] = []
): Drill {
  return {
    title,
    usesFacts: true,
    params,
    sql: `SELECT serial || ' ' || loan_no AS "Loan", loan_date AS "Loan date",
            release_date AS "Released", company AS "Company", metal_type AS "Metal",
            loan_amount AS "Principal", interest_rate AS "Rate %",
            months AS "Extra months", interest_amount AS "Interest paid",
            CASE WHEN release_date IS NULL THEN due_interest END AS "Interest due",
            net_weight AS "Net wt (g)", customer_name AS "Customer",
            fhtitle || ' ' || fhname AS "Relation", area AS "Area", phone_no AS "Phone"
          FROM ${FACTS} WHERE ${where}
          ORDER BY loan_date DESC, serial, loan_no`,
  };
}
