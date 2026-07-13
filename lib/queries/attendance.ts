import { db } from '@/lib/db';
import { attendanceRecords, employees, nteRecords, uploadHistory } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { computeNteStatus, NteStatus } from '@/lib/utils/nte-status';
import { notExcludedSql } from '@/lib/queries/exclusions';

export interface EmployeeMonthlyStats {
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  department: string | null;
  immediateSupervisor: string | null;
  approver2: string | null;
  lateCount: number;
  accumulatedMinutes: number;
  nteStatus: NteStatus;
  nteRecordId: number | null;
  issuedDate: string | null;
  issuedBy: string | null;
  acknowledgedDate: string | null;
}

export interface DashboardFilters {
  year: number;
  month: number;       // 1-12
  department?: string;
  immediateSupervisor?: string;
  approver2?: string;
}

export async function getMonthlyStats(filters: DashboardFilters): Promise<EmployeeMonthlyStats[]> {
  const monthStr = `${filters.year}-${String(filters.month).padStart(2, '0')}`;
  const monthStart = `${monthStr}-01`;
  const nextY = filters.month === 12 ? filters.year + 1 : filters.year;
  const nextM = filters.month === 12 ? 1 : filters.month + 1;
  const periodEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  const rows = await db.execute(sql`
    SELECT
      e.employee_id,
      e.first_name,
      e.last_name,
      e.middle_name,
      e.department,
      e.immediate_supervisor,
      e.approver2,
      COUNT(CASE WHEN a.late_minutes > 0 THEN 1 END)::int AS late_count,
      COALESCE(SUM(a.late_minutes), 0)::int AS accumulated_minutes,
      n.id AS nte_record_id,
      n.status AS nte_db_status,
      n.issued_date,
      n.issued_by,
      n.acknowledged_date
    FROM employees e
    LEFT JOIN attendance_records a
      ON e.employee_id = a.employee_id
      AND a.date >= ${monthStart}::date
      AND a.date < ${periodEnd}::date
    LEFT JOIN nte_records n
      ON e.employee_id = n.employee_id
      AND n.month = ${monthStr}
    WHERE
      (${filters.department ?? null}::text IS NULL OR e.department = ${filters.department ?? null}::text)
      AND (${filters.immediateSupervisor ?? null}::text IS NULL OR e.immediate_supervisor = ${filters.immediateSupervisor ?? null}::text)
      AND (${filters.approver2 ?? null}::text IS NULL OR e.approver2 = ${filters.approver2 ?? null}::text)
      AND ${notExcludedSql('e')}
    GROUP BY e.employee_id, e.first_name, e.last_name, e.middle_name,
             e.department, e.immediate_supervisor, e.approver2,
             n.id, n.status, n.issued_date, n.issued_by, n.acknowledged_date
    ORDER BY
      CASE n.status
        WHEN 'required' THEN 1
        WHEN 'issued'   THEN 2
        ELSE 3
      END,
      late_count DESC
  `);

  return (rows.rows as Record<string, unknown>[]).map((row) => {
    const lateCount = Number(row.late_count) || 0;
    const accumulatedMinutes = Number(row.accumulated_minutes) || 0;
    const dbStatus = (row.nte_db_status as 'required' | 'issued' | 'acknowledged' | null) ?? null;

    return {
      employeeId: String(row.employee_id),
      firstName: String(row.first_name),
      lastName: String(row.last_name),
      middleName: row.middle_name ? String(row.middle_name) : null,
      department: row.department ? String(row.department) : null,
      immediateSupervisor: row.immediate_supervisor ? String(row.immediate_supervisor) : null,
      approver2: row.approver2 ? String(row.approver2) : null,
      lateCount,
      accumulatedMinutes,
      nteStatus: computeNteStatus(lateCount, accumulatedMinutes, dbStatus),
      nteRecordId: row.nte_record_id ? Number(row.nte_record_id) : null,
      issuedDate: row.issued_date ? String(row.issued_date) : null,
      issuedBy: row.issued_by ? String(row.issued_by) : null,
      acknowledgedDate: row.acknowledged_date ? String(row.acknowledged_date) : null,
    };
  });
}

