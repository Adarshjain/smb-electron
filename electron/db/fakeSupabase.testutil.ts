import type { SupabaseClient } from '@supabase/supabase-js';

// Minimal stand-in for the supabase-js query builder, capped at `pageCap`
// rows per response like PostgREST.
export function fakeSupabase(
  remote: Record<string, Record<string, unknown>[]>,
  pageCap = 1000
) {
  return {
    from(table: string) {
      const rows = remote[table] ?? [];
      const orders: string[] = [];
      let limit: number | undefined;
      let head = false;
      const builder = {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          head = Boolean(opts?.head);
          return builder;
        },
        order(column: string) {
          orders.push(column);
          return builder;
        },
        limit(n: number) {
          limit = n;
          return builder;
        },
        range(from: number, to: number) {
          const sorted = [...rows].sort((a, b) => {
            for (const c of orders) {
              if (a[c] === b[c]) continue;
              return String(a[c]) < String(b[c]) ? -1 : 1;
            }
            return 0;
          });
          const end = Math.min(to + 1, from + pageCap);
          return Promise.resolve({
            data: sorted.slice(from, end),
            error: null,
          });
        },
        then(resolve: (value: unknown) => void) {
          if (head) resolve({ count: rows.length, error: null });
          else resolve({ data: rows.slice(0, limit), error: null });
        },
      };
      return builder;
    },
  } as unknown as SupabaseClient;
}

export const bill = (
  loan_no: number,
  overrides: Record<string, unknown> = {}
) => ({
  serial: 'A',
  loan_no,
  date: '2026-01-01',
  customer_id: 'c1',
  loan_amount: 1000,
  interest_rate: 2,
  first_month_interest: 20,
  doc_charges: 5,
  metal_type: 'Gold',
  released: 0,
  company: 'SMB',
  ...overrides,
});
