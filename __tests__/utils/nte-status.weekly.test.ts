import { describe, it, expect } from 'vitest';
import { weekNeedsNte, computeWeeklyNteStatus } from '@/lib/utils/nte-status';

// October walkthrough agreed with HR: monthly threshold, reviewed each week.
describe('weekNeedsNte', () => {
  it('week 1: 3 lates / 25 min month-to-date is safe', () => {
    expect(weekNeedsNte(3, 3, 25)).toBe(false);
  });

  it('week 2: crossing 6 lates month-to-date triggers NTE #1', () => {
    expect(weekNeedsNte(3, 6, 45)).toBe(true);
  });

  it('week 3: any further late after crossing triggers NTE #2', () => {
    expect(weekNeedsNte(1, 7, 50)).toBe(true);
  });

  it('week 4: no lates this week means no NTE even when over the threshold', () => {
    expect(weekNeedsNte(0, 7, 50)).toBe(false);
  });

  it('crossing on minutes alone also triggers', () => {
    expect(weekNeedsNte(1, 2, 60)).toBe(true);
  });
});

describe('computeWeeklyNteStatus', () => {
  it('db issued/acknowledged always wins', () => {
    expect(computeWeeklyNteStatus(false, 0, 0, 'issued')).toBe('issued');
    expect(computeWeeklyNteStatus(true, 9, 90, 'acknowledged')).toBe('acknowledged');
  });

  it('required when the week needs an NTE', () => {
    expect(computeWeeklyNteStatus(true, 6, 45, null)).toBe('required');
  });

  it('warning when over the threshold but not late this week', () => {
    expect(computeWeeklyNteStatus(false, 7, 50, null)).toBe('warning');
  });

  it('warning when approaching, safe otherwise', () => {
    expect(computeWeeklyNteStatus(false, 4, 10, null)).toBe('warning');
    expect(computeWeeklyNteStatus(false, 1, 45, null)).toBe('warning');
    expect(computeWeeklyNteStatus(false, 3, 44, null)).toBe('safe');
  });
});
