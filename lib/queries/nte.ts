import { db } from '@/lib/db';
import { nteRecords, attendanceRecords, employees } from '@/lib/db/schema';
import { and, eq, sql, SQL } from 'drizzle-orm';

export async function upsertNteRequired(employeeId: string, month: string) {
  await db
    .insert(nteRecords)
    .values({ employeeId, month, status: 'required' })
    .onConflictDoNothing();
}

// Single-query sync for one month (used by upload route after new data lands).
// INSERT INTO … SELECT collapses N per-employee upserts into one roundtrip.
export async function syncNteForMonth(month: string) {
  await db.execute(sql`
    INSERT INTO nte_records (employee_id, month, status)
    SELECT
      employee_id,
      ${month} AS month,
      'required'  AS status
    FROM attendance_records
    WHERE TO_CHAR(date::date, 'YYYY-MM') = ${month}
    GROUP BY employee_id
    HAVING COUNT(CASE WHEN late_minutes > 0 THEN 1 END) >= 6
        OR COALESCE(SUM(late_minutes), 0) >= 60
    ON CONFLICT (employee_id, month) DO NOTHING
  `);
}

// Single-query sync across ALL months at once — used on NTE page load.
export async function syncAllNteRequired() {
  await db.execute(sql`
    INSERT INTO nte_records (employee_id, month, status)
    SELECT
      employee_id,
      TO_CHAR(date::date, 'YYYY-MM') AS month,
      'required'                      AS status
    FROM attendance_records
    GROUP BY employee_id, TO_CHAR(date::date, 'YYYY-MM')
    HAVING COUNT(CASE WHEN late_minutes > 0 THEN 1 END) >= 6
        OR COALESCE(SUM(late_minutes), 0) >= 60
    ON CONFLICT (employee_id, month) DO NOTHING
  `);
}

// Returns today's date in Asia/Manila timezone as YYYY-MM-DD.
// toISOString() is always UTC — if the server is UTC and the user is UTC+8,
// anything after 4 PM PH time would store tomorrow's date.
function todayPH(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export async function issueNte(
  employeeId: string,
  month: string,
  issuedBy: string,
  notes: string,
) {
  const today = todayPH();
  await db
    .insert(nteRecords)
    .values({ employeeId, month, status: 'issued', issuedBy, notes, issuedDate: today })
    .onConflictDoUpdate({
      target: [nteRecords.employeeId, nteRecords.month],
      set: {
        status: 'issued',
        issuedBy,
        notes,
        issuedDate: today,
        updatedAt: new Date(),
      },
    });
}

export async function acknowledgeNte(employeeId: string, month: string) {
  // Guard: only acknowledge records that are already in 'issued' state.
  // Prevents skipping the issue step (e.g. going required → acknowledged directly).
  await db
    .update(nteRecords)
    .set({ status: 'acknowledged', acknowledgedDate: todayPH(), updatedAt: new Date() })
    .where(and(
      eq(nteRecords.employeeId, employeeId),
      eq(nteRecords.month, month),
      eq(nteRecords.status, 'issued'),
    ));
}

export interface NteListFilters {
  status?: string;
  month?: string;
  department?: string;
}

export async function getNteList(filters: NteListFilters = {}) {
  const conditions: SQL[] = [];

  if (filters.status && filters.status !== 'all') {
    conditions.push(sql`n.status = ${filters.status}`);
  } else {
    conditions.push(sql`n.status IN ('required', 'issued', 'acknowledged')`);
  }

  if (filters.month) {
    conditions.push(sql`n.month = ${filters.month}`);
  }

  if (filters.department) {
    conditions.push(sql`e.department = ${filters.department}`);
  }

  const whereClause = sql`WHERE ${sql.join(conditions, sql` AND `)}`;

  const rows = await db.execute(sql`
    SELECT
      n.id,
      n.employee_id,
      e.first_name,
      e.last_name,
      e.middle_name,
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
    ${whereClause}
    GROUP BY n.id, n.employee_id, e.first_name, e.last_name, e.middle_name,
             e.department, e.immediate_supervisor, e.approver2,
             n.month, n.status, n.issued_date, n.issued_by, n.notes, n.acknowledged_date
    ORDER BY n.month DESC, e.last_name ASC
  `);
  return rows.rows as Record<string, unknown>[];
}

export async function getNteCounts(filters: { month?: string; department?: string } = {}) {
  const conditions: SQL[] = [];
  if (filters.month) conditions.push(sql`n.month = ${filters.month}`);
  if (filters.department) conditions.push(sql`e.department = ${filters.department}`);

  const join = filters.department
    ? sql`JOIN employees e ON n.employee_id = e.employee_id`
    : sql``;
  const where = conditions.length > 0
    ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
    : sql``;

  const result = await db.execute(sql`
    SELECT n.status, COUNT(*)::int AS count
    FROM nte_records n
    ${join}
    ${where}
    GROUP BY n.status
  `);
  const map: Record<string, number> = {};
  for (const row of result.rows as { status: string; count: number }[]) {
    map[row.status] = row.count;
  }
  return {
    required: map['required'] ?? 0,
    issued: map['issued'] ?? 0,
    acknowledged: map['acknowledged'] ?? 0,
  };
}

export async function getNteFilterOptions() {
  const [months, departments] = await Promise.all([
    // Use attendance_records so all uploaded months appear, not just those with NTE records
    db.execute(sql`
      SELECT DISTINCT TO_CHAR(date::date, 'YYYY-MM') AS month
      FROM attendance_records
      ORDER BY month DESC
    `),
    db.execute(sql`
      SELECT DISTINCT department
      FROM employees
      WHERE department IS NOT NULL
      ORDER BY department ASC
    `),
  ]);
  return {
    months: (months.rows as { month: string }[]).map((r) => r.month),
    departments: (departments.rows as { department: string }[]).map((r) => r.department),
  };
}
