import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { setEmployeeExcluded } from '@/lib/queries/exclusions';

// Toggling exclusion changes what every user sees in the tracking views — admins only.
async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ success: false, error: 'Admins only.' }, { status: 403 }) };
  return { user };
}

// Add an employee to the exclusion list (hide from tracking).
export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const employeeId = body?.employeeId ? String(body.employeeId).trim() : '';
  if (!employeeId) {
    return NextResponse.json({ success: false, error: 'employeeId is required.' }, { status: 400 });
  }

  await setEmployeeExcluded(employeeId, true);
  return NextResponse.json({ success: true });
}

// Remove an employee from the exclusion list (restore to tracking).
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const employeeId = req.nextUrl.searchParams.get('employeeId')?.trim() ?? '';
  if (!employeeId) {
    return NextResponse.json({ success: false, error: 'employeeId is required.' }, { status: 400 });
  }

  await setEmployeeExcluded(employeeId, false);
  return NextResponse.json({ success: true });
}
