'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface FilterBarProps {
  year: number;
  month: number;
  departments: string[];
  supervisors: string[];
  managers: string[];
  selectedDept?: string;
  selectedSupervisor?: string;
  selectedManager?: string;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

export function FilterBar({
  year, month, departments, supervisors, managers,
  selectedDept, selectedSupervisor, selectedManager,
}: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const handleMonthChange = (value: string) => {
    const [y, m] = value.split('-');
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', y);
    params.set('month', m);
    router.push(`${pathname}?${params.toString()}`);
  };

  const currentMonthValue = `${year}-${String(month).padStart(2, '0')}`;

  const monthOptions: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthOptions.push({ value: val, label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` });
  }

  return (
    <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-6 flex-wrap">
      <h1 className="text-[15px] font-semibold text-app-text tracking-tight mr-2">
        {MONTHS[month - 1]} {year}
      </h1>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Period</span>
        <select
          value={currentMonthValue}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none"
        >
          {monthOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Dept</span>
        <select
          value={selectedDept ?? ''}
          onChange={(e) => updateParam('dept', e.target.value)}
          className="bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none"
        >
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Supervisor</span>
        <select
          value={selectedSupervisor ?? ''}
          onChange={(e) => updateParam('supervisor', e.target.value)}
          className="bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none"
        >
          <option value="">All Supervisors</option>
          {supervisors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted">Manager</span>
        <select
          value={selectedManager ?? ''}
          onChange={(e) => updateParam('manager', e.target.value)}
          className="bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none"
        >
          <option value="">All Managers</option>
          {managers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  );
}
