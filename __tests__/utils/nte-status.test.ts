import { describe, it, expect } from 'vitest';
import { computeNteStatus } from '@/lib/utils/nte-status';

describe('computeNteStatus', () => {
  it('returns safe when count < 4 and minutes < 45', () => {
    expect(computeNteStatus(0, 0, null)).toBe('safe');
    expect(computeNteStatus(3, 44, null)).toBe('safe');
  });

  it('returns warning when count is 4-5', () => {
    expect(computeNteStatus(4, 10, null)).toBe('warning');
    expect(computeNteStatus(5, 10, null)).toBe('warning');
  });

  it('returns warning when minutes are 45-59', () => {
    expect(computeNteStatus(1, 45, null)).toBe('warning');
    expect(computeNteStatus(1, 59, null)).toBe('warning');
  });

  it('returns required when count >= 6', () => {
    expect(computeNteStatus(6, 0, null)).toBe('required');
    expect(computeNteStatus(7, 100, null)).toBe('required');
  });

  it('returns required when minutes >= 60', () => {
    expect(computeNteStatus(1, 60, null)).toBe('required');
    expect(computeNteStatus(2, 75, null)).toBe('required');
  });

  it('returns issued when db status is issued (regardless of counts)', () => {
    expect(computeNteStatus(6, 65, 'issued')).toBe('issued');
  });

  it('returns acknowledged when db status is acknowledged', () => {
    expect(computeNteStatus(6, 65, 'acknowledged')).toBe('acknowledged');
  });

  it('db status required is treated same as computed required', () => {
    expect(computeNteStatus(6, 0, 'required')).toBe('required');
  });
});
