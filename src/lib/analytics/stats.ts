// Statistics for the analytics screen. Everything here works on counts that
// SQLite has already aggregated (e.g. "how many loans were released at month
// k"), never on raw rows, so the page only ever holds small result sets.

export interface SurvivalCount {
  /** Time value (months or days). */
  t: number;
  /** Loans released at t. */
  events: number;
  /** Loans still open, last observed at t. */
  censored: number;
}

export interface KmPoint extends SurvivalCount {
  atRisk: number;
  /** Share of loans still open just after t. */
  survival: number;
}

function mergeCounts(rows: SurvivalCount[]): SurvivalCount[] {
  const byT = new Map<number, SurvivalCount>();
  for (const row of rows) {
    const existing = byT.get(row.t);
    if (existing) {
      existing.events += row.events;
      existing.censored += row.censored;
    } else {
      byT.set(row.t, { ...row });
    }
  }
  return [...byT.values()].sort((a, b) => a.t - b.t);
}

/**
 * Kaplan–Meier estimate of the share of loans still open over time. Loans that
 * are still open count as censored, so long-running loans aren't dropped the
 * way they are when looking at released loans only.
 */
export function kaplanMeier(rows: SurvivalCount[]): KmPoint[] {
  const merged = mergeCounts(rows);
  let atRisk = merged.reduce((sum, r) => sum + r.events + r.censored, 0);
  let survival = 1;
  const points: KmPoint[] = [];
  for (const row of merged) {
    if (atRisk > 0 && row.events > 0) {
      survival *= 1 - row.events / atRisk;
    }
    points.push({ ...row, atRisk, survival });
    atRisk -= row.events + row.censored;
  }
  return points;
}

/** Share of loans still open at time t (step function). */
export function survivalAt(km: KmPoint[], t: number): number {
  let survival = 1;
  for (const point of km) {
    if (point.t > t) break;
    survival = point.survival;
  }
  return survival;
}

/**
 * Time by which a share p of loans has been released, e.g. p = 0.5 is the
 * median. Undefined when the curve never gets that low (not enough loans have
 * been released yet to know).
 */
export function kmQuantile(km: KmPoint[], p: number): number | undefined {
  const target = 1 - p;
  for (const point of km) {
    if (point.survival <= target + 1e-12) return point.t;
  }
  return undefined;
}

/**
 * Chance that a loan still open at the start of t is released during t,
 * i.e. events / at risk.
 */
export function hazard(
  km: KmPoint[]
): { t: number; rate: number; atRisk: number }[] {
  return km
    .filter((p) => p.atRisk > 0)
    .map((p) => ({ t: p.t, rate: p.events / p.atRisk, atRisk: p.atRisk }));
}

// --- Distributions -------------------------------------------------------

export interface ValueCount {
  value: number;
  count: number;
}

/** Nearest-rank percentile of a discrete distribution given as counts. */
export function percentileFromCounts(
  rows: ValueCount[],
  p: number
): number | undefined {
  const sorted = [...rows]
    .filter((r) => r.count > 0)
    .sort((a, b) => a.value - b.value);
  const total = sorted.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return undefined;
  const rank = Math.max(1, Math.ceil(p * total));
  let cumulative = 0;
  for (const row of sorted) {
    cumulative += row.count;
    if (cumulative >= rank) return row.value;
  }
  return sorted[sorted.length - 1].value;
}

export function meanFromCounts(rows: ValueCount[]): number | undefined {
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  if (total === 0) return undefined;
  return rows.reduce((sum, r) => sum + r.value * r.count, 0) / total;
}

/** [p5, p25, median, p75, p95] for a box plot. */
export function boxFromCounts(rows: ValueCount[]): number[] | undefined {
  const ps = [0.05, 0.25, 0.5, 0.75, 0.95].map((p) =>
    percentileFromCounts(rows, p)
  );
  if (ps.some((v) => v === undefined)) return undefined;
  return ps as number[];
}

// --- Significance tests ---------------------------------------------------

function logGamma(x: number): number {
  // Lanczos approximation.
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = c[0];
  const t = x + g + 0.5;
  for (let i = 1; i < g + 2; i++) a += c[i] / (x + i);
  return (
    0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a)
  );
}

/** Regularized upper incomplete gamma Q(a, x). */
function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  if (x < a + 1) {
    // Series for P, then Q = 1 - P.
    let sum = 1 / a;
    let term = sum;
    for (let n = 1; n < 500; n++) {
      term *= x / (a + n);
      sum += term;
      if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
    }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - logGamma(a));
  }
  // Continued fraction for Q (Lentz).
  let b = x + 1 - a;
  let c = 1 / 1e-300;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-300) d = 1e-300;
    c = b + an / c;
    if (Math.abs(c) < 1e-300) c = 1e-300;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGamma(a)) * h;
}

/** P(X >= x) for a chi-square distribution with df degrees of freedom. */
export function chiSquarePValue(x: number, df: number): number {
  if (df <= 0 || !Number.isFinite(x)) return NaN;
  return Math.min(1, Math.max(0, gammaQ(df / 2, x / 2)));
}

