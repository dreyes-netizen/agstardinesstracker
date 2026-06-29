import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { parseAttendanceSheet } from '@/lib/parsers/attendance';
import { parseRosterSheet, UploadValidationError } from '@/lib/parsers/roster';
import { parseLeaveSheet } from '@/lib/parsers/leave';
import { replaceRoster, getRosterEmployeeIds } from '@/lib/queries/employees';
import { replaceAttendancePeriod, recordUpload } from '@/lib/queries/attendance';
import { replaceLeaveFromReport } from '@/lib/queries/leave';
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

// Constant-time password check. Returns false on length mismatch without
// comparing (timingSafeEqual throws on unequal-length buffers).
function passwordMatches(submitted: string, expected: string): boolean {
  const a = Buffer.from(submitted, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Gate the entire upload behind the server-side password before any
    // parsing or DB writes. The secret lives in UPLOAD_PASSWORD (Vercel env).
    const expectedPassword = process.env.UPLOAD_PASSWORD;
    if (!expectedPassword) {
      return NextResponse.json(
        { success: false, error: 'Upload password is not configured on the server.' },
        { status: 500 },
      );
    }
    const submittedPassword = (formData.get('password') as string | null) ?? '';
    if (!passwordMatches(submittedPassword, expectedPassword)) {
      return NextResponse.json(
        { success: false, error: 'Incorrect password.' },
        { status: 401 },
      );
    }

    const attendanceFile = formData.get('attendance') as File | null;
    const rosterFile = formData.get('roster') as File | null;
    const leaveFile = formData.get('leave') as File | null;

    let attendanceSummary: { period: string; employees: number; records: number } | undefined;
    let rosterSummary: { employees: number; removed: number } | undefined;
    let leaveSummary: { period: string; records: number } | undefined;

    if (rosterFile && rosterFile.size > 0) {
      if (rosterFile.size > 10 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: 'Roster file exceeds the 10 MB limit.' }, { status: 400 });
      }
      const buffer = Buffer.from(await rosterFile.arrayBuffer());
      const parsed = parseRosterSheet(buffer);
      if (parsed.length < 5) {
        return NextResponse.json(
          { success: false, error: `Roster upload rejected — only ${parsed.length} employee(s) detected. Upload the full Employee List Report to avoid accidental data loss.` },
          { status: 400 },
        );
      }
      const { upserted, removed } = await replaceRoster(parsed);
      rosterSummary = { employees: upserted, removed };
    }

    if (attendanceFile && attendanceFile.size > 0 && attendanceFile.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: 'Attendance file exceeds the 10 MB limit.' }, { status: 400 });
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

    if (leaveFile && leaveFile.size > 0) {
      if (leaveFile.size > 10 * 1024 * 1024) {
        return NextResponse.json({ success: false, error: 'Leave report file exceeds the 10 MB limit.' }, { status: 400 });
      }
      const buffer = Buffer.from(await leaveFile.arrayBuffer());
      const parsed = parseLeaveSheet(buffer);
      const count = await replaceLeaveFromReport(parsed.records, parsed.periodStart, parsed.periodEnd);
      leaveSummary = {
        period: parsed.periodStart && parsed.periodEnd
          ? `${parsed.periodStart} to ${parsed.periodEnd}`
          : 'detected dates',
        records: count,
      };
    }

    return NextResponse.json({ success: true, attendanceSummary, rosterSummary, leaveSummary });
  } catch (err) {
    console.error('Upload error:', err);
    const message = err instanceof UploadValidationError
      ? err.message
      : 'Upload failed. Please check your files and try again.';
    return NextResponse.json(
      { success: false, error: message },
      { status: err instanceof UploadValidationError ? 400 : 500 },
    );
  }
}
