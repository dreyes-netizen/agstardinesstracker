import { Suspense } from 'react';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { StatCards } from '@/components/dashboard/StatCards';
import { DayOfWeekCards } from '@/components/dashboard/DayOfWeekCards';
import { EmployeeTable } from '@/components/dashboard/EmployeeTable';
import { getFilterOptions } from '@/lib/queries/employees';
import { getMonthlyStats, hasAttendanceData, getLatestAttendancePeriod, getLateByDayOfWeek } from '@/lib/queries/attendance';

interface PageProps {
  searchParams: {
    year?: string;
    month?: string;
    dept?: string;
    supervisor?: string;
    manager?: string;
  };
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const now = new Date();
  const hasParams = !!(searchParams.year && searchParams.month);
  const dept = searchParams.dept;
  const supervisor = searchParams.supervisor;
  const manager = searchParams.manager;

  // Round 1: latestPeriod always runs so the "Data through …" label stays visible
  // on every filter selection, not just the initial page load.
  const [latestPeriod, filterOptions] = await Promise.all([
    getLatestAttendancePeriod(),
    getFilterOptions(),
  ]);

  const year  = Number(searchParams.year)  || latestPeriod?.year  || now.getFullYear();
  const month = Number(searchParams.month) || latestPeriod?.month || (now.getMonth() + 1);

  const filters = { year, month, department: dept, immediateSupervisor: supervisor, approver2: manager };

  // Round 2: data queries, now that year/month is resolved.
  const [dataExists, employees, dowStats] = await Promise.all([
    hasAttendanceData(year, month),
    getMonthlyStats(filters),
    getLateByDayOfWeek(filters),
  ]);

  const nteRequired    = dataExists ? employees.filter((e) => e.nteStatus === 'required').length : 0;
  const approaching    = dataExists ? employees.filter((e) => e.nteStatus === 'warning').length : 0;
  const totalIncidents = dataExists ? employees.reduce((sum, e) => sum + e.lateCount, 0) : 0;
  const lateCount      = dataExists ? employees.filter((e) => e.lateCount > 0).length : 0;
  const latePercent    = dataExists && employees.length > 0
    ? Math.round((lateCount / employees.length) * 100)
    : 0;

  const monthLabel = new Date(year, month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <FilterBar
          year={year} month={month}
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
        {dataExists && <DayOfWeekCards stats={dowStats} totalEmployees={employees.length} />}
        {dataExists ? (
          <EmployeeTable data={employees} year={year} month={month} dept={dept} supervisor={supervisor} manager={manager} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <p className="text-[15px] font-medium text-app-text">No attendance data for {monthLabel}</p>
            <p className="text-[13px] text-muted mt-1">Upload an attendance report for this period to see results.</p>
          </div>
        )}
      </div>
    </div>
  );
}
