'use server';

import { requireRole } from '@/lib/auth/session';
import {
  countActiveAdmins, upsertAppUser, setAppUserRole, setAppUserActive, removeAppUser, setAppUserName,
} from '@/lib/queries/users';
import { getEmployeeById } from '@/lib/queries/employees';
import { revalidatePath } from 'next/cache';
import type { Role } from '@/lib/db/schema';

type Result = { ok: true } | { error: string };

const norm = (raw: string) => raw.trim().toLowerCase();
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const validRole = (r: string): r is Role => r === 'admin' || r === 'manager';

export async function addUserAction(
  emailRaw: string,
  role: string,
  employeeIdRaw: string,
  nameRaw: string,
): Promise<Result> {
  await requireRole('admin');
  const email = norm(emailRaw);
  if (!validEmail(email)) return { error: 'Enter a valid email address.' };
  if (!validRole(role)) return { error: 'Invalid role.' };

  let employeeId: string | null = employeeIdRaw.trim() || null;
  let displayName: string | null = nameRaw.trim() || null;

  // Prefer the roster's name when the ID exists; otherwise treat as a manual
  // entry (drop the link, keep whatever name was typed).
  if (employeeId) {
    const emp = await getEmployeeById(employeeId);
    if (emp) {
      displayName = [emp.firstName, emp.lastName].filter(Boolean).join(' ').trim() || displayName;
    } else {
      employeeId = null;
    }
  }

  if (!displayName) {
    return { error: 'Enter an Employee ID from the roster, or a name.' };
  }

  await upsertAppUser(email, role, displayName, employeeId);
  revalidatePath('/users');
  return { ok: true };
}

export async function setNameAction(email: string, nameRaw: string): Promise<Result> {
  await requireRole('admin');
  await setAppUserName(email, nameRaw.trim() || null);
  revalidatePath('/users');
  return { ok: true };
}

export async function setRoleAction(email: string, role: string): Promise<Result> {
  await requireRole('admin');
  if (!validRole(role)) return { error: 'Invalid role.' };
  if (role === 'manager' && (await countActiveAdmins(email)) === 0) {
    return { error: 'At least one active admin is required.' };
  }
  await setAppUserRole(email, role);
  revalidatePath('/users');
  return { ok: true };
}

export async function setActiveAction(email: string, active: boolean): Promise<Result> {
  await requireRole('admin');
  if (!active && (await countActiveAdmins(email)) === 0) {
    return { error: 'At least one active admin is required.' };
  }
  await setAppUserActive(email, active);
  revalidatePath('/users');
  return { ok: true };
}

export async function removeUserAction(email: string): Promise<Result> {
  await requireRole('admin');
  if ((await countActiveAdmins(email)) === 0) {
    return { error: 'At least one active admin is required.' };
  }
  await removeAppUser(email);
  revalidatePath('/users');
  return { ok: true };
}