export interface DayOfWeekStat {
  dow: number; // 0=Sun … 6=Sat (PostgreSQL EXTRACT DOW)
  lateEmployees: number;
}

export async function getLateByDayOfWeek(filters: DashboardFilters): Promise<DayOfWeekStat[]> {
  const monthStr = `${filters.year}-${String(filters.month).padStart(2, '0')}`;
  const monthStart = `${monthStr}-01`;
  const nextY = filters.month === 12 ? filters.year + 1 : filters.year;
  const nextM = filters.month === 12 ? 1 : filters.month + 1;
  const periodEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;

  // Always join employees so excluded people are filtered out of the chart, even
  // when no department/supervisor/manager filter is active.
  const rows = await db.execute(sql`
    SELECT
      EXTRACT(DOW FROM a.date::date)::int AS dow,
      COUNT(DISTINCT a.employee_id)::int  AS late_employees
    FROM attendance_records a
    JOIN employees e ON a.employee_id = e.employee_id
    WHERE a.late_minutes > 0
      AND a.date >= ${monthStart}::date
      AND a.date < ${periodEnd}::date
      AND (${filters.department          ?? null}::text IS NULL OR e.department           = ${filters.department          ?? null}::text)
      AND (${filters.immediateSupervisor ?? null}::text IS NULL OR e.immediate_supervisor = ${filters.immediateSupervisor ?? null}::text)
      AND (${filters.approver2           ?? null}::text IS NULL OR e.approver2            = ${filters.approver2           ?? null}::text)
      AND ${notExcludedSql('e')}
    GROUP BY dow
    ORDER BY dow
  `);

  return (rows.rows as { dow: number; late_employees: number }[]).map((r) => ({
    dow: Number(r.dow),
    lateEmployees: Number(r.late_employees),
  }));
}

export async function getLatestAttendancePeriod(): Promise<{ year: number; month: number; latestDate: string | null } | null> {
  const result = await db.execute(sql`
    SELECT
      EXTRACT(YEAR FROM MAX(date::date))::int  AS year,
      EXTRACT(MONTH FROM MAX(date::date))::int AS month,
      MAX(date::date)::text                    AS latest_date
    FROM attendance_records
  `);
  if (!result.rows.length) return null;
  const row = result.rows[0] as Record<string, unknown>;
  if (!row.latest_date) return null;
  return {
    year: Number(row.year),
    month: Number(row.month),
    latestDate: String(row.latest_date),
  };
}

// Full date span of attendance data we hold (earliest record to latest).
export async function getAttendanceCoverage(): Promise<{ start: string | null; end: string | null; count: number }> {
  const result = await db.execute(sql`
    SELECT MIN(date)::text AS start, MAX(date)::text AS "end", COUNT(*)::int AS count
    FROM attendance_records
  `);
  const row = result.rows[0] as { start: string | null; end: string | null; count: number };
  return { start: row?.start ?? null, end: row?.end ?? null, count: Number(row?.count) || 0 };
}

