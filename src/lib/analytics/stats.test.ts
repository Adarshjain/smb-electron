import { describe, expect, it } from 'vitest';
import {
  boxFromCounts,
  chiSquareGoodnessOfFit,
  chiSquarePValue,
  hazard,
  kaplanMeier,
  kmQuantile,
  kruskalWallis,
  logRank,
  percentileFromCounts,
  survivalAt,
} from './stats';

describe('chiSquarePValue', () => {
  it('matches table critical values', () => {
    expect(chiSquarePValue(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(5.991, 2)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(18.307, 10)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(0, 4)).toBe(1);
  });
});

describe('kaplanMeier', () => {
  // Five loans: released at 1, 3, 4; still open at 2 and 5.
  const rows = [
    { t: 1, events: 1, censored: 0 },
    { t: 2, events: 0, censored: 1 },
    { t: 3, events: 1, censored: 0 },
    { t: 4, events: 1, censored: 0 },
    { t: 5, events: 0, censored: 1 },
  ];
  const km = kaplanMeier(rows);

  it('steps down only on releases', () => {
    expect(km.map((p) => p.survival)).toEqual([
      0.8,
      0.8,
      expect.closeTo(0.5333, 4),
      expect.closeTo(0.2667, 4),
      expect.closeTo(0.2667, 4),
    ]);
    expect(km.map((p) => p.atRisk)).toEqual([5, 4, 3, 2, 1]);
  });

  it('reads quantiles and values off the curve', () => {
    expect(kmQuantile(km, 0.5)).toBe(4);
    expect(kmQuantile(km, 0.9)).toBeUndefined();
    expect(survivalAt(km, 3.5)).toBeCloseTo(0.5333, 4);
    expect(survivalAt(km, 0)).toBe(1);
  });

  it('merges rows with the same time', () => {
    const merged = kaplanMeier([
      { t: 1, events: 1, censored: 0 },
      { t: 1, events: 1, censored: 1 },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ events: 2, censored: 1, atRisk: 3 });
  });

  it('gives the monthly release chance', () => {
    expect(hazard(km)[2]).toEqual({ t: 3, rate: 1 / 3, atRisk: 3 });
  });
});

describe('percentiles from counts', () => {
  const rows = Array.from({ length: 10 }, (_, i) => ({
    value: i + 1,
    count: 1,
  }));
  it('uses nearest rank', () => {
    expect(percentileFromCounts(rows, 0.5)).toBe(5);
    expect(percentileFromCounts(rows, 0.9)).toBe(9);
    expect(percentileFromCounts(rows, 1)).toBe(10);
    expect(percentileFromCounts([], 0.5)).toBeUndefined();
  });
  it('builds box plot stats', () => {
    expect(boxFromCounts(rows)).toEqual([1, 3, 5, 8, 10]);
  });
});

describe('kruskalWallis', () => {
  it('matches a hand-computed H', () => {
    const result = kruskalWallis([
      [1, 2, 3].map((value) => ({ value, count: 1 })),
      [4, 5, 6].map((value) => ({ value, count: 1 })),
    ]);
    expect(result.statistic).toBeCloseTo(3.857, 3);
    expect(result.df).toBe(1);
    expect(result.p).toBeCloseTo(0.0495, 3);
  });
});

describe('logRank', () => {
  it('is 0 for identical groups', () => {
    const group = [
      { t: 1, events: 2, censored: 1 },
      { t: 3, events: 1, censored: 0 },
    ];
    const result = logRank([group, group]);
    expect(result.statistic).toBeCloseTo(0, 10);
    expect(result.p).toBeCloseTo(1, 6);
  });

  it('matches a hand-computed statistic', () => {
    const result = logRank([
      [
        { t: 1, events: 1, censored: 0 },
        { t: 2, events: 1, censored: 0 },
      ],
      [
        { t: 3, events: 1, censored: 0 },
        { t: 4, events: 1, censored: 0 },
      ],
    ]);
    expect(result.statistic).toBeCloseTo(2.882, 3);
    expect(result.p).toBeCloseTo(0.0896, 3);
  });
});

describe('chiSquareGoodnessOfFit', () => {
  it('is 1 for a perfectly uniform spread', () => {
    expect(chiSquareGoodnessOfFit([10, 10, 10]).p).toBeCloseTo(1, 6);
  });
  it('flags a lopsided spread', () => {
    expect(chiSquareGoodnessOfFit([100, 10, 10]).p).toBeLessThan(0.001);
  });
});
