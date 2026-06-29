import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseLeaveSheet } from '@/lib/parsers/leave';
import { UploadValidationError } from '@/lib/parsers/roster';

const HEADER = [
  'EmployeeID', 'Name', 'LeaveTypeName', 'DateFiled', 'DateFrom', 'DateTo',
  'WithPayNoOfdays', 'WoutPayNoOfDays', 'Reason', 'LeaveStatus',
];

function buildBuffer(rows: (string | number | null)[][], withSummary = true): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([HEADER, ...rows]),
    'LEAVE TRANSACTIONS REPORT',
  );
  if (withSummary) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['LEAVE SUMMARY REPORT'],
        ['FOR DATE RANGE:', '2026-04-20 - 2026-04-26'],
      ]),
      'LEAVE SUMMARY REPORT',
    );
  }
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('parseLeaveSheet', () => {
  it('throws on the wrong sheet', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Detailed');
    const buf = Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    expect(() => parseLeaveSheet(buf)).toThrow(UploadValidationError);
  });

  it('parses approved sick leave with ISO dates', () => {
    const buf = buildBuffer([
      ['21105', 'Jamorol, Analyn', 'Sick', '2026-04-15', '2026-04-14', '2026-04-21', '5', '1', 'reason', 'Approved'],
      ['23209', 'Aquino, Pauline', 'Vacation', '2026-04-03', '2026-04-19', '2026-04-21', '3', '0', 'reason', 'Pending To Immediate Supervisor'],
    ]);
    const result = parseLeaveSheet(buf);
    expect(result.periodStart).toBe('2026-04-20');
    expect(result.periodEnd).toBe('2026-04-26');
    expect(result.records).toHaveLength(2);

    const sick = result.records.find((r) => r.employeeId === '21105')!;
    expect(sick.leaveType).toBe('Sick');
    expect(sick.status).toBe('Approved');
    expect(sick.dateFrom).toBe('2026-04-14');
    expect(sick.dateTo).toBe('2026-04-21');
    expect(sick.withPayDays).toBe(5);
  });

  it('skips rows without a valid employee id or date span', () => {
    const buf = buildBuffer([
      ['', 'No ID', 'Sick', '2026-04-15', '2026-04-14', '2026-04-21', '5', '1', 'r', 'Approved'],
      ['24286', 'Bardaje', 'Sick', '2026-04-19', null, null, '1', '0', 'r', 'Approved'],
      ['24268', 'Cavinta', 'Vacation', '2026-04-06', '2026-04-20', '2026-04-21', '2', '0', 'r', 'Approved'],
    ]);
    const result = parseLeaveSheet(buf);
    expect(result.records).toHaveLength(1);
    expect(result.records[0].employeeId).toBe('24268');
  });
});
