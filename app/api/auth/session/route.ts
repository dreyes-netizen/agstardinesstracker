import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getAdminAuth } from '@/lib/firebase/admin';
import { db } from '@/lib/db';
import { appUsers } from '@/lib/db/schema';
import { backfillDisplayName } from '@/lib/queries/users';
import { SESSION_COOKIE } from '@/lib/auth/constants';

const EXPIRES_IN_MS = 5 * 24 * 60 * 60 * 1000; // 5 days

// POST { idToken } — verify the Google sign-in, enforce the allowlist, and mint
// an httpOnly session cookie. This is where unauthorized accounts are rejected.
export async function POST(req: NextRequest) {
  try {
    const { idToken } = await req.json();
    if (!idToken) {
      return NextResponse.json({ error: 'Missing token.' }, { status: 400 });
    }

    const decoded = await getAdminAuth().verifyIdToken(idToken);
    const email = (decoded.email ?? '').toLowerCase();
    if (!email) {
      return NextResponse.json({ error: 'No email on this account.' }, { status: 400 });
    }

    const rows = await db.select().from(appUsers).where(eq(appUsers.email, email)).limit(1);
    const user = rows[0];
    if (!user || !user.active) {
      return NextResponse.json(
        { error: 'This account is not authorized for this app. Contact an admin.' },
        { status: 403 },
      );
    }

    // First sign-in: capture the Google display name if no name is set yet.
    if (!user.displayName && decoded.name) {
      await backfillDisplayName(email, String(decoded.name));
    }

    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, { expiresIn: EXPIRES_IN_MS });
    const res = NextResponse.json({ ok: true, role: user.role });
    res.cookies.set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: EXPIRES_IN_MS / 1000,
    });
    return res;
  } catch (err) {
    console.error('session POST error:', err);
    return NextResponse.json({ error: 'Sign-in failed. Please try again.' }, { status: 401 });
  }
}

// DELETE — sign out by clearing the cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
