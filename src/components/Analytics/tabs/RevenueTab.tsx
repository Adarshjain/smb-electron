import { useMemo } from 'react';
import EChart from '../chart/EChart.tsx';
import { ChartCard, Insight, StatTile } from '../ChartCard.tsx';
import { useAnalytics, useAnalyticsQueries } from '../AnalyticsContext.tsx';
import { factsDrill } from '../drill.ts';
import {
  revenueQueries,
  WAIVER_BINS,
  type RevenueRows,
} from '../queries/revenue.ts';
import { outstandingByCompany } from '../queries/shared.ts';
import { BRACKETS } from '@/lib/analytics/facts.ts';
import {
  axisTooltip,
  bar,
  countAxis,
  grid,
  legend,
  line,
  percentAxis,
  rupeeAxis,
  stackedBar,
  zoom,
} from '../chart/options.ts';
import {
  BRACKET_COLORS,
  DIVERGING,
  METAL_COLORS,
  SERIES,
} from '../chart/palette.ts';
import {
  count,
  monthLabel,
  monthRange,
  percent,
  rupees,
  rupeesCompact,
} from '../format.ts';

const WAIVER_WHERE = 'interest_amount < due_interest - 1';

export default function RevenueTab() {
  const { openDrill } = useAnalytics();
  const { data, loading, ctx } =
    useAnalyticsQueries<RevenueRows>(revenueQueries);

  const monthly = useMemo(() => {
    if (!data) return null;
    const keys = [
      ...data.byLoanMonth.map((r) => r.ym),
      ...data.byReleaseMonth.map((r) => r.ym),
    ].sort();
    const months = keys.length
      ? monthRange(keys[0], keys[keys.length - 1])
      : [];
    const loanBy = new Map(data.byLoanMonth.map((r) => [r.ym, r]));
    const relBy = new Map(data.byReleaseMonth.map((r) => [r.ym, r]));
    const book = outstandingByCompany(data.outstanding, months);
    return months.map((ym, i) => {
      const l = loanBy.get(ym);
      const r = relBy.get(ym);
      const outstanding = book.reduce((s, c) => s + (c.values[i] ?? 0), 0);
      const income = (l?.first_month ?? 0) + (r?.interest ?? 0);
      return {
        ym,
        upfront: l?.first_month ?? 0,
        doc: l?.doc ?? 0,
        atRelease: r?.interest ?? 0,
        tax: r?.tax_interest ?? 0,
        waived: r?.waived ?? 0,
        extra: r?.extra ?? 0,
        discounted: r?.discounted ?? 0,
        releases: r?.n ?? 0,
        outstanding,
        // The current month is still running, so its yield would read low.
        yieldAnnual:
          outstanding && ym < ctx.asOf.slice(0, 7)
            ? (income * 12) / outstanding
            : null,
      };
    });
  }, [data, ctx.asOf]);

  const ledger = useMemo(() => {
    if (!data) return null;
    const months = [...new Set(data.ledger.map((r) => r.ym))].sort();
    const value = (ym: string, grp: 'Income' | 'Expenses') => {
      const r = data.ledger.find((x) => x.ym === ym && x.grp === grp);
      if (!r) return 0;
      return grp === 'Income'
        ? Math.abs(r.credit - r.debit)
        : r.credit - r.debit;
    };
    return months.map((ym) => ({
      ym,
      income: value(ym, 'Income'),
      expenses: value(ym, 'Expenses'),
    }));
  }, [data]);

  if (!data || !monthly || !ledger)
    return <div className="p-8 text-sm text-[#898781]">Loading…</div>;

  const sum = (k: keyof (typeof monthly)[number]) =>
    monthly.reduce((s, m) => s + (typeof m[k] === 'number' ? m[k] : 0), 0);
  const upfront = sum('upfront');
  const atRelease = sum('atRelease');
  const doc = sum('doc');
  const waived = sum('waived');
  const extra = sum('extra');
  const discounted = sum('discounted');
  const releases = sum('releases');
  const complete = monthly.filter((m) => m.yieldAnnual !== null);
  const avgBook = complete.length
    ? complete.reduce((s, m) => s + m.outstanding, 0) / complete.length
    : 0;
  const annualYield =
    avgBook && complete.length
      ? ((complete.reduce((s, m) => s + m.upfront + m.atRelease, 0) /
          complete.length) *
          12) /
        avgBook
      : NaN;
  const booksIncome = ledger.reduce((s, m) => s + m.income, 0);
  const booksExpenses = ledger.reduce((s, m) => s + m.expenses, 0);

  const yieldRows = (dim: 'bracket' | 'metal') =>
    data.yieldBy.filter((r) => r.dim === dim);
  const monthlyRate = (r: { interest: number; loan_months: number }) =>
    r.loan_months ? r.interest / r.loan_months : 0;
  const topHeads = (grp: 'Income' | 'Expenses') =>
    data.heads.filter((h) => h.grp === grp && h.net > 0).slice(0, 10);

  const drillMonth = (ym: string, series: string) => {
    if (series === 'At release' || series === 'Waived') {
      openDrill(
        factsDrill(
          series === 'Waived'
            ? `Discounted releases in ${monthLabel(ym)}`
            : `Loans released in ${monthLabel(ym)}`,
          series === 'Waived'
            ? `release_month = ? AND ${WAIVER_WHERE}`
            : 'release_month = ?',
          [ym]
        )
      );
    } else {
      openDrill(
        factsDrill(`Loans taken in ${monthLabel(ym)}`, 'loan_month = ?', [ym])
      );
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-6 gap-3">
        <StatTile
          label="Interest earned"
          value={rupeesCompact(upfront + atRelease)}
          detail={`${rupeesCompact(upfront)} upfront · ${rupeesCompact(atRelease)} at release`}
        />
        <StatTile
          label="Document charges"
          value={rupeesCompact(doc)}
          detail="collected when lending"
        />
        <StatTile
          label="Yield on the book"
          value={percent(annualYield)}
          detail={`a year · average book ${rupeesCompact(avgBook)}`}
        />
        <StatTile
          label="Interest waived at release"
          value={rupeesCompact(waived)}
          detail={`${count(discounted)} of ${count(releases)} releases discounted`}
          onClick={() =>
            openDrill(
              factsDrill(
                'Discounted releases',
                `release_date BETWEEN ? AND ? AND ${WAIVER_WHERE}`,
                [ctx.from, ctx.to]
              )
            )
          }
        />
        <StatTile
          label="Charged above the rate"
          value={rupeesCompact(extra)}
          detail="above the Release Loan formula"
          onClick={() =>
            openDrill(
              factsDrill(
                'Releases charged above the rate',
                'release_date BETWEEN ? AND ? AND interest_amount > due_interest + 1',
                [ctx.from, ctx.to]
              )
            )
          }
        />
        <StatTile
          label="Books: income − expenses"
          value={rupeesCompact(booksIncome - booksExpenses)}
          detail={`${rupeesCompact(booksIncome)} income · ${rupeesCompact(booksExpenses)} expenses`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard
          title="Interest and charges collected each month"
          subtitle="Upfront interest and document charges by loan date; interest at release by release date. Click a bar for the loans."
          loading={loading}
          className="col-span-2"
          table={{
            columns: ['Month', 'Upfront', 'At release', 'Doc charges', 'Total'],
            rows: monthly.map((m) => [
              monthLabel(m.ym),
              rupees(m.upfront),
              rupees(m.atRelease),
              rupees(m.doc),
              rupees(m.upfront + m.atRelease + m.doc),
            ]),
          }}
        >
          <EChart
            height={300}
            onClick={(e) =>
              drillMonth(monthly[e.dataIndex].ym, e.seriesName ?? '')
            }
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: {
                ...axisTooltip(rupees),
                axisPointer: { type: 'shadow' },
              },
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: monthly.map((m) => monthLabel(m.ym)),
              },
              yAxis: rupeeAxis(),
              series: [
                stackedBar(
                  'Upfront (first month)',
                  monthly.map((m) => m.upfront),
                  SERIES[0],
                  'income'
                ),
                stackedBar(
                  'At release',
                  monthly.map((m) => m.atRelease),
                  SERIES[2],
                  'income'
                ),
                stackedBar(
                  'Document charges',
                  monthly.map((m) => m.doc),
                  SERIES[3],
                  'income'
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Yield on the book"
          subtitle="Interest earned in the month × 12 ÷ principal outstanding at month end"
          loading={loading}
          table={{
            columns: ['Month', 'Outstanding', 'Annualised yield'],
            rows: monthly.map((m) => [
              monthLabel(m.ym),
              rupees(m.outstanding),
              percent(m.yieldAnnual),
            ]),
          }}
        >
          <EChart
            height={260}
            option={{
              grid: grid({ top: 16 }),
              tooltip: axisTooltip((v) => percent(v)),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: monthly.map((m) => monthLabel(m.ym)),
                boundaryGap: false,
              },
              yAxis: percentAxis(),
              series: [
                line(
                  'Annualised yield',
                  monthly.map((m) => m.yieldAnnual),
                  SERIES[0]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Rate actually earned"
          subtitle="Interest collected ÷ (principal × months held), for loans released in the period"
          loading={loading}
          footer="Compare with the nominal rates: small loans pay 3%, loans of ₹5,000+ pay 2%."
          table={{
            columns: ['Group', 'Loans', 'Principal', 'Interest', 'Per month'],
            rows: [...yieldRows('bracket'), ...yieldRows('metal')].map((r) => [
              r.dim === 'bracket' ? BRACKETS[parseInt(r.g, 10) - 1].label : r.g,
              r.n,
              rupees(r.principal),
              rupees(r.interest),
              percent(monthlyRate(r), 2),
            ]),
          }}
        >
          <EChart
            height={260}
            option={{
              grid: grid({ top: 16, right: 56 }),
              tooltip: {
                trigger: 'item',
                valueFormatter: (v: number) => `${percent(v, 2)} a month`,
              },
              yAxis: {
                type: 'category',
                inverse: true,
                data: [
                  ...yieldRows('bracket').map(
                    (r) => BRACKETS[parseInt(r.g, 10) - 1].label
                  ),
                  ...yieldRows('metal').map((r) => r.g),
                ],
              },
              xAxis: percentAxis(),
              series: [
                bar(
                  'Earned per month',
                  [
                    ...yieldRows('bracket').map((r) => ({
                      value: monthlyRate(r),
                      itemStyle: {
                        color: BRACKET_COLORS[parseInt(r.g, 10) - 1],
                        borderRadius: [0, 4, 4, 0],
                      },
                    })),
                    ...yieldRows('metal').map((r) => ({
                      value: monthlyRate(r),
                      itemStyle: {
                        color: METAL_COLORS[r.g] ?? SERIES[2],
                        borderRadius: [0, 4, 4, 0],
                      },
                    })),
                  ],
                  SERIES[0],
                  {
                    label: {
                      show: true,
                      position: 'right',
                      color: '#52514e',
                      formatter: (p: { value: number }) => percent(p.value, 2),
                    },
                  }
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Interest waived each month"
          subtitle="Charged less than principal × rate × months at release. Click a bar for the loans."
          loading={loading}
          table={{
            columns: [
              'Month',
              'Waived',
              'Discounted releases',
              'Charged above',
            ],
            rows: monthly.map((m) => [
              monthLabel(m.ym),
              rupees(m.waived),
              m.discounted,
              rupees(m.extra),
            ]),
          }}
        >
          <EChart
            height={240}
            onClick={(e) => drillMonth(monthly[e.dataIndex].ym, 'Waived')}
            option={{
              grid: grid({ top: 16 }),
              tooltip: {
                ...axisTooltip(rupees),
                axisPointer: { type: 'shadow' },
              },
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: monthly.map((m) => monthLabel(m.ym)),
              },
              yAxis: rupeeAxis(),
              series: [
                bar(
                  'Waived',
                  monthly.map((m) => m.waived),
                  DIVERGING[4]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Size of each waiver"
          subtitle="Discounted releases in the period, by rupees waived"
          loading={loading}
          table={{
            columns: ['Waived', 'Releases', 'Total'],
            rows: data.waivers.map((w) => [
              WAIVER_BINS[w.bin],
              w.n,
              rupees(w.amt),
            ]),
          }}
        >
          <EChart
            height={240}
            option={{
              grid: grid({ top: 16 }),
              tooltip: {
                ...axisTooltip(count),
                axisPointer: { type: 'shadow' },
              },
              xAxis: { type: 'category', data: WAIVER_BINS },
              yAxis: countAxis(),
              series: [
                bar(
                  'Releases',
                  WAIVER_BINS.map(
                    (_, i) => data.waivers.find((w) => w.bin === i)?.n ?? 0
                  ),
                  DIVERGING[4]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Books: income and expenses"
          subtitle="From the day book, using the Profit & Loss rules (company filter applies)"
          loading={loading}
          className="col-span-2"
          table={{
            columns: ['Month', 'Income', 'Expenses', 'Net'],
            rows: ledger.map((m) => [
              monthLabel(m.ym),
              rupees(m.income),
              rupees(m.expenses),
              rupees(m.income - m.expenses),
            ]),
          }}
        >
          <EChart
            height={280}
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: axisTooltip(rupees),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: ledger.map((m) => monthLabel(m.ym)),
              },
              yAxis: rupeeAxis(),
              series: [
                bar(
                  'Income',
                  ledger.map((m) => m.income),
                  SERIES[2]
                ),
                bar(
                  'Expenses',
                  ledger.map((m) => m.expenses),
                  SERIES[1]
                ),
                line(
                  'Net',
                  ledger.map((m) => m.income - m.expenses),
                  SERIES[6],
                  { showSymbol: true, symbolSize: 6 }
                ),
              ],
            }}
          />
        </ChartCard>

        {(['Income', 'Expenses'] as const).map((grp) => {
          const heads = topHeads(grp);
          return (
            <ChartCard
              key={grp}
              title={
                grp === 'Income'
                  ? 'Biggest income heads'
                  : 'Biggest expense heads'
              }
              subtitle="Day book, for the period"
              loading={loading}
              table={{
                columns: ['Head', 'Amount'],
                rows: heads.map((h) => [h.name, rupees(h.net)]),
              }}
            >
              <EChart
                height={280}
                option={{
                  grid: grid({ top: 8, right: 24 }),
                  tooltip: { trigger: 'item', valueFormatter: rupees },
                  yAxis: {
                    type: 'category',
                    inverse: true,
                    data: heads.map((h) => h.name),
                  },
                  xAxis: rupeeAxis(),
                  series: [
                    bar(
                      'Amount',
                      heads.map((h) => h.net),
                      grp === 'Income' ? SERIES[2] : SERIES[1],
                      {
                        itemStyle: {
                          color: grp === 'Income' ? SERIES[2] : SERIES[1],
                          borderRadius: [0, 4, 4, 0],
                        },
                      }
                    ),
                  ],
                }}
              />
            </ChartCard>
          );
        })}
      </div>
      {waived > 0 ? (
        <Insight>
          {rupeesCompact(waived)} of interest was waived across{' '}
          {count(discounted)} releases (
          {percent(releases ? discounted / releases : NaN)} of releases) — about{' '}
          {percent(
            upfront + atRelease ? waived / (upfront + atRelease + waived) : NaN
          )}{' '}
          of what the rates would have earned.
        </Insight>
      ) : null}
    </div>
  );
}
