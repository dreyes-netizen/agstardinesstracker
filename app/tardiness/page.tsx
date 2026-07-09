import { Suspense } from 'react';
import { TardinessFilterBar } from '@/components/tardiness/TardinessFilterBar';
import { TardinessReport } from '@/components/tardiness/TardinessReport';
import { getEmployeeOptions, getEmployeeById } from '@/lib/queries/employees';
import { getEmployeeTardinessDetail, getLatestAttendancePeriod } from '@/lib/queries/attendance';
import { getLatestAttendanceRange } from '@/lib/queries/attendance-score';
import { requireUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: {
    employeeId?: string;
    start?: string;
    end?: string;
  };
}

function isISO(v: string | undefined): v is string {
  return !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

export default async function TardinessPage({ searchParams }: PageProps) {
  await requireUser(); // manager-visible

  // "Today" in Manila time (YYYY-MM-DD), to match the rest of the app.
  const todayPH = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  const [employees, latestRange, latestPeriod] = await Promise.all([
    getEmployeeOptions(),
    getLatestAttendanceRange(),
    getLatestAttendancePeriod(),
  ]);

  // Default range: the most recent uploaded month (1st → latest date), capped so
  // the picker never runs ahead of actual data. Mirrors the Attendance Score page.
  let defaultStart = '';
  let defaultEnd = '';
  if (latestPeriod?.latestDate) {
    defaultEnd = latestRange && latestRange.end < todayPH ? latestRange.end : latestPeriod.latestDate;
    defaultStart = `${defaultEnd.slice(0, 7)}-01`;
  }

  const start = isISO(searchParams.start) ? searchParams.start : defaultStart;
  const end = isISO(searchParams.end) ? searchParams.end : defaultEnd;

  const employeeId = searchParams.employeeId;
  const hasRange = isISO(start) && isISO(end);

  const [employee, incidents] =
    employeeId && hasRange
      ? await Promise.all([
          getEmployeeById(employeeId),
          getEmployeeTardinessDetail(employeeId, start, end),
        ])
      : [undefined, []];

  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <TardinessFilterBar employees={employees} selectedEmployeeId={employeeId} start={start} end={end} />
      </Suspense>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 print:p-0 print:overflow-visible">
        {employee ? (
          <TardinessReport employee={employee} incidents={incidents} start={start} end={end} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center print:hidden">
            <p className="text-[15px] font-medium text-app-text">
              {employeeId ? 'Employee not found' : 'Select an employee to generate a report'}
            </p>
            <p className="text-[13px] text-muted mt-1">
              {employeeId
                ? 'That employee is no longer in the roster.'
                : 'Search for an employee above, then choose a month or date range.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
