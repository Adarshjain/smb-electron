// Chart colours. The sets below were checked for colour-blind separation and
// contrast against the chart surface; keep each set's order when adding
// series so a company or metal never changes colour between charts.

export const SURFACE = '#fcfcfb';

export const INK = {
  primary: '#0b0b0b',
  secondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
};

/** Categorical slots, in fixed order. */
export const SERIES = [
  '#2a78d6', // blue
  '#eb6834', // orange
  '#1baf7a', // aqua
  '#eda100', // yellow
  '#e87ba4', // magenta
  '#008300', // green
  '#4a3aa7', // violet
  '#e34948', // red
];

const COMPANY_COLORS: Record<string, string> = {
  'Sri Mahaveer Bankers': SERIES[0],
  'Mahaveer Bankers': SERIES[1],
};

export function companyColor(name: string, index = 0): string {
  return COMPANY_COLORS[name] ?? SERIES[(index + 2) % SERIES.length];
}

export const METAL_COLORS: Record<string, string> = {
  Gold: '#eda100',
  Silver: '#4a3aa7',
  Other: '#1baf7a',
};

/** One-hue ordinal ramp for the five principal brackets (light → dark). */
export const BRACKET_COLORS = [
  '#86b6ef',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
];

/** Sequential ramp for heatmaps (near zero → high). */
export const SEQUENTIAL = [
  '#f0efec',
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
];

/** Diverging ramp: blue (below) ↔ grey ↔ red (above). */
export const DIVERGING = [
  '#256abf',
  '#86b6ef',
  '#f0efec',
  '#f19999',
  '#d03b3b',
];

export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
};
