// Number formatting for the analytics screen, in Indian units.

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹4,52,300 */
export function rupees(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '–';
  return `₹${inr.format(Math.round(value))}`;
}

/** ₹4.5L, ₹1.23Cr, ₹8.2K */
export function rupeesCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '–';
  const sign = value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7, 2)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5, 1)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3, 1)}K`;
  return `${sign}₹${Math.round(abs)}`;
}

function trim(value: number, digits: number): string {
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

/** Axis ticks: 4.5L, 1.2Cr (no symbol, keeps axes quiet). */
export function axisCompact(value: number): string {
  return rupeesCompact(value).replace('₹', '');
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '–';
  return inr.format(Math.round(value));
}

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '–';
  return `${(value * 100).toFixed(digits)}%`;
}

export function grams(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '–';
  if (Math.abs(value) >= 1000) return `${trim(value / 1000, 2)} kg`;
  return `${trim(value, 1)} g`;
}

export function months(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return '–';
  const rounded = Math.round(value * 10) / 10;
  return `${rounded} ${rounded === 1 ? 'month' : 'months'}`;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/** '2024-03' → 'Mar 24' */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y.slice(2)}`;
}

export function monthName(index: number): string {
  return MONTH_NAMES[index];
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Every 'YYYY-MM' from `from` to `to`, inclusive. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
