import { INK, SURFACE } from './palette';
import { axisCompact } from '../format';

// Small builders for the ECharts options every chart repeats.

export const grid = (extra: Record<string, unknown> = {}) => ({
  left: 8,
  right: 16,
  top: 36,
  bottom: 8,
  containLabel: true,
  ...extra,
});

export const legend = (extra: Record<string, unknown> = {}) => ({
  top: 0,
  left: 0,
  ...extra,
});

export function axisTooltip(valueFormatter: (v: number) => string) {
  return {
    trigger: 'axis',
    axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
    valueFormatter: (v: unknown) =>
      typeof v === 'number' ? valueFormatter(v) : '–',
  };
}

export function itemTooltip(valueFormatter: (v: number) => string) {
  return {
    trigger: 'item',
    valueFormatter: (v: unknown) =>
      typeof v === 'number' ? valueFormatter(v) : '–',
  };
}

export const rupeeAxis = (extra: Record<string, unknown> = {}) => ({
  type: 'value',
  axisLabel: { formatter: (v: number) => axisCompact(v) },
  ...extra,
});

export const countAxis = (extra: Record<string, unknown> = {}) => ({
  type: 'value',
  axisLabel: { formatter: (v: number) => v.toLocaleString('en-IN') },
  ...extra,
});

export const percentAxis = (extra: Record<string, unknown> = {}) => ({
  type: 'value',
  axisLabel: {
    formatter: (v: number) => {
      const pct = Math.round(v * 1000) / 10;
      return `${pct}%`;
    },
  },
  ...extra,
});

export function bar(
  name: string,
  data: unknown[],
  color: string,
  extra: Record<string, unknown> = {}
) {
  return {
    type: 'bar',
    name,
    data,
    barMaxWidth: 24,
    itemStyle: { color, borderRadius: [4, 4, 0, 0] },
    emphasis: { itemStyle: { opacity: 0.85 } },
    ...extra,
  };
}

/** A segment of a stacked bar: square ends and a surface-coloured gap. */
export function stackedBar(
  name: string,
  data: unknown[],
  color: string,
  stack = 'total',
  extra: Record<string, unknown> = {}
) {
  return bar(name, data, color, {
    stack,
    itemStyle: { color, borderColor: SURFACE, borderWidth: 1, borderRadius: 0 },
    ...extra,
  });
}

export function line(
  name: string,
  data: unknown[],
  color: string,
  extra: Record<string, unknown> = {}
) {
  return {
    type: 'line',
    name,
    data,
    showSymbol: false,
    symbolSize: 8,
    lineStyle: { width: 2, color },
    itemStyle: { color, borderColor: SURFACE, borderWidth: 2 },
    ...extra,
  };
}

/** A wash under a line (≈10% of the line colour). */
export const areaWash = (color: string) => ({
  areaStyle: { color, opacity: 0.1 },
});

/** Vertical reference lines with labels (slab edges, percentiles…). */
export function markLines(lines: { x: number | string; label: string }[]) {
  return {
    silent: true,
    symbol: 'none',
    lineStyle: { color: INK.secondary, type: 'solid', width: 1 },
    label: {
      color: INK.secondary,
      fontSize: 11,
      formatter: '{b}',
      position: 'insideEndTop',
    },
    data: lines.map((l) => ({ xAxis: l.x, name: l.label })),
  };
}

export const zoom = [{ type: 'inside', filterMode: 'none' }];
