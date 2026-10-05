'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

interface Range {
  start: string;
  end: string;
}

interface NteFilterBarProps {
  start: string;
  end: string;
  lastWeek: Range;
  monthOptions: (Range & { label: string })[];
  departments: string[];
  selectedStatus?: string;
  selectedDept?: string;
}

const SELECT_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-app-blue/40 min-w-0 w-full md:w-auto';
const LABEL_CLS = 'text-[12.5px] text-muted';
const PRESET_CLS =
  'px-2.5 py-1.5 rounded-[5px] border text-[11.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-blue/40';

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
    (r: Range) => pushParams((p) => { p.set('start', r.start); p.set('end', r.end); }),
    [pushParams],
  );

  const isRange = (r: Range) => r.start === start && r.end === end;
  // Shows the month only when the range is exactly that month; otherwise the placeholder.
  const selectedMonth = monthOptions.findIndex(isRange);

  // The range is always set (defaulted on server), so only status/dept count as active.
  const hasFilters = !!(selectedStatus || selectedDept);

  return (
    <div className="px-4 md:px-6 pb-3 grid grid-cols-2 gap-2 md:flex md:items-center md:gap-6 md:flex-wrap">
      <div className="col-span-2 flex items-center gap-2 flex-wrap">
        <span className={LABEL_CLS}>From</span>
        <input type="date" value={start} max={end}
          onChange={(e) => e.target.value && updateParam('start', e.target.value)} className={SELECT_CLS} />
        <span className={LABEL_CLS}>To</span>
        <input type="date" value={end} min={start}
          onChange={(e) => e.target.value && updateParam('end', e.target.value)} className={SELECT_CLS} />
        <button
          type="button"
          onClick={() => setRange(lastWeek)}
          aria-pressed={isRange(lastWeek)}
          className={`${PRESET_CLS} ${isRange(lastWeek)
            ? 'bg-app-blue/10 border-app-blue/30 text-app-blue font-medium'
            : 'border-border text-muted hover:text-app-text'}`}
        >
          Last week
        </button>
      </div>

      {monthOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <span className={LABEL_CLS}>Month</span>
          <select
            value={selectedMonth}
            onChange={(e) => {
              const r = monthOptions[Number(e.target.value)];
              if (r) setRange(r);
            }}
            className={SELECT_CLS}
          >
            <option value={-1} disabled>Select month</option>
            {monthOptions.map((m, i) => (
              <option key={m.label} value={i}>{m.label}</option>
            ))}
          </select>
        </div>
      )}

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
