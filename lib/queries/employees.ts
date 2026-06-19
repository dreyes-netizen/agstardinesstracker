import { db } from '@/lib/db';
import { employees } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';

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

  const departments = [...new Set(rows.map((r) => r.department).filter(Boolean))] as string[];
  const supervisors = [...new Set(rows.map((r) => r.immediateSupervisor).filter(Boolean))] as string[];
  const managers = [...new Set(rows.map((r) => r.approver2).filter(Boolean))] as string[];

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