export interface TestResult {
  statistic: number;
  df: number;
  p: number;
}

/** Chi-square goodness of fit against expected counts (default: uniform). */
export function chiSquareGoodnessOfFit(
  observed: number[],
  expected?: number[]
): TestResult {
  const total = observed.reduce((sum, o) => sum + o, 0);
  const exp = expected ?? observed.map(() => total / observed.length);
  let statistic = 0;
  for (let i = 0; i < observed.length; i++) {
    if (exp[i] > 0) statistic += (observed[i] - exp[i]) ** 2 / exp[i];
  }
  const df = observed.length - 1;
  return { statistic, df, p: chiSquarePValue(statistic, df) };
}

/**
 * Kruskal–Wallis H test: do the groups come from the same distribution?
 * Groups are value counts; ties are handled with mid-ranks and the usual
 * correction.
 */
export function kruskalWallis(groups: ValueCount[][]): TestResult {
  const live = groups.filter((g) => g.some((r) => r.count > 0));
  const pooled = new Map<number, number>();
  for (const group of live) {
    for (const r of group)
      pooled.set(r.value, (pooled.get(r.value) ?? 0) + r.count);
  }
  const values = [...pooled.keys()].sort((a, b) => a - b);
  const midRank = new Map<number, number>();
  let before = 0;
  let tieSum = 0;
  for (const v of values) {
    const c = pooled.get(v)!;
    midRank.set(v, before + (c + 1) / 2);
    before += c;
    tieSum += c ** 3 - c;
  }
  const n = before;
  const df = live.length - 1;
  if (n < 2 || df < 1) return { statistic: 0, df: Math.max(df, 0), p: NaN };
  let sum = 0;
  for (const group of live) {
    let rankSum = 0;
    let size = 0;
    for (const r of group) {
      rankSum += r.count * midRank.get(r.value)!;
      size += r.count;
    }
    sum += rankSum ** 2 / size;
  }
  let h = (12 / (n * (n + 1))) * sum - 3 * (n + 1);
  const correction = 1 - tieSum / (n ** 3 - n);
  if (correction > 0) h /= correction;
  return { statistic: h, df, p: chiSquarePValue(h, df) };
}

function solve(matrix: number[][], vector: number[]): number[] | null {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[pivot][col])) pivot = r;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = a[r][col] / a[col][col];
      for (let k = col; k <= n; k++) a[r][k] -= factor * a[col][k];
    }
  }
  return a.map((row, i) => row[n] / row[i]);
}

/**
 * Log-rank test: do the groups' "still open over time" curves differ? This is
 * the right test for loan durations because it accounts for loans that are
 * still open.
 */
export function logRank(groups: SurvivalCount[][]): TestResult {
  const live = groups
    .map(mergeCounts)
    .filter((g) => g.some((r) => r.events + r.censored > 0));
  const k = live.length;
  if (k < 2) return { statistic: 0, df: 0, p: NaN };

  const times = [...new Set(live.flatMap((g) => g.map((r) => r.t)))].sort(
    (a, b) => a - b
  );
  const atRisk = live.map((g) =>
    g.reduce((s, r) => s + r.events + r.censored, 0)
  );
  const index = live.map(() => 0);
  const observedMinusExpected = new Array<number>(k).fill(0);
  const variance = Array.from({ length: k }, () =>
    new Array<number>(k).fill(0)
  );

  for (const t of times) {
    const events = live.map((g, i) =>
      g[index[i]]?.t === t ? g[index[i]].events : 0
    );
    const censored = live.map((g, i) =>
      g[index[i]]?.t === t ? g[index[i]].censored : 0
    );
    const n = atRisk.reduce((s, v) => s + v, 0);
    const d = events.reduce((s, v) => s + v, 0);
    if (d > 0 && n > 1) {
      for (let i = 0; i < k; i++) {
        observedMinusExpected[i] += events[i] - (d * atRisk[i]) / n;
        for (let j = 0; j < k; j++) {
          const factor = (d * (n - d)) / (n - 1);
          variance[i][j] +=
            factor * (atRisk[i] / n) * ((i === j ? 1 : 0) - atRisk[j] / n);
        }
      }
    }
    for (let i = 0; i < k; i++) {
      if (live[i][index[i]]?.t === t) index[i]++;
      atRisk[i] -= events[i] + censored[i];
    }
  }

  // Drop the last group: the full covariance matrix is singular.
  const size = k - 1;
  const v = variance.slice(0, size).map((row) => row.slice(0, size));
  const o = observedMinusExpected.slice(0, size);
  const x = solve(v, o);
  if (!x) return { statistic: 0, df: size, p: NaN };
  const statistic = o.reduce((sum, val, i) => sum + val * x[i], 0);
  return { statistic, df: size, p: chiSquarePValue(statistic, size) };
}

/** Human wording for a p-value. */
export function describePValue(p: number): string {
  if (!Number.isFinite(p)) return 'not enough data';
  if (p < 0.001) return 'p < 0.001 · the difference is real';
  if (p < 0.05) return `p = ${p.toFixed(3)} · the difference is real`;
  return `p = ${p.toFixed(2)} · could be chance`;
}
