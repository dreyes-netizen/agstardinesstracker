'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { PrintButton } from './PrintButton';

interface EmployeeOption {
  employeeId: string;
  name: string;
  department: string | null;
}

interface Props {
  employees: EmployeeOption[];
  selectedEmployeeId?: string;
  start: string;
  end: string;
}

const SELECT_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none min-w-0';
const LABEL_CLS = 'text-[12.5px] text-muted';

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

function iso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

// Only reflect a month/year selection when the range is exactly that calendar
// month's full span (matches the Attendance Score filter behavior).
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

export function TardinessFilterBar({ employees, selectedEmployeeId, start, end }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.employeeId === selectedEmployeeId) ?? null,
    [employees, selectedEmployeeId],
  );

  const pushParams = useCallback(
    (mut: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mut(params);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  const updateParam = useCallback(
    (key: string, value: string) => pushParams((p) => (value ? p.set(key, value) : p.delete(key))),
    [pushParams],
  );
  const setRange = useCallback(
    (s: string, e: string) => pushParams((p) => { p.set('start', s); p.set('end', e); }),
    [pushParams],
  );

  // Employee search combobox
  const [query, setQuery] = useState('');
  const [showList, setShowList] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return employees
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          e.employeeId.toLowerCase().includes(q) ||
          (e.department ?? '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, employees]);

  const selectEmployee = (employeeId: string) => {
    setQuery('');
    setShowList(false);
    updateParam('employeeId', employeeId);
  };
  const clearEmployee = () => updateParam('employeeId', '');

  // Month/Year selects mirror the range
  const [selMonth, setSelMonth] = useState('');
  const [selYear, setSelYear] = useState('');
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
    setSelMonth(value); setSelYear(year);
    applyMonthYear(value, year);
  };
  const handleYearChange = (value: string) => {
    const month = selMonth || String(now.getMonth() + 1);
    setSelMonth(month); setSelYear(value);
    applyMonthYear(month, value);
  };

  const currentYear = now.getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= 2024; y--) years.push(y);

  return (
    <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-4 flex-wrap print:hidden">
      <h1 className="text-[15px] font-semibold text-app-text tracking-tight mr-1">Tardiness Report</h1>

      {/* Employee picker */}
      <div className="relative min-w-[220px] flex-1 max-w-[320px]">
        {selectedEmployee ? (
          <div className="flex items-center gap-2 bg-ground border border-border rounded-[5px] px-2.5 py-1.5">
            <span className="text-[12.5px] font-medium text-app-text truncate">{selectedEmployee.name}</span>
            <span className="text-[11px] text-muted font-mono flex-shrink-0">{selectedEmployee.employeeId}</span>
            <button
              type="button"
              onClick={clearEmployee}
              aria-label="Change employee"
              className="ml-auto text-muted hover:text-nte-red flex-shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <>
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none w-[13px] h-[13px]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              role="combobox"
              aria-expanded={showList && matches.length > 0}
              aria-controls="tardiness-emp-listbox"
              aria-autocomplete="list"
              onChange={(e) => { setQuery(e.target.value); setShowList(true); setActiveIndex(-1); }}
              onFocus={() => setShowList(true)}
              onBlur={() => setTimeout(() => setShowList(false), 150)}
              onKeyDown={(e) => {
                if (!showList || matches.length === 0) return;
                if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex((i) => Math.min(i + 1, matches.length - 1)); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex((i) => Math.max(i - 1, 0)); }
                else if (e.key === 'Enter' && activeIndex >= 0) { e.preventDefault(); selectEmployee(matches[activeIndex].employeeId); }
                else if (e.key === 'Escape') { setShowList(false); }
              }}
              placeholder="Search an employee by name or ID…"
              className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
            />
            {showList && matches.length > 0 && (
              <ul id="tardiness-emp-listbox" role="listbox" className="absolute z-30 mt-1 w-full max-h-64 overflow-auto bg-white border border-border rounded-[6px] shadow-lg">
                {matches.map((e, i) => (
                  <li key={e.employeeId} role="option" aria-selected={i === activeIndex}>
                    <button
                      type="button"
                      onMouseDown={(ev) => ev.preventDefault()}
                      onClick={() => selectEmployee(e.employeeId)}
                      className={`w-full text-left px-3 py-2 text-[12.5px] flex items-center justify-between gap-3 ${i === activeIndex ? 'bg-ground' : 'hover:bg-ground'}`}
                    >
                      <span className="font-medium text-app-text">{e.name}</span>
                      <span className="text-[11px] text-muted font-mono">
                        {e.employeeId}{e.department ? ` · ${e.department}` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

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

      <PrintButton disabled={!selectedEmployee} />
    </div>
  );
}
