import { db } from '@/lib/db';
import { employees, attendanceRecords, nteRecords, leaveRecords } from '@/lib/db/schema';
import { asc, notInArray, sql } from 'drizzle-orm';

export async function getLastRosterUpdate(): Promise<string | null> {
  const result = await db.execute(
    sql`SELECT MAX(updated_at)::text AS last_updated FROM employees`
  );
  const row = result.rows[0] as { last_updated: string | null };
  return row?.last_updated ?? null;
}

// Roster summary for the Upload page status panel.
export async function getRosterStatus(): Promise<{ count: number; lastUpdated: string | null }> {
  const result = await db.execute(
    sql`SELECT COUNT(*)::int AS count, MAX(updated_at)::text AS last_updated FROM employees`
  );
  const row = result.rows[0] as { count: number; last_updated: string | null };
  return { count: Number(row?.count) || 0, lastUpdated: row?.last_updated ?? null };
}

export async function getAllEmployees() {
  return db.select().from(employees).orderBy(asc(employees.lastName));
}

// Lightweight list for the Users add-form picker (Employee ID → name).
export async function getEmployeeOptions(): Promise<{ employeeId: string; name: string; department: string | null }[]> {
  const rows = await db
    .select({
      employeeId: employees.employeeId,
      firstName: employees.firstName,
      lastName: employees.lastName,
      department: employees.department,
    })
    .from(employees)
    .orderBy(asc(employees.lastName));
  return rows.map((r) => ({
    employeeId: r.employeeId,
    name: [r.firstName, r.lastName].filter(Boolean).join(' ').trim() || r.employeeId,
    department: r.department,
  }));
}

// Authoritative single-employee lookup (server derives the name from the roster).
export async function getEmployeeById(employeeId: string) {
  const rows = await db
    .select()
    .from(employees)
    .where(sql`${employees.employeeId} = ${employeeId}`)
    .limit(1);
  return rows[0];
}

export async function getFilterOptions() {
  const rows = await db
    .selectDistinct({
      department: employees.department,
      immediateSupervisor: employees.immediateSupervisor,
      approver2: employees.approver2,
    })
    .from(employees)
    .orderBy(asc(employees.department));

  const departments = Array.from(new Set(rows.map((r) => r.department).filter(Boolean))) as string[];
  const supervisors = Array.from(new Set(rows.map((r) => r.immediateSupervisor).filter(Boolean))) as string[];
  const managers = Array.from(new Set(rows.map((r) => r.approver2).filter(Boolean))) as string[];

  // Raw combinations so FilterBar can cascade — filter supervisors/managers by dept client-side.
  const combinations = rows
    .filter((r) => r.department || r.immediateSupervisor || r.approver2)
    .map((r) => ({
      department: r.department ?? null,
      supervisor: r.immediateSupervisor ?? null,
      manager: r.approver2 ?? null,
    }));

  return { departments, supervisors, managers, combinations };
}

export async function getRosterEmployeeIds(): Promise<Set<string>> {
  const rows = await db.select({ employeeId: employees.employeeId }).from(employees);
  return new Set(rows.map((r) => r.employeeId));
}

export async function insertMissingEmployees(employeeIds: string[]) {
  if (employeeIds.length === 0) return;
  for (const id of employeeIds) {
    await db
      .insert(employees)
      .values({
        employeeId: id,
        firstName: '',
        lastName: id,
        middleName: null,
        department: null,
        immediateSupervisor: null,
        approver2: null,
        hireDate: null,
      })
      .onConflictDoNothing();
  }
}

export async function upsertEmployees(
  parsed: {
    employeeId: string;
    firstName: string;
    lastName: string;
    middleName: string;
    department: string;
    immediateSupervisor: string;
    approver2: string;
    hireDate: string | null;
  }[],
) {
  if (parsed.length === 0) return 0;
  for (const emp of parsed) {
    await db
      .insert(employees)
      .values({
        employeeId: emp.employeeId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        middleName: emp.middleName || null,
        department: emp.department || null,
        immediateSupervisor: emp.immediateSupervisor || null,
        approver2: emp.approver2 || null,
        hireDate: emp.hireDate,
      })
      .onConflictDoUpdate({
        target: employees.employeeId,
        set: {
          firstName: emp.firstName,
          lastName: emp.lastName,
          middleName: emp.middleName || null,
          department: emp.department || null,
          immediateSupervisor: emp.immediateSupervisor || null,
          approver2: emp.approver2 || null,
          hireDate: emp.hireDate,
          updatedAt: new Date(),
        },
      });
  }
  return parsed.length;
}

export async function replaceRoster(
  parsed: {
    employeeId: string;
    firstName: string;
    lastName: string;
    middleName: string;
    department: string;
    immediateSupervisor: string;
    approver2: string;
    hireDate: string | null;
  }[],
): Promise<{ upserted: number; removed: number }> {
  if (parsed.length === 0) return { upserted: 0, removed: 0 };

  await upsertEmployees(parsed);

  const keepIds = parsed.map((e) => e.employeeId);

  const toRemove = await db
    .select({ employeeId: employees.employeeId })
    .from(employees)
    .where(notInArray(employees.employeeId, keepIds));

  if (toRemove.length > 0) {
    const removeIds = toRemove.map((r) => r.employeeId);
    await db.delete(attendanceRecords).where(notInArray(attendanceRecords.employeeId, keepIds));
    await db.delete(nteRecords).where(notInArray(nteRecords.employeeId, keepIds));
    await db.delete(leaveRecords).where(notInArray(leaveRecords.employeeId, keepIds));
    await db.delete(employees).where(notInArray(employees.employeeId, keepIds));
    return { upserted: parsed.length, removed: removeIds.length };
  }

  return { upserted: parsed.length, removed: 0 };
}
