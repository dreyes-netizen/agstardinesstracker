import * as XLSX from 'xlsx';

export interface ParsedAttendanceRecord {
  employeeId: string;
  date: string;           // YYYY-MM-DD
  lateMinutes: number;
  undertimeMinutes: number;
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

function isDateLike(val: unknown): boolean {
  if (val instanceof Date) return !isNaN(val.getTime());
  if (typeof val === 'number') return val > 40000 && val < 60000;
  if (typeof val === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(val) || /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(val);
  }
  return false;
}

function toISODate(val: Date | number | string): string {
  if (typeof val === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    // MM/DD/YYYY
    const p = val.split('/');
    return `${p[2]}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}`;
  }
  let d: Date;
  if (val instanceof Date) {
    d = new Date(val.getTime() - val.getTimezoneOffset() * 60000);
  } else {
    d = new Date((val - 25569) * 86400 * 1000);
  }
  return d.toISOString().split('T')[0];
}

function parsePeriod(val: unknown): { start: string; end: string } | null {
  if (typeof val !== 'string') return null;
  const m = val.match(/(\d{4}-\d{2}-\d{2})\s*-\s*(\d{4}-\d{2}-\d{2})/);
  return m ? { start: m[1], end: m[2] } : null;
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
