import { describe, it, expect } from 'vitest';
import {
  addDays, weekStart, weekEnd, monthEnd, lastCompleteWeekStart, formatPeriod, isValidNtePeriod,
  WEEKLY_NTE_START, buildMonthOptions,
} from '@/lib/utils/week';

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('weekStart / weekEnd', () => {
  it('returns the Monday and Sunday of the week', () => {
    expect(weekStart('2026-10-01')).toBe('2026-09-28'); // Thursday
    expect(weekStart('2026-09-28')).toBe('2026-09-28'); // Monday
    expect(weekStart('2026-10-04')).toBe('2026-09-28'); // Sunday belongs to the prior Monday
    expect(weekEnd('2026-10-01')).toBe('2026-10-04');
  });

  it('handles weeks spanning a year boundary', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-28');
    expect(weekEnd('2026-12-28')).toBe('2027-01-03');
  });
});

describe('monthEnd', () => {
  it('returns the last day of the month', () => {
    expect(monthEnd('2026-09-15')).toBe('2026-09-30');
    expect(monthEnd('2028-02-03')).toBe('2028-02-29');
    expect(monthEnd('2026-12-01')).toBe('2026-12-31');
  });
});

describe('lastCompleteWeekStart', () => {
  it('is the current week when data runs through Sunday', () => {
    expect(lastCompleteWeekStart('2026-10-04')).toBe('2026-09-28');
  });

  it('is the previous week when data stops mid-week', () => {
    expect(lastCompleteWeekStart('2026-10-07')).toBe('2026-09-28');
    expect(lastCompleteWeekStart('2026-10-05')).toBe('2026-09-28');
  });
});

describe('formatPeriod', () => {
  it('formats a week within one year', () => {
    expect(formatPeriod('2026-09-28', '2026-10-04')).toBe('Sep 28 – Oct 4, 2026');
  });

  it('formats a week spanning two years', () => {
    expect(formatPeriod('2026-12-28', '2027-01-03')).toBe('Dec 28, 2026 – Jan 3, 2027');
  });

  it('formats a full calendar month as the month name', () => {
    expect(formatPeriod('2026-09-01', '2026-09-30')).toBe('September 2026');
  });
});

describe('isValidNtePeriod', () => {
  it('accepts a Monday–Sunday week from the weekly cutover on', () => {
    expect(isValidNtePeriod('2026-09-28', '2026-10-04')).toBe(true);
    expect(isValidNtePeriod('2026-10-05', '2026-10-11')).toBe(true);
  });

  it('rejects weeks entirely before the cutover', () => {
    expect(isValidNtePeriod('2026-09-21', '2026-09-27')).toBe(false);
  });

  it('rejects ranges that are not Monday–Sunday', () => {
    expect(isValidNtePeriod('2026-10-06', '2026-10-12')).toBe(false);
    expect(isValidNtePeriod('2026-10-05', '2026-10-10')).toBe(false);
  });

  it('accepts a full month before the cutover (legacy monthly NTE)', () => {
    expect(isValidNtePeriod('2026-09-01', '2026-09-30')).toBe(true);
    expect(isValidNtePeriod(WEEKLY_NTE_START, monthEnd(WEEKLY_NTE_START))).toBe(false);
  });

  it('rejects malformed dates', () => {
    expect(isValidNtePeriod('2026-9-28', '2026-10-04')).toBe(false);
  });
});

describe('buildMonthOptions', () => {
  it('prepends All time spanning the oldest to newest month', () => {
    expect(buildMonthOptions(['2026-10', '2026-09'])).toEqual([
      { label: 'All time', start: '2026-09-01', end: '2026-10-31' },
      { label: 'October 2026', start: '2026-10-01', end: '2026-10-31' },
      { label: 'September 2026', start: '2026-09-01', end: '2026-09-30' },
    ]);
  });

  it('is empty without data', () => {
    expect(buildMonthOptions([])).toEqual([]);
  });
});
