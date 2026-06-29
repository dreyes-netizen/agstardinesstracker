import { Suspense } from 'react';
import { ScoreFilterBar } from '@/components/attendance-score/ScoreFilterBar';
import { ScoreTable } from '@/components/attendance-score/ScoreTable';
import { getFilterOptions } from '@/lib/queries/employees';
import { getAttendanceScores, getLatestAttendanceRange } from '@/lib/queries/attendance-score';

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
  const [latestRange, filterOptions] = await Promise.all([
    getLatestAttendanceRange(),
    getFilterOptions(),
  ]);

  // Default to the most recent uploaded attendance period.
  const start = isISO(searchParams.start) ? searchParams.start : latestRange?.start ?? '';
  const end = isISO(searchParams.end) ? searchParams.end : latestRange?.end ?? '';

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
          latestRange={latestRange}
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
          <ScoreTable
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
