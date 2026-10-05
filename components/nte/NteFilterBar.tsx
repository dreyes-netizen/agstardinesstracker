'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { DateRangeControls } from '@/components/filters/DateRangeControls';
import type { MonthOption } from '@/lib/utils/week';

interface NteFilterBarProps {
  start: string;
  end: string;
  lastWeek: { start: string; end: string };
  monthOptions: MonthOption[];
  departments: string[];
  selectedStatus?: string;
  selectedDept?: string;
}

const SELECT_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-app-blue/40 min-w-0 w-full md:w-auto';
const LABEL_CLS = 'text-[12.5px] text-muted';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'required', label: 'NTE Required' },
  { value: 'issued', label: 'NTE Issued' },
  { value: 'acknowledged', label: 'Acknowledged' },
];

export function NteFilterBar({ start, end, lastWeek, monthOptions, departments, selectedStatus, selectedDept }: NteFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
    (r: { start: string; end: string }) => pushParams((p) => { p.set('start', r.start); p.set('end', r.end); }),
    [pushParams],
  );

  // The range is always set (defaulted on server), so only status/dept count as active.
  const hasFilters = !!(selectedStatus || selectedDept);

  return (
    <div className="px-4 md:px-6 pb-3 grid grid-cols-2 gap-2 md:flex md:items-center md:gap-6 md:flex-wrap">
      <DateRangeControls start={start} end={end} lastWeek={lastWeek} monthOptions={monthOptions} onChange={setRange} />

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
          onClick={() => pushParams((p) => { p.delete('status'); p.delete('dept'); })}
          className="text-[12px] text-muted hover:text-app-text transition-colors ml-auto"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
