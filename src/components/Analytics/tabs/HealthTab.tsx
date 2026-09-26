import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { useAnalytics, useAnalyticsQueries } from '../AnalyticsContext.tsx';
import { HEALTH_CHECKS, healthCountQuery } from '../queries/health.ts';
import { STATUS } from '../chart/palette.ts';
import { count, rupees } from '../format.ts';
import { Insight } from '../ChartCard.tsx';

type HealthRows = Record<string, { n: number; amt: number | null }>;

function healthQueries() {
  return Object.fromEntries(
    HEALTH_CHECKS.map((c) => [c.id, healthCountQuery(c)])
  ) as {
    [K in keyof HealthRows]: ReturnType<typeof healthCountQuery>;
  };
}

export default function HealthTab() {
  const { openDrill } = useAnalytics();
  const { data, loading } = useAnalyticsQueries<HealthRows>(healthQueries, {
    usesFacts: false,
  });

  if (!data) return <div className="p-8 text-sm text-[#898781]">Checking…</div>;

  const problems = HEALTH_CHECKS.filter((c) => (data[c.id]?.[0]?.n ?? 0) > 0);

  return (
    <div className={`flex flex-col gap-3 ${loading ? 'opacity-50' : ''}`}>
      <Insight>
        These checks run over the whole database and ignore the filters above.{' '}
        {problems.length
          ? `${problems.length} of ${HEALTH_CHECKS.length} checks found something. Click one to see the rows.`
          : 'Everything checks out.'}
      </Insight>
      <div className="rounded-xl border border-black/10 bg-[#fcfcfb] divide-y divide-black/5">
        {HEALTH_CHECKS.map((check) => {
          const result = data[check.id]?.[0];
          const n = result?.n ?? 0;
          const ok = n === 0;
          const Icon = ok
            ? CircleCheck
            : check.level === 'error'
              ? CircleAlert
              : TriangleAlert;
          const color = ok
            ? STATUS.good
            : check.level === 'error'
              ? STATUS.critical
              : STATUS.serious;
          const amount =
            check.amountColumn && result?.amt
              ? check.amountColumn === 'Missing' ||
                check.amountColumn === 'Rows'
                ? `${count(result.amt)} ${check.amountColumn.toLowerCase()}`
                : rupees(result.amt)
              : null;
          return (
            <button
              key={check.id}
              type="button"
              disabled={ok}
              onClick={() =>
                openDrill({
                  title: check.label,
                  sql: check.sql,
                  usesFacts: false,
                })
              }
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left enabled:hover:bg-accent enabled:cursor-pointer"
            >
              <Icon size={18} style={{ color }} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#0b0b0b]">{check.label}</div>
                <div className="text-xs text-[#898781]">{check.detail}</div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold tabular-nums">
                  {ok
                    ? 'OK'
                    : `${count(n)} ${check.level === 'error' ? (n === 1 ? 'problem' : 'problems') : 'to check'}`}
                </div>
                {amount && !ok ? (
                  <div className="text-xs text-[#52514e]">{amount}</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
