import { db } from '@/lib/db';
import { leaveRecords } from '@/lib/db/schema';
import { and, asc, eq, gte, lte } from 'drizzle-orm';
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
          leaveRecords.dateFiled,
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
  leaveType: string | null;
  dateFiled: string | null;
  dateFrom: string;
  dateTo: string;
}

// Approved leaves whose [dateFrom, dateTo] overlaps the selected range.
// Used by the Leave Report page (columns A–F only).
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
    })
    .from(leaveRecords)
    .where(
      and(
        eq(leaveRecords.status, 'Approved'),
        // overlap: from <= end AND to >= start
        lte(leaveRecords.dateFrom, end),
        gte(leaveRecords.dateTo, start),
      ),
    )
    .orderBy(asc(leaveRecords.dateFrom), asc(leaveRecords.employeeId));

  return rows.map((r) => ({
    employeeId: r.employeeId,
    name: r.name,
    leaveType: r.leaveType,
    dateFiled: r.dateFiled,
    dateFrom: r.dateFrom,
    dateTo: r.dateTo,
  }));
}
