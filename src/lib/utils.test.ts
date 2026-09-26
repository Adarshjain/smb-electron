import { describe, expect, it } from 'vitest';
import { cn } from './utils';
import { getMonthDiff, getTaxedMonthDiff } from '@/lib/myUtils.tsx';

describe('cn utility function', () => {
  it('should merge class names', () => {
    const result = cn('class1', 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn('base', isActive && 'active', isDisabled && 'disabled');
    expect(result).toBe('base active');
  });

  it('should handle array of classes', () => {
    const result = cn(['class1', 'class2']);
    expect(result).toBe('class1 class2');
  });

  it('should merge tailwind classes correctly', () => {
    // tailwind-merge should resolve conflicts
    const result = cn('px-2 py-1', 'px-4');
    expect(result).toBe('py-1 px-4');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should filter out falsy values', () => {
    const result = cn('class1', null, undefined, false, 'class2');
    expect(result).toBe('class1 class2');
  });

  it('should handle object syntax', () => {
    const result = cn({
      class1: true,
      class2: false,
      class3: true,
    });
    expect(result).toBe('class1 class3');
  });
});

describe('tax month diff', () => {
  const cases: [string, string, number][] = [
    ['2025-02-02', '2025-02-06', 1],
    ['2025-02-02', '2025-04-02', 2],
    ['2025-02-02', '2025-05-07', 4],
    ['2025-02-02', '2025-05-03', 3], // Relief for just one day - dont change it to 4
    ['2025-02-02', '2025-05-02', 3],
    ['2026-02-28', '2026-03-30', 2],
    ['2026-04-30', '2026-05-02', 1],
    ['2026-05-02', '2026-05-02', 1], // same day release
    ['2026-04-30', '2026-05-01', 1],
  ];
  it('solve cases', () => {
    cases.forEach(([from, to, count]) => {
      // console.log(`From ${from} to ${to} should be ${count} months`);
      expect(getTaxedMonthDiff(from, to)).toEqual(count);
    });
  });
});

describe('month diff', () => {
  const cases: [string, string, number][] = [
    ['2026-01-15', '2026-01-15', 0], // same day release
    ['2026-01-15', '2026-01-20', 0],
    ['2026-01-15', '2026-02-14', 0],
    ['2026-01-15', '2026-02-15', 0], // anniversary doesn't add a month
    ['2026-01-15', '2026-02-16', 1],
    ['2026-01-31', '2026-02-28', 0],
    ['2026-01-31', '2026-03-01', 1],
    ['2026-01-31', '2026-04-30', 2],
    ['2026-01-15', '2026-01-10', 0], // release before loan date
  ];
  it('solve cases', () => {
    cases.forEach(([from, to, count]) => {
      expect(getMonthDiff(from, to)).toEqual(count);
    });
  });

  it('is 0 for a loan dated today with no end date', () => {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(getMonthDiff(todayIso)).toEqual(0);
    expect(getMonthDiff(todayIso, new Date())).toEqual(0);
  });
});
