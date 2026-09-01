import { db } from '@/lib/db';
import { sql, SQL } from 'drizzle-orm';
import { notExcludedSql } from '@/lib/queries/exclusions';
import { NON_WORKING_PATTERNS, classifyDayType, type DayType } from '@/lib/utils/day-type';

// Matches attendance rows whose shift_schedule marks a non-working day
// (holiday, approved leave, pre-hire) — see lib/utils/day-type.ts.
const nonWorkingScheduleSql: SQL = sql.join(
  NON_WORKING_PATTERNS.map((p) => sql`UPPER(COALESCE(a.shift_schedule, '')) LIKE ${'%' + p + '%'}`),
  sql` OR `,
);

// Approved Vacation is treated like a normal worked day: it counts toward
// both present and required hours (unlike Sick, which is subtracted from
// present hours below). Most vacation days already show up in Sprout with
// total_hours_worked > 0 and need no help; this only matters for the rare
// zero-hour day whose shift_schedule text would otherwise exclude it.
const coveredByVacationSql: SQL = sql`EXISTS (
  SELECT 1 FROM leave_records lv
  WHERE lv.employee_id = a.employee_id
    AND lv.status = 'Approved'
    AND lv.leave_type = 'Vacation'
    AND a.date >= lv.date_from AND a.date <= lv.date_to
)`;

// Sprout's total_hours_worked can read 0 on a day the employee actually
// clocked in/out for (commonly a HOLIDAY-tagged shift Sprout doesn't count
// toward "hours worked" for payroll purposes). actual_logs carries the raw
// clock times, or the literal string "NO LOGS" when nothing was recorded —
// so a real value there means the employee was genuinely present.
const hasRealLogsSql: SQL = sql`(a.actual_logs IS NOT NULL AND a.actual_logs <> '' AND UPPER(a.actual_logs) <> 'NO LOGS')`;

// A zero-hour day still counts as present when either an approved Vacation
// request covers it, or actual_logs shows the employee really clocked in.
// Both override whatever total_hours_worked / shift_schedule text say.
const zeroHourPresentOverrideSql: SQL = sql`(COALESCE(a.total_hours_worked, 0) = 0 AND ((${coveredByVacationSql}) OR (${hasRealLogsSql})))`;

// A day only needs this fix when Sprout recorded 0 hours for it — that's the
// actual bug (a holiday/leave/pre-hire day with 0 hours reads as "Absent").
// If the schedule text says HOLIDAY/ON LEAVE/etc but hours were still
// credited (e.g. paid leave logged as 8 worked hours), that day was already
// counting correctly as present and must be left alone, or it would silently
// shrink required hours for a day that was never wrong.
// Zero-hour days covered by zeroHourPresentOverrideSql are carved out of this
// exclusion — they count as present instead, even if Sprout's schedule text
// also says HOLIDAY/etc for that same date.
const zeroHourNonWorkingSql: SQL = sql`(COALESCE(a.total_hours_worked, 0) = 0 AND (${nonWorkingScheduleSql}) AND NOT (${zeroHourPresentOverrideSql}))`;

export interface AttendanceScore {
  employeeId: string;
  fullName: string;          // "Last, First"
  account: string | null;    // department
  teamLeader: string | null; // immediate supervisor
  accountManager: string | null; // approver2
  totalHoursPresent: number;
  totalHoursAbsent: number;
  totalSickLeaveHours: number;
  undertime: number;         // hours
  requiredHours: number;
  attendancePct: number;     // 0..1+
  attendanceGrade: number;   // 1 | 2 | 3 | 5
}

export interface ScoreFilters {
  start: string;             // YYYY-MM-DD
  end: string;               // YYYY-MM-DD inclusive
  department?: string;
  immediateSupervisor?: string;
  approver2?: string;
}

function gradeFor(pct: number): number {
  if (pct < 0.9) return 1;
  if (pct < 0.95) return 2;
  if (pct < 1) return 3;
  return 5;
}

