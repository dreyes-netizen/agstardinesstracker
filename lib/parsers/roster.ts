import * as XLSX from 'xlsx';

export interface ParsedEmployee {
  employeeId: string;
  lastName: string;
  middleName: string;
  firstName: string;
  department: string;
  immediateSupervisor: string;
  approver2: string;
  hireDate: string | null;
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

// Maps a header cell string to a canonical field name.
// Partial, case-insensitive matching so "Employee ID", "Emp ID", "ID Number" all resolve.
const HEADER_MAP: Array<[RegExp, string]> = [
  [/id.*(number|no|#)|employee.*id|emp.*id/i, 'employeeId'],
  [/last.*name|surname/i,                     'lastName'],
  [/middle.*name/i,                            'middleName'],
  [/first.*name|given.*name/i,                 'firstName'],
  [/department|dept/i,                          'department'],
  [/immediate.*supervisor|supervisor/i,         'immediateSupervisor'],
  [/approver.*2|manager|approver/i,             'approver2'],
  [/hire.*date|date.*hired|start.*date/i,       'hireDate'],
];

function detectHeaders(row: unknown[]): Record<string, number> {
  const map: Record<string, number> = {};
  row.forEach((cell, i) => {
    if (cell == null) return;
    const text = String(cell).trim();
    for (const [pattern, field] of HEADER_MAP) {
      if (pattern.test(text) && !(field in map)) {
        map[field] = i;
        break;
      }
    }
  });
  return map;
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

  // Find the header row — first row where we can detect at least 3 known fields
  let headerRowIndex = -1;
  let colMap: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const detected = detectHeaders(rows[i]);
    if (Object.keys(detected).length >= 3) {
      headerRowIndex = i;
      colMap = detected;
      break;
    }
  }

  // Fall back to fixed column positions if header detection fails
  if (headerRowIndex === -1) {
    colMap = {
      employeeId: 0,
      lastName: 1,
      middleName: 2,
      firstName: 3,
      department: 4,
      immediateSupervisor: 5,
      approver2: 6,
      hireDate: 10,
    };
    headerRowIndex = 0;
  }

  const employees: ParsedEmployee[] = [];

  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const get = (field: string) =>
      colMap[field] !== undefined && row[colMap[field]] != null
        ? String(row[colMap[field]]).trim()
        : '';

    const employeeId = get('employeeId');
    if (!employeeId) continue;

    employees.push({
      employeeId,
      lastName: get('lastName'),
      middleName: get('middleName'),
      firstName: get('firstName'),
      department: get('department'),
      immediateSupervisor: get('immediateSupervisor'),
      approver2: get('approver2'),
      hireDate: parseHireDate(
        colMap['hireDate'] !== undefined ? row[colMap['hireDate']] : null,
      ),
    });
  }

  return employees;
}
