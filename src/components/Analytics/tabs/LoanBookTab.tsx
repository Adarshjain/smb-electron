import { useMemo } from 'react';
import EChart from '../chart/EChart.tsx';
import { ChartCard, Insight } from '../ChartCard.tsx';
import { useAnalytics, useAnalyticsQueries } from '../AnalyticsContext.tsx';
import { factsDrill } from '../drill.ts';
import {
  AGE_BUCKETS,
  AMOUNT_BIN,
  AMOUNT_BINS,
  ageBucketSql,
  grossUpSql,
  loanBookQueries,
  type LoanBookRows,
} from '../queries/loanBook.ts';
import { openAt } from '../queries/shared.ts';
import { BRACKETS, monthDiffSql, sqlDate } from '@/lib/analytics/facts.ts';
import {
  axisTooltip,
  bar,
  countAxis,
  grid,
  legend,
  line,
  markLines,
  percentAxis,
  rupeeAxis,
  stackedBar,
  zoom,
} from '../chart/options.ts';
import { BRACKET_COLORS, METAL_COLORS, SERIES } from '../chart/palette.ts';
import {
  count,
  grams,
  monthLabel,
  percent,
  rupees,
  rupeesCompact,
} from '../format.ts';

const METALS = ['Gold', 'Silver', 'Other'];

