import { db } from '@/lib/db';
import { employees, attendanceRecords, nteRecords } from '@/lib/db/schema';
import { asc, notInArray } from 'drizzle-orm';

export async function getAllEmployees() {
  return db.select().from(employees).orderBy(asc(employees.lastName));
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

  return { departments, supervisors, managers };
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
    await db.delete(employees).where(notInArray(employees.employeeId, keepIds));
    return { upserted: parsed.length, removed: removeIds.length };
  }

  return { upserted: parsed.length, removed: 0 };
}
