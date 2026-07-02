import { Suspense } from 'react';
import { ScoreFilterBar } from '@/components/attendance-score/ScoreFilterBar';
import { ScoreBoard } from '@/components/attendance-score/ScoreBoard';
import { getFilterOptions } from '@/lib/queries/employees';
import { getAttendanceScores, getLatestAttendanceRange } from '@/lib/queries/attendance-score';
import { hasAttendanceData } from '@/lib/queries/attendance';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    start?: string;
    end?: string;
    dept?: string;
    supervisor?: string;
    manager?: string;
  };
}

function isISO(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default async function AttendanceScorePage({ searchParams }: PageProps) {
  // "Today" in Manila time (YYYY-MM-DD), to match the rest of the app.
  const todayPH = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const curYear = Number(todayPH.slice(0, 4));
  const curMonth = Number(todayPH.slice(5, 7));

  const [latestRange, filterOptions, hasThisMonth] = await Promise.all([
    getLatestAttendanceRange(),
    getFilterOptions(),
    hasAttendanceData(curYear, curMonth),
  ]);

  // Default: month-to-date (1st → today) when the current month has data,
  // otherwise show the whole month of the most recent uploaded period.
  let defaultStart = '';
  let defaultEnd = '';
  if (hasThisMonth) {
    defaultStart = `${todayPH.slice(0, 7)}-01`;
    defaultEnd = todayPH;
  } else if (latestRange) {
    defaultStart = `${latestRange.end.slice(0, 7)}-01`;
    defaultEnd = latestRange.end;
  }

  const start = isISO(searchParams.start) ? searchParams.start : defaultStart;
  const end = isISO(searchParams.end) ? searchParams.end : defaultEnd;

  const dept = searchParams.dept;
  const supervisor = searchParams.supervisor;
  const manager = searchParams.manager;

  const hasRange = isISO(start) && isISO(end);

  const scores = hasRange
    ? await getAttendanceScores({
        start, end,
        department: dept,
        immediateSupervisor: supervisor,
        approver2: manager,
      })
    : [];

  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <ScoreFilterBar
          start={start}
          end={end}
          departments={filterOptions.departments}
          supervisors={filterOptions.supervisors}
          managers={filterOptions.managers}
          combinations={filterOptions.combinations}
          selectedDept={dept}
          selectedSupervisor={supervisor}
          selectedManager={manager}
        />
      </Suspense>
      <div className="flex-1 min-h-0 flex flex-col p-6 gap-5">
        {hasRange && scores.length > 0 ? (
          <ScoreBoard
            data={scores}
            start={start}
            end={end}
            dept={dept}
            supervisor={supervisor}
            manager={manager}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-[15px] font-medium text-app-text">
              {hasRange ? 'No attendance data for this range' : 'Select a date range'}
            </p>
            <p className="text-[13px] text-muted mt-1">
              {hasRange
                ? 'Upload an attendance report covering these dates to see scores.'
                : 'Upload an attendance report, then pick a start and end date above.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
