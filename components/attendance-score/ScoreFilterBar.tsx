'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

interface Combination {
  department: string | null;
  supervisor: string | null;
  manager: string | null;
}

interface ScoreFilterBarProps {
  start: string;
  end: string;
  latestRange: { start: string; end: string } | null;
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
const PRESET_CLS =
  'px-2.5 py-1.5 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text hover:border-app-text/30 transition-colors';

function iso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

function fmt(v: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(v)
    ? new Date(v + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '—';
}

export function ScoreFilterBar({
  start, end, latestRange,
  departments, supervisors, managers, combinations,
  selectedDept, selectedSupervisor, selectedManager,
}: ScoreFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const thisMonth = () => {
    const now = new Date();
    setRange(iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)));
  };
  const last30 = () => {
    const now = new Date();
    const from = new Date(now); from.setDate(now.getDate() - 29);
    setRange(iso(from), iso(now));
  };

  return (
    <div className="bg-white border-b border-border px-6 py-3 flex items-center gap-4 flex-wrap">
      <h1 className="text-[15px] font-semibold text-app-text tracking-tight mr-1">
        Attendance Score
      </h1>
      <span className="text-[11.5px] text-muted">
        {fmt(start)} <span className="opacity-60">→</span> {fmt(end)}
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <span className={LABEL_CLS}>From</span>
        <input type="date" value={start} max={end || undefined}
          onChange={(e) => updateParam('start', e.target.value)} className={SELECT_CLS} />
        <span className={LABEL_CLS}>To</span>
        <input type="date" value={end} min={start || undefined}
          onChange={(e) => updateParam('end', e.target.value)} className={SELECT_CLS} />
      </div>

      <div className="flex items-center gap-1.5">
        {latestRange && (
          <button className={PRESET_CLS} onClick={() => setRange(latestRange.start, latestRange.end)}>
            Latest period
          </button>
        )}
        <button className={PRESET_CLS} onClick={thisMonth}>This month</button>
        <button className={PRESET_CLS} onClick={last30}>Last 30 days</button>
      </div>

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
  );
}
