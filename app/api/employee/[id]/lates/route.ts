import { NextRequest, NextResponse } from 'next/server';
import { getEmployeeLateRecords } from '@/lib/queries/attendance';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(request.url);
  const year = Number(searchParams.get('year')) || new Date().getFullYear();
  const month = Number(searchParams.get('month')) || new Date().getMonth() + 1;

  const records = await getEmployeeLateRecords(params.id, year, month);
  return NextResponse.json(records);
}
