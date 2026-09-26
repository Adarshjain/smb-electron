import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { batchQuery } from '@/hooks/dbUtil.ts';
import { errorToast } from '@/lib/myUtils.tsx';
import {
  buildFactsQueries,
  resolveContext,
  type AnalyticsFilters,
  type Query,
  type QueryContext,
} from '@/lib/analytics/facts.ts';

export interface Drill {
  title: string;
  /** Full SELECT; rows are shown as a table. */
  sql: string;
  params?: unknown[];
  /** Rebuild the filtered facts table before running `sql`. */
  usesFacts?: boolean;
}

interface AnalyticsContextValue {
  filters: AnalyticsFilters;
  setFilters: (filters: AnalyticsFilters) => void;
  asOf: string;
  /** Bumped by the refresh button so every tab re-queries. */
  refreshKey: number;
  openDrill: (drill: Drill) => void;
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null);

export function AnalyticsProvider({
  value,
  children,
}: {
  value: AnalyticsContextValue;
  children: ReactNode;
}) {
  return (
    <AnalyticsContext.Provider value={value}>
      {children}
    </AnalyticsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalytics(): AnalyticsContextValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx)
    throw new Error('useAnalytics must be used within AnalyticsProvider');
  return ctx;
}

export type Rows<T> = { [K in keyof T]: T[K][] };

/**
 * Runs a tab's aggregate queries in a single IPC call, after rebuilding the
 * facts table for the current filters. `build` must be a stable (module-level)
 * function. While a refetch is in flight the previous data is kept so charts
 * don't flash.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useAnalyticsQueries<T extends object>(
  build: (
    ctx: QueryContext,
    filters: AnalyticsFilters
  ) => { [K in keyof T]: Query },
  options: { usesFacts?: boolean } = { usesFacts: true }
): { data: Rows<T> | null; loading: boolean; ctx: QueryContext } {
  const { filters, asOf, refreshKey } = useAnalytics();
  const [data, setData] = useState<Rows<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const requestId = useRef(0);
  const ctx = resolveContext(filters, asOf);
  const usesFacts = options.usesFacts !== false;

  useEffect(() => {
    if (!asOf) return;
    const id = ++requestId.current;
    const queryContext = resolveContext(filters, asOf);
    const named = build(queryContext, filters);
    const keys = Object.keys(named) as (keyof T)[];
    const prelude = usesFacts ? buildFactsQueries(filters, asOf) : [];
    setLoading(true);
    batchQuery<unknown[][]>([...prelude, ...keys.map((k) => named[k])])
      .then((results) => {
        if (id !== requestId.current) return;
        const out = {} as Rows<T>;
        keys.forEach((key, i) => {
          out[key] = results[prelude.length + i] as Rows<T>[typeof key];
        });
        setData(out);
      })
      .catch(errorToast)
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [build, filters, asOf, refreshKey, usesFacts]);

  return { data, loading, ctx };
}
