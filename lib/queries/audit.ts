import { db } from '@/lib/db';
import { nteAuditLog } from '@/lib/db/schema';
import { and, desc, eq, sql, SQL } from 'drizzle-orm';

export interface NteAuditInput {
  nteRecordId?: number | null;
  employeeId: string;
  periodStart: string;
  periodEnd: string;
  month?: string;          // defaults to the month the period ends in
  action: string;          // 'issued' | 'acknowledged' | …
  actorEmail: string;
  actorRole?: string | null;
  details?: string | null;
}

// Append one entry to the NTE audit trail. Never updates/deletes — append-only.
export async function addNteAuditEntry(e: NteAuditInput) {
  await db.insert(nteAuditLog).values({
    nteRecordId: e.nteRecordId ?? null,
    employeeId: e.employeeId,
    month: e.month ?? e.periodEnd.slice(0, 7),
    periodStart: e.periodStart,
    periodEnd: e.periodEnd,
    action: e.action,
    actorEmail: e.actorEmail,
    actorRole: e.actorRole ?? null,
    details: e.details ?? null,
  });
}

// Inline history for one NTE (employee + period), newest first.
export async function getNteAuditForPeriod(employeeId: string, periodStart: string, periodEnd: string) {
  return db
    .select()
    .from(nteAuditLog)
    .where(and(
      eq(nteAuditLog.employeeId, employeeId),
      eq(nteAuditLog.periodStart, periodStart),
      eq(nteAuditLog.periodEnd, periodEnd),
    ))
    .orderBy(desc(nteAuditLog.createdAt));
}

export interface AuditLogFilters {
  action?: string;
  month?: string;
  actor?: string;
}

// Global audit log (Audit Log page), joined to employee names, newest first.
export async function getNteAuditLog(filters: AuditLogFilters = {}) {
  const conditions: SQL[] = [];
  if (filters.action && filters.action !== 'all') conditions.push(sql`l.action = ${filters.action}`);
  if (filters.month) conditions.push(sql`l.month = ${filters.month}`);
  if (filters.actor) conditions.push(sql`l.actor_email = ${filters.actor}`);
  const where = conditions.length ? sql`WHERE ${sql.join(conditions, sql` AND `)}` : sql``;

  const rows = await db.execute(sql`
    SELECT
      l.id, l.created_at, l.action, l.actor_email, l.actor_role,
      l.employee_id, l.month, l.period_start::text AS period_start, l.period_end::text AS period_end, l.details,
      e.first_name, e.last_name
    FROM nte_audit_log l
    LEFT JOIN employees e ON e.employee_id = l.employee_id
    ${where}
    ORDER BY l.created_at DESC
    LIMIT 1000
  `);
  return rows.rows as Record<string, unknown>[];
}

// Distinct actors and months for the audit page filters.
export async function getAuditFilterOptions() {
  const [actors, months] = await Promise.all([
    db.execute(sql`SELECT DISTINCT actor_email FROM nte_audit_log ORDER BY actor_email ASC`),
    db.execute(sql`SELECT DISTINCT month FROM nte_audit_log ORDER BY month DESC`),
  ]);
  return {
    actors: (actors.rows as { actor_email: string }[]).map((r) => r.actor_email),
    months: (months.rows as { month: string }[]).map((r) => r.month),
  };
}
