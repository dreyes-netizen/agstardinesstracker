import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeLateRecords } from '@/lib/queries/attendance';
import { getSessionUser } from '@/lib/auth/session';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // Verify the session server-side — middleware only checks cookie presence.
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year')) || new Date().getFullYear();
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;

  const records = await getEmployeeLateRecords(params.id, year, month);
  return NextResponse.json(records);
}
