import { db } from '@/lib/db';
import { nteRecords } from '@/lib/db/schema';
import { and, eq, sql, SQL } from 'drizzle-orm';
import { notExcludedSql, employeeNotExcludedSql } from '@/lib/queries/exclusions';
import { adjustmentJoinSql, effectiveLateSql } from '@/lib/queries/adjustments';
import { WEEKLY_NTE_START, todayPH, weekStart } from '@/lib/utils/week';

interface WeeklyLateOptions {
  from: string;          // any date in the first week of interest
  to?: string;           // last attendance date to read (inclusive)
  employeeId?: string;
}

// One row per (employee, Mon–Sun week) with the week's totals and the
// month-to-date figures that decide the NTE. A week spanning two months is split
// into per-month segments; it needs an NTE if any segment has a late AND its
// month-to-date total has crossed 6 lates / 60 min (see weekNeedsNte). Segments
// from months before WEEKLY_NTE_START never need one — those months had monthly NTEs.
// The reported mtd_* come from the deciding segment, else the latest month's.
// Reads from the 1st of the month containing `from`'s week so totals are complete.
export function weeklyLateSql({ from, to, employeeId }: WeeklyLateOptions) {
  const late = effectiveLateSql('a');
  return sql`
    SELECT DISTINCT ON (employee_id, week_start)
      employee_id, week_start, week_lates, week_minutes, mtd_lates, mtd_minutes, needs_nte
    FROM (
      SELECT *,
        (month_start >= ${WEEKLY_NTE_START}::date
          AND seg_lates > 0 AND (mtd_lates >= 6 OR mtd_minutes >= 60)) AS needs_nte
      FROM (
        SELECT *,
          SUM(seg_lates)   OVER (PARTITION BY employee_id, week_start)::int AS week_lates,
          SUM(seg_minutes) OVER (PARTITION BY employee_id, week_start)::int AS week_minutes,
          SUM(seg_lates)   OVER (PARTITION BY employee_id, month_start ORDER BY week_start)::int AS mtd_lates,
          SUM(seg_minutes) OVER (PARTITION BY employee_id, month_start ORDER BY week_start)::int AS mtd_minutes
        FROM (
          SELECT
            a.employee_id,
            date_trunc('week', a.date)::date  AS week_start,
            date_trunc('month', a.date)::date AS month_start,
            COUNT(*) FILTER (WHERE ${late} > 0)::int AS seg_lates,
            COALESCE(SUM(${late}), 0)::int          AS seg_minutes
          FROM attendance_records a
          ${adjustmentJoinSql('a')}
          WHERE a.date >= date_trunc('month', date_trunc('week', ${from}::date))::date
            ${to ? sql`AND a.date <= ${to}::date` : sql``}
            ${employeeId ? sql`AND a.employee_id = ${employeeId}` : sql``}
          GROUP BY 1, 2, 3
        ) seg
      ) cum
    ) w
    ORDER BY employee_id, week_start, needs_nte DESC, month_start DESC
  `;
}

// Creates a 'required' row for every week that needs an NTE. Idempotent; runs
// after each attendance upload.
export async function syncNteRequired() {
  await db.execute(sql`
    INSERT INTO nte_records (employee_id, period_start, period_end, status)
    SELECT w.employee_id, w.week_start, w.week_start + 6, 'required'
    FROM (${weeklyLateSql({ from: WEEKLY_NTE_START })}) w
    WHERE w.needs_nte AND ${employeeNotExcludedSql('w.employee_id')}
    ON CONFLICT (employee_id, period_start, period_end) DO NOTHING
  `);
}

// Re-applies the weekly rule to one employee's weeks in [fromWeek, toWeek] after an
// adjustment: removes 'required' rows that no longer qualify (returned, for the
// audit trail) and creates rows for weeks that now do. Issued/acknowledged NTEs
// are formal records and are never touched.
export async function reconcileWeeklyNte(employeeId: string, fromWeek: string, toWeek: string, readTo: string) {
  const weeks = sql`
    SELECT employee_id, week_start FROM (${weeklyLateSql({ from: fromWeek, to: readTo, employeeId })}) w
    WHERE w.needs_nte AND w.week_start BETWEEN ${fromWeek}::date AND ${toWeek}::date
  `;
  const cleared = await db.execute(sql`
    DELETE FROM nte_records n
    WHERE n.employee_id = ${employeeId}
      AND n.status = 'required'
      AND n.period_end = n.period_start + 6
      AND n.period_start BETWEEN ${fromWeek}::date AND ${toWeek}::date
      AND n.period_start NOT IN (SELECT week_start FROM (${weeks}) q)
    RETURNING n.period_start::text AS period_start, n.period_end::text AS period_end
  `);
  await db.execute(sql`
    INSERT INTO nte_records (employee_id, period_start, period_end, status)
    SELECT q.employee_id, q.week_start, q.week_start + 6, 'required' FROM (${weeks}) q
    WHERE ${employeeNotExcludedSql('q.employee_id')}
    ON CONFLICT (employee_id, period_start, period_end) DO NOTHING
  `);
  return cleared.rows as { period_start: string; period_end: string }[];
}

