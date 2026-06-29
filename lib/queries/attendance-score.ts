import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

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
// day (0). Sick hours are approved "Sick" leaves CLIPPED to the selected range:
//   min(withPayDays, overlapping calendar days) * 8.
export async function getAttendanceScores(filters: ScoreFilters): Promise<AttendanceScore[]> {
  const { start, end } = filters;

  const result = await db.execute(sql`
    WITH att AS (
      SELECT
        a.employee_id,
        COUNT(*) FILTER (WHERE COALESCE(a.total_hours_worked, 0) > 0)::int AS days_present,
        COUNT(*) FILTER (WHERE COALESCE(a.total_hours_worked, 0) = 0)::int AS days_absent,
        COALESCE(SUM(a.late_minutes + a.undertime_minutes), 0)::numeric AS undertime_min
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
