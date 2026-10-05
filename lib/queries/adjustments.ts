import { db } from '@/lib/db';
import { lateAdjustments, nteRecords } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import type { NteDbStatus } from '@/lib/utils/nte-status';

// ── Shared SQL fragments ───────────────────────────────────────────────────
// Every tardiness/NTE query joins the overlay and reads late minutes through
// effectiveLateSql instead of a.late_minutes. LEAST() guarantees an adjustment can
// only lower lateness, even if a re-upload later lowers the original value.
// Attendance Score queries must NOT use these.
//
//   FROM attendance_records a ${adjustmentJoinSql('a')}
//   ... SUM(${effectiveLateSql('a')}) ...
export function adjustmentJoinSql(alias = 'a') {
  const a = sql.raw(alias);
  return sql`LEFT JOIN late_adjustments adj ON adj.employee_id = ${a}.employee_id AND adj.date = ${a}.date`;
}

export function effectiveLateSql(alias = 'a') {
  const a = sql.raw(alias);
  return sql`LEAST(COALESCE(adj.adjusted_minutes, ${a}.late_minutes), ${a}.late_minutes)`;
}

// ── CRUD ───────────────────────────────────────────────────────────────────
export async function getOriginalLateMinutes(employeeId: string, date: string): Promise<number | null> {
  const r = await db.execute(sql`
    SELECT late_minutes FROM attendance_records
    WHERE employee_id = ${employeeId} AND date = ${date}::date
  `);
  const row = r.rows[0] as { late_minutes: number } | undefined;
  return row ? Number(row.late_minutes) : null;
}

export async function getAdjustment(employeeId: string, date: string) {
  const rows = await db
    .select()
    .from(lateAdjustments)
    .where(and(eq(lateAdjustments.employeeId, employeeId), eq(lateAdjustments.date, date)))
    .limit(1);
  return rows[0] ?? null;
}

export async function upsertAdjustment(
  employeeId: string, date: string, adjustedMinutes: number, reason: string, createdBy: string,
) {
  await db
    .insert(lateAdjustments)
    .values({ employeeId, date, adjustedMinutes, reason, createdBy })
    .onConflictDoUpdate({
      target: [lateAdjustments.employeeId, lateAdjustments.date],
      set: { adjustedMinutes, reason, createdBy, updatedAt: new Date() },
    });
}

export async function deleteAdjustment(employeeId: string, date: string) {
  await db
    .delete(lateAdjustments)
    .where(and(eq(lateAdjustments.employeeId, employeeId), eq(lateAdjustments.date, date)));
}

// ── Legacy monthly NTE reconciliation (dates before WEEKLY_NTE_START) ─────
export async function getEffectivePeriodTotals(employeeId: string, start: string, end: string) {
  const r = await db.execute(sql`
    SELECT
      COUNT(CASE WHEN ${effectiveLateSql('a')} > 0 THEN 1 END)::int AS late_count,
      COALESCE(SUM(${effectiveLateSql('a')}), 0)::int AS accumulated_minutes
    FROM attendance_records a
    ${adjustmentJoinSql('a')}
    WHERE a.employee_id = ${employeeId}
      AND a.date >= ${start}::date
      AND a.date <= ${end}::date
  `);
  const row = r.rows[0] as { late_count: number; accumulated_minutes: number };
  return { lateCount: Number(row.late_count) || 0, accumulatedMinutes: Number(row.accumulated_minutes) || 0 };
}

function periodWhere(employeeId: string, start: string, end: string) {
  return and(
    eq(nteRecords.employeeId, employeeId),
    eq(nteRecords.periodStart, start),
    eq(nteRecords.periodEnd, end),
  );
}

export async function getNteDbStatus(employeeId: string, start: string, end: string): Promise<NteDbStatus> {
  const rows = await db
    .select({ status: nteRecords.status })
    .from(nteRecords)
    .where(periodWhere(employeeId, start, end))
    .limit(1);
  return (rows[0]?.status as NteDbStatus) ?? null;
}

// Guarded on status so an NTE issued concurrently is never removed.
export async function deleteRequiredNte(employeeId: string, start: string, end: string) {
  await db
    .delete(nteRecords)
    .where(and(periodWhere(employeeId, start, end), eq(nteRecords.status, 'required')));
}
