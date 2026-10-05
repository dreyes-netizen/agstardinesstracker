'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { formatDate } from '@/lib/utils/date';
import { addDays, formatPeriod, weekStart as toWeekStart } from '@/lib/utils/week';
import { useFilterContext } from '@/context/FilterContext';

interface Combination {
  department: string | null;
  supervisor: string | null;
  manager: string | null;
}

interface FilterBarProps {
  weekStart: string; // Monday, YYYY-MM-DD
  departments: string[];
  supervisors: string[];
  managers: string[];
  combinations: Combination[];
  selectedDept?: string;
  selectedSupervisor?: string;
  selectedManager?: string;
  latestDate?: string | null;
}

const SELECT_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-app-blue/40 min-w-0';
const LABEL_CLS =
  'text-[12.5px] text-muted';
const NAV_BTN_CLS =
  'border border-border rounded-[5px] w-7 h-[30px] text-[15px] leading-none text-muted hover:text-app-text hover:border-app-text/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-blue/40';

export function FilterBar({
  weekStart, departments, supervisors, managers, combinations,
  selectedDept, selectedSupervisor, selectedManager, latestDate,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { dashboard: savedDashboard, setDashboard } = useFilterContext();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Restore saved filters whenever the URL has no params (covers both initial mount
  // and clicking the nav button again while already on this page).
  useEffect(() => {
    if (!searchParams.get('week') && savedDashboard) {
      const params = new URLSearchParams();
      params.set('week', savedDashboard.week);
      if (savedDashboard.dept) params.set('dept', savedDashboard.dept);
      if (savedDashboard.supervisor) params.set('supervisor', savedDashboard.supervisor);
      if (savedDashboard.manager) params.set('manager', savedDashboard.manager);
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushAndSave = useCallback((params: URLSearchParams) => {
    router.push(`${pathname}?${params.toString()}`);
    setDashboard({
      week: params.get('week') || weekStart,
      dept: params.get('dept') || '',
      supervisor: params.get('supervisor') || '',
      manager: params.get('manager') || '',
    });
  }, [router, pathname, weekStart, setDashboard]);

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

  const setWeek = (date: string) => {
    if (!date) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set('week', toWeekStart(date));
    pushAndSave(params);
  };

  const latestDateLabel = latestDate ? formatDate(latestDate) : null;

  return (
    <div className="bg-white border-b border-border px-4 md:px-6 py-3 flex items-center gap-4 md:gap-6 flex-wrap">
      <h1 className="text-[15px] font-semibold text-app-text tracking-tight mr-2">
        {formatPeriod(weekStart, addDays(weekStart, 6))}
      </h1>
      {latestDateLabel && (
        <span className="hidden md:inline text-[11.5px] text-muted ml-auto">
          Data through <span className="font-medium text-app-text">{latestDateLabel}</span>
        </span>
      )}
      <button
        onClick={() => setFiltersOpen((v) => !v)}
        className="md:hidden ml-auto text-[12px] text-muted border border-border rounded-[5px] px-2.5 py-1 flex items-center gap-1"
        aria-expanded={filtersOpen}
      >
        Filters {filtersOpen ? '▴' : '▾'}
      </button>

      <div className={`${filtersOpen ? 'flex flex-wrap gap-x-4 gap-y-2 w-full' : 'hidden'} md:contents`}>
      <div className="flex items-center gap-1.5">
        <span className={`${LABEL_CLS} mr-0.5`}>Week</span>
        <button type="button" onClick={() => setWeek(addDays(weekStart, -7))} aria-label="Previous week" className={NAV_BTN_CLS}>
          ‹
        </button>
        <input
          type="date"
          value={weekStart}
          onChange={(e) => setWeek(e.target.value)}
          aria-label="Pick any day in the week"
          className={SELECT_CLS}
        />
        <button type="button" onClick={() => setWeek(addDays(weekStart, 7))} aria-label="Next week" className={NAV_BTN_CLS}>
          ›
        </button>
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
    </div>
  );
}
