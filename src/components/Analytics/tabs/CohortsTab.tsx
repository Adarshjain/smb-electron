import { useMemo, useState } from 'react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import EChart from '../chart/EChart.tsx';
import { ChartCard, Insight } from '../ChartCard.tsx';
import { useAnalytics, useAnalyticsQueries } from '../AnalyticsContext.tsx';
import { factsDrill } from '../drill.ts';
import { cohortQueries, type CohortRows } from '../queries/cohorts.ts';
import { kaplanMeier, kmQuantile, survivalAt } from '@/lib/analytics/stats.ts';
import {
  axisTooltip,
  bar,
  countAxis,
  grid,
  line,
  percentAxis,
  zoom,
} from '../chart/options.ts';
import { SEQUENTIAL, SERIES } from '../chart/palette.ts';
import { count, monthLabel, percent } from '../format.ts';

const AGES = 24;

type Grain = 'month' | 'quarter';

function cohortKey(ym: string, grain: Grain): string {
  if (grain === 'month') return ym;
  const [y, m] = ym.split('-').map(Number);
  return `${y} Q${Math.ceil(m / 3)}`;
}

function cohortLabel(key: string, grain: Grain): string {
  return grain === 'month' ? monthLabel(key) : key;
}

/** Months from the start of `ym` to the start of `asOf`'s month. */
function monthsSince(ym: string, asOf: string): number {
  const [y, m] = ym.split('-').map(Number);
  const [ay, am] = asOf.split('-').map(Number);
  return (ay - y) * 12 + (am - m);
}