// Computes the attendance score per employee over an arbitrary date range,
// replicating the Apps Script logic, derived from DAILY records so any range
// works. Undertime = late + early-out minutes (matches Sprout's Summary
// "Undertime *" column exactly), and present hours follow the Apps Script form:
//   undertime     = Σ(late_minutes + undertime_minutes) / 60
//   present hours = daysPresent*8 - undertime - sickHours
//   absent  hours = daysAbsent*8
//   required      = (daysPresent + daysAbsent)*8
// total_hours_worked is used only to tell a present day (>0) from an absent
// day (0), except a zero-hour day that's either covered by an approved
// Vacation request or has real actual_logs (see zeroHourPresentOverrideSql),
// either of which also counts as present. Sick hours are approved "Sick"
// leaves CLIPPED to the selected range:
//   min(withPayDays, overlapping calendar days) * 8.
export async function getAttendanceScores(filters: ScoreFilters): Promise<AttendanceScore[]> {
  const { start, end } = filters;

  const result = await db.execute(sql`
    WITH att AS (
      SELECT
        a.employee_id,
        COUNT(*) FILTER (WHERE COALESCE(a.total_hours_worked, 0) > 0 OR (${zeroHourPresentOverrideSql}))::int AS days_present,
        COUNT(*) FILTER (WHERE COALESCE(a.total_hours_worked, 0) = 0 AND NOT (${zeroHourNonWorkingSql}) AND NOT (${zeroHourPresentOverrideSql}))::int AS days_absent,
        COALESCE(SUM(a.late_minutes + a.undertime_minutes) FILTER (WHERE NOT (${zeroHourNonWorkingSql}) AND NOT (${zeroHourPresentOverrideSql})), 0)::numeric AS undertime_min
      FROM attendance_records a
      WHERE a.date >= ${start}::date AND a.date <= ${end}::date
      GROUP BY a.employee_id
    ),
    sick AS (
      SELECT
        l.employee_id,
        SUM(
          LEAST(
            l.with_pay_days,
            GREATEST(
              0,
              (LEAST(l.date_to, ${end}::date) - GREATEST(l.date_from, ${start}::date)) + 1
            )
          )
        )::numeric AS sick_days
      FROM leave_records l
      WHERE l.status = 'Approved'
        AND l.leave_type = 'Sick'
        AND l.date_from <= ${end}::date
        AND l.date_to >= ${start}::date
      GROUP BY l.employee_id
    )
    SELECT
      att.employee_id,
      e.first_name, e.last_name,
      e.department, e.immediate_supervisor, e.approver2,
      att.days_present,
      att.days_absent,
      att.undertime_min,
      COALESCE(sick.sick_days, 0)::numeric AS sick_days
    FROM att
    LEFT JOIN employees e ON e.employee_id = att.employee_id
    LEFT JOIN sick ON sick.employee_id = att.employee_id
    WHERE
      (${filters.department ?? null}::text IS NULL OR e.department = ${filters.department ?? null}::text)
      AND (${filters.immediateSupervisor ?? null}::text IS NULL OR e.immediate_supervisor = ${filters.immediateSupervisor ?? null}::text)
      AND (${filters.approver2 ?? null}::text IS NULL OR e.approver2 = ${filters.approver2 ?? null}::text)
      AND ${notExcludedSql('e')}
    ORDER BY e.last_name, e.first_name
  `);

  return (result.rows as Record<string, unknown>[]).map((row) => {
    const daysPresent = Number(row.days_present) || 0;
    const daysAbsent = Number(row.days_absent) || 0;
    const undertime = (Number(row.undertime_min) || 0) / 60;
    const totalSickLeaveHours = (Number(row.sick_days) || 0) * 8;

    const totalHoursPresent = daysPresent * 8 - undertime - totalSickLeaveHours;
    const totalHoursAbsent = daysAbsent * 8;
    const requiredHours = (daysPresent + daysAbsent) * 8;
    const attendancePct = requiredHours > 0 ? totalHoursPresent / requiredHours : 0;

    const firstName = row.first_name ? String(row.first_name) : '';
    const lastName = row.last_name ? String(row.last_name) : '';
    const fullName = [lastName, firstName].filter(Boolean).join(', ') || String(row.employee_id);

    return {
      employeeId: String(row.employee_id),
      fullName,
      account: row.department ? String(row.department) : null,
      teamLeader: row.immediate_supervisor ? String(row.immediate_supervisor) : null,
      accountManager: row.approver2 ? String(row.approver2) : null,
      totalHoursPresent,
      totalHoursAbsent,
      totalSickLeaveHours,
      undertime,
      requiredHours,
      attendancePct,
      attendanceGrade: gradeFor(attendancePct),
    };
  });
}