export async function hasAttendanceData(year: number, month: number): Promise<boolean> {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthStart = `${monthStr}-01`;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const periodEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM attendance_records
      WHERE date >= ${monthStart}::date
        AND date < ${periodEnd}::date
    ) AS has_data
  `);
  return (result.rows[0] as Record<string, unknown>).has_data === true;
}

export async function getEmployeeLateRecords(employeeId: string, year: number, month: number) {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  const monthStart = `${monthStr}-01`;
  const nextY = month === 12 ? year + 1 : year;
  const nextM = month === 12 ? 1 : month + 1;
  const periodEnd = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return db
    .select()
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employeeId),
        sql`${attendanceRecords.date} >= ${monthStart}::date`,
        sql`${attendanceRecords.date} < ${periodEnd}::date`,
        sql`${attendanceRecords.lateMinutes} > 0`,
      ),
    )
    .orderBy(attendanceRecords.date);
}

export interface TardinessIncident {
  date: string;
  lateMinutes: number;
  undertimeMinutes: number;
  shiftSchedule: string | null;
  actualLogs: string | null;
}

// Per-employee late incidents over an arbitrary date range (inclusive), late days
// only. Range-based counterpart to getEmployeeLateRecords (which is single-month);
// includes the scheduled shift + actual clock-in log for the detailed report.
export async function getEmployeeTardinessDetail(
  employeeId: string,
  start: string,
  end: string,
): Promise<TardinessIncident[]> {
  const rows = await db
    .select({
      date: attendanceRecords.date,
      lateMinutes: attendanceRecords.lateMinutes,
      undertimeMinutes: attendanceRecords.undertimeMinutes,
      shiftSchedule: attendanceRecords.shiftSchedule,
      actualLogs: attendanceRecords.actualLogs,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.employeeId, employeeId),
        sql`${attendanceRecords.date} >= ${start}::date`,
        sql`${attendanceRecords.date} <= ${end}::date`,
        sql`${attendanceRecords.lateMinutes} > 0`,
      ),
    )
    .orderBy(attendanceRecords.date);

  return rows.map((r) => ({
    date: String(r.date),
    lateMinutes: Number(r.lateMinutes) || 0,
    undertimeMinutes: Number(r.undertimeMinutes) || 0,
    shiftSchedule: r.shiftSchedule ?? null,
    actualLogs: r.actualLogs ?? null,
  }));
}

export async function replaceAttendancePeriod(
  periodStart: string,
  periodEnd: string,
  records: {
    employeeId: string;
    date: string;
    lateMinutes: number;
    undertimeMinutes: number;
    totalHoursWorked: number;
    shiftType: string;
    shiftSchedule: string;
    actualLogs: string;
  }[],
) {
  // Nothing to upload — leave existing data untouched rather than wiping a period.
  if (records.length === 0) return 0;

  // Dedupe by (employee_id, date), last-wins. A malformed export that repeats an
  // employee block would otherwise collide with itself inside a single insert
  // batch (the unique index is on employee_id + date).
  const byKey = new Map<string, (typeof records)[number]>();
  for (const r of records) byKey.set(`${r.employeeId}|${r.date}`, r);
  const deduped = Array.from(byKey.values());

  // Clear existing rows by the CALENDAR DATE RANGE this upload covers — NOT by
  // the report_period_* columns. The unique index is on (employee_id, date), and
  // the same date can arrive under different report-period boundaries across
  // overlapping uploads (e.g. a monthly report after a weekly one). A
  // period-scoped delete would leave a prior row for that date in place and the
  // insert would fail with a duplicate-key violation. Deleting by date range
  // makes an upload authoritative for exactly the dates it contains.
  const dates = deduped.map((r) => r.date).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  await db
    .delete(attendanceRecords)
    .where(
      and(
        sql`${attendanceRecords.date} >= ${minDate}::date`,
        sql`${attendanceRecords.date} <= ${maxDate}::date`,
      ),
    );

  const BATCH = 500;
  const mapped = deduped.map((r) => ({
    employeeId: r.employeeId,
    date: r.date,
    lateMinutes: r.lateMinutes,
    undertimeMinutes: r.undertimeMinutes,
    totalHoursWorked: String(r.totalHoursWorked ?? 0),
    shiftType: r.shiftType || null,
    shiftSchedule: r.shiftSchedule || null,
    actualLogs: r.actualLogs ? r.actualLogs.slice(0, 500) : null,
    reportPeriodStart: periodStart,
    reportPeriodEnd: periodEnd,
  }));
  for (let i = 0; i < mapped.length; i += BATCH) {
    await db.insert(attendanceRecords).values(mapped.slice(i, i + BATCH));
  }

  return deduped.length;
}

export async function recordUpload(
  filename: string,
  periodStart: string,
  periodEnd: string,
  recordCount: number,
) {
  await db.insert(uploadHistory).values({ filename, periodStart, periodEnd, recordCount });
}
