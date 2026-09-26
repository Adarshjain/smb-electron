import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useCompany } from '@/context/CompanyProvider.tsx';
import { viewableDate } from '@/lib/myUtils.tsx';
import {
  DEFAULT_FILTERS,
  type AnalyticsFilters,
} from '@/lib/analytics/facts.ts';
import { AnalyticsProvider, type Drill } from './AnalyticsContext.tsx';
import FilterBar from './FilterBar.tsx';
import DrillDialog from './DrillDialog.tsx';

const OverviewTab = lazy(() => import('./tabs/OverviewTab.tsx'));
const LoanBookTab = lazy(() => import('./tabs/LoanBookTab.tsx'));
const ReleasesTab = lazy(() => import('./tabs/ReleasesTab.tsx'));
const RevenueTab = lazy(() => import('./tabs/RevenueTab.tsx'));
const CohortsTab = lazy(() => import('./tabs/CohortsTab.tsx'));
const CustomersTab = lazy(() => import('./tabs/CustomersTab.tsx'));
const RiskTab = lazy(() => import('./tabs/RiskTab.tsx'));
const HealthTab = lazy(() => import('./tabs/HealthTab.tsx'));

const TABS = [
  { id: 'overview', label: 'Overview', Component: OverviewTab },
  { id: 'book', label: 'Loan book', Component: LoanBookTab },
  { id: 'releases', label: 'Release behaviour', Component: ReleasesTab },
  { id: 'revenue', label: 'Revenue', Component: RevenueTab },
  { id: 'cohorts', label: 'Cohorts', Component: CohortsTab },
  { id: 'customers', label: 'Customers & areas', Component: CustomersTab },
  { id: 'risk', label: 'Risk & forecast', Component: RiskTab },
  { id: 'health', label: 'Data health', Component: HealthTab },
];

const FILTERS_KEY = 'analytics.filters';
const TAB_KEY = 'analytics.tab';

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...(JSON.parse(raw) as T) } : fallback;
  } catch {
    return fallback;
  }
}

function store(key: string, value: unknown) {
  try {
    localStorage.setItem(
      key,
      typeof value === 'string' ? value : JSON.stringify(value)
    );
  } catch {
    /* remembering the view is a convenience only */
  }
}

export default function Analytics() {
  const { allCompanies } = useCompany();
  const [filters, setFiltersState] = useState<AnalyticsFilters>(() =>
    readStored(FILTERS_KEY, DEFAULT_FILTERS)
  );
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) ?? 'overview';
    } catch {
      return 'overview';
    }
  });
  const [drill, setDrill] = useState<Drill | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // The business date: open loans are aged to it and presets count back from it.
  const asOf = useMemo(
    () =>
      allCompanies.reduce(
        (latest, c) => (c.current_date > latest ? c.current_date : latest),
        ''
      ),
    [allCompanies]
  );

  useEffect(() => store(FILTERS_KEY, filters), [filters]);
  useEffect(() => store(TAB_KEY, tab), [tab]);

  const context = useMemo(
    () => ({
      filters,
      setFilters: setFiltersState,
      asOf,
      refreshKey,
      openDrill: setDrill,
    }),
    [filters, asOf, refreshKey]
  );

  return (
    <AnalyticsProvider value={context}>
      <div className="min-h-full bg-[#f9f9f7] p-3 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-[#0b0b0b]">Analytics</h1>
          {asOf ? (
            <span className="text-sm text-[#52514e]">
              Open loans aged to {viewableDate(asOf)}
            </span>
          ) : null}
          <div className="flex-1" />
          <Button
            variant="outline"
            className="h-8 border-input font-normal"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <RefreshCcw />
            Refresh
          </Button>
        </div>
        {asOf ? (
          <>
            <FilterBar
              filters={filters}
              onChange={setFiltersState}
              asOf={asOf}
            />
            <Tabs value={tab} onValueChange={setTab} className="gap-3">
              <TabsList className="h-10 w-full justify-start overflow-x-auto">
                {TABS.map((t) => (
                  <TabsTrigger
                    key={t.id}
                    value={t.id}
                    className="flex-none px-3"
                  >
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
              {TABS.map(({ id, Component }) => (
                <TabsContent key={id} value={id}>
                  <Suspense
                    fallback={
                      <div className="p-8 text-sm text-[#898781]">Loading…</div>
                    }
                  >
                    <Component />
                  </Suspense>
                </TabsContent>
              ))}
            </Tabs>
          </>
        ) : null}
      </div>
      <DrillDialog
        drill={drill}
        filters={filters}
        asOf={asOf}
        onClose={() => setDrill(null)}
      />
    </AnalyticsProvider>
  );
}
