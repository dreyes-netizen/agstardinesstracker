import { db } from '@/lib/db';
import { attendanceRecords, uploadHistory } from '@/lib/db/schema';
import { and, sql } from 'drizzle-orm';
import { rangeNteStatus, NteDbStatus, NteStatus } from '@/lib/utils/nte-status';
import { notExcludedSql } from '@/lib/queries/exclusions';
import { adjustmentJoinSql, effectiveLateSql } from '@/lib/queries/adjustments';
import { weekStart } from '@/lib/utils/week';

export interface EmployeeNte {
  periodStart: string;
  periodEnd: string;
  status: Exclude<NteDbStatus, null>;
  issuedDate: string | null;
  issuedBy: string | null;
  notes: string | null;
  acknowledgedDate: string | null;
}

export interface EmployeeStats {
  employeeId: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  department: string | null;
  immediateSupervisor: string | null;
  approver2: string | null;
  lateCount: number;            // within the selected range
  accumulatedMinutes: number;
  mtdLates: number;             // month-to-date as of the range end — what the NTE threshold reads
  mtdMinutes: number;
  nteStatus: NteStatus;
  ntes: EmployeeNte[];          // NTEs whose period starts in the range, oldest first
}

export interface DashboardFilters {
  start: string;       // YYYY-MM-DD, inclusive
  end: string;
  department?: string;
  immediateSupervisor?: string;
  approver2?: string;
}

function employeeFilterSql(filters: DashboardFilters) {
  return sql`
    (${filters.department ?? null}::text IS NULL OR e.department = ${filters.department ?? null}::text)
    AND (${filters.immediateSupervisor ?? null}::text IS NULL OR e.immediate_supervisor = ${filters.immediateSupervisor ?? null}::text)
    AND (${filters.approver2 ?? null}::text IS NULL OR e.approver2 = ${filters.approver2 ?? null}::text)
    AND ${notExcludedSql('e')}`;
}

const STATUS_ORDER: Record<NteStatus, number> = { required: 0, issued: 1, warning: 2, acknowledged: 3, safe: 4 };

export async function getRangeStats(filters: DashboardFilters): Promise<EmployeeStats[]> {
  const { start, end } = filters;
  const monthStart = `${end.slice(0, 7)}-01`;
  const late = effectiveLateSql('a');

  // One pass over attendance gives both the range totals and month-to-date
  // totals (1st of the end month → end). NTEs use the same "period starts in
  // range" rule as NTE Management.
  const rows = await db.execute(sql`
    SELECT
      e.employee_id,
      e.first_name,
      e.last_name,
      e.middle_name,
      e.department,
      e.immediate_supervisor,
      e.approver2,
      COALESCE(t.late_count, 0)          AS late_count,
      COALESCE(t.accumulated_minutes, 0) AS accumulated_minutes,
      COALESCE(t.mtd_lates, 0)           AS mtd_lates,
      COALESCE(t.mtd_minutes, 0)         AS mtd_minutes,
      COALESCE(n.ntes, '[]'::json)       AS ntes
    FROM employees e
    LEFT JOIN (
      SELECT
        a.employee_id,
        COUNT(*) FILTER (WHERE ${late} > 0 AND a.date >= ${start}::date)::int           AS late_count,
        COALESCE(SUM(${late}) FILTER (WHERE a.date >= ${start}::date), 0)::int          AS accumulated_minutes,
        COUNT(*) FILTER (WHERE ${late} > 0 AND a.date >= ${monthStart}::date)::int      AS mtd_lates,
        COALESCE(SUM(${late}) FILTER (WHERE a.date >= ${monthStart}::date), 0)::int     AS mtd_minutes
      FROM attendance_records a
      ${adjustmentJoinSql('a')}
      WHERE a.date >= LEAST(${start}::date, ${monthStart}::date)
        AND a.date <= ${end}::date
      GROUP BY a.employee_id
    ) t ON t.employee_id = e.employee_id
    LEFT JOIN (
      SELECT
        employee_id,
        json_agg(json_build_object(
          'periodStart', period_start::text,
          'periodEnd', period_end::text,
          'status', status,
          'issuedDate', issued_date::text,
          'issuedBy', issued_by,
          'notes', notes,
          'acknowledgedDate', acknowledged_date::text
        ) ORDER BY period_start) AS ntes
      FROM nte_records
      WHERE period_start >= ${weekStart(start)}::date
        AND period_start <= ${end}::date
      GROUP BY employee_id
    ) n ON n.employee_id = e.employee_id
    WHERE ${employeeFilterSql(filters)}
  `);

  return (rows.rows as Record<string, unknown>[])
    .map((row) => {
      const mtdLates = Number(row.mtd_lates) || 0;
      const mtdMinutes = Number(row.mtd_minutes) || 0;
      const ntes = (typeof row.ntes === 'string' ? JSON.parse(row.ntes) : row.ntes) as EmployeeNte[];
      return {
        employeeId: String(row.employee_id),
        firstName: String(row.first_name),
        lastName: String(row.last_name),
        middleName: row.middle_name ? String(row.middle_name) : null,
        department: row.department ? String(row.department) : null,
        immediateSupervisor: row.immediate_supervisor ? String(row.immediate_supervisor) : null,
        approver2: row.approver2 ? String(row.approver2) : null,
        lateCount: Number(row.late_count) || 0,
        accumulatedMinutes: Number(row.accumulated_minutes) || 0,
        mtdLates,
        mtdMinutes,
        nteStatus: rangeNteStatus(ntes.map((n) => n.status), mtdLates, mtdMinutes),
        ntes,
      };
    })
    .sort((a, b) => STATUS_ORDER[a.nteStatus] - STATUS_ORDER[b.nteStatus] || b.lateCount - a.lateCount);
}

