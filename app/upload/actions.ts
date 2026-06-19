'use server';

import { parseAttendanceSheet } from '@/lib/parsers/attendance';
import { parseRosterSheet } from '@/lib/parsers/roster';
import { replaceRoster } from '@/lib/queries/employees';
import { replaceAttendancePeriod, recordUpload } from '@/lib/queries/attendance';

export interface UploadResult {
  success: boolean;
  attendanceSummary?: { period: string; employees: number; records: number };
  rosterSummary?: { employees: number; removed: number };
  error?: string;
}

export async function uploadFiles(formData: FormData): Promise<UploadResult> {
  try {
    const attendanceFile = formData.get('attendance') as File | null;
    const rosterFile = formData.get('roster') as File | null;

    let attendanceSummary: UploadResult['attendanceSummary'];
    let rosterSummary: UploadResult['rosterSummary'];

    if (rosterFile && rosterFile.size > 0) {
      const buffer = Buffer.from(await rosterFile.arrayBuffer());
      const parsed = parseRosterSheet(buffer);
      const { upserted, removed } = await replaceRoster(parsed);
      rosterSummary = { employees: upserted, removed };
    }

    if (attendanceFile && attendanceFile.size > 0) {
      const buffer = Buffer.from(await attendanceFile.arrayBuffer());
      const result = parseAttendanceSheet(buffer);

      // Upsert any employees found in attendance that aren't in the roster yet
      const minimalEmployees = Array.from(new Set(result.records.map(r => r.employeeId))).map(id => ({
        employeeId: id,
        firstName: '',
        lastName: id,
        middleName: '',
        department: '',
        immediateSupervisor: '',
        approver2: '',
        hireDate: null,
      }));
      await upsertEmployees(minimalEmployees);

      const count = await replaceAttendancePeriod(
        result.periodStart,
        result.periodEnd,
        result.records,
      );
      await recordUpload(attendanceFile.name, result.periodStart, result.periodEnd, count);

      attendanceSummary = {
        period: `${result.periodStart} to ${result.periodEnd}`,
        employees: result.employeeCount,
        records: count,
      };
    }

    return { success: true, attendanceSummary, rosterSummary };
  } catch (err) {
    console.error('Upload error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Upload failed' };
  }
}
