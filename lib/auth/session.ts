import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { getAdminAuth } from '@/lib/firebase/admin';
import { db } from '@/lib/db';
import { appUsers } from '@/lib/db/schema';
import type { Role } from '@/lib/db/schema';
import { SESSION_COOKIE } from './constants';

export interface SessionUser {
  email: string;
  role: Role;
  displayName: string | null;
}

// Verifies the session cookie with the Admin SDK, then confirms the email is an
// active allowlist row and returns its role. Returns null if anything fails —
// callers decide whether to redirect (pages) or 401/403 (API routes).
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookie = cookies().get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  try {
    const decoded = await getAdminAuth().verifySessionCookie(cookie, false);
    const email = (decoded.email ?? '').toLowerCase();
    if (!email) return null;
    const rows = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
    const u = rows[0];
    if (!u || !u.active) return null;
    return { email: u.email, role: u.role as Role, displayName: u.displayName };
  } catch {
    return null;
  }
}

// For pages / server actions: redirect on failure.
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect('/login');
  return u;
}

// admin is a superset of manager. requireRole('manager') admits any authorized
// user; requireRole('admin') admits admins only (managers are bounced home).
export async function requireRole(min: Role): Promise<SessionUser> {
  const u = await requireUser();
  if (min === 'admin' && u.role !== 'admin') redirect('/');
  return u;
}
