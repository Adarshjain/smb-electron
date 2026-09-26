import { useMemo, useState } from 'react';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import EChart from '../chart/EChart.tsx';
import { ChartCard, Insight, StatTile } from '../ChartCard.tsx';
import { useAnalytics, useAnalyticsQueries } from '../AnalyticsContext.tsx';
import { factsDrill } from '../drill.ts';
import {
  GROUPINGS,
  releaseQueries,
  type Grouping,
  type ReleaseRows,
} from '../queries/releases.ts';
import { BRACKETS } from '@/lib/analytics/facts.ts';
import {
  boxFromCounts,
  chiSquareGoodnessOfFit,
  describePValue,
  hazard,
  kaplanMeier,
  kmQuantile,
  kruskalWallis,
  logRank,
  percentileFromCounts,
  survivalAt,
  type KmPoint,
  type SurvivalCount,
} from '@/lib/analytics/stats.ts';
import {
  axisTooltip,
  bar,
  countAxis,
  grid,
  legend,
  line,
  markLines,
  percentAxis,
} from '../chart/options.ts';
import {
  BRACKET_COLORS,
  companyColor,
  METAL_COLORS,
  SEQUENTIAL,
  SERIES,
} from '../chart/palette.ts';
import { count, monthName, monthRange, percent, WEEKDAYS } from '../format.ts';

// Months here are "months held": 1 = released within the first month (only
// the upfront interest paid), 2 = one extra month charged, and so on.
const held = (t: number | undefined) => (t === undefined ? undefined : t + 1);
const MAX_MONTHS = 48;

interface GroupStat {
  key: string;
  label: string;
  color: string;
  rows: SurvivalCount[];
  km: KmPoint[];
  n: number;
  released: number;
}

function groupLabel(dim: Grouping, key: string): string {
  if (dim === 'bracket') return BRACKETS[parseInt(key, 10) - 1]?.label ?? key;
  return key;
}

function groupOrder(dim: Grouping, a: string, b: string): number {
  if (dim === 'bracket' || dim === 'year')
    return a.localeCompare(b, undefined, { numeric: true });
  if (dim === 'rate') return parseFloat(a) - parseFloat(b);
  return a.localeCompare(b);
}

function groupColor(dim: Grouping, key: string, index: number): string {
  if (dim === 'bracket')
    return BRACKET_COLORS[parseInt(key, 10) - 1] ?? SERIES[index % 8];
  if (dim === 'metal') return METAL_COLORS[key] ?? SERIES[index % 8];
  if (dim === 'company') return companyColor(key, index);
  return SERIES[index % SERIES.length];
}

const fmtHeld = (t: number | undefined) =>
  t === undefined ? 'not yet' : `${t} ${t === 1 ? 'month' : 'months'}`;