export interface DayOfWeekStat {
  dow: number; // 0=Sun … 6=Sat (PostgreSQL EXTRACT DOW)
  lateEmployees: number;
}

export async function getLateByDayOfWeek(filters: DashboardFilters): Promise<DayOfWeekStat[]> {
  // Always join employees so excluded people are filtered out of the chart, even
  // when no department/supervisor/manager filter is active.
  const rows = await db.execute(sql`
    SELECT
      EXTRACT(DOW FROM a.date::date)::int AS dow,
      COUNT(DISTINCT a.employee_id)::int  AS late_employees
    FROM attendance_records a
    JOIN employees e ON a.employee_id = e.employee_id
    ${adjustmentJoinSql('a')}
    WHERE ${effectiveLateSql('a')} > 0
      AND a.date >= ${filters.start}::date
      AND a.date <= ${filters.end}::date
      AND ${employeeFilterSql(filters)}
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

// Every month with uploaded attendance, newest first ("2026-09").
export async function getAttendanceMonths(): Promise<string[]> {
  const rows = await db.execute(sql`
    SELECT DISTINCT TO_CHAR(date::date, 'YYYY-MM') AS month
    FROM attendance_records
    ORDER BY month DESC
  `);
  return (rows.rows as { month: string }[]).map((r) => r.month);
}

export async function hasAttendanceInRange(start: string, end: string): Promise<boolean> {
  const result = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM attendance_records
      WHERE date >= ${start}::date AND date <= ${end}::date
    ) AS has_data
  `);
  return (result.rows[0] as Record<string, unknown>).has_data === true;
}

export interface EmployeeLateRecord {
  date: string;
  lateMinutes: number;          // effective (after adjustment)
  originalMinutes: number;
  adjusted: boolean;
  reason: string | null;
  adjustedBy: string | null;
  shiftSchedule: string | null;
  actualLogs: string | null;
}

// Filters on the ORIGINAL late minutes so waived days stay visible (and undoable)
// in the employee drawer. Range is inclusive.
export async function getEmployeeLateRecords(employeeId: string, start: string, end: string): Promise<EmployeeLateRecord[]> {
  const rows = await db.execute(sql`
    SELECT
      a.date::text AS date,
      ${effectiveLateSql('a')} AS late_minutes,
      a.late_minutes AS original_minutes,
      adj.id IS NOT NULL AS adjusted,
      adj.reason,
      adj.created_by AS adjusted_by,
      a.shift_schedule,
      a.actual_logs
    FROM attendance_records a
    ${adjustmentJoinSql('a')}
    WHERE a.employee_id = ${employeeId}
      AND a.date >= ${start}::date
      AND a.date <= ${end}::date
      AND a.late_minutes > 0
    ORDER BY a.date
  `);
  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    date: String(r.date),
    lateMinutes: Number(r.late_minutes) || 0,
    originalMinutes: Number(r.original_minutes) || 0,
    adjusted: r.adjusted === true,
    reason: r.reason ? String(r.reason) : null,
    adjustedBy: r.adjusted_by ? String(r.adjusted_by) : null,
    shiftSchedule: r.shift_schedule ? String(r.shift_schedule) : null,
    actualLogs: r.actual_logs ? String(r.actual_logs) : null,
  }));
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
  const rows = await db.execute(sql`
    SELECT
      a.date::text AS date,
      ${effectiveLateSql('a')} AS late_minutes,
      a.undertime_minutes,
      a.shift_schedule,
      a.actual_logs
    FROM attendance_records a
    ${adjustmentJoinSql('a')}
    WHERE a.employee_id = ${employeeId}
      AND a.date >= ${start}::date
      AND a.date <= ${end}::date
      AND ${effectiveLateSql('a')} > 0
    ORDER BY a.date
  `);

  return (rows.rows as Record<string, unknown>[]).map((r) => ({
    date: String(r.date),
    lateMinutes: Number(r.late_minutes) || 0,
    undertimeMinutes: Number(r.undertime_minutes) || 0,
    shiftSchedule: r.shift_schedule ? String(r.shift_schedule) : null,
    actualLogs: r.actual_logs ? String(r.actual_logs) : null,
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
