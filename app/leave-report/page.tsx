import { Suspense } from 'react';
import { LeaveFilterBar } from '@/components/leave-report/LeaveFilterBar';
import { LeaveTable } from '@/components/leave-report/LeaveTable';
import { getApprovedLeaves } from '@/lib/queries/leave';
import { getLatestAttendanceRange } from '@/lib/queries/attendance-score';
import { hasAttendanceData } from '@/lib/queries/attendance';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: { start?: string; end?: string };
}

function isISO(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default async function LeaveReportPage({ searchParams }: PageProps) {
  const todayPH = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const curYear = Number(todayPH.slice(0, 4));
  const curMonth = Number(todayPH.slice(5, 7));

  const [latestRange, hasThisMonth] = await Promise.all([
    getLatestAttendanceRange(),
    hasAttendanceData(curYear, curMonth),
  ]);

  const defaultStart = hasThisMonth ? `${todayPH.slice(0, 7)}-01` : latestRange?.start ?? '';
  const defaultEnd = hasThisMonth ? todayPH : latestRange?.end ?? '';

  const start = isISO(searchParams.start) ? searchParams.start : defaultStart;
  const end = isISO(searchParams.end) ? searchParams.end : defaultEnd;
  const hasRange = isISO(start) && isISO(end);

  const leaves = hasRange ? await getApprovedLeaves(start, end) : [];

  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <LeaveFilterBar start={start} end={end} latestRange={latestRange} />
      </Suspense>
      <div className="flex-1 min-h-0 flex flex-col p-6 gap-5">
        {hasRange && leaves.length > 0 ? (
          <LeaveTable data={leaves} start={start} end={end} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-[15px] font-medium text-app-text">
              {hasRange ? 'No approved leaves in this range' : 'Select a date range'}
            </p>
            <p className="text-[13px] text-muted mt-1">
              {hasRange
                ? 'Only approved leaves overlapping the selected dates are shown.'
                : 'Upload a leave report, then pick a start and end date above.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
