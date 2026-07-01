'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo } from 'react';
import { formatDate } from '@/lib/utils/date';
import { useFilterContext } from '@/context/FilterContext';

interface Combination {
  department: string | null;
  supervisor: string | null;
  manager: string | null;
}

interface FilterBarProps {
  year: number;
  month: number;
  departments: string[];
  supervisors: string[];
  managers: string[];
  combinations: Combination[];
  selectedDept?: string;
  selectedSupervisor?: string;
  selectedManager?: string;
  latestDate?: string | null;
}

const MONTHS = [
  { value: 1,  label: 'January' },
  { value: 2,  label: 'February' },
  { value: 3,  label: 'March' },
  { value: 4,  label: 'April' },
  { value: 5,  label: 'May' },
  { value: 6,  label: 'June' },
  { value: 7,  label: 'July' },
  { value: 8,  label: 'August' },
  { value: 9,  label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const SELECT_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none min-w-0';
const LABEL_CLS =
  'text-[12.5px] text-muted';

export function FilterBar({
  year, month, departments, supervisors, managers, combinations,
  selectedDept, selectedSupervisor, selectedManager, latestDate,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dashboard: savedDashboard, setDashboard } = useFilterContext();

  // Restore saved filters whenever the URL has no params (covers both initial mount
  // and clicking the nav button again while already on this page).
  useEffect(() => {
    if (!searchParams.get('year') && savedDashboard) {
      const params = new URLSearchParams();
      params.set('year', savedDashboard.year);
      params.set('month', savedDashboard.month);
      if (savedDashboard.dept) params.set('dept', savedDashboard.dept);
      if (savedDashboard.supervisor) params.set('supervisor', savedDashboard.supervisor);
      if (savedDashboard.manager) params.set('manager', savedDashboard.manager);
      router.replace(`${pathname}?${params.toString()}`);
    }
  }, [searchParams, savedDashboard, router, pathname]);

  const pushAndSave = useCallback((params: URLSearchParams) => {
    router.push(`${pathname}?${params.toString()}`);
    setDashboard({
      year: params.get('year') || String(year),
      month: params.get('month') || String(month),
      dept: params.get('dept') || '',
      supervisor: params.get('supervisor') || '',
      manager: params.get('manager') || '',
    });
  }, [router, pathname, year, month, setDashboard]);

  // Cascade: when a dept is selected, narrow supervisors and managers to those
  // who appear in at least one employee row in that department.
  const filteredSupervisors = useMemo(() => {
    if (!selectedDept) return supervisors;
    return Array.from(new Set(
      combinations
        .filter((c) => c.department === selectedDept && c.supervisor)
        .map((c) => c.supervisor!)
    )).sort();
  }, [selectedDept, combinations, supervisors]);

  const filteredManagers = useMemo(() => {
    if (!selectedDept) return managers;
    return Array.from(new Set(
      combinations
        .filter((c) => c.department === selectedDept && c.manager)
        .map((c) => c.manager!)
    )).sort();
  }, [selectedDept, combinations, managers]);

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      pushAndSave(params);
    },
    [searchParams, pushAndSave],
  );

  const handleDeptChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set('dept', value);
      else params.delete('dept');

      // Clear supervisor/manager if they no longer belong to the new department.
      if (value) {
        const validSupervisors = new Set(
          combinations.filter((c) => c.department === value).map((c) => c.supervisor).filter(Boolean)
        );
        const validManagers = new Set(
          combinations.filter((c) => c.department === value).map((c) => c.manager).filter(Boolean)
        );
        if (selectedSupervisor && !validSupervisors.has(selectedSupervisor)) params.delete('supervisor');
        if (selectedManager && !validManagers.has(selectedManager)) params.delete('manager');
      }

      pushAndSave(params);
    },
    [searchParams, combinations, selectedSupervisor, selectedManager, pushAndSave],
  );

  const handleYearChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', value);
    params.set('month', String(month));
    pushAndSave(params);
  };

  const handleMonthChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(year));
    params.set('month', value);
    pushAndSave(params);
  };

  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= 2024; y--) years.push(y);

  const monthLabel = MONTHS.find((m) => m.value === month)?.label ?? '';

  const latestDateLabel = latestDate ? formatDate(latestDate) : null;

  return (
    <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-6 flex-wrap">
      <h1 className="text-[15px] font-semibold text-app-text tracking-tight mr-2">
        {monthLabel} {year}
      </h1>
      {latestDateLabel && (
        <span className="text-[11.5px] text-muted ml-auto">
          Data through <span className="font-medium text-app-text">{latestDateLabel}</span>
        </span>
      )}

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Month</span>
        <select
          value={month}
          onChange={(e) => handleMonthChange(e.target.value)}
          className={SELECT_CLS}
        >
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Year</span>
        <select
          value={year}
          onChange={(e) => handleYearChange(e.target.value)}
          className={SELECT_CLS}
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Dept</span>
        <select
          value={selectedDept ?? ''}
          onChange={(e) => handleDeptChange(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Supervisor</span>
        <select
          value={selectedSupervisor ?? ''}
          onChange={(e) => updateParam('supervisor', e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">{selectedDept ? `All (${filteredSupervisors.length})` : 'All Supervisors'}</option>
          {filteredSupervisors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Manager</span>
        <select
          value={selectedManager ?? ''}
          onChange={(e) => updateParam('manager', e.target.value)}
          className={SELECT_CLS}
        >
          <option value="">{selectedDept ? `All (${filteredManagers.length})` : 'All Managers'}</option>
          {filteredManagers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
