import * as XLSX from 'xlsx';

export interface ParsedEmployee {
  employeeId: string;
  lastName: string;
  middleName: string;
  firstName: string;
  department: string;
  immediateSupervisor: string;
  approver2: string;
  hireDate: string | null; // YYYY-MM-DD or null
}

function parseHireDate(val: unknown): string | null {
  if (val == null) return null;
  if (val instanceof Date && !isNaN(val.getTime())) {
    const d = new Date(val.getTime() - val.getTimezoneOffset() * 60000);
    return d.toISOString().split('T')[0];
  }
  const str = String(val).trim();
  if (!str || str === 'N/A') return null;
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

export function parseRosterSheet(buffer: Buffer): ParsedEmployee[] {
  const wb = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  const sheetName =
    wb.SheetNames.find((n) => n.toLowerCase().includes('employee')) ??
    wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  if (!sheet) throw new Error('No employee sheet found in roster file');

  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  });

  const employees: ParsedEmployee[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const employeeId = row[0] != null ? String(row[0]).trim() : '';
    if (!employeeId) continue;

    employees.push({
      employeeId,
      lastName: row[1] != null ? String(row[1]).trim() : '',
      middleName: row[2] != null ? String(row[2]).trim() : '',
      firstName: row[3] != null ? String(row[3]).trim() : '',
      department: row[4] != null ? String(row[4]).trim() : '',
      immediateSupervisor: row[5] != null ? String(row[5]).trim() : '',
      approver2: row[6] != null ? String(row[6]).trim() : '',
      hireDate: parseHireDate(row[10]),
    });
  }

  return employees;
}
