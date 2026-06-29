import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseAttendanceSheet } from '@/lib/parsers/attendance';

function buildTestBuffer(): Buffer {
  const data: (string | number | Date | null)[][] = [
    // Employee 1 block
    ['Date:', '2026-06-01 - 2026-06-15'],
    [null],
    ['Name:', 'Aban, Ma. Melanie Pombo'],
    ['ID Number:', '25358'],
    ['Days Present:', 11],
    ['Days Absent:', 0],
    ['Date', 'Day', 'Shift Type', 'Shift', 'Biologs', 'Late', 'Undertime', 'Hrs', 'Total'],
    [new Date('2026-06-01'), 'Mon', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:09 PM TO 06:06 AM', 9, 0, 7.85, 8.95],
    [new Date('2026-06-02'), 'Tue', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:00 PM TO 06:00 AM', 0, 0, 9, 9],
    [new Date('2026-06-03'), 'Wed', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:02 PM TO 06:02 AM', 2, 0, 8.97, 8.97],
    [null, 'Sat', '', 'REST DAY', '', 0, 0, 0, 0],
    [null, 'Totals', '', '', '', 11, 0, 80.82, 100.8],
    [null], [null],
    // Employee 2 block
    ['Date:', '2026-06-01 - 2026-06-15'],
    [null],
    ['Name:', 'Ado, Jaypee Dhan Juayong'],
    ['ID Number:', '25369'],
    ['Days Present:', 11],
    ['Days Absent:', 0],
    ['Date', 'Day', 'Shift Type', 'Shift', 'Biologs', 'Late', 'Undertime', 'Hrs', 'Total'],
    [new Date('2026-06-01'), 'Mon', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:00 PM TO 06:00 AM', 0, 0, 9, 9],
    [new Date('2026-06-11'), 'Thu', 'Follows Schedule', '09:00 PM To 06:00 AM', '09:03 PM TO 06:03 AM', 3, 0, 8.95, 8.95],
    [null, 'Totals', '', '', '', 3, 0, 80.95, 101.63],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Detailed');
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('parseAttendanceSheet', () => {
  it('throws if Detailed sheet is missing', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([]), 'Sheet1');
    const buf = Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(() => parseAttendanceSheet(buf)).toThrow('Sheet "Detailed" not found');
  });

  it('extracts the report period', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    expect(result.periodStart).toBe('2026-06-01');
    expect(result.periodEnd).toBe('2026-06-15');
  });

  it('counts employees correctly', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    expect(result.employeeCount).toBe(2);
  });

  it('parses daily records for employee 25358 (skips REST DAY and Totals rows)', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    const records = result.records.filter(r => r.employeeId === '25358');
    expect(records).toHaveLength(3);
    expect(records[0]).toMatchObject({ date: '2026-06-01', lateMinutes: 9 });
    expect(records[1]).toMatchObject({ date: '2026-06-02', lateMinutes: 0 });
    expect(records[2]).toMatchObject({ date: '2026-06-03', lateMinutes: 2 });
  });

  it('parses daily records for employee 25369', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    const records = result.records.filter(r => r.employeeId === '25369');
    expect(records).toHaveLength(2);
    expect(records[1]).toMatchObject({ date: '2026-06-11', lateMinutes: 3 });
  });

  it('stamps reportPeriodStart/End on every record', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    for (const r of result.records) {
      expect(r.reportPeriodStart).toBe('2026-06-01');
      expect(r.reportPeriodEnd).toBe('2026-06-15');
    }
  });

  it('captures Total Hours Worked (col 7)', () => {
    const result = parseAttendanceSheet(buildTestBuffer());
    const records = result.records.filter((r) => r.employeeId === '25358');
    expect(records[0].totalHoursWorked).toBeCloseTo(7.85);
    expect(records[1].totalHoursWorked).toBeCloseTo(9);
  });
});

describe('parseAttendanceSheet — present vs absent', () => {
  function buildBuffer(): Buffer {
    const data: (string | number | Date | null)[][] = [
      ['Date:', '2026-04-20 - 2026-04-26'],
      ['ID Number:', '23209'],
      ['Date', 'Day', 'Shift Type', 'Shift', 'Biologs', 'Late', 'Undertime', 'Hrs', 'Total'],
      // present day (hours > 0)
      [new Date('2026-04-20'), 'Mon', 'Sched', '09:00 PM To 06:00 AM', '08:51 PM TO 06:02 AM', 0, 0, 8, 9.18],
      // absent day (scheduled but NO LOGS, 0 hours) — kept, hours 0
      [new Date('2026-04-21'), 'Tue', 'Sched', '09:00 PM To 06:00 AM', 'NO LOGS', 0, 0, 0, 0],
      // rest day — skipped
      [null, 'Sat', 'Sched', 'REST DAY', 'NO LOGS', 0, 0, 0, 0],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Detailed');
    return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
  }

  it('keeps absent days with 0 hours and skips rest days', () => {
    const result = parseAttendanceSheet(buildBuffer());
    expect(result.records).toHaveLength(2); // present + absent, rest day skipped
    const present = result.records.find((r) => r.date === '2026-04-20')!;
    const absent = result.records.find((r) => r.date === '2026-04-21')!;
    expect(present.totalHoursWorked).toBeGreaterThan(0);
    expect(absent.totalHoursWorked).toBe(0);
  });
});
