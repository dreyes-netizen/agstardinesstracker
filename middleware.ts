import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

// Lightweight gate: if there's no session cookie, send to /login. This runs in
// Edge so it only checks cookie PRESENCE — the cookie is cryptographically
// verified (and the role enforced) server-side in pages/actions/routes.
export function middleware(req: NextRequest) {
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  // Protect everything except the login page, the auth API, and static assets
  // (including the favicon route /icon.png and the public logo).
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico|icon.png|agslogo.png).*)'],
};
