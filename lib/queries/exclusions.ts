import { db } from '@/lib/db';
import { employees, excludedDepartments } from '@/lib/db/schema';
import { asc, eq, sql } from 'drizzle-orm';

// ── Shared filter predicate ────────────────────────────────────────────────
// A SQL fragment that keeps only NON-excluded employees. Reused in the WHERE of
// every tracking query (Dashboard, Attendance Score, NTE). Assumes the employees
// table is joined and aliased `e`. An employee is excluded if their own flag is
// set OR their department matches a row in excluded_departments (case-insensitive).
//
// Usage inside a raw `sql` template:
//   WHERE ... AND ${notExcludedSql('e')}
export function notExcludedSql(alias = 'e') {
  const a = sql.raw(alias);
  return sql`${a}.excluded_from_tracking = false
    AND (${a}.department IS NULL
      OR LOWER(TRIM(${a}.department)) NOT IN (SELECT LOWER(TRIM(name)) FROM excluded_departments))`;
}

// Same rule, but expressed against a bare `employee_id` column (for the NTE sync
// INSERT … SELECT statements, which read from attendance_records without an `e` join).
export function employeeNotExcludedSql(idColumn = 'employee_id') {
  const c = sql.raw(idColumn);
  return sql`${c} NOT IN (
      SELECT employee_id FROM employees
      WHERE excluded_from_tracking = true
         OR LOWER(TRIM(department)) IN (SELECT LOWER(TRIM(name)) FROM excluded_departments)
    )`;
}

// ── Per-employee exclusions ────────────────────────────────────────────────
export async function getExcludedEmployees(): Promise<
  { employeeId: string; name: string; department: string | null }[]
> {
  const rows = await db
    .select({
      employeeId: employees.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      department: employees.department,
    })
    .from(employees)
    .where(eq(employees.excludedFromTracking, true))
    .orderBy(asc(employees.lastName));
  return rows.map((r) => ({
    employeeId: r.employeeId,
    name: [r.lastName, r.firstName].filter(Boolean).join(', ').trim() || r.employeeId,
    department: r.department,
  }));
}

export async function setEmployeeExcluded(employeeId: string, value: boolean) {
  await db
    .update(employees)
    .set({ excludedFromTracking: value, updatedAt: new Date() })
    .where(eq(employees.employeeId, employeeId));
}

// ── Department-level exclusions ────────────────────────────────────────────
export async function getExcludedDepartments() {
  return db.select().from(excludedDepartments).orderBy(asc(excludedDepartments.name));
}

export async function addExcludedDepartment(name: string, actorEmail: string | null) {
  const trimmed = name.trim();
  if (!trimmed) return;
  // Case-insensitive dedupe: skip if a matching name already exists.
  const existing = await db
    .select({ id: excludedDepartments.id })
    .from(excludedDepartments)
    .where(sql`LOWER(TRIM(${excludedDepartments.name})) = ${trimmed.toLowerCase()}`)
    .limit(1);
  if (existing.length > 0) return;
  await db.insert(excludedDepartments).values({ name: trimmed, createdBy: actorEmail });
}

export async function removeExcludedDepartment(id: number) {
  await db.delete(excludedDepartments).where(eq(excludedDepartments.id, id));
}
