import { Suspense } from 'react';
import { FilterBar } from '@/components/dashboard/FilterBar';
import { StatCards } from '@/components/dashboard/StatCards';
import { EmployeeTable } from '@/components/dashboard/EmployeeTable';
import { getFilterOptions } from '@/lib/queries/employees';
import { getMonthlyStats } from '@/lib/queries/attendance';

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
  const year = Number(searchParams.year) || now.getFullYear();
  const month = Number(searchParams.month) || (now.getMonth() + 1);
  const dept = searchParams.dept;
  const supervisor = searchParams.supervisor;
  const manager = searchParams.manager;

  const [filterOptions, employees] = await Promise.all([
    getFilterOptions(),
    getMonthlyStats({ year, month, department: dept, immediateSupervisor: supervisor, approver2: manager }),
  ]);

  const nteRequired  = employees.filter((e) => e.nteStatus === 'required').length;
  const approaching  = employees.filter((e) => e.nteStatus === 'warning').length;
  const totalIncidents = employees.reduce((sum, e) => sum + e.lateCount, 0);

  return (
    <div className="flex flex-col h-full">
      <Suspense>
        <FilterBar
          year={year} month={month}
          departments={filterOptions.departments}
          supervisors={filterOptions.supervisors}
          managers={filterOptions.managers}
          selectedDept={dept}
          selectedSupervisor={supervisor}
          selectedManager={manager}
        />
      </Suspense>
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <StatCards nteRequired={nteRequired} approaching={approaching} totalIncidents={totalIncidents} />
        <EmployeeTable data={employees} year={year} month={month} />
      </div>
    </div>
  );
}
