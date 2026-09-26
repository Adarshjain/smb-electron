import EChart from '../chart/EChart.tsx';
import { ChartCard, Insight, StatTile } from '../ChartCard.tsx';
import { useAnalytics, useAnalyticsQueries } from '../AnalyticsContext.tsx';
import { factsDrill } from '../drill.ts';
import {
  customerQueries,
  LAPSED_BINS,
  type CustomerRows,
} from '../queries/customers.ts';
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
import { INK, SERIES } from '../chart/palette.ts';
import {
  count,
  monthLabel,
  percent,
  rupees,
  rupeesCompact,
} from '../format.ts';

const TOP_AREAS = 20;

export default function CustomersTab() {
  const { openDrill } = useAnalytics();
  const { data, loading, ctx } =
    useAnalyticsQueries<CustomerRows>(customerQueries);

  if (!data) return <div className="p-8 text-sm text-[#898781]">Loading…</div>;

  const s = data.summary[0];
  const conc = data.concentration[0];
  const lapsedYear = data.lapsed
    .filter((r) => r.bin >= 2)
    .reduce((a, r) => a + r.n, 0);
  const areas = data.areas.slice(0, TOP_AREAS);
  const totalLent = data.areas.reduce((a, r) => a + r.amt, 0);
  const topAreaShare =
    areas.slice(0, 5).reduce((a, r) => a + r.amt, 0) / (totalLent || 1);

  const customerDrill = (row: {
    customer_id: string;
    name: string;
    relation: string;
  }) =>
    openDrill(
      factsDrill(`Loans of ${row.name} ${row.relation}`, 'customer_id = ?', [
        row.customer_id,
      ])
    );

  const topChart = (
    rows: {
      customer_id: string;
      name: string;
      relation: string;
      area: string;
      loans: number;
      amt: number;
    }[],
    color: string
  ) => (
    <EChart
      height={440}
      onClick={(e) => customerDrill(rows[e.dataIndex])}
      option={{
        grid: grid({ top: 8, right: 72 }),
        tooltip: {
          trigger: 'item',
          formatter: (p: { dataIndex: number }) => {
            const r = rows[p.dataIndex];
            return `<b>${rupees(r.amt)}</b> · ${count(r.loans)} loans<br/>${r.name} ${r.relation}<br/>${r.area ?? ''}`;
          },
        },
        yAxis: {
          type: 'category',
          inverse: true,
          data: rows.map((r) => r.name),
          axisLabel: { width: 120, overflow: 'truncate', color: INK.muted },
        },
        xAxis: rupeeAxis(),
        series: [
          bar(
            'Principal',
            rows.map((r) => r.amt),
            color,
            {
              itemStyle: { color, borderRadius: [0, 4, 4, 0] },
              label: {
                show: true,
                position: 'right',
                color: '#52514e',
                formatter: (p: { value: number }) => rupeesCompact(p.value),
              },
            }
          ),
        ],
      }}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-6 gap-3">
        <StatTile
          label="Customers who borrowed"
          value={count(s.customers)}
          detail={`${count(s.loans)} loans in the period`}
        />
        <StatTile
          label="Borrowed more than once"
          value={percent(s.customers ? s.repeat_customers / s.customers : NaN)}
          detail={`${count(s.repeat_customers)} customers`}
        />
        <StatTile
          label="Customers with open loans"
          value={count(s.active)}
          detail="on the snapshot date"
        />
        <StatTile
          label="Top 10% of customers hold"
          value={percent(conc?.top10)}
          detail={`of the open book · top 1% hold ${percent(conc?.top1)}`}
        />
        <StatTile
          label="Concentration (Gini)"
          value={
            conc?.gini === null || conc?.gini === undefined
              ? '–'
              : conc.gini.toFixed(2)
          }
          detail="0 = spread evenly · 1 = one customer"
        />
        <StatTile
          label="Gone quiet for over a year"
          value={count(lapsedYear)}
          detail="no open loans, no visit in 12+ months"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard
          title="Biggest customers by open principal"
          subtitle="On the snapshot date. Click a bar for the customer's loans."
          loading={loading}
          table={{
            columns: [
              'Customer',
              'Relation',
              'Area',
              'Loans',
              'Principal',
              'Interest owed',
            ],
            rows: data.topOutstanding.map((r) => [
              r.name,
              r.relation,
              r.area,
              r.loans,
              rupees(r.amt),
              rupees(r.due),
            ]),
          }}
        >
          {topChart(data.topOutstanding, SERIES[0])}
        </ChartCard>
        <ChartCard
          title="Biggest borrowers in the period"
          subtitle="Total principal of loans taken in the period"
          loading={loading}
          table={{
            columns: ['Customer', 'Relation', 'Area', 'Loans', 'Principal'],
            rows: data.topLifetime.map((r) => [
              r.name,
              r.relation,
              r.area,
              r.loans,
              rupees(r.amt),
            ]),
          }}
        >
          {topChart(data.topLifetime, SERIES[2])}
        </ChartCard>

        <ChartCard
          title="How concentrated the open book is"
          subtitle="Customers sorted from smallest to largest balance: the further the curve sags, the more a few customers hold"
          loading={loading}
        >
          <EChart
            height={280}
            option={{
              grid: grid({ top: 16, bottom: 28 }),
              tooltip: {
                trigger: 'axis',
                formatter: (p: { value: [number, number] }[]) => {
                  const v = p[0]?.value;
                  return v
                    ? `Smallest ${percent(v[0], 0)} of customers hold <b>${percent(v[1])}</b>`
                    : '';
                },
              },
              xAxis: {
                type: 'value',
                max: 1,
                axisLabel: {
                  formatter: (v: number) => `${Math.round(v * 100)}%`,
                },
                name: 'customers',
                nameLocation: 'middle',
                nameGap: 24,
              },
              yAxis: percentAxis({ max: 1 }),
              series: [
                line(
                  'Share of open principal',
                  data.lorenz.map((r) => [r.x, r.y]),
                  SERIES[0],
                  {
                    areaStyle: { color: SERIES[0], opacity: 0.1 },
                  }
                ),
                line(
                  'Equal shares',
                  [
                    [0, 0],
                    [1, 1],
                  ],
                  INK.axis,
                  { silent: true, lineStyle: { width: 1, color: INK.axis } }
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Loans per customer"
          subtitle="Loans each customer took in the period (15+ grouped)"
          loading={loading}
          table={{
            columns: ['Loans', 'Customers'],
            rows: data.loansPerCustomer.map((r) => [
              r.k === 15 ? '15+' : r.k,
              r.n,
            ]),
          }}
        >
          <EChart
            height={280}
            option={{
              grid: grid({ top: 16, bottom: 28 }),
              tooltip: {
                ...axisTooltip(count),
                axisPointer: { type: 'shadow' },
              },
              xAxis: {
                type: 'category',
                data: data.loansPerCustomer.map((r) =>
                  r.k === 15 ? '15+' : String(r.k)
                ),
                name: 'loans',
                nameLocation: 'middle',
                nameGap: 24,
              },
              yAxis: countAxis(),
              series: [
                bar(
                  'Customers',
                  data.loansPerCustomer.map((r) => r.n),
                  SERIES[0]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="First-time vs repeat borrowers each month"
          subtitle="Loans taken, split by whether it was the customer's first ever loan"
          loading={loading}
          table={{
            columns: ['Month', 'First loan', 'Repeat', 'Re-pledges'],
            rows: data.newVsRepeat.map((r) => [
              monthLabel(r.ym),
              r.first,
              r.repeat,
              r.repledge,
            ]),
          }}
        >
          <EChart
            height={260}
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: {
                ...axisTooltip(count),
                axisPointer: { type: 'shadow' },
              },
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: data.newVsRepeat.map((r) => monthLabel(r.ym)),
              },
              yAxis: countAxis(),
              series: [
                stackedBar(
                  'Repeat customer',
                  data.newVsRepeat.map((r) => r.repeat),
                  SERIES[0],
                  'who'
                ),
                stackedBar(
                  'First loan',
                  data.newVsRepeat.map((r) => r.first),
                  SERIES[1],
                  'who'
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Renewals"
          subtitle="Share of releases where the customer took a fresh loan the same day"
          loading={loading}
          table={{
            columns: ['Month', 'Releases', 'Renewals', 'Share'],
            rows: data.renewalMonthly.map((r) => [
              monthLabel(r.ym),
              r.n,
              r.renewed,
              percent(r.renewed / r.n),
            ]),
          }}
        >
          <EChart
            height={260}
            onClick={(e) => {
              const ym = data.renewalMonthly[e.dataIndex]?.ym;
              if (ym)
                openDrill(
                  factsDrill(
                    `Renewed releases in ${monthLabel(ym)}`,
                    'release_month = ? AND is_renewed = 1',
                    [ym]
                  )
                );
            }}
            option={{
              grid: grid({ top: 16 }),
              tooltip: axisTooltip((v) => percent(v)),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: data.renewalMonthly.map((r) => monthLabel(r.ym)),
                boundaryGap: false,
              },
              yAxis: percentAxis(),
              series: [
                line(
                  'Renewal share',
                  data.renewalMonthly.map((r) => r.renewed / r.n),
                  SERIES[0]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Time between visits"
          subtitle="Months between a customer's consecutive borrowing days (36+ grouped)"
          loading={loading}
          table={{
            columns: ['Months', 'Visits'],
            rows: data.gaps.map((r) => [r.bin === 36 ? '36+' : r.bin, r.n]),
          }}
        >
          <EChart
            height={240}
            option={{
              grid: grid({ top: 16, bottom: 28 }),
              tooltip: {
                ...axisTooltip(count),
                axisPointer: { type: 'shadow' },
              },
              xAxis: {
                type: 'category',
                data: data.gaps.map((r) =>
                  r.bin === 36 ? '36+' : String(r.bin)
                ),
                name: 'months',
                nameLocation: 'middle',
                nameGap: 24,
              },
              yAxis: countAxis(),
              series: [
                bar(
                  'Visits',
                  data.gaps.map((r) => r.n),
                  SERIES[0]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Customers with nothing open"
          subtitle="Time since their last loan or release"
          loading={loading}
          table={{
            columns: ['Last seen', 'Customers'],
            rows: data.lapsed.map((r) => [LAPSED_BINS[r.bin], r.n]),
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
              xAxis: { type: 'category', data: LAPSED_BINS },
              yAxis: countAxis(),
              series: [
                bar(
                  'Customers',
                  LAPSED_BINS.map(
                    (_, i) => data.lapsed.find((r) => r.bin === i)?.n ?? 0
                  ),
                  SERIES[0]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title={`Top ${TOP_AREAS} areas`}
          subtitle="Principal lent in the period, and what is still open from it. Click a bar for the loans."
          loading={loading}
          className="col-span-2"
          table={{
            columns: [
              'Area',
              'Town',
              'Customers',
              'Loans',
              'Lent',
              'Still open',
            ],
            rows: data.areas.map((r) => [
              r.area,
              r.town ?? '',
              r.customers,
              r.loans,
              rupees(r.amt),
              rupees(r.open_amt),
            ]),
          }}
        >
          <EChart
            height={320}
            onClick={(e) => {
              const a = areas[e.dataIndex];
              openDrill(
                factsDrill(
                  `Loans from ${a.area}`,
                  'area = ? AND loan_date BETWEEN ? AND ?',
                  [a.area, ctx.from, ctx.to]
                )
              );
            }}
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: {
                ...axisTooltip(rupees),
                axisPointer: { type: 'shadow' },
              },
              xAxis: {
                type: 'category',
                data: areas.map((a) => a.area),
                axisLabel: { rotate: 35, color: INK.muted, fontSize: 11 },
              },
              yAxis: rupeeAxis(),
              series: [
                bar(
                  'Lent',
                  areas.map((a) => a.amt),
                  SERIES[0],
                  { barGap: '10%' }
                ),
                bar(
                  'Still open',
                  areas.map((a) => a.open_amt),
                  SERIES[1]
                ),
              ],
            }}
          />
        </ChartCard>
      </div>
      {data.areas.length ? (
        <Insight>
          The top 5 areas account for {percent(topAreaShare)} of all lending in
          the period, led by {data.areas[0].area} (
          {rupeesCompact(data.areas[0].amt)} from{' '}
          {count(data.areas[0].customers)} customers).
        </Insight>
      ) : null}
    </div>
  );
}
