import { NextRequest, NextResponse } from 'next/server';
import { parseAttendanceSheet } from '@/lib/parsers/attendance';
import { parseRosterSheet } from '@/lib/parsers/roster';
import { replaceRoster, getRosterEmployeeIds } from '@/lib/queries/employees';
import { replaceAttendancePeriod, recordUpload } from '@/lib/queries/attendance';
import { syncNteForMonth } from '@/lib/queries/nte';

function getMonthsInRange(start: string, end: string): string[] {
  const months = new Set<string>();
  const current = new Date(start + 'T00:00:00');
  const endDate = new Date(end + 'T00:00:00');
  while (current <= endDate) {
    months.add(current.toISOString().substring(0, 7));
    current.setMonth(current.getMonth() + 1);
  }
  return Array.from(months);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const attendanceFile = formData.get('attendance') as File | null;
    const rosterFile = formData.get('roster') as File | null;

    let attendanceSummary: { period: string; employees: number; records: number } | undefined;
    let rosterSummary: { employees: number; removed: number } | undefined;

    if (rosterFile && rosterFile.size > 0) {
      const buffer = Buffer.from(await rosterFile.arrayBuffer());
      const parsed = parseRosterSheet(buffer);
      const { upserted, removed } = await replaceRoster(parsed);
      rosterSummary = { employees: upserted, removed };
    }

    if (attendanceFile && attendanceFile.size > 0) {
      const buffer = Buffer.from(await attendanceFile.arrayBuffer());
      const result = parseAttendanceSheet(buffer);

      const rosterIds = await getRosterEmployeeIds();
      const filteredRecords = result.records.filter(r => rosterIds.has(r.employeeId));

      const count = await replaceAttendancePeriod(
        result.periodStart,
        result.periodEnd,
        filteredRecords,
      );
      await recordUpload(attendanceFile.name, result.periodStart, result.periodEnd, count);

      const months = getMonthsInRange(result.periodStart, result.periodEnd);
      await Promise.all(months.map((m) => syncNteForMonth(m)));

      const skipped = result.records.length - filteredRecords.length;
      attendanceSummary = {
        period: `${result.periodStart} to ${result.periodEnd}`,
        employees: new Set(filteredRecords.map(r => r.employeeId)).size,
        records: count,
        ...(skipped > 0 && { skipped }),
      };
    }

    return NextResponse.json({ success: true, attendanceSummary, rosterSummary });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