export default function CohortsTab() {
  const { openDrill } = useAnalytics();
  const { data, loading, ctx } = useAnalyticsQueries<CohortRows>(cohortQueries);
  const [grain, setGrain] = useState<Grain>('quarter');

  const cohorts = useMemo(() => {
    if (!data) return null;
    // Group rows by cohort; remember the youngest month in each so a cell is
    // only shown once every loan in the cohort could have reached that age.
    const groups = new Map<
      string,
      { months: Set<string>; rows: CohortRows['cohorts'][] }
    >();
    for (const r of data.cohorts) {
      const key = cohortKey(r.cohort, grain);
      const g = groups.get(key) ?? { months: new Set<string>(), rows: [] };
      g.months.add(r.cohort);
      g.rows.push(r);
      groups.set(key, g);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, g]) => {
        const youngest = [...g.months].sort().pop()!;
        const age = monthsSince(youngest, ctx.asOf);
        const n = g.rows.reduce((s, r) => s + r.n, 0);
        const km = kaplanMeier(
          g.rows.map((r) => ({
            t: r.t,
            events: r.released,
            censored: r.n - r.released,
          }))
        );
        const released = (k: number) =>
          g.rows
            .filter((r) => r.t <= k - 1)
            .reduce((s, r) => s + r.released, 0);
        return {
          key,
          months: [...g.months].sort(),
          n,
          age,
          byAge: Array.from({ length: AGES }, (_, i) =>
            i + 1 <= age ? released(i + 1) / n : null
          ),
          median: kmQuantile(km, 0.5),
          within3: age >= 3 ? 1 - survivalAt(km, 2) : null,
        };
      });
  }, [data, grain, ctx.asOf]);

  const customers = useMemo(() => {
    if (!data) return null;
    return data.customers.map((r) => ({
      ...r,
      rate12:
        monthsSince(r.cohort, ctx.asOf) >= 12 && r.customers
          ? r.back12 / r.customers
          : null,
    }));
  }, [data, ctx.asOf]);

  if (!cohorts || !customers)
    return <div className="p-8 text-sm text-[#898781]">Loading…</div>;

  const heat = cohorts.flatMap((c, row) =>
    c.byAge.map((v, col) => [
      col,
      row,
      v === null ? '-' : Math.round(v * 1000) / 10,
    ])
  );
  const recent = customers.filter((c) => c.rate12 !== null).slice(-12);
  const earlier = customers.filter((c) => c.rate12 !== null).slice(0, -12);
  const avg = (rows: typeof customers) => {
    const total = rows.reduce((s, r) => s + r.customers, 0);
    return total ? rows.reduce((s, r) => s + r.back12, 0) / total : NaN;
  };

  return (
    <div className="flex flex-col gap-3">
      <ChartCard
        title="How fast each batch of loans comes back"
        subtitle="Share of loans released by each month held, grouped by when they were taken. Blank = not old enough yet."
        loading={loading}
        actions={
          <NativeSelect
            value={grain}
            onChange={(e) => setGrain(e.target.value as Grain)}
            className="h-8 py-1 text-xs"
            aria-label="Cohort size"
          >
            <NativeSelectOption value="quarter">By quarter</NativeSelectOption>
            <NativeSelectOption value="month">By month</NativeSelectOption>
          </NativeSelect>
        }
        table={{
          columns: [
            'Taken',
            'Loans',
            ...[1, 3, 6, 12, 24].map((k) => `≤ ${k} mo`),
          ],
          rows: cohorts.map((c) => [
            cohortLabel(c.key, grain),
            c.n,
            ...[1, 3, 6, 12, 24].map((k) =>
              c.byAge[k - 1] === null ? '–' : percent(c.byAge[k - 1], 0)
            ),
          ]),
        }}
      >
        <EChart
          height={Math.max(260, cohorts.length * 22 + 80)}
          onClick={(e) => {
            const c = cohorts[(e.value as number[])[1]];
            openDrill(
              factsDrill(
                `Loans taken in ${cohortLabel(c.key, grain)}`,
                `loan_month IN (${c.months.map(() => '?').join(', ')})`,
                c.months
              )
            );
          }}
          option={{
            grid: grid({ top: 8, bottom: 48 }),
            tooltip: {
              trigger: 'item',
              formatter: (p: { value: [number, number, number | string] }) => {
                const c = cohorts[p.value[1]];
                return typeof p.value[2] === 'number'
                  ? `<b>${p.value[2]}%</b> released within ${p.value[0] + 1} months<br/>${cohortLabel(c.key, grain)} · ${count(c.n)} loans`
                  : '';
              },
            },
            xAxis: {
              type: 'category',
              data: Array.from({ length: AGES }, (_, i) => i + 1),
              name: 'months held',
              nameLocation: 'middle',
              nameGap: 24,
            },
            yAxis: {
              type: 'category',
              data: cohorts.map((c) => cohortLabel(c.key, grain)),
              inverse: true,
            },
            visualMap: {
              min: 0,
              max: 100,
              orient: 'horizontal',
              left: 'center',
              bottom: 0,
              itemHeight: 160,
              itemWidth: 10,
              text: ['100% released', '0%'],
              inRange: { color: SEQUENTIAL },
              textStyle: { color: '#898781', fontSize: 11 },
            },
            series: [
              {
                type: 'heatmap',
                data: heat,
                itemStyle: {
                  borderColor: '#fcfcfb',
                  borderWidth: 2,
                  borderRadius: 3,
                },
                emphasis: {
                  itemStyle: { borderColor: '#0b0b0b', borderWidth: 1 },
                },
              },
            ],
          }}
        />
      </ChartCard>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard
          title="Median months held, by batch"
          subtitle="Kaplan–Meier median for each batch; rising means loans are staying out longer"
          loading={loading}
          table={{
            columns: ['Taken', 'Median months', 'Released ≤ 3 months'],
            rows: cohorts.map((c) => [
              cohortLabel(c.key, grain),
              c.median === undefined ? 'not yet' : c.median + 1,
              c.within3 === null ? '–' : percent(c.within3, 0),
            ]),
          }}
        >
          <EChart
            height={240}
            option={{
              grid: grid({ top: 16 }),
              tooltip: axisTooltip((v) => `${v} months`),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: cohorts.map((c) => cohortLabel(c.key, grain)),
              },
              yAxis: countAxis({ minInterval: 1 }),
              series: [
                line(
                  'Median months held',
                  cohorts.map((c) =>
                    c.median === undefined ? null : c.median + 1
                  ),
                  SERIES[0],
                  { showSymbol: true }
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Released within 3 months, by batch"
          subtitle="Share of each batch back within three months held"
          loading={loading}
        >
          <EChart
            height={240}
            option={{
              grid: grid({ top: 16 }),
              tooltip: axisTooltip((v) => percent(v)),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: cohorts.map((c) => cohortLabel(c.key, grain)),
              },
              yAxis: percentAxis({ max: 1 }),
              series: [
                bar(
                  'Within 3 months',
                  cohorts.map((c) => c.within3),
                  SERIES[0]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="New customers each month"
          subtitle="Customers whose first loan (within the filters) was that month. Records start in Jan 2020, so the first months include long-standing customers."
          loading={loading}
          table={{
            columns: [
              'Month',
              'New customers',
              'Back within a year',
              'Came back ever',
            ],
            rows: customers.map((c) => [
              monthLabel(c.cohort),
              c.customers,
              c.rate12 === null ? '–' : percent(c.rate12, 0),
              percent(c.customers ? c.back / c.customers : NaN, 0),
            ]),
          }}
        >
          <EChart
            height={240}
            option={{
              grid: grid({ top: 16 }),
              tooltip: axisTooltip(count),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: customers.map((c) => monthLabel(c.cohort)),
              },
              yAxis: countAxis(),
              series: [
                bar(
                  'New customers',
                  customers.map((c) => c.customers),
                  SERIES[2]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="New customers who came back within a year"
          subtitle="Share who took another loan on a later day within 12 months of their first"
          loading={loading}
        >
          <EChart
            height={240}
            option={{
              grid: grid({ top: 16 }),
              tooltip: axisTooltip((v) => percent(v)),
              dataZoom: zoom,
              xAxis: {
                type: 'category',
                data: customers.map((c) => monthLabel(c.cohort)),
                boundaryGap: false,
              },
              yAxis: percentAxis({ max: 1 }),
              series: [
                line(
                  'Came back within a year',
                  customers.map((c) => c.rate12),
                  SERIES[2],
                  { connectNulls: false }
                ),
              ],
            }}
          />
        </ChartCard>
      </div>
      {recent.length && earlier.length ? (
        <Insight>
          In the latest 12 months that can be measured, {percent(avg(recent))}{' '}
          of new customers came back within a year, against{' '}
          {percent(avg(earlier))} before that.
        </Insight>
      ) : null}
    </div>
  );
}
