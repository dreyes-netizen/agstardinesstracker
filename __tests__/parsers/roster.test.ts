import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { parseRosterSheet } from '@/lib/parsers/roster';

function buildRosterBuffer(): Buffer {
  const data = [
    ['Employee ID', 'Last Name', 'Middle Name', 'First Name', 'Department', 'Immediate Supervisor', 'Approver 2', 'Approver 3', 'Approver 4', 'Approver 5', 'Hire Date'],
    ['25358', 'Aban', 'Pombo', 'Ma. Melanie', 'Flyland Recovery', 'Roxanne Reyes', 'Mark Dwane Laurente', 'N/A', 'N/A', 'N/A', '2020-01-15'],
    ['25369', 'Ado', 'Juayong', 'Jaypee Dhan', 'Flyland Recovery', 'Roxanne Reyes', 'Mark Dwane Laurente', 'N/A', 'N/A', 'N/A', null],
    ['24229', 'Budol', 'Aquino', 'Arjay', 'Fundward', 'Carl Stephen Paolo Ong', 'Djanisse Toledo', 'N/A', 'N/A', 'N/A', '2019-03-10'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employee List Report');
  return Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
}

describe('parseRosterSheet', () => {
  it('returns one employee per data row (skips header)', () => {
    const employees = parseRosterSheet(buildRosterBuffer());
    expect(employees).toHaveLength(3);
  });

  it('maps columns to correct fields', () => {
    const [emp] = parseRosterSheet(buildRosterBuffer());
    expect(emp).toMatchObject({
      employeeId: '25358',
      lastName: 'Aban',
      middleName: 'Pombo',
      firstName: 'Ma. Melanie',
      department: 'Flyland Recovery',
      immediateSupervisor: 'Roxanne Reyes',
      approver2: 'Mark Dwane Laurente',
    });
  });

  it('parses a valid hire date', () => {
    const [emp] = parseRosterSheet(buildRosterBuffer());
    expect(emp.hireDate).toBe('2020-01-15');
  });

  it('returns null hireDate when cell is empty', () => {
    const employees = parseRosterSheet(buildRosterBuffer());
    expect(employees[1].hireDate).toBeNull();
  });

  it('skips rows with no employee ID', () => {
    const data = [
      ['Employee ID', 'Last Name', 'Middle Name', 'First Name', 'Department', 'Immediate Supervisor', 'Approver 2'],
      [null, 'Nobody', '', 'Empty', 'Dept', 'Sup', 'Mgr'],
      ['99999', 'Valid', '', 'Employee', 'Dept', 'Sup', 'Mgr'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employee List Report');
    const buf = Buffer.from(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }));
    const employees = parseRosterSheet(buf);
    expect(employees).toHaveLength(1);
    expect(employees[0].employeeId).toBe('99999');
  });
});
