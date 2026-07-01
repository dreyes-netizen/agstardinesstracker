import { db } from '@/lib/db';
import { leaveRecords, employees } from '@/lib/db/schema';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { getRosterEmployeeIds } from './employees';
import type { ParsedLeaveRecord } from '@/lib/parsers/leave';

// Upsert leave transactions. Re-uploading overlapping weekly reports is safe:
// the unique key (employee, type, from, to, filed) collapses duplicates, and a
// status change (e.g. Pending -> Approved) updates the existing row in place.
export async function replaceLeaveFromReport(
  records: ParsedLeaveRecord[],
  periodStart: string | null,
  periodEnd: string | null,
): Promise<number> {
  const rosterIds = await getRosterEmployeeIds();
  const filtered = records.filter((r) => rosterIds.has(r.employeeId));
  if (filtered.length === 0) return 0;

  for (const r of filtered) {
    await db
      .insert(leaveRecords)
      .values({
        employeeId: r.employeeId,
        name: r.name || null,
        leaveType: r.leaveType || null,
        dateFiled: r.dateFiled,
        dateFrom: r.dateFrom,
        dateTo: r.dateTo,
        withPayDays: String(r.withPayDays ?? 0),
        woutPayDays: String(r.woutPayDays ?? 0),
        status: r.status || null,
        reportPeriodStart: periodStart,
        reportPeriodEnd: periodEnd,
      })
      .onConflictDoUpdate({
        target: [
          leaveRecords.employeeId,
          leaveRecords.leaveType,
          leaveRecords.dateFrom,
          leaveRecords.dateTo,
        ],
        set: {
          name: r.name || null,
          withPayDays: String(r.withPayDays ?? 0),
          woutPayDays: String(r.woutPayDays ?? 0),
          status: r.status || null,
          reportPeriodStart: periodStart,
          reportPeriodEnd: periodEnd,
        },
      });
  }

  return filtered.length;
}

export interface ApprovedLeaveRow {
  employeeId: string;
  name: string | null;
  department: string | null;
  immediateSupervisor: string | null;
  approver2: string | null;
  leaveType: string | null;
  dateFiled: string | null;
  dateFrom: string;
  dateTo: string;
  totalDays: number;
}

// Approved leaves whose [dateFrom, dateTo] overlaps the selected range.
// Joined with roster for department; totalDays = withPayDays + woutPayDays.
export async function getApprovedLeaves(
  start: string,
  end: string,
): Promise<ApprovedLeaveRow[]> {
  const rows = await db
    .select({
      employeeId: leaveRecords.employeeId,
      name: leaveRecords.name,
      leaveType: leaveRecords.leaveType,
      dateFiled: leaveRecords.dateFiled,
      dateFrom: leaveRecords.dateFrom,
      dateTo: leaveRecords.dateTo,
      withPayDays: leaveRecords.withPayDays,
      woutPayDays: leaveRecords.woutPayDays,
      department: employees.department,
      immediateSupervisor: employees.immediateSupervisor,
      approver2: employees.approver2,
    })
    .from(leaveRecords)
    .leftJoin(employees, eq(leaveRecords.employeeId, employees.employeeId))
    .where(
      and(
        eq(leaveRecords.status, 'Approved'),
        lte(leaveRecords.dateFrom, end),
        gte(leaveRecords.dateTo, start),
      ),
    )
    .orderBy(asc(leaveRecords.dateFrom), asc(leaveRecords.employeeId));

  return rows.map((r) => ({
    employeeId: r.employeeId,
    name: r.name,
    department: r.department ?? null,
    immediateSupervisor: r.immediateSupervisor ?? null,
    approver2: r.approver2 ?? null,
    leaveType: r.leaveType,
    dateFiled: r.dateFiled,
    dateFrom: r.dateFrom,
    dateTo: r.dateTo,
    totalDays: Number(r.withPayDays ?? 0) + Number(r.woutPayDays ?? 0),
  }));
}

// Leave summary for the Upload page status panel: count + full date span.
// Uses the report period when present, falling back to the leave's own dates.
export async function getLeaveStatus(): Promise<{ count: number; start: string | null; end: string | null }> {
  const result = await db.execute(sql`
    SELECT
      COUNT(*)::int AS count,
      MIN(COALESCE(report_period_start, date_from))::text AS start,
      MAX(COALESCE(report_period_end, date_to))::text AS "end"
    FROM leave_records
  `);
  const row = result.rows[0] as { count: number; start: string | null; end: string | null };
  return { count: Number(row?.count) || 0, start: row?.start ?? null, end: row?.end ?? null };
}
