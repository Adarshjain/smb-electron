import { useCallback, useEffect, useMemo, useState } from 'react';
import { addMonths, format, parseISO } from 'date-fns';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDebounce } from '@/hooks/useDebounce.ts';
import { viewableDate } from '@/lib/myUtils.tsx';
import { monthDiffSql, sqlDate } from '@/lib/analytics/facts.ts';
import {
  kaplanMeier,
  survivalAt,
  type KmPoint,
} from '@/lib/analytics/stats.ts';
import EChart from '../chart/EChart.tsx';
import { ChartCard, Insight, StatTile } from '../ChartCard.tsx';
import { useAnalytics, useAnalyticsQueries } from '../AnalyticsContext.tsx';
import { factsDrill } from '../drill.ts';
import {
  COVER_BINS,
  DUE_BINS,
  riskQueries,
  type Prices,
  type RiskRows,
} from '../queries/risk.ts';
import { openAt } from '../queries/shared.ts';
import {
  axisTooltip,
  bar,
  countAxis,
  grid,
  legend,
  markLines,
  rupeeAxis,
  stackedBar,
} from '../chart/options.ts';
import { METAL_COLORS, SEQUENTIAL, SERIES, STATUS } from '../chart/palette.ts';
import {
  count,
  monthLabel,
  percent,
  rupees,
  rupeesCompact,
} from '../format.ts';

const PRICES_KEY = 'analytics.prices';
const HORIZON = 6;

function loadPrices(): Prices {
  try {
    const stored = JSON.parse(
      localStorage.getItem(PRICES_KEY) ?? '{}'
    ) as Partial<Prices>;
    return { gold: stored.gold ?? null, silver: stored.silver ?? null };
  } catch {
    return { gold: null, silver: null };
  }
}

/** Survival beyond the observed range, extended with the recent monthly hazard. */
function survivalFn(km: KmPoint[]) {
  const maxT = km.length ? km[km.length - 1].t : 0;
  const tail = km.filter(
    (p) => p.t >= Math.max(1, maxT - 12) && p.atRisk >= 30
  );
  const tailHazard = tail.length
    ? tail.reduce((s, p) => s + p.events, 0) /
      tail.reduce((s, p) => s + p.atRisk, 0)
    : 0.05;
  return (t: number) => {
    if (t < 0) return 1;
    if (t <= maxT) return survivalAt(km, t);
    return survivalAt(km, maxT) * (1 - tailHazard) ** (t - maxT);
  };
}

function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? '' : String(value));
  const debounced = useDebounce((v: string) => {
    const n = parseFloat(v);
    onChange(Number.isFinite(n) && n > 0 ? n : null);
  }, 500);
  return (
    <div className="flex items-center gap-2">
      <Label className="whitespace-nowrap">{label}</Label>
      <Input
        className="w-28 h-8"
        inputMode="decimal"
        placeholder="₹ per gram"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          debounced(e.target.value);
        }}
      />
    </div>
  );
}