export async function upsertNteRequired(employeeId: string, periodStart: string, periodEnd: string) {
  await db
    .insert(nteRecords)
    .values({ employeeId, periodStart, periodEnd, status: 'required' })
    .onConflictDoNothing();
}

export async function issueNte(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
  issuedBy: string,
  notes: string,
) {
  const today = todayPH();
  await db
    .insert(nteRecords)
    .values({ employeeId, periodStart, periodEnd, status: 'issued', issuedBy, notes, issuedDate: today })
    .onConflictDoUpdate({
      target: [nteRecords.employeeId, nteRecords.periodStart, nteRecords.periodEnd],
      set: {
        status: 'issued',
        issuedBy,
        notes,
        issuedDate: today,
        updatedAt: new Date(),
      },
    });
}

export async function acknowledgeNte(employeeId: string, periodStart: string, periodEnd: string) {
  // Guard: only acknowledge records that are already in 'issued' state.
  // Prevents skipping the issue step (e.g. going required → acknowledged directly).
  await db
    .update(nteRecords)
    .set({ status: 'acknowledged', acknowledgedDate: todayPH(), updatedAt: new Date() })
    .where(and(
      eq(nteRecords.employeeId, employeeId),
      eq(nteRecords.periodStart, periodStart),
      eq(nteRecords.periodEnd, periodEnd),
      eq(nteRecords.status, 'issued'),
    ));
}

export interface NteListFilters {
  status?: string;
  start: string;
  end: string;
  department?: string;
}

// An NTE belongs to a range when its period starts inside it, counting from the
// Monday of the start date — so "October" includes the week of Sep 28 – Oct 4,
// while "last week" doesn't pull in the overlapping monthly NTE before it.
function periodInRangeSql(start: string, end: string) {
  return sql`n.period_start >= ${weekStart(start)}::date AND n.period_start <= ${end}::date`;
}

export async function getNteList(filters: NteListFilters) {
  const conditions: SQL[] = [periodInRangeSql(filters.start, filters.end)];

  if (filters.status && filters.status !== 'all') {
    conditions.push(sql`n.status = ${filters.status}`);
  } else {
    conditions.push(sql`n.status IN ('required', 'issued', 'acknowledged')`);
  }

  if (filters.department) {
    conditions.push(sql`e.department = ${filters.department}`);
  }

  // Hide excluded employees/departments from the NTE list.
  conditions.push(notExcludedSql('e'));

  const late = effectiveLateSql('a');
  // Period totals for every row; weekly rows also get month-to-date figures from
  // the weekly rule (a monthly row's period total already is its month total).
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
      n.period_start::text AS period_start,
      n.period_end::text   AS period_end,
      n.status,
      n.issued_date,
      n.issued_by,
      n.notes,
      n.acknowledged_date,
      p.late_count,
      p.accumulated_minutes,
      COALESCE(w.mtd_lates, p.late_count)            AS mtd_lates,
      COALESCE(w.mtd_minutes, p.accumulated_minutes) AS mtd_minutes
    FROM nte_records n
    JOIN employees e ON n.employee_id = e.employee_id
    LEFT JOIN LATERAL (
      SELECT
        COUNT(*) FILTER (WHERE ${late} > 0)::int AS late_count,
        COALESCE(SUM(${late}), 0)::int          AS accumulated_minutes
      FROM attendance_records a
      ${adjustmentJoinSql('a')}
      WHERE a.employee_id = n.employee_id
        AND a.date BETWEEN n.period_start AND n.period_end
    ) p ON true
    LEFT JOIN (${weeklyLateSql({ from: filters.start, to: filters.end })}) w
      ON w.employee_id = n.employee_id
      AND w.week_start = n.period_start
      AND n.period_end = n.period_start + 6
    WHERE ${sql.join(conditions, sql` AND `)}
    ORDER BY n.period_start DESC, e.last_name ASC
  `);
  return rows.rows as Record<string, unknown>[];
}

export async function getNteCounts(filters: { start: string; end: string; department?: string }) {
  const conditions: SQL[] = [periodInRangeSql(filters.start, filters.end)];
  if (filters.department) conditions.push(sql`e.department = ${filters.department}`);

  // Always join employees so excluded employees/departments are left out of the counts.
  conditions.push(notExcludedSql('e'));

  const result = await db.execute(sql`
    SELECT n.status, COUNT(*)::int AS count
    FROM nte_records n
    JOIN employees e ON n.employee_id = e.employee_id
    WHERE ${sql.join(conditions, sql` AND `)}
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

export async function getNteDepartments() {
  const rows = await db.execute(sql`
    SELECT DISTINCT department
    FROM employees e
    WHERE department IS NOT NULL
      AND ${notExcludedSql('e')}
    ORDER BY department ASC
  `);
  return (rows.rows as { department: string }[]).map((r) => r.department);
}