export default function LoanBookTab() {
  const { openDrill } = useAnalytics();
  const { data, loading, ctx } =
    useAnalyticsQueries<LoanBookRows>(loanBookQueries);
  const snap = sqlDate(ctx.snapshot);
  const openClause = openAt(snap);

  const aging = useMemo(() => {
    if (!data) return null;
    const metals = METALS.filter((m) =>
      data.aging.some((r) => r.metal_type === m)
    );
    return {
      metals,
      rows: AGE_BUCKETS.map((b) => {
        const rows = data.aging.filter((r) => r.bucket === b.id);
        return {
          bucket: b,
          byMetal: metals.map(
            (m) => rows.find((r) => r.metal_type === m)?.amt ?? 0
          ),
          n: rows.reduce((s, r) => s + r.n, 0),
          amt: rows.reduce((s, r) => s + r.amt, 0),
          due: rows.reduce((s, r) => s + r.due, 0),
        };
      }),
    };
  }, [data]);

  const hist = useMemo(() => {
    if (!data) return [];
    const byBin = new Map(data.amountHist.map((r) => [r.bin, r.n]));
    return Array.from({ length: AMOUNT_BINS + 1 }, (_, i) => ({
      label:
        i === AMOUNT_BINS
          ? `${rupeesCompact(AMOUNT_BINS * AMOUNT_BIN)}+`
          : rupeesCompact(i * AMOUNT_BIN),
      n: byBin.get(i) ?? 0,
    }));
  }, [data]);

  const perGram = useMemo(() => {
    if (!data) return null;
    const months = [...new Set(data.perGram.map((r) => r.ym))].sort();
    const series = (metal: string) =>
      months.map((ym) => {
        const r = data.perGram.find(
          (p) => p.ym === ym && p.metal_type === metal
        );
        return r ? Math.round(r.rate) : null;
      });
    return { months, gold: series('Gold'), silver: series('Silver') };
  }, [data]);

  if (!data || !aging || !perGram)
    return <div className="p-8 text-sm text-[#898781]">Loading…</div>;

  const openTotal = aging.rows.reduce((s, r) => s + r.amt, 0);
  const old = aging.rows
    .filter((r) => r.bucket.min >= 12)
    .reduce((s, r) => s + r.amt, 0);
  const grossTotal = data.grossUp.reduce((s, r) => s + r.gross, 0);
  const loansTotal = data.grossUp.reduce((s, r) => s + r.n, 0);
  const bracketTotal = data.brackets.reduce((s, r) => s + r.amt, 0);
  const rates = [...new Set(data.rates.map((r) => r.interest_rate))].sort(
    (a, b) => a - b
  );
  const age = monthDiffSql('loan_date', snap);

  const perGramChart = (
    metal: 'Gold' | 'Silver',
    values: (number | null)[]
  ) => (
    <EChart
      height={220}
      option={{
        grid: grid({ top: 16 }),
        tooltip: axisTooltip((v) => `${rupees(v)} / g`),
        dataZoom: zoom,
        xAxis: {
          type: 'category',
          data: perGram.months.map(monthLabel),
          boundaryGap: false,
        },
        yAxis: rupeeAxis({ scale: true }),
        series: [
          line(`${metal} ₹ per gram`, values, METAL_COLORS[metal], {
            connectNulls: true,
          }),
        ],
      }}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <ChartCard
          title="How long open loans have been out"
          subtitle="Principal still outstanding, by age and metal. Click a bar for the loans."
          loading={loading}
          footer={`${percent(openTotal ? old / openTotal : NaN)} of the open book (${rupeesCompact(old)}) has been out for over a year.`}
          table={{
            columns: ['Age', 'Loans', 'Principal', 'Interest owed'],
            rows: aging.rows.map((r) => [
              r.bucket.label,
              r.n,
              rupees(r.amt),
              rupees(r.due),
            ]),
          }}
        >
          <EChart
            height={280}
            onClick={(e) => {
              const bucket = AGE_BUCKETS[e.dataIndex];
              openDrill(
                factsDrill(
                  `Open ${e.seriesName} loans · ${bucket.label}`,
                  `${openClause} AND metal_type = ? AND ${ageBucketSql(age)} = ?`,
                  [e.seriesName, bucket.id]
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
                data: AGE_BUCKETS.map((b) => b.label),
                axisLabel: { interval: 0 },
              },
              yAxis: rupeeAxis(),
              series: aging.metals.map((m, i) =>
                stackedBar(
                  m,
                  aging.rows.map((r) => r.byMetal[i]),
                  METAL_COLORS[m],
                  'age'
                )
              ),
            }}
          />
        </ChartCard>

        <ChartCard
          title="Open book by loan size"
          subtitle="Principal outstanding in each bracket (the ₹1,100 and ₹5,000 edges are where the rate slabs change)"
          loading={loading}
          table={{
            columns: ['Bracket', 'Loans', 'Principal', 'Share'],
            rows: data.brackets.map((r) => [
              BRACKETS[r.bracket - 1].label,
              r.n,
              rupees(r.amt),
              percent(r.amt / bracketTotal),
            ]),
          }}
        >
          <EChart
            height={280}
            onClick={(e) => {
              const b = BRACKETS[e.dataIndex];
              openDrill(
                factsDrill(
                  `Open loans · ${b.label}`,
                  `${openClause} AND bracket = ?`,
                  [b.id]
                )
              );
            }}
            option={{
              grid: grid({ top: 8, right: 64 }),
              tooltip: {
                ...axisTooltip(rupees),
                axisPointer: { type: 'shadow' },
              },
              yAxis: {
                type: 'category',
                data: BRACKETS.map((b) => b.label),
                inverse: true,
              },
              xAxis: rupeeAxis(),
              series: [
                bar(
                  'Principal',
                  BRACKETS.map((b, i) => ({
                    value:
                      data.brackets.find((r) => r.bracket === b.id)?.amt ?? 0,
                    itemStyle: {
                      color: BRACKET_COLORS[i],
                      borderRadius: [0, 4, 4, 0],
                    },
                  })),
                  BRACKET_COLORS[2],
                  {
                    label: {
                      show: true,
                      position: 'right',
                      color: '#52514e',
                      formatter: (p: { value: number }) =>
                        percent(bracketTotal ? p.value / bracketTotal : NaN, 0),
                    },
                  }
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Loan amounts"
          subtitle="Loans taken in the period, in ₹250 steps. Lines mark the rate slab edges."
          loading={loading}
          className="col-span-2"
          table={{
            columns: ['From', 'Loans'],
            rows: hist.map((h) => [h.label, h.n]),
          }}
        >
          <EChart
            height={260}
            onClick={(e) => {
              const from = e.dataIndex * AMOUNT_BIN;
              if (e.dataIndex === AMOUNT_BINS) {
                openDrill(
                  factsDrill(
                    `Loans of ${rupees(from)} or more`,
                    'loan_amount >= ? AND loan_date BETWEEN ? AND ?',
                    [from, ctx.from, ctx.to]
                  )
                );
              } else {
                openDrill(
                  factsDrill(
                    `Loans of ${rupees(from)} – ${rupees(from + AMOUNT_BIN - 1)}`,
                    'loan_amount >= ? AND loan_amount < ? AND loan_date BETWEEN ? AND ?',
                    [from, from + AMOUNT_BIN, ctx.from, ctx.to]
                  )
                );
              }
            }}
            option={{
              grid: grid({ top: 24 }),
              tooltip: {
                ...axisTooltip(count),
                axisPointer: { type: 'shadow' },
              },
              xAxis: { type: 'category', data: hist.map((h) => h.label) },
              yAxis: countAxis(),
              series: [
                bar(
                  'Loans',
                  hist.map((h) => h.n),
                  SERIES[0],
                  {
                    barCategoryGap: '8%',
                    markLine: markLines([
                      {
                        x: hist[Math.floor(1100 / AMOUNT_BIN)].label,
                        label: '₹1,100 slab',
                      },
                      {
                        x: hist[5000 / AMOUNT_BIN].label,
                        label: '₹5,000 slab',
                      },
                    ]),
                  }
                ),
              ],
            }}
          />
        </ChartCard>

        <ChartCard
          title="Most common loan amounts"
          subtitle="And what the customer takes home after the first month's interest and document charges"
          loading={loading}
          table={{
            columns: ['Principal', 'Loans', 'Avg take-home'],
            rows: data.topAmounts.map((r) => [
              rupees(r.loan_amount),
              r.n,
              rupees(r.take_home),
            ]),
          }}
        >
          <EChart
            height={420}
            onClick={(e) => {
              const r = data.topAmounts[e.dataIndex];
              openDrill(
                factsDrill(
                  `Loans of exactly ${rupees(r.loan_amount)}`,
                  'loan_amount = ? AND loan_date BETWEEN ? AND ?',
                  [r.loan_amount, ctx.from, ctx.to]
                )
              );
            }}
            option={{
              grid: grid({ top: 8, right: 110 }),
              tooltip: {
                trigger: 'item',
                formatter: (p: { dataIndex: number }) => {
                  const r = data.topAmounts[p.dataIndex];
                  return `<b>${count(r.n)} loans</b> of ${rupees(r.loan_amount)}<br/>take-home ≈ ${rupees(r.take_home)}`;
                },
              },
              yAxis: {
                type: 'category',
                inverse: true,
                data: data.topAmounts.map((r) => rupees(r.loan_amount)),
              },
              xAxis: countAxis(),
              series: [
                bar(
                  'Loans',
                  data.topAmounts.map((r) => r.n),
                  SERIES[0],
                  {
                    itemStyle: { color: SERIES[0], borderRadius: [0, 4, 4, 0] },
                    label: {
                      show: true,
                      position: 'right',
                      color: '#52514e',
                      formatter: (p: { dataIndex: number }) =>
                        `takes home ${rupees(data.topAmounts[p.dataIndex].take_home)}`,
                    },
                  }
                ),
              ],
            }}
          />
        </ChartCard>

        <div className="flex flex-col gap-3">
          <ChartCard
            title="Grossed-up loans"
            subtitle="Share of loans sized so the customer walks away with a round figure (e.g. ₹5,130 → ₹5,000)"
            loading={loading}
            table={{
              columns: ['Year', 'Loans', 'Grossed up', 'Share'],
              rows: data.grossUp.map((r) => [
                r.y,
                r.n,
                r.gross,
                percent(r.gross / r.n),
              ]),
            }}
          >
            <EChart
              height={170}
              onClick={(e) => {
                const y = data.grossUp[e.dataIndex].y;
                openDrill(
                  factsDrill(
                    `Grossed-up loans in ${y}`,
                    `substr(loan_date, 1, 4) = ? AND ${grossUpSql}`,
                    [y]
                  )
                );
              }}
              option={{
                grid: grid({ top: 16 }),
                tooltip: axisTooltip((v) => percent(v)),
                xAxis: { type: 'category', data: data.grossUp.map((r) => r.y) },
                yAxis: percentAxis({ max: 0.5 }),
                series: [
                  bar(
                    'Grossed up',
                    data.grossUp.map((r) => r.gross / r.n),
                    SERIES[0]
                  ),
                ],
              }}
            />
          </ChartCard>
          <Insight>
            {percent(loansTotal ? grossTotal / loansTotal : NaN)} of loans in
            the period were grossed up ({count(grossTotal)} loans). Customers
            ask for a take-home amount, not a principal.
          </Insight>
          <ChartCard
            title="Interest rates used"
            subtitle="Loans taken in the period, by rate and metal"
            loading={loading}
            table={{
              columns: ['Rate', 'Metal', 'Loans', 'Principal'],
              rows: data.rates.map((r) => [
                `${r.interest_rate}%`,
                r.metal_type,
                r.n,
                rupees(r.amt),
              ]),
            }}
          >
            <EChart
              height={170}
              onClick={(e) => {
                const rate = rates[e.dataIndex];
                openDrill(
                  factsDrill(
                    `${e.seriesName} loans at ${rate}%`,
                    'interest_rate = ? AND metal_type = ? AND loan_date BETWEEN ? AND ?',
                    [rate, e.seriesName, ctx.from, ctx.to]
                  )
                );
              }}
              option={{
                grid: grid(),
                legend: legend(),
                tooltip: {
                  ...axisTooltip(count),
                  axisPointer: { type: 'shadow' },
                },
                xAxis: { type: 'category', data: rates.map((r) => `${r}%`) },
                yAxis: countAxis(),
                series: METALS.filter((m) =>
                  data.rates.some((r) => r.metal_type === m)
                ).map((m) =>
                  stackedBar(
                    m,
                    rates.map(
                      (rate) =>
                        data.rates.find(
                          (r) => r.interest_rate === rate && r.metal_type === m
                        )?.n ?? 0
                    ),
                    METAL_COLORS[m],
                    'rates'
                  )
                ),
              }}
            />
          </ChartCard>
        </div>

        <ChartCard
          title="Lent per gram of gold"
          subtitle="Principal ÷ net weight for gold loans taken each month: tracks the gold price"
          loading={loading}
          table={{
            columns: ['Month', '₹ per gram'],
            rows: perGram.months.map((ym, i) => [
              monthLabel(ym),
              perGram.gold[i] ?? '–',
            ]),
          }}
        >
          {perGramChart('Gold', perGram.gold)}
        </ChartCard>
        <ChartCard
          title="Lent per gram of silver"
          subtitle="Principal ÷ net weight for silver loans taken each month"
          loading={loading}
          table={{
            columns: ['Month', '₹ per gram'],
            rows: perGram.months.map((ym, i) => [
              monthLabel(ym),
              perGram.silver[i] ?? '–',
            ]),
          }}
        >
          {perGramChart('Silver', perGram.silver)}
        </ChartCard>

        <ChartCard
          title="Most pledged items"
          subtitle="Loans that include each item, for loans taken in the period"
          loading={loading}
          className="col-span-2"
          table={{
            columns: ['Item', 'Loans', 'Pieces', 'Net weight'],
            rows: data.products.map((r) => [
              r.product,
              r.n,
              r.qty,
              grams(r.grams),
            ]),
          }}
        >
          <EChart
            height={300}
            option={{
              grid: grid({ top: 8, right: 24 }),
              tooltip: {
                trigger: 'item',
                formatter: (p: { dataIndex: number }) => {
                  const r = data.products[p.dataIndex];
                  return `<b>${count(r.n)} loans</b> · ${r.product}<br/>${count(r.qty)} pieces · ${grams(r.grams)}`;
                },
              },
              yAxis: {
                type: 'category',
                inverse: true,
                data: data.products.map((r) => r.product),
              },
              xAxis: countAxis(),
              series: [
                bar(
                  'Loans',
                  data.products.map((r) => r.n),
                  SERIES[0],
                  {
                    itemStyle: { color: SERIES[0], borderRadius: [0, 4, 4, 0] },
                  }
                ),
              ],
            }}
          />
        </ChartCard>
      </div>
    </div>
  );
}