export default function RiskTab() {
  const { openDrill } = useAnalytics();
  const [prices, setPrices] = useState<Prices>(loadPrices);
  useEffect(() => {
    try {
      localStorage.setItem(PRICES_KEY, JSON.stringify(prices));
    } catch {
      /* ignore */
    }
  }, [prices]);

  const build = useMemo(() => riskQueries(prices), [prices]);
  const { data, loading, ctx } = useAnalyticsQueries<RiskRows>(build);
  const hasPrices = prices.gold !== null || prices.silver !== null;

  const snap = sqlDate(ctx.snapshot);
  const age = monthDiffSql('loan_date', snap);
  const owedSql = `(loan_amount + ROUND(loan_amount * interest_rate / 100.0 * ${age}))`;
  const valueSql = `(net_weight * CASE metal_type WHEN 'Gold' THEN ? WHEN 'Silver' THEN ? END)`;
  const coverDrill = useCallback(
    (min: number, max: number | null, metal?: string) =>
      openDrill(
        factsDrill(
          `Open loans owing ${percent(min, 0)}${max === null ? '+' : `–${percent(max, 0)}`} of metal value${metal ? ` · ${metal}` : ''}`,
          `${openAt(snap)} AND ${valueSql} > 0 AND ${owedSql} >= ? * ${valueSql}` +
            (max === null ? '' : ` AND ${owedSql} < ? * ${valueSql}`) +
            (metal ? ' AND metal_type = ?' : ''),
          [
            prices.gold,
            prices.silver,
            min,
            prices.gold,
            prices.silver,
            ...(max === null ? [] : [max, prices.gold, prices.silver]),
            ...(metal ? [metal] : []),
          ]
        )
      ),
    [openDrill, snap, valueSql, owedSql, prices]
  );

  const forecast = useMemo(() => {
    if (!data) return null;
    const S = survivalFn(kaplanMeier(data.recentHazard));
    const future = Array.from({ length: HORIZON }, () => ({
      n: 0,
      amt: 0,
      interest: 0,
    }));
    for (const row of data.openByAge) {
      const alive = S(row.age - 1);
      if (alive <= 0) continue;
      for (let j = 0; j < HORIZON; j++) {
        const p = (S(row.age + j - 1) - S(row.age + j)) / alive;
        future[j].n += row.n * p;
        future[j].amt += row.amt * p;
        future[j].interest += row.interest_per_month * (row.age + j) * p;
      }
    }
    const start = parseISO(ctx.snapshot);
    return future.map((f, j) => ({
      ...f,
      ym: format(addMonths(start, j), 'yyyy-MM'),
    }));
  }, [data, ctx.snapshot]);

  if (!data || !forecast)
    return <div className="p-8 text-sm text-[#898781]">Loading…</div>;

  const coverRows = (metal: string) =>
    Array.from(
      { length: COVER_BINS },
      (_, bin) =>
        data.coverage.find((r) => r.metal_type === metal && r.bin === bin)
          ?.amt ?? 0
    );
  const metals = ['Gold', 'Silver'].filter((m) =>
    data.coverage.some((r) => r.metal_type === m)
  );
  const over = (threshold: number) =>
    data.coverage
      .filter((r) => r.bin >= threshold * 10)
      .reduce((a, r) => ({ n: a.n + r.n, amt: a.amt + r.amt }), {
        n: 0,
        amt: 0,
      });
  const over80 = over(0.8);
  const over100 = over(1);
  const dueHigh = data.dueRatio
    .filter((r) => r.bin >= 5)
    .reduce((a, r) => ({ n: a.n + r.n, amt: a.amt + r.amt }), { n: 0, amt: 0 });
  const next3 = forecast.slice(0, 3).reduce(
    (a, f) => ({
      amt: a.amt + f.amt,
      interest: a.interest + f.interest,
      n: a.n + f.n,
    }),
    { amt: 0, interest: 0, n: 0 }
  );
  const recentAvg = data.recentReleases.length
    ? data.recentReleases.reduce((a, r) => a + r.amt, 0) /
      data.recentReleases.length
    : 0;
  const coverLabels = Array.from({ length: COVER_BINS }, (_, i) =>
    i === COVER_BINS - 1 ? '150%+' : `${i * 10}%`
  );
  const dueLabels = Array.from({ length: DUE_BINS }, (_, i) =>
    i === DUE_BINS - 1 ? '100%+' : `${i * 10}–${i * 10 + 10}%`
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-xl border border-black/10 bg-[#fcfcfb] px-4 py-3 flex flex-wrap items-center gap-4">
        <div className="text-sm font-semibold">Today's metal value</div>
        <PriceInput
          label="Gold"
          value={prices.gold}
          onChange={(gold) => setPrices((p) => ({ ...p, gold }))}
        />
        <PriceInput
          label="Silver"
          value={prices.silver}
          onChange={(silver) => setPrices((p) => ({ ...p, silver }))}
        />
        <div className="text-xs text-[#898781]">
          Per gram of net weight, what you would realise at auction. Used only
          for the cover charts below; remembered on this computer.
        </div>
      </div>

      <div className="grid grid-cols-6 gap-3">
        <StatTile
          label="Owe 80%+ of metal value"
          value={hasPrices ? count(over80.n) : '–'}
          detail={
            hasPrices
              ? `${rupeesCompact(over80.amt)} principal`
              : 'enter a metal price'
          }
          onClick={hasPrices ? () => coverDrill(0.8, null) : undefined}
        />
        <StatTile
          label="Owe more than the metal is worth"
          value={hasPrices ? count(over100.n) : '–'}
          detail={
            hasPrices
              ? `${rupeesCompact(over100.amt)} principal`
              : 'enter a metal price'
          }
          onClick={hasPrices ? () => coverDrill(1, null) : undefined}
        />
        <StatTile
          label="Interest owed ≥ half the principal"
          value={count(dueHigh.n)}
          detail={`${rupeesCompact(dueHigh.amt)} principal`}
          onClick={() =>
            openDrill(
              factsDrill(
                'Open loans owing 50%+ of principal in interest',
                `${openAt(snap)} AND ${owedSql} - loan_amount >= 0.5 * loan_amount`
              )
            )
          }
        />
        <StatTile
          label="Expected back in 3 months"
          value={rupeesCompact(next3.amt)}
          detail={`≈ ${count(next3.n)} releases · ${rupeesCompact(next3.interest)} interest`}
        />
        <StatTile
          label="Released per month lately"
          value={rupeesCompact(recentAvg)}
          detail="average of the last 12 months"
        />
        <StatTile
          label="Loans with no weight"
          value={count(data.noValue[0]?.n ?? 0)}
          detail={`${rupeesCompact(data.noValue[0]?.amt ?? 0)} principal can't be valued`}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard
          title="What open loans owe against their metal"
          subtitle="(Principal + interest owed) ÷ metal value, in 10% steps. Click a bar for the loans."
          loading={loading}
          table={{
            columns: ['Owed vs value', ...metals.map((m) => `${m} principal`)],
            rows: coverLabels.map((l, i) => [
              l,
              ...metals.map((m) => rupees(coverRows(m)[i])),
            ]),
          }}
        >
          {hasPrices ? (
            <EChart
              height={280}
              onClick={(e) =>
                coverDrill(
                  e.dataIndex / 10,
                  e.dataIndex === COVER_BINS - 1
                    ? null
                    : (e.dataIndex + 1) / 10,
                  e.seriesName
                )
              }
              option={{
                grid: grid(),
                legend: legend(),
                tooltip: {
                  ...axisTooltip(rupees),
                  axisPointer: { type: 'shadow' },
                },
                xAxis: { type: 'category', data: coverLabels },
                yAxis: rupeeAxis(),
                series: metals.map((m, i) =>
                  stackedBar(
                    m,
                    coverRows(m),
                    METAL_COLORS[m],
                    'cover',
                    i === 0
                      ? {
                          markLine: markLines([
                            { x: '80%', label: '80%' },
                            { x: '100%', label: 'value' },
                          ]),
                        }
                      : {}
                  )
                ),
              }}
            />
          ) : (
            <div className="h-[280px] flex items-center justify-center text-sm text-[#898781]">
              Enter today's gold and silver value per gram above.
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Interest owed as a share of principal"
          subtitle="Open loans on the snapshot date"
          loading={loading}
          table={{
            columns: ['Interest owed', 'Loans', 'Principal'],
            rows: data.dueRatio.map((r) => [
              dueLabels[r.bin],
              r.n,
              rupees(r.amt),
            ]),
          }}
        >
          <EChart
            height={280}
            option={{
              grid: grid({ top: 16 }),
              tooltip: {
                ...axisTooltip(count),
                axisPointer: { type: 'shadow' },
              },
              xAxis: {
                type: 'category',
                data: dueLabels,
                axisLabel: { rotate: 30, color: '#898781', fontSize: 11 },
              },
              yAxis: countAxis(),
              series: [
                bar(
                  'Loans',
                  dueLabels.map((_, i) => {
                    const v = data.dueRatio.find((r) => r.bin === i)?.n ?? 0;
                    return {
                      value: v,
                      itemStyle: {
                        color: i >= 5 ? STATUS.serious : SEQUENTIAL[5],
                        borderRadius: [4, 4, 0, 0],
                      },
                    };
                  }),
                  SEQUENTIAL[5]
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Money coming back: last 12 months and the next 6"
          subtitle={`Principal released each month; the next ${HORIZON} are projected from how loans of each age have released over the last three years`}
          loading={loading}
          className="col-span-2"
          footer="Projection assumes customers keep behaving the way they have in the last three years. It ignores renewals, auctions and new loans."
          table={{
            columns: ['Month', 'Releases', 'Principal', 'Interest', ''],
            rows: [
              ...data.recentReleases.map((r) => [
                monthLabel(r.ym),
                r.n,
                rupees(r.amt),
                rupees(r.interest),
                'actual',
              ]),
              ...forecast.map((f) => [
                monthLabel(f.ym),
                Math.round(f.n),
                rupees(f.amt),
                rupees(f.interest),
                'projected',
              ]),
            ],
          }}
        >
          <EChart
            height={300}
            option={{
              grid: grid(),
              legend: legend(),
              tooltip: {
                ...axisTooltip(rupees),
                axisPointer: { type: 'shadow' },
              },
              xAxis: {
                type: 'category',
                data: [
                  ...data.recentReleases.map((r) => monthLabel(r.ym)),
                  ...forecast.map((f) => monthLabel(f.ym)),
                ],
              },
              yAxis: rupeeAxis(),
              series: [
                stackedBar(
                  'Released (actual)',
                  [
                    ...data.recentReleases.map((r) => r.amt),
                    ...forecast.map(() => null),
                  ],
                  SERIES[0],
                  'back'
                ),
                stackedBar(
                  'Expected (projected)',
                  [
                    ...data.recentReleases.map(() => null),
                    ...forecast.map((f) => Math.round(f.amt)),
                  ],
                  SEQUENTIAL[2],
                  'back'
                ),
              ],
            }}
          />
        </ChartCard>
      </div>

      <ChartCard
        title="Watchlist"
        subtitle={
          hasPrices
            ? 'Open loans owing the most against their metal value'
            : 'Open loans with the most interest owed relative to principal (enter metal prices to rank by cover)'
        }
        loading={loading}
      >
        <div className="max-h-[420px] overflow-auto">
          <Table className="text-xs">
            <TableHeader className="sticky top-0 bg-[#fcfcfb]">
              <TableRow>
                <TableHead>Loan</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Metal</TableHead>
                <TableHead className="text-right">Principal</TableHead>
                <TableHead className="text-right">Owed now</TableHead>
                <TableHead className="text-right">Metal value</TableHead>
                <TableHead className="text-right">Owed ÷ value</TableHead>
                <TableHead className="text-right">Extra months</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.watchlist.map((r) => (
                <TableRow key={r.loan}>
                  <TableCell className="py-1 whitespace-nowrap">
                    {r.loan}
                  </TableCell>
                  <TableCell className="py-1 whitespace-nowrap">
                    {viewableDate(r.loan_date)}
                  </TableCell>
                  <TableCell className="py-1">{r.metal_type}</TableCell>
                  <TableCell className="py-1 text-right tabular-nums">
                    {rupees(r.loan_amount)}
                  </TableCell>
                  <TableCell className="py-1 text-right tabular-nums">
                    {rupees(r.owed)}
                  </TableCell>
                  <TableCell className="py-1 text-right tabular-nums">
                    {r.value ? rupees(r.value) : '–'}
                  </TableCell>
                  <TableCell className="py-1 text-right tabular-nums">
                    {r.cover === null ? (
                      '–'
                    ) : (
                      <span
                        className={
                          r.cover >= 1 ? 'text-[#d03b3b] font-medium' : ''
                        }
                      >
                        {r.cover >= 1 ? '▲ ' : ''}
                        {percent(r.cover, 0)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="py-1 text-right tabular-nums">
                    {r.age}
                  </TableCell>
                  <TableCell className="py-1 whitespace-nowrap">
                    {r.customer}
                  </TableCell>
                  <TableCell className="py-1 whitespace-nowrap">
                    {r.area}
                  </TableCell>
                  <TableCell className="py-1 whitespace-nowrap">
                    {r.phone_no}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ChartCard>
      {hasPrices && over100.n ? (
        <Insight>
          {count(over100.n)} open loans ({rupeesCompact(over100.amt)} principal)
          now owe more than their metal is worth at the prices entered. These
          are the loans an auction would not cover.
        </Insight>
      ) : null}
    </div>
  );
}
