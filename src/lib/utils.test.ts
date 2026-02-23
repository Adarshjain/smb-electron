import { describe, expect, it } from 'vitest';
import { cn } from './utils';
import { calculateMonths } from '@/lib/myUtils.tsx';

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
    ['2025-02-02', '2025-05-03', 3],
    ['2025-02-02', '2025-05-02', 3],
    ['2026-02-28', '2026-03-30', 2],
  ];
  it('solve cases', () => {
    cases.forEach(([from, to, count]) =>
      expect(calculateMonths(from, to)).toEqual(count)
    );
  });
});
