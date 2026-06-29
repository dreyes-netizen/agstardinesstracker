import * as XLSX from 'xlsx';
import { isDateLike, toISODate, parsePeriod } from './dates';

export interface ParsedAttendanceRecord {
  employeeId: string;
  date: string;           // YYYY-MM-DD
  lateMinutes: number;
  undertimeMinutes: number;
  totalHoursWorked: number;
  shiftType: string;
  shiftSchedule: string;
  actualLogs: string;
  reportPeriodStart: string;
  reportPeriodEnd: string;
}

export interface AttendanceParseResult {
  periodStart: string;
  periodEnd: string;
  records: ParsedAttendanceRecord[];
  employeeCount: number;
}

export function parseAttendanceSheet(buffer: Buffer): AttendanceParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheet = wb.Sheets['Detailed'];
  if (!sheet) throw new Error('Sheet "Detailed" not found in workbook');

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  let periodStart = '';
  let periodEnd = '';
  let currentEmployeeId = '';
  const seenEmployees = new Set<string>();
  const records: ParsedAttendanceRecord[] = [];

  for (const row of rows) {
    const col0 = row[0] != null ? String(row[0]).trim() : '';

    if (col0 === 'Date:') {
      const p = parsePeriod(row[1]);
      if (p && !periodStart) { periodStart = p.start; periodEnd = p.end; }
      continue;
    }

    if (col0 === 'ID Number:') {
      currentEmployeeId = row[1] != null ? String(row[1]).trim() : '';
      if (currentEmployeeId) seenEmployees.add(currentEmployeeId);
      continue;
    }

    if (!currentEmployeeId) continue;
    if (!isDateLike(row[0])) continue;

    const shiftSchedule = row[3] != null ? String(row[3]) : '';
    if (shiftSchedule.toUpperCase().includes('REST DAY')) continue;

    records.push({
      employeeId: currentEmployeeId,
      date: toISODate(row[0] as Date | number),
      lateMinutes: typeof row[5] === 'number' ? Math.round(row[5]) : 0,
      undertimeMinutes: typeof row[6] === 'number' ? Math.round(row[6]) : 0,
      totalHoursWorked: typeof row[7] === 'number' ? row[7] : 0,
      shiftType: row[2] != null ? String(row[2]) : '',
      shiftSchedule,
      actualLogs: row[4] != null ? String(row[4]) : '',
      reportPeriodStart: periodStart,
      reportPeriodEnd: periodEnd,
    });
  }

  if (!periodStart) throw new Error('Could not detect report period from file');
  return { periodStart, periodEnd, records, employeeCount: seenEmployees.size };
}