export default function ReleasesTab() {
  const { openDrill } = useAnalytics();
  const { data, loading, ctx } =
    useAnalyticsQueries<ReleaseRows>(releaseQueries);
  const [dim, setDim] = useState<Grouping>('bracket');

  const overall = useMemo(() => {
    if (!data) return null;
    const km = kaplanMeier(data.km);
    const kmDays = kaplanMeier(data.kmDays);
    const n = data.km.reduce((s, r) => s + r.events + r.censored, 0);
    const released = data.km.reduce((s, r) => s + r.events, 0);
    const naive = data.released.map((r) => ({ value: r.t, count: r.n }));
    return {
      km,
      kmDays,
      n,
      released,
      p: [0.25, 0.5, 0.75, 0.9].map((p) => held(kmQuantile(km, p))),
      days: [0.25, 0.5, 0.75, 0.9].map((p) => kmQuantile(kmDays, p)),
      naiveMedian: held(percentileFromCounts(naive, 0.5)),
      hazard: hazard(km).filter((h) => h.t < 36),
    };
  }, [data]);

  const groups = useMemo<GroupStat[]>(() => {
    if (!data) return [];
    const byKey = new Map<string, SurvivalCount[]>();
    for (const r of data.kmGroups) {
      if (r.dim !== dim || r.g === null) continue;
      const list = byKey.get(r.g) ?? [];
      list.push({ t: r.t, events: r.events, censored: r.censored });
      byKey.set(r.g, list);
    }
    return [...byKey.keys()]
      .sort((a, b) => groupOrder(dim, a, b))
      .map((key, i) => {
        const rows = byKey.get(key)!;
        return {
          key,
          label: groupLabel(dim, key),
          color: groupColor(dim, key, i),
          rows,
          km: kaplanMeier(rows),
          n: rows.reduce((s, r) => s + r.events + r.censored, 0),
          released: rows.reduce((s, r) => s + r.events, 0),
        };
      });
  }, [data, dim]);

  const test = useMemo(() => logRank(groups.map((g) => g.rows)), [groups]);

  const box = useMemo(() => {
    if (!data) return null;
    const byBracket = BRACKETS.map((b) =>
      data.releasedByBracket
        .filter((r) => r.bracket === b.id)
        .map((r) => ({ value: r.t + 1, count: r.n }))
    );
    return {
      stats: byBracket.map((g) => boxFromCounts(g)),
      kw: kruskalWallis(byBracket),
    };
  }, [data]);

  const season = useMemo(() => {
    if (!data?.yearMonth.length) return null;
    const currentMonth = ctx.asOf.slice(0, 7);
    const ym = (r: { y: number; m: number }) =>
      `${r.y}-${String(r.m).padStart(2, '0')}`;
    const complete = data.yearMonth.filter((r) => ym(r) < currentMonth);
    const months = complete.map(ym).sort();
    const span = months.length
      ? monthRange(months[0], months[months.length - 1])
      : [];
    const occurrences = Array.from(
      { length: 12 },
      (_, m) => span.filter((s) => parseInt(s.slice(5), 10) === m + 1).length
    );
    const perMonth = (kind: 'loan' | 'release') =>
      Array.from({ length: 12 }, (_, m) =>
        complete
          .filter((r) => r.kind === kind && r.m === m + 1)
          .reduce((s, r) => s + r.n, 0)
      );
    const loans = perMonth('loan');
    const releases = perMonth('release');
    const expected = (observed: number[]) => {
      const total = observed.reduce((s, v) => s + v, 0);
      const occ = occurrences.reduce((s, v) => s + v, 0);
      return occurrences.map((o) => (total * o) / occ);
    };
    const years = [...new Set(data.yearMonth.map((r) => r.y))].sort();
    return {
      avgLoans: loans.map((v, i) => (occurrences[i] ? v / occurrences[i] : 0)),
      avgReleases: releases.map((v, i) =>
        occurrences[i] ? v / occurrences[i] : 0
      ),
      loanTest: chiSquareGoodnessOfFit(loans, expected(loans)),
      releaseTest: chiSquareGoodnessOfFit(releases, expected(releases)),
      years,
      heat: data.yearMonth
        .filter((r) => r.kind === 'release')
        .map((r) => [r.m - 1, years.indexOf(r.y), r.n]),
      heatMax: Math.max(
        ...data.yearMonth.filter((r) => r.kind === 'release').map((r) => r.n),
        1
      ),
    };
  }, [data, ctx.asOf]);

  if (!data || !overall || !box)
    return <div className="p-8 text-sm text-[#898781]">Loading…</div>;

  const within = (k: number) => 1 - survivalAt(overall.km, k - 1);
  const maxT = Math.min(MAX_MONTHS, Math.max(0, ...overall.km.map((p) => p.t)));
  const xMonths = Array.from({ length: maxT + 1 }, (_, i) => i + 1);
  const releasedHist = xMonths.map(
    (m) => data.released.find((r) => r.t === m - 1)?.n ?? 0
  );
  const releasedTail = data.released
    .filter((r) => r.t + 1 > xMonths.length)
    .reduce((s, r) => s + r.n, 0);
  if (releasedTail) releasedHist[releasedHist.length - 1] += releasedTail;
  const naive = data.released.map((r) => ({ value: r.t + 1, count: r.n }));
  const naiveP = [0.5, 0.75, 0.9].map((p) => percentileFromCounts(naive, p));
  const renew = data.renewals[0];
  const peakHazard = overall.hazard
    .filter((h) => h.t >= 1 && h.atRisk >= 30)
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);

  const weekday = (kind: 'loan' | 'release') =>
    WEEKDAYS.map(
      (_, d) => data.weekday.find((r) => r.kind === kind && r.dow === d)?.n ?? 0
    );
  const dom = (kind: 'loan' | 'release') =>
    Array.from(
      { length: 31 },
      (_, d) =>
        data.dayOfMonth.find((r) => r.kind === kind && r.dom === d + 1)?.n ?? 0
    );
  const monSat = weekday('release').slice(1);
  const weekdayTest = chiSquareGoodnessOfFit(monSat);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-6 gap-3">
        <StatTile
          label="Median time to release"
          value={fmtHeld(overall.p[1])}
          detail={
            overall.days[1] !== undefined
              ? `≈ ${overall.days[1]} days`
              : 'fewer than half released'
          }
        />
        <StatTile
          label="A quarter are back within"
          value={fmtHeld(overall.p[0])}
          detail={
            overall.days[0] !== undefined
              ? `≈ ${overall.days[0]} days`
              : undefined
          }
        />
        <StatTile
          label="Three quarters within"
          value={fmtHeld(overall.p[2])}
          detail={
            overall.days[2] !== undefined
              ? `≈ ${overall.days[2]} days`
              : undefined
          }
        />
        <StatTile
          label="90% within"
          value={fmtHeld(overall.p[3])}
          detail={
            overall.days[3] !== undefined
              ? `≈ ${overall.days[3]} days`
              : undefined
          }
        />
        <StatTile
          label="Released in the first month"
          value={percent(within(1))}
          detail={`${percent(within(6), 0)} in 6 months · ${percent(within(12), 0)} in a year`}
        />
        <StatTile
          label="Loans in this group"
          value={count(overall.n)}
          detail={`${count(overall.n - overall.released)} still open`}
          onClick={() =>
            openDrill(
              factsDrill(
                'Loans taken in the period',
                'loan_date BETWEEN ? AND ?',
                [ctx.from, ctx.to]
              )
            )
          }
        />
      </div>
      <Insight>
        These figures follow every loan taken in the period, including the ones
        still open, so long-running loans aren't left out (Kaplan–Meier method).
        Looking only at loans already released gives a median of{' '}
        {fmtHeld(overall.naiveMedian)}
        {overall.naiveMedian !== overall.p[1]
          ? ', which understates how long loans stay out'
          : ''}
        .
      </Insight>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard
          title="Share of loans still open over time"
          subtitle={`By ${GROUPINGS[dim].toLowerCase()} · loans taken in the period`}
          loading={loading}
          actions={
            <NativeSelect
              value={dim}
              onChange={(e) => setDim(e.target.value as Grouping)}
              className="h-8 py-1 text-xs"
              aria-label="Group by"
            >
              {(Object.keys(GROUPINGS) as Grouping[]).map((g) => (
                <NativeSelectOption key={g} value={g}>
                  By {GROUPINGS[g].toLowerCase()}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          }
          footer={
            <>
              Are the curves really different? Log-rank test:{' '}
              {describePValue(test.p)} (χ² = {test.statistic.toFixed(1)},{' '}
              {test.df} df).
            </>
          }
        >
          <EChart
            height={320}
            option={{
              grid: grid({ top: 48, bottom: 28 }),
              legend: legend(),
              tooltip: axisTooltip((v) => percent(v)),
              xAxis: {
                type: 'category',
                data: xMonths,
                name: 'months held',
                nameLocation: 'middle',
                nameGap: 24,
                boundaryGap: false,
              },
              yAxis: percentAxis({ max: 1 }),
              series: groups.map((g) =>
                line(
                  g.label,
                  xMonths.map((m) => survivalAt(g.km, m - 1)),
                  g.color,
                  { step: 'end' }
                )
              ),
            }}
          />
        </ChartCard>

        <ChartCard
          title="Percentiles by group"
          subtitle="Months held until release (Kaplan–Meier). “Not yet” = too few released to tell."
          loading={loading}
        >
          <div className="max-h-[340px] overflow-auto">
            <Table className="text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>{GROUPINGS[dim]}</TableHead>
                  <TableHead className="text-right">Loans</TableHead>
                  <TableHead className="text-right">Released</TableHead>
                  <TableHead className="text-right">p25</TableHead>
                  <TableHead className="text-right">Median</TableHead>
                  <TableHead className="text-right">p75</TableHead>
                  <TableHead className="text-right">p90</TableHead>
                  <TableHead className="text-right">≤ 3 mo</TableHead>
                  <TableHead className="text-right">≤ 12 mo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groups.map((g) => (
                  <TableRow key={g.key}>
                    <TableCell className="py-1">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="size-2 rounded-full"
                          style={{ background: g.color }}
                        />
                        {g.label}
                      </span>
                    </TableCell>
                    <TableCell className="py-1 text-right tabular-nums">
                      {count(g.n)}
                    </TableCell>
                    <TableCell className="py-1 text-right tabular-nums">
                      {percent(g.released / g.n, 0)}
                    </TableCell>
                    {[0.25, 0.5, 0.75, 0.9].map((p) => (
                      <TableCell
                        key={p}
                        className="py-1 text-right tabular-nums"
                      >
                        {held(kmQuantile(g.km, p)) ?? 'not yet'}
                      </TableCell>
                    ))}
                    <TableCell className="py-1 text-right tabular-nums">
                      {percent(1 - survivalAt(g.km, 2), 0)}
                    </TableCell>
                    <TableCell className="py-1 text-right tabular-nums">
                      {percent(1 - survivalAt(g.km, 11), 0)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </ChartCard>

        <ChartCard
          title="Chance of release, month by month"
          subtitle="Of the loans still open going into each month, the share released that month"
          loading={loading}
          footer={
            peakHazard.length
              ? `After the first month, releases peak in month ${peakHazard.map((h) => h.t + 1).join(', ')}.`
              : undefined
          }
          table={{
            columns: ['Month held', 'Open going in', 'Released', 'Chance'],
            rows: overall.hazard.map((h) => [
              h.t + 1,
              h.atRisk,
              overall.km.find((p) => p.t === h.t)?.events ?? 0,
              percent(h.rate),
            ]),
          }}
        >
          <EChart
            height={260}
            onClick={(e) => {
              const t = overall.hazard[e.dataIndex].t;
              openDrill(
                factsDrill(
                  `Released in month ${t + 1}`,
                  'months = ? AND release_date IS NOT NULL AND loan_date BETWEEN ? AND ?',
                  [t, ctx.from, ctx.to]
                )
              );
            }}
            option={{
              grid: grid({ top: 16, bottom: 28 }),
              tooltip: {
                trigger: 'item',
                formatter: (p: { dataIndex: number }) => {
                  const h = overall.hazard[p.dataIndex];
                  return `<b>${percent(h.rate)}</b> released in month ${h.t + 1}<br/>${count(h.atRisk)} loans were still open`;
                },
              },
              xAxis: {
                type: 'category',
                data: overall.hazard.map((h) => h.t + 1),
                name: 'month held',
                nameLocation: 'middle',
                nameGap: 24,
              },
              yAxis: percentAxis(),
              series: [
                bar(
                  'Chance of release',
                  overall.hazard.map((h) => h.rate),
                  SERIES[0]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Months held, for loans released in the period"
          subtitle="By release date. Lines mark the median, p75 and p90 of these released loans."
          loading={loading}
          table={{
            columns: ['Months held', 'Loans'],
            rows: xMonths.map((m, i) => [
              i === xMonths.length - 1 && releasedTail ? `${m}+` : m,
              releasedHist[i],
            ]),
          }}
        >
          <EChart
            height={260}
            onClick={(e) => {
              const t = e.dataIndex;
              openDrill(
                factsDrill(
                  `Released after ${t + 1} months held`,
                  'months = ? AND release_date BETWEEN ? AND ?',
                  [t, ctx.from, ctx.to]
                )
              );
            }}
            option={{
              grid: grid({ top: 24, bottom: 28 }),
              tooltip: {
                ...axisTooltip(count),
                axisPointer: { type: 'shadow' },
              },
              xAxis: {
                type: 'category',
                data: xMonths,
                name: 'months held',
                nameLocation: 'middle',
                nameGap: 24,
              },
              yAxis: countAxis(),
              series: [
                bar('Loans', releasedHist, SERIES[0], {
                  barCategoryGap: '10%',
                  markLine: markLines(
                    naiveP
                      .map((v, i) => ({
                        v,
                        label: ['median', 'p75', 'p90'][i],
                      }))
                      .filter((x) => x.v !== undefined && x.v <= xMonths.length)
                      .map((x) => ({
                        x: String(x.v),
                        label: `${x.label} ${x.v}`,
                      }))
                  ),
                }),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Months held by loan size"
          subtitle="Released loans in the period. Box = middle half, line = median, whiskers = p5–p95."
          loading={loading}
          footer={
            <>
              Do bigger loans stay out longer? Kruskal–Wallis:{' '}
              {describePValue(box.kw.p)} (H = {box.kw.statistic.toFixed(1)}).
            </>
          }
          table={{
            columns: ['Bracket', 'p5', 'p25', 'Median', 'p75', 'p95'],
            rows: BRACKETS.map((b, i) => [
              b.label,
              ...(box.stats[i] ?? ['–', '–', '–', '–', '–']),
            ]),
          }}
        >
          <EChart
            height={260}
            option={{
              grid: grid({ top: 16 }),
              tooltip: {
                trigger: 'item',
                formatter: (p: { dataIndex: number }) => {
                  const s = box.stats[p.dataIndex];
                  if (!s) return '';
                  return `<b>${BRACKETS[p.dataIndex].label}</b><br/>median ${s[2]} months<br/>middle half ${s[1]}–${s[3]} months<br/>p5–p95 ${s[0]}–${s[4]} months`;
                },
              },
              xAxis: { type: 'category', data: BRACKETS.map((b) => b.label) },
              yAxis: countAxis(),
              series: [
                {
                  type: 'boxplot',
                  data: box.stats.map((s, i) => ({
                    value: s ?? [0, 0, 0, 0, 0],
                    itemStyle: {
                      color: `${BRACKET_COLORS[i]}33`,
                      borderColor: BRACKET_COLORS[i],
                      borderWidth: 2,
                    },
                  })),
                  boxWidth: [12, 32],
                },
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Released within 3, 6 and 12 months, by loan size"
          subtitle="Loans taken in the period (Kaplan–Meier)"
          loading={loading}
        >
          <EChart
            height={260}
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: {
                ...axisTooltip((v) => percent(v)),
                axisPointer: { type: 'shadow' },
              },
              xAxis: { type: 'category', data: BRACKETS.map((b) => b.label) },
              yAxis: percentAxis({ max: 1 }),
              series: [3, 6, 12].map((k, i) => {
                const bracketKm = BRACKETS.map((b) =>
                  kaplanMeier(
                    data.kmGroups
                      .filter(
                        (r) => r.dim === 'bracket' && r.g === String(b.id)
                      )
                      .map((r) => ({
                        t: r.t,
                        events: r.events,
                        censored: r.censored,
                      }))
                  )
                );
                return bar(
                  `Within ${k} months`,
                  bracketKm.map((km) =>
                    km.length ? 1 - survivalAt(km, k - 1) : null
                  ),
                  [SEQUENTIAL[3], SEQUENTIAL[5], SEQUENTIAL[7]][i]
                );
              }),
            }}
          />
        </ChartCard>
      </div>

      {season ? (
        <div className="grid grid-cols-2 gap-3">
          <ChartCard
            title="Busy months of the year"
            subtitle="Average loans and releases per calendar month (complete months only)"
            loading={loading}
            footer={
              <>
                Releases spread evenly across the year? χ²:{' '}
                {describePValue(season.releaseTest.p)}. Loans:{' '}
                {describePValue(season.loanTest.p)}.
              </>
            }
            table={{
              columns: ['Month', 'Avg loans', 'Avg releases'],
              rows: season.avgLoans.map((v, i) => [
                monthName(i),
                Math.round(v),
                Math.round(season.avgReleases[i]),
              ]),
            }}
          >
            <EChart
              height={260}
              option={{
                grid: grid(),
                legend: legend(),
                tooltip: axisTooltip((v) => count(v)),
                xAxis: {
                  type: 'category',
                  data: Array.from({ length: 12 }, (_, i) => monthName(i)),
                },
                yAxis: countAxis(),
                series: [
                  bar('Loans', season.avgLoans.map(Math.round), SERIES[2]),
                  bar(
                    'Releases',
                    season.avgReleases.map(Math.round),
                    SERIES[6]
                  ),
                ],
              }}
            />
          </ChartCard>

          <ChartCard
            title="Releases by year and month"
            subtitle="Darker = more releases. Click a cell for the loans."
            loading={loading}
          >
            <EChart
              height={260}
              onClick={(e) => {
                const [m, yi] = e.value as number[];
                const ym = `${season.years[yi]}-${String(m + 1).padStart(2, '0')}`;
                openDrill(
                  factsDrill(
                    `Loans released in ${monthName(m)} ${season.years[yi]}`,
                    'release_month = ?',
                    [ym]
                  )
                );
              }}
              option={{
                grid: grid({ top: 8, bottom: 40 }),
                tooltip: {
                  trigger: 'item',
                  formatter: (p: { value: number[] }) =>
                    `<b>${count(p.value[2])} releases</b><br/>${monthName(p.value[0])} ${season.years[p.value[1]]}`,
                },
                xAxis: {
                  type: 'category',
                  data: Array.from({ length: 12 }, (_, i) => monthName(i)),
                  splitArea: { show: false },
                },
                yAxis: { type: 'category', data: season.years.map(String) },
                visualMap: {
                  min: 0,
                  max: season.heatMax,
                  orient: 'horizontal',
                  left: 'center',
                  bottom: 0,
                  itemHeight: 120,
                  itemWidth: 10,
                  calculable: false,
                  inRange: { color: SEQUENTIAL },
                  textStyle: { color: '#898781', fontSize: 11 },
                },
                series: [
                  {
                    type: 'heatmap',
                    data: season.heat,
                    itemStyle: {
                      borderColor: '#fcfcfb',
                      borderWidth: 2,
                      borderRadius: 3,
                    },
                  },
                ],
              }}
            />
          </ChartCard>

          <ChartCard
            title="Day of the week"
            subtitle="Loans and releases in the period"
            loading={loading}
            footer={
              <>
                Releases even across Mon–Sat? {describePValue(weekdayTest.p)}.
              </>
            }
            table={{
              columns: ['Day', 'Loans', 'Releases'],
              rows: WEEKDAYS.map((d, i) => [
                d,
                weekday('loan')[i],
                weekday('release')[i],
              ]),
            }}
          >
            <EChart
              height={220}
              option={{
                grid: grid(),
                legend: legend(),
                tooltip: axisTooltip(count),
                xAxis: { type: 'category', data: WEEKDAYS },
                yAxis: countAxis(),
                series: [
                  bar('Loans', weekday('loan'), SERIES[2]),
                  bar('Releases', weekday('release'), SERIES[6]),
                ],
              }}
            />
          </ChartCard>

          <ChartCard
            title="Day of the month"
            subtitle="Loans and releases in the period, by date (only 7 months have a 31st)"
            loading={loading}
            table={{
              columns: ['Date', 'Loans', 'Releases'],
              rows: Array.from({ length: 31 }, (_, i) => [
                i + 1,
                dom('loan')[i],
                dom('release')[i],
              ]),
            }}
          >
            <EChart
              height={220}
              option={{
                grid: grid(),
                legend: legend(),
                tooltip: axisTooltip(count),
                xAxis: {
                  type: 'category',
                  data: Array.from({ length: 31 }, (_, i) => i + 1),
                  boundaryGap: false,
                },
                yAxis: countAxis(),
                series: [
                  line('Loans', dom('loan'), SERIES[2]),
                  line('Releases', dom('release'), SERIES[6]),
                ],
              }}
            />
          </ChartCard>
        </div>
      ) : null}

      {renew?.n ? (
        <Insight>
          {percent(renew.renewed / renew.n)} of releases in the period were
          renewals (the customer took a fresh loan the same day), and{' '}
          {percent(renew.same_day / renew.n)} were released the same day they
          were taken.
        </Insight>
      ) : null}
    </div>
  );
}
