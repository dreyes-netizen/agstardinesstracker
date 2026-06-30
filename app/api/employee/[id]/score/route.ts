import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeScoreDetail } from '@/lib/queries/attendance-score';
import { getSessionUser } from '@/lib/auth/session';

function isISO(v: string | null): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

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
  if (!isISO(start) || !isISO(end)) {
    return NextResponse.json({ error: 'start and end (YYYY-MM-DD) are required.' }, { status: 400 });
  }
  const detail = await getEmployeeScoreDetail(params.id, start, end);
  return NextResponse.json(detail);
}
