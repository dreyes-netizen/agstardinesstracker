'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

interface NteFilterBarProps {
  months: string[]; // YYYY-MM strings from the DB, sorted DESC
  departments: string[];
  selectedStatus?: string;
  selectedYear?: string;
  selectedMonthNum?: string; // "04", not "2026-04"
  selectedDept?: string;
}

const SELECT_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none min-w-0';
const LABEL_CLS = 'text-[12.5px] text-muted';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'required', label: 'NTE Required' },
  { value: 'issued', label: 'NTE Issued' },
  { value: 'acknowledged', label: 'Acknowledged' },
];

export function NteFilterBar({ months, departments, selectedStatus, selectedYear, selectedMonthNum, selectedDept }: NteFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive unique years and the months available for the selected year.
  const years = useMemo(
    () => Array.from(new Set(months.map((m) => m.split('-')[0]))).sort((a, b) => Number(b) - Number(a)),
    [months],
  );

  const availableMonthNums = useMemo(
    () => months
      .filter((m) => m.startsWith(selectedYear ?? ''))
      .map((m) => m.split('-')[1]),
    [months, selectedYear],
  );

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams],
  );

  // When the year changes, also reset month to the latest available for that year.
  const handleYearChange = useCallback(
    (year: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('year', year);
      const latestMonthForYear = months.find((m) => m.startsWith(year))?.split('-')[1] ?? '';
      if (latestMonthForYear) params.set('month', latestMonthForYear);
      else params.delete('month');
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams, months],
  );

  // Year/month are always set (defaulted on server), so only status/dept count as active.
  const hasFilters = !!(selectedStatus || selectedDept);

  return (
    <div className="px-6 pb-3 flex items-center gap-6 flex-wrap">
      <div className="flex items-center gap-2">
        <span className={LABEL_CLS}>Status</span>
        <select
          value={selectedStatus ?? ''}
          onChange={(e) => updateParam('status', e.target.value)}
          className={SELECT_CLS}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {years.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={LABEL_CLS}>Year</span>
          <select
            value={selectedYear ?? ''}
            onChange={(e) => handleYearChange(e.target.value)}
            className={SELECT_CLS}
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      )}

      {availableMonthNums.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={LABEL_CLS}>Month</span>
          <select
            value={selectedMonthNum ?? ''}
            onChange={(e) => updateParam('month', e.target.value)}
            className={SELECT_CLS}
          >
            {availableMonthNums.map((m) => (
              <option key={m} value={m}>{MONTH_NAMES[Number(m) - 1]}</option>
            ))}
          </select>
        </div>
      )}

      {departments.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={LABEL_CLS}>Department</span>
          <select
            value={selectedDept ?? ''}
            onChange={(e) => updateParam('dept', e.target.value)}
            className={SELECT_CLS}
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {hasFilters && (
        <button
          onClick={() => router.push(pathname)}
          className="text-[12px] text-muted hover:text-app-text transition-colors ml-auto"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
