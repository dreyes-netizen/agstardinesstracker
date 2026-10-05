import { Suspense } from 'react';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { StatCards } from '@/components/dashboard/StatCards';
import { DayOfWeekCards } from '@/components/dashboard/DayOfWeekCards';
import { EmployeeTable } from '@/components/dashboard/EmployeeTable';
import { getFilterOptions } from '@/lib/queries/employees';
import { getSessionUser } from '@/lib/auth/session';
import { getWeeklyStats, hasAttendanceInRange, getLatestAttendancePeriod, getLateByDayOfWeek } from '@/lib/queries/attendance';
import { addDays, formatPeriod, isIsoDate, lastCompleteWeekStart, todayPH, weekStart as toWeekStart } from '@/lib/utils/week';

interface PageProps {
  searchParams: {
    week?: string; // any date in the week; snapped to its Monday
    dept?: string;
    supervisor?: string;
    manager?: string;
  };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const dept = searchParams.dept;
  const supervisor = searchParams.supervisor;
  const manager = searchParams.manager;

  // Round 1: latestPeriod always runs so the "Data through …" label stays visible
  // on every filter selection, not just the initial page load.
  const [latestPeriod, filterOptions, user] = await Promise.all([
    getLatestAttendancePeriod(),
    getFilterOptions(),
    getSessionUser(),
  ]);

  // Default: the last Mon–Sun week fully covered by uploaded data — the week
  // reviewed on Monday.
  const weekStart = isIsoDate(searchParams.week)
    ? toWeekStart(searchParams.week)
    : lastCompleteWeekStart(latestPeriod?.latestDate ?? todayPH());
  const weekEnd = addDays(weekStart, 6);

  const filters = { weekStart, department: dept, immediateSupervisor: supervisor, approver2: manager };

  // Round 2: data queries, now that the week is resolved.
  const [dataExists, employees, dowStats] = await Promise.all([
    hasAttendanceInRange(weekStart, weekEnd),
    getWeeklyStats(filters),
    getLateByDayOfWeek(filters),
  ]);

  const nteRequired    = dataExists ? employees.filter((e) => e.nteStatus === 'required').length : 0;
  const approaching    = dataExists ? employees.filter((e) => e.nteStatus === 'warning').length : 0;
  const totalIncidents = dataExists ? employees.reduce((sum, e) => sum + e.lateCount, 0) : 0;
  const lateCount      = dataExists ? employees.filter((e) => e.lateCount > 0).length : 0;
  const latePercent    = dataExists && employees.length > 0
    ? Math.round((lateCount / employees.length) * 100)
    : 0;

  const weekLabel = formatPeriod(weekStart, weekEnd);

  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <FilterBar
          weekStart={weekStart}
          departments={filterOptions.departments}
          supervisors={filterOptions.supervisors}
          managers={filterOptions.managers}
          combinations={filterOptions.combinations}
          selectedDept={dept}
          selectedSupervisor={supervisor}
          selectedManager={manager}
          latestDate={latestPeriod?.latestDate ?? null}
        />
      </Suspense>
      <div className="flex-1 min-h-0 flex flex-col p-6 gap-5">
        <StatCards
          nteRequired={nteRequired}
          approaching={approaching}
          totalIncidents={totalIncidents}
          latePercent={latePercent}
          lateCount={lateCount}
          totalEmployees={employees.length}
        />
        {dataExists && (
          <div className="hidden md:block">
            <DayOfWeekCards stats={dowStats} totalEmployees={employees.length} />
          </div>
        )}
        {dataExists ? (
          <EmployeeTable data={employees} weekStart={weekStart} dept={dept} supervisor={supervisor} manager={manager} isAdmin={user?.role === 'admin'} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-[15px] font-medium text-app-text">No attendance data for {weekLabel}</p>
            <p className="text-[13px] text-muted mt-1">Upload an attendance report covering this week to see results.</p>
          </div>
        )}
      </div>
    </div>
  );
}
