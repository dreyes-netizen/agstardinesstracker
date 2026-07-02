'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { formatDate } from '@/lib/utils/date';
import { useFilterContext } from '@/context/FilterContext';

interface Combination {
  department: string | null;
  supervisor: string | null;
  manager: string | null;
}

interface ScoreFilterBarProps {
  start: string;
  end: string;
  departments: string[];
  supervisors: string[];
  managers: string[];
  combinations: Combination[];
  selectedDept?: string;
  selectedSupervisor?: string;
  selectedManager?: string;
}

const SELECT_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none min-w-0';
const LABEL_CLS = 'text-[12.5px] text-muted';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function iso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

// Only report a month/year selection when the range is exactly that
// calendar month's full span — a manually-edited partial range should
// show the dropdowns as blank rather than a stale/misleading month.
function monthYearFromRange(start: string, end: string): { month: string; year: string } | null {
  if (!start || !end) return null;
  const s = new Date(`${start}T00:00:00`);
  const firstOfMonth = iso(new Date(s.getFullYear(), s.getMonth(), 1));
  const lastOfMonth = iso(new Date(s.getFullYear(), s.getMonth() + 1, 0));
  if (firstOfMonth === start && lastOfMonth === end) {
    return { month: String(s.getMonth() + 1), year: String(s.getFullYear()) };
  }
  return null;
}

export function ScoreFilterBar({
  start, end,
  departments, supervisors, managers, combinations,
  selectedDept, selectedSupervisor, selectedManager,
}: ScoreFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { score: savedScore, setScore } = useFilterContext();
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Restore saved filters whenever the URL has no params (covers both initial mount
  // and clicking the nav button again while already on this page).
  useEffect(() => {
    if (!searchParams.get('start') && savedScore) {
      const params = new URLSearchParams();
      params.set('start', savedScore.start);
      params.set('end', savedScore.end);
      if (savedScore.dept) params.set('dept', savedScore.dept);
      if (savedScore.supervisor) params.set('supervisor', savedScore.supervisor);
      if (savedScore.manager) params.set('manager', savedScore.manager);
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredSupervisors = useMemo(() => {
    if (!selectedDept) return supervisors;
    return Array.from(new Set(
      combinations.filter((c) => c.department === selectedDept && c.supervisor).map((c) => c.supervisor!),
    )).sort();
  }, [selectedDept, combinations, supervisors]);

  const filteredManagers = useMemo(() => {
    if (!selectedDept) return managers;
    return Array.from(new Set(
      combinations.filter((c) => c.department === selectedDept && c.manager).map((c) => c.manager!),
    )).sort();
  }, [selectedDept, combinations, managers]);

  const pushParams = useCallback(
    (mut: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mut(params);
      router.push(`${pathname}?${params.toString()}`);
      setScore({
        start: params.get('start') || start,
        end: params.get('end') || end,
        dept: params.get('dept') || '',
        supervisor: params.get('supervisor') || '',
        manager: params.get('manager') || '',
      });
    },
    [router, pathname, searchParams, start, end, setScore],
  );

  const updateParam = useCallback(
    (key: string, value: string) => pushParams((p) => (value ? p.set(key, value) : p.delete(key))),
    [pushParams],
  );

  const setRange = useCallback(
    (s: string, e: string) => pushParams((p) => { p.set('start', s); p.set('end', e); }),
    [pushParams],
  );

  const handleDeptChange = useCallback(
    (value: string) => pushParams((p) => {
      if (value) p.set('dept', value); else p.delete('dept');
      if (value) {
        const validSup = new Set(combinations.filter((c) => c.department === value).map((c) => c.supervisor).filter(Boolean));
        const validMgr = new Set(combinations.filter((c) => c.department === value).map((c) => c.manager).filter(Boolean));
        if (selectedSupervisor && !validSup.has(selectedSupervisor)) p.delete('supervisor');
        if (selectedManager && !validMgr.has(selectedManager)) p.delete('manager');
      }
    }),
    [pushParams, combinations, selectedSupervisor, selectedManager],
  );

  const [selMonth, setSelMonth] = useState('');
  const [selYear, setSelYear] = useState('');

  // Date pickers are the source of truth: only reflect a month/year
  // selection when the range matches a full calendar month, and reset to
  // blank the moment a manual edit breaks that match.
  useEffect(() => {
    const derived = monthYearFromRange(start, end);
    setSelMonth(derived?.month ?? '');
    setSelYear(derived?.year ?? '');
  }, [start, end]);

  const applyMonthYear = useCallback(
    (month: string, year: string) => {
      if (!month || !year) return;
      const y = Number(year);
      const m = Number(month);
      setRange(iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0)));
    },
    [setRange],
  );

  const now = new Date();
  const handleMonthChange = (value: string) => {
    const year = selYear || String(now.getFullYear());
    setSelMonth(value);
    setSelYear(year);
    applyMonthYear(value, year);
  };
  const handleYearChange = (value: string) => {
    const month = selMonth || String(now.getMonth() + 1);
    setSelMonth(month);
    setSelYear(value);
    applyMonthYear(month, value);
  };

  const currentYear = now.getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= 2024; y--) years.push(y);

  return (
    <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-4 flex-wrap">
      <h1 className="text-[15px] font-semibold text-app-text tracking-tight mr-1">
        Attendance Score
      </h1>
      <span className="text-[11.5px] text-muted">
        {formatDate(start)} <span className="opacity-60">→</span> {formatDate(end)}
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <span className={LABEL_CLS}>From</span>
        <input type="date" value={start} max={end || undefined}
          onChange={(e) => updateParam('start', e.target.value)} className={SELECT_CLS} />
        <span className={LABEL_CLS}>To</span>
        <input type="date" value={end} min={start || undefined}
          onChange={(e) => updateParam('end', e.target.value)} className={SELECT_CLS} />
      </div>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Month</span>
        <select value={selMonth} onChange={(e) => handleMonthChange(e.target.value)} className={SELECT_CLS}>
          <option value="">Month</option>
          {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Year</span>
        <select value={selYear} onChange={(e) => handleYearChange(e.target.value)} className={SELECT_CLS}>
          <option value="">Year</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <button
        onClick={() => setFiltersOpen((v) => !v)}
        className="md:hidden text-[12px] text-muted border border-border rounded-[5px] px-2.5 py-1 flex items-center gap-1"
        aria-expanded={filtersOpen}
      >
        Filters {filtersOpen ? '▴' : '▾'}
      </button>

      <div className={`${filtersOpen ? 'flex flex-wrap gap-x-4 gap-y-2 w-full' : 'hidden'} md:contents`}>
      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Dept</span>
        <select value={selectedDept ?? ''} onChange={(e) => handleDeptChange(e.target.value)} className={SELECT_CLS}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Supervisor</span>
        <select value={selectedSupervisor ?? ''} onChange={(e) => updateParam('supervisor', e.target.value)} className={SELECT_CLS}>
          <option value="">{selectedDept ? `All (${filteredSupervisors.length})` : 'All Supervisors'}</option>
          {filteredSupervisors.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Manager</span>
        <select value={selectedManager ?? ''} onChange={(e) => updateParam('manager', e.target.value)} className={SELECT_CLS}>
          <option value="">{selectedDept ? `All (${filteredManagers.length})` : 'All Managers'}</option>
          {filteredManagers.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      </div>
    </div>
  );
}