export interface ScoreDetailDay {
  date: string;
  hoursWorked: number;
  lateMinutes: number;
  undertimeMinutes: number;
  present: boolean;
  dayType: DayType;
}
export interface ScoreDetailSick {
  dateFrom: string;
  dateTo: string;
  withPayDays: number;
  countedDays: number;
}
export interface ScoreDetail {
  daily: ScoreDetailDay[];
  sick: ScoreDetailSick[];
}

// Per-employee breakdown behind the aggregate score, for the detail drawer.
export async function getEmployeeScoreDetail(
  employeeId: string,
  start: string,
  end: string,
): Promise<ScoreDetail> {
  const dailyRes = await db.execute(sql`
    SELECT
      a.date::text AS date,
      COALESCE(a.total_hours_worked, 0)::float8 AS hours_worked,
      COALESCE(a.late_minutes, 0)::int AS late_minutes,
      COALESCE(a.undertime_minutes, 0)::int AS undertime_minutes,
      a.shift_schedule,
      EXISTS (
        SELECT 1 FROM leave_records lv
        WHERE lv.employee_id = ${employeeId}
          AND lv.status = 'Approved'
          AND lv.leave_type = 'Vacation'
          AND a.date >= lv.date_from AND a.date <= lv.date_to
      ) AS covered_by_vacation,
      (a.actual_logs IS NOT NULL AND a.actual_logs <> '' AND UPPER(a.actual_logs) <> 'NO LOGS') AS has_real_logs
    FROM attendance_records a
    WHERE a.employee_id = ${employeeId}
      AND a.date >= ${start}::date AND a.date <= ${end}::date
    ORDER BY a.date
  `);

  const daily: ScoreDetailDay[] = (dailyRes.rows as Record<string, unknown>[]).map((r) => {
    const hoursWorked = Number(r.hours_worked) || 0;
    // Mirrors zeroHourPresentOverrideSql in getAttendanceScores: a zero-hour
    // day counts as present when it's covered by approved Vacation, or when
    // actual_logs shows the employee really clocked in that day.
    const zeroHourVacation = hoursWorked === 0 && Boolean(r.covered_by_vacation);
    const zeroHourWorked = hoursWorked === 0 && !zeroHourVacation && Boolean(r.has_real_logs);
    let dayType: DayType;
    if (zeroHourVacation) dayType = 'vacation';
    else if (zeroHourWorked) dayType = 'working'; // falls through to the present/absent/sick check below
    else dayType = classifyDayType(r.shift_schedule as string | null);
    return {
      date: String(r.date),
      hoursWorked,
      lateMinutes: Number(r.late_minutes) || 0,
      undertimeMinutes: Number(r.undertime_minutes) || 0,
      present: hoursWorked > 0 || zeroHourVacation || zeroHourWorked,
      dayType,
    };
  });

  const sickRes = await db.execute(sql`
    SELECT
      date_from::text AS date_from,
      date_to::text AS date_to,
      with_pay_days::float8 AS with_pay_days,
      LEAST(
        with_pay_days,
        GREATEST(0, (LEAST(date_to, ${end}::date) - GREATEST(date_from, ${start}::date)) + 1)
      )::float8 AS counted_days
    FROM leave_records
    WHERE employee_id = ${employeeId}
      AND status = 'Approved' AND leave_type = 'Sick'
      AND date_from <= ${end}::date AND date_to >= ${start}::date
    ORDER BY date_from
  `);

  const sick: ScoreDetailSick[] = (sickRes.rows as Record<string, unknown>[]).map((r) => ({
    dateFrom: String(r.date_from),
    dateTo: String(r.date_to),
    withPayDays: Number(r.with_pay_days) || 0,
    countedDays: Number(r.counted_days) || 0,
  }));

  return { daily, sick };
}

// Most recent uploaded attendance period — used as the default range.
export async function getLatestAttendanceRange(): Promise<{ start: string; end: string } | null> {
  const result = await db.execute(sql`
    SELECT report_period_start::text AS start, report_period_end::text AS "end"
    FROM attendance_records
    ORDER BY report_period_end DESC
    LIMIT 1
  `);
  if (!result.rows.length) return null;
  const row = result.rows[0] as { start: string | null; end: string | null };
  if (!row.start || !row.end) return null;
  return { start: row.start, end: row.end };
}
