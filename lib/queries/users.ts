import { db } from '@/lib/db';
import { appUsers } from '@/lib/db/schema';
import { asc, eq, sql } from 'drizzle-orm';
import type { Role } from '@/lib/db/schema';

export async function getAppUsers() {
  return db.select().from(appUsers).orderBy(asc(appUsers.email));
}

// Active admins, optionally excluding one email — used to prevent locking
// everyone out by removing/demoting/deactivating the last admin.
export async function countActiveAdmins(excludeEmail?: string): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS n FROM app_users
    WHERE role = 'admin' AND active = true
    ${excludeEmail ? sql`AND email <> ${excludeEmail}` : sql``}
  `);
  return Number((rows.rows[0] as { n: number }).n) || 0;
}

export async function upsertAppUser(
  email: string,
  role: Role,
  displayName?: string | null,
  employeeId?: string | null,
) {
  await db
    .insert(appUsers)
    .values({ email, role, displayName: displayName ?? null, employeeId: employeeId ?? null, active: true })
    .onConflictDoUpdate({
      target: appUsers.email,
      set: { role, active: true, displayName: displayName ?? null, employeeId: employeeId ?? null, updatedAt: new Date() },
    });
}

export async function setAppUserRole(email: string, role: Role) {
  await db.update(appUsers).set({ role, updatedAt: new Date() }).where(eq(appUsers.email, email));
}

export async function setAppUserName(email: string, displayName: string | null) {
  await db.update(appUsers).set({ displayName, updatedAt: new Date() }).where(eq(appUsers.email, email));
}

// Fill the name from the Google profile on first sign-in, but never overwrite a
// name an admin has set.
export async function backfillDisplayName(email: string, name: string) {
  await db.execute(sql`
    UPDATE app_users SET display_name = ${name}, updated_at = now()
    WHERE email = ${email} AND (display_name IS NULL OR display_name = '')
  `);
}

export async function setAppUserActive(email: string, active: boolean) {
  await db.update(appUsers).set({ active, updatedAt: new Date() }).where(eq(appUsers.email, email));
}

export async function removeAppUser(email: string) {
  await db.delete(appUsers).where(eq(appUsers.email, email));
}
