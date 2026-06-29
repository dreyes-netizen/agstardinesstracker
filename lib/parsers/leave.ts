import * as XLSX from 'xlsx';
import { toISODate, parsePeriod } from './dates';
import { UploadValidationError } from './roster';

export interface ParsedLeaveRecord {
  employeeId: string;
  name: string;            // col B
  leaveType: string;       // col C
  dateFiled: string | null;// col D
  dateFrom: string;        // col E
  dateTo: string;          // col F
  withPayDays: number;     // col G
  woutPayDays: number;     // col H
  status: string;          // col J
}

export interface LeaveParseResult {
  periodStart: string | null;
  periodEnd: string | null;
  records: ParsedLeaveRecord[];
}

const TX_SHEET = 'LEAVE TRANSACTIONS REPORT';
const SUMMARY_SHEET = 'LEAVE SUMMARY REPORT';

// Column indexes in the LEAVE TRANSACTIONS REPORT sheet.
const COL = {
  employeeId: 0,
  name: 1,
  leaveType: 2,
  dateFiled: 3,
  dateFrom: 4,
  dateTo: 5,
  withPay: 6,
  woutPay: 7,
  status: 9,
} as const;

function toDateString(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (val instanceof Date || typeof val === 'number' || typeof val === 'string') {
    try {
      return toISODate(val as Date | number | string);
    } catch {
      return null;
    }
  }
  return null;
}

export function parseLeaveSheet(buffer: Buffer): LeaveParseResult {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });

  const sheetName = wb.SheetNames.find(
    (n) => n.trim().toUpperCase() === TX_SHEET,
  );
  if (!sheetName) {
    throw new UploadValidationError(
      'Wrong file — expected a sheet named "LEAVE TRANSACTIONS REPORT". Did you upload the attendance or roster file by mistake?',
    );
  }

  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
  });

  // Validate the header row looks like a leave transactions sheet.
  const header = (rows[0] ?? []).map((c) => String(c ?? '').trim().toLowerCase());
  const looksValid =
    header[COL.employeeId]?.includes('employee') &&
    header[COL.leaveType]?.includes('leave') &&
    header.some((h) => h.includes('datefrom') || h === 'date from');
  if (!looksValid) {
    throw new UploadValidationError(
      'The "LEAVE TRANSACTIONS REPORT" sheet does not have the expected columns (EmployeeID, LeaveTypeName, DateFrom…).',
    );
  }

  const records: ParsedLeaveRecord[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const employeeId = row[COL.employeeId] != null ? String(row[COL.employeeId]).trim() : '';
    if (!employeeId || !/^\d+$/.test(employeeId)) continue;

    const dateFrom = toDateString(row[COL.dateFrom]);
    const dateTo = toDateString(row[COL.dateTo]);
    if (!dateFrom || !dateTo) continue; // a leave with no span can't be placed on a calendar

    records.push({
      employeeId,
      name: row[COL.name] != null ? String(row[COL.name]).trim() : '',
      leaveType: row[COL.leaveType] != null ? String(row[COL.leaveType]).trim() : '',
      dateFiled: toDateString(row[COL.dateFiled]),
      dateFrom,
      dateTo,
      withPayDays: Number(row[COL.withPay]) || 0,
      woutPayDays: Number(row[COL.woutPay]) || 0,
      status: row[COL.status] != null ? String(row[COL.status]).trim() : '',
    });
  }

  // Report period: prefer the "FOR DATE RANGE:" cell in the summary sheet.
  let periodStart: string | null = null;
  let periodEnd: string | null = null;
  const summaryName = wb.SheetNames.find(
    (n) => n.trim().toUpperCase() === SUMMARY_SHEET,
  );
  if (summaryName) {
    const sRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[summaryName], {
      header: 1, defval: null, raw: true,
    });
    for (const r of sRows.slice(0, 5)) {
      const p = parsePeriod(r?.[1]);
      if (p) { periodStart = p.start; periodEnd = p.end; break; }
    }
  }

  return { periodStart, periodEnd, records };
}
