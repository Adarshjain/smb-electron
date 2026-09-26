import { useCallback, useMemo } from 'react';
import EChart, { type ChartClick } from '../chart/EChart.tsx';
import { ChartCard, Insight, StatTile } from '../ChartCard.tsx';
import { useAnalytics, useAnalyticsQueries } from '../AnalyticsContext.tsx';
import { factsDrill } from '../drill.ts';
import { overviewQueries, type OverviewRows } from '../queries/overview.ts';
import { outstandingByCompany } from '../queries/shared.ts';
import {
  axisTooltip,
  bar,
  grid,
  legend,
  line,
  areaWash,
  rupeeAxis,
  stackedBar,
  zoom,
} from '../chart/options.ts';
import {
  companyColor,
  DIVERGING,
  METAL_COLORS,
  SERIES,
} from '../chart/palette.ts';
import {
  count,
  grams,
  monthLabel,
  monthRange,
  percent,
  rupees,
  rupeesCompact,
} from '../format.ts';

const LENT = SERIES[2];
const RETURNED = SERIES[6];

export default function OverviewTab() {
  const { openDrill } = useAnalytics();
  const { data, loading, ctx } =
    useAnalyticsQueries<OverviewRows>(overviewQueries);

  const months = useMemo(() => {
    if (!data) return [];
    const all = [
      ...data.monthlyLoans.map((r) => r.ym),
      ...data.monthlyReleases.map((r) => r.ym),
      ...data.outstanding.map((r) => r.ym),
    ].sort();
    return all.length ? monthRange(all[0], all[all.length - 1]) : [];
  }, [data]);

  const flows = useMemo(() => {
    if (!data) return null;
    const lent = new Map(data.monthlyLoans.map((r) => [r.ym, r]));
    const returned = new Map(data.monthlyReleases.map((r) => [r.ym, r]));
    return months.map((ym) => ({
      ym,
      lent: lent.get(ym)?.amt ?? 0,
      lentN: lent.get(ym)?.n ?? 0,
      returned: returned.get(ym)?.amt ?? 0,
      returnedN: returned.get(ym)?.n ?? 0,
    }));
  }, [data, months]);

  const book = useMemo(
    () => (data ? outstandingByCompany(data.outstanding, months) : []),
    [data, months]
  );

  const onFlowClick = useCallback(
    (e: ChartClick) => {
      const ym = months[e.dataIndex];
      if (!ym) return;
      if (e.seriesName === 'Returned') {
        openDrill(
          factsDrill(
            `Loans released in ${monthLabel(ym)}`,
            'release_month = ?',
            [ym]
          )
        );
      } else {
        openDrill(
          factsDrill(`Loans taken in ${monthLabel(ym)}`, 'loan_month = ?', [ym])
        );
      }
    },
    [months, openDrill]
  );

  const openAtSnapshot = factsDrill(
    'Open loans',
    'loan_date <= ? AND (release_date IS NULL OR release_date > ?)',
    [ctx.snapshot, ctx.snapshot]
  );

  if (!data || !flows)
    return <div className="p-8 text-sm text-[#898781]">Loading…</div>;

  const s = data.snapshot[0];
  const lent = data.lent[0];
  const released = data.released[0];
  const collected = released.interest + lent.first_month + lent.doc;
  // Growth over the last 12 months shown (or the whole span if shorter).
  const lastIdx = months.length - 1;
  const firstIdx = Math.max(0, lastIdx - 12);
  const first = book.reduce((sum, c) => sum + (c.values[firstIdx] ?? 0), 0);
  const last = book.reduce((sum, c) => sum + (c.values[lastIdx] ?? 0), 0);
  const growth = first ? last / first - 1 : NaN;

  const metals = ['Gold', 'Silver', 'Other'].filter((m) =>
    data.mix.some((r) => r.metal_type === m)
  );
  const mixCompanies = [...new Set(data.mix.map((r) => r.company))]
    .sort()
    .reverse();

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-6 gap-3">
        <StatTile
          label="Outstanding principal"
          value={rupeesCompact(s.principal)}
          detail={`${count(s.loans)} open loans · ${count(s.customers)} customers`}
          onClick={() => openDrill(openAtSnapshot)}
        />
        <StatTile
          label="Interest owed on open loans"
          value={rupeesCompact(s.due)}
          detail={`${percent(s.principal ? s.due / s.principal : NaN)} of principal`}
        />
        <StatTile
          label="Pledged metal (net)"
          value={grams(s.gold)}
          detail={`gold · ${grams(s.silver)} silver`}
        />
        <StatTile
          label="Lent in period"
          value={rupeesCompact(lent.principal)}
          detail={`${count(lent.loans)} loans · avg ${rupees(lent.loans ? lent.principal / lent.loans : NaN)}`}
        />
        <StatTile
          label="Returned in period"
          value={rupeesCompact(released.principal)}
          detail={`${count(released.loans)} loans released`}
        />
        <StatTile
          label="Interest & charges collected"
          value={rupeesCompact(collected)}
          detail={`${rupeesCompact(released.interest)} at release · ${rupeesCompact(lent.first_month)} upfront`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard
          title="Loan book over time"
          subtitle="Principal outstanding at each month end, by company"
          loading={loading}
          footer={
            Number.isFinite(growth)
              ? `${growth >= 0 ? 'Grew' : 'Shrank'} ${percent(Math.abs(growth))} from ${rupeesCompact(first)} to ${rupeesCompact(last)} since ${months[firstIdx] ? monthLabel(months[firstIdx]) : 'the start'}.`
              : undefined
          }
          table={{
            columns: ['Month', ...book.map((c) => c.company), 'Total'],
            rows: months.map((ym, i) => [
              monthLabel(ym),
              ...book.map((c) => rupees(c.values[i])),
              rupees(book.reduce((sum, c) => sum + c.values[i], 0)),
            ]),
          }}
        >
          <EChart
            height={300}
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: axisTooltip(rupees),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: months.map(monthLabel),
                boundaryGap: false,
              },
              yAxis: rupeeAxis(),
              series: book.map((c, i) =>
                line(c.company, c.values, companyColor(c.company, i), {
                  stack: 'book',
                  ...areaWash(companyColor(c.company, i)),
                })
              ),
            }}
          />
        </ChartCard>

        <ChartCard
          title="Money lent vs returned each month"
          subtitle="Principal of loans taken (by loan date) and released (by release date). Click a bar for the loans."
          loading={loading}
          table={{
            columns: ['Month', 'Lent', 'Loans', 'Returned', 'Releases'],
            rows: flows.map((f) => [
              monthLabel(f.ym),
              rupees(f.lent),
              f.lentN,
              rupees(f.returned),
              f.returnedN,
            ]),
          }}
        >
          <EChart
            height={300}
            onClick={onFlowClick}
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: axisTooltip(rupees),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: flows.map((f) => monthLabel(f.ym)),
              },
              yAxis: rupeeAxis(),
              series: [
                bar(
                  'Lent',
                  flows.map((f) => f.lent),
                  LENT,
                  { barGap: '10%' }
                ),
                bar(
                  'Returned',
                  flows.map((f) => f.returned),
                  RETURNED
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Net change in the book"
          subtitle="Lent minus returned each month: above zero the book grew"
          loading={loading}
        >
          <EChart
            height={240}
            onClick={onFlowClick}
            option={{
              grid: grid({ top: 16 }),
              tooltip: axisTooltip(rupees),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: flows.map((f) => monthLabel(f.ym)),
              },
              yAxis: rupeeAxis(),
              series: [
                bar(
                  'Net change',
                  flows.map((f) => {
                    const v = f.lent - f.returned;
                    return {
                      value: v,
                      itemStyle: {
                        color: v >= 0 ? DIVERGING[0] : DIVERGING[4],
                        borderRadius: v >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4],
                      },
                    };
                  }),
                  DIVERGING[0]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="What the open book is made of"
          subtitle={`Principal outstanding on ${ctx.snapshot.split('-').reverse().join('/')}, by metal and company`}
          loading={loading}
          table={{
            columns: ['Metal', 'Company', 'Loans', 'Principal'],
            rows: data.mix.map((r) => [
              r.metal_type,
              r.company,
              r.n,
              rupees(r.amt),
            ]),
          }}
        >
          <EChart
            height={240}
            onClick={(e) =>
              openDrill(
                factsDrill(
                  `Open ${metals[e.dataIndex]} loans · ${e.seriesName}`,
                  'metal_type = ? AND company = ? AND loan_date <= ? AND (release_date IS NULL OR release_date > ?)',
                  [
                    metals[e.dataIndex],
                    e.seriesName,
                    ctx.snapshot,
                    ctx.snapshot,
                  ]
                )
              )
            }
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: {
                ...axisTooltip(rupees),
                axisPointer: { type: 'shadow' },
              },
              yAxis: { type: 'category', data: metals, inverse: true },
              xAxis: rupeeAxis(),
              series: mixCompanies.map((company, i) =>
                stackedBar(
                  company,
                  metals.map(
                    (m) =>
                      data.mix.find(
                        (r) => r.metal_type === m && r.company === company
                      )?.amt ?? 0
                  ),
                  companyColor(company, i),
                  'mix',
                  { barMaxWidth: 28 }
                )
              ),
            }}
          />
          <div className="flex gap-3 text-xs text-[#52514e] mt-1">
            {metals.map((m) => {
              const amt = data.mix
                .filter((r) => r.metal_type === m)
                .reduce((a, r) => a + r.amt, 0);
              return (
                <span key={m} className="flex items-center gap-1">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: METAL_COLORS[m] }}
                  />
                  {m}: {percent(s.principal ? amt / s.principal : NaN)} of the
                  book
                </span>
              );
            })}
          </div>
        </ChartCard>
      </div>
      {released.loans ? (
        <Insight>
          {percent(released.renewed / released.loans)} of releases in this
          period ({count(released.renewed)}) were renewals: the same customer
          took a new loan the same day. Counting those as money that came back
          overstates how much cash really returned.
        </Insight>
      ) : null}
    </div>
  );
}
