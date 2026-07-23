import { describe, it, expect } from 'vitest';
import { classifyDayType } from '@/lib/utils/day-type';

describe('classifyDayType', () => {
  it('classifies holiday shift schedules', () => {
    expect(classifyDayType('09:00 PM To 06:00 AM (HOLIDAY)')).toBe('holiday');
    expect(classifyDayType('HOLIDAY')).toBe('holiday');
    expect(classifyDayType('REST DAY AND HOLIDAY')).toBe('holiday');
  });

  it('classifies on-leave shift schedules', () => {
    expect(classifyDayType('ON LEAVE')).toBe('on-leave');
  });

  it('classifies unpaid leave shift schedules', () => {
    expect(classifyDayType('09:00 PM To 06:00 AM (UNPAID LEAVE)')).toBe('unpaid-leave');
  });

  it('classifies not-yet-hired shift schedules', () => {
    expect(classifyDayType('NOT YET HIRED')).toBe('not-yet-hired');
  });

  it('is case-insensitive', () => {
    expect(classifyDayType('holiday')).toBe('holiday');
    expect(classifyDayType('on leave')).toBe('on-leave');
  });

  it('treats normal shifts and half-day leave as working days', () => {
    expect(classifyDayType('09:00 PM To 06:00 AM')).toBe('working');
    expect(classifyDayType('08:00 AM To 05:00 PM (HALF DAY LEAVE)')).toBe('working');
  });

  it('treats null/empty schedule as working', () => {
    expect(classifyDayType(null)).toBe('working');
    expect(classifyDayType(undefined)).toBe('working');
    expect(classifyDayType('')).toBe('working');
  });
});
