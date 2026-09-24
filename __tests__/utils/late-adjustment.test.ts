import { describe, it, expect } from 'vitest';
import { validateAdjustment, shouldClearRequiredNte } from '@/lib/utils/late-adjustment';

describe('validateAdjustment', () => {
  it('accepts a reduction with a reason', () => {
    expect(validateAdjustment(41, 10, 'System lag')).toBeNull();
  });

  it('accepts a waiver (0 minutes)', () => {
    expect(validateAdjustment(41, 0, 'Approved by HR')).toBeNull();
  });

  it('rejects a blank reason', () => {
    expect(validateAdjustment(41, 10, '   ')).toMatch(/reason/i);
  });

  it('rejects negative, non-integer, or non-reducing minutes', () => {
    expect(validateAdjustment(41, -1, 'x')).not.toBeNull();
    expect(validateAdjustment(41, 2.5, 'x')).not.toBeNull();
    expect(validateAdjustment(41, 41, 'x')).not.toBeNull();
    expect(validateAdjustment(41, 50, 'x')).not.toBeNull();
  });

  it('rejects adjusting a day that was not late', () => {
    expect(validateAdjustment(0, 0, 'x')).not.toBeNull();
  });
});

describe('shouldClearRequiredNte', () => {
  it('clears a required NTE once back under both thresholds', () => {
    expect(shouldClearRequiredNte(5, 59, 'required')).toBe(true);
  });

  it('keeps it while either threshold is still crossed', () => {
    expect(shouldClearRequiredNte(6, 10, 'required')).toBe(false);
    expect(shouldClearRequiredNte(2, 60, 'required')).toBe(false);
  });

  it('never touches issued/acknowledged or missing records', () => {
    expect(shouldClearRequiredNte(0, 0, 'issued')).toBe(false);
    expect(shouldClearRequiredNte(0, 0, 'acknowledged')).toBe(false);
    expect(shouldClearRequiredNte(0, 0, null)).toBe(false);
  });
});
