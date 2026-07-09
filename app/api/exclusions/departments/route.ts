import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth/session';
import { addExcludedDepartment, removeExcludedDepartment } from '@/lib/queries/exclusions';

// Department-level exclusion affects every user's tracking views — admins only.
async function requireAdmin() {
  const user = await getSessionUser();
  if (!user) return { error: NextResponse.json({ success: false, error: 'Not signed in.' }, { status: 401 }) };
  if (user.role !== 'admin') return { error: NextResponse.json({ success: false, error: 'Admins only.' }, { status: 403 }) };
  return { user };
}

// Add a department to the exclusion list.
export async function POST(req: NextRequest) {
  const { user, error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const name = body?.name ? String(body.name).trim() : '';
  if (!name) {
    return NextResponse.json({ success: false, error: 'name is required.' }, { status: 400 });
  }

  await addExcludedDepartment(name, user.email);
  return NextResponse.json({ success: true });
}

// Remove a department from the exclusion list by id.
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const idParam = req.nextUrl.searchParams.get('id');
  const id = idParam ? Number(idParam) : NaN;
  if (!Number.isInteger(id)) {
    return NextResponse.json({ success: false, error: 'Valid id is required.' }, { status: 400 });
  }

  await removeExcludedDepartment(id);
  return NextResponse.json({ success: true });
}
