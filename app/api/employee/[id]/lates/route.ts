import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeLateRecords } from '@/lib/queries/attendance';
import { getSessionUser } from '@/lib/auth/session';
import { isIsoDate } from '@/lib/utils/week';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // Verify the session server-side — middleware only checks cookie presence.
  if (!(await getSessionUser())) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!isIsoDate(start) || !isIsoDate(end)) {
    return NextResponse.json({ error: 'start and end must be YYYY-MM-DD.' }, { status: 400 });
  }

  const records = await getEmployeeLateRecords(params.id, start, end);
  return NextResponse.json(records);
}
