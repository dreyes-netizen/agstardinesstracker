import { db } from '@/lib/db';
import { nteRecords, attendanceRecords, employees } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function upsertNteRequired(employeeId: string, month: string) {
  await db
    .insert(nteRecords)
    .values({ employeeId, month, status: 'required' })
    .onConflictDoNothing();
}

export async function issueNte(
  employeeId: string,
  month: string,
  issuedBy: string,
  notes: string,
) {
  await db
    .insert(nteRecords)
    .values({ employeeId, month, status: 'issued', issuedBy, notes, issuedDate: new Date().toISOString().split('T')[0] })
    .onConflictDoUpdate({
      target: [nteRecords.employeeId, nteRecords.month],
      set: {
        status: 'issued',
        issuedBy,
        notes,
        issuedDate: new Date().toISOString().split('T')[0],
        updatedAt: new Date(),
      },
    });
}

export async function acknowledgeNte(employeeId: string, month: string) {
  await db
    .update(nteRecords)
    .set({ status: 'acknowledged', acknowledgedDate: new Date().toISOString().split('T')[0], updatedAt: new Date() })
    .where(and(eq(nteRecords.employeeId, employeeId), eq(nteRecords.month, month)));
}

export async function getNteList() {
  const rows = await db.execute(sql`
    SELECT
      n.id,
      n.employee_id,
      e.first_name,
      e.last_name,
      e.department,
      e.immediate_supervisor,
      e.approver2,
      n.month,
      n.status,
      n.issued_date,
      n.issued_by,
      n.notes,
      n.acknowledged_date,
      COUNT(CASE WHEN a.late_minutes > 0 THEN 1 END)::int AS late_count,
      COALESCE(SUM(a.late_minutes), 0)::int AS accumulated_minutes
    FROM nte_records n
    JOIN employees e ON n.employee_id = e.employee_id
    LEFT JOIN attendance_records a
      ON n.employee_id = a.employee_id
      AND TO_CHAR(a.date::date, 'YYYY-MM') = n.month
    WHERE n.status IN ('required', 'issued')
    GROUP BY n.id, n.employee_id, e.first_name, e.last_name,
             e.department, e.immediate_supervisor, e.approver2,
             n.month, n.status, n.issued_date, n.issued_by, n.notes, n.acknowledged_date
    ORDER BY n.month DESC, e.last_name ASC
  `);
  return rows.rows as Record<string, unknown>[];
}
