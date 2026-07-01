'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { formatDate } from '@/lib/utils/date';
import { useFilterContext } from '@/context/FilterContext';

interface LeaveFilterBarProps {
  start: string;
  end: string;
  latestRange: { start: string; end: string } | null;
}

const FIELD_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none min-w-0';
const LABEL_CLS = 'text-[12.5px] text-muted';
const PRESET_CLS =
  'px-2.5 py-1.5 rounded-[5px] border border-border text-[11.5px] text-muted hover:text-app-text hover:border-app-text/30 transition-colors';

function iso(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().split('T')[0];
}

export function LeaveFilterBar({ start, end, latestRange }: LeaveFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { leave: savedLeave, setLeave } = useFilterContext();

  // Restore saved filters when navigating here without URL params
  useEffect(() => {
    if (!searchParams.get('start') && savedLeave) {
      const params = new URLSearchParams();
      params.set('start', savedLeave.start);
      params.set('end', savedLeave.end);
      router.replace(`${pathname}?${params.toString()}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pushParams = useCallback(
    (mut: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mut(params);
      router.push(`${pathname}?${params.toString()}`);
      setLeave({
        start: params.get('start') || start,
        end: params.get('end') || end,
      });
    },
    [router, pathname, searchParams, start, end, setLeave],
  );

  const updateParam = (key: string, value: string) =>
    pushParams((p) => (value ? p.set(key, value) : p.delete(key)));
  const setRange = (s: string, e: string) =>
    pushParams((p) => { p.set('start', s); p.set('end', e); });

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
      <h1 className="text-[15px] font-semibold text-app-text tracking-tight mr-1">Leave Report</h1>
      <span className="text-[11.5px] text-muted">
        Approved leaves · {formatDate(start)} <span className="opacity-60">→</span> {formatDate(end)}
      </span>

      <div className="flex items-center gap-2 ml-auto">
        <span className={LABEL_CLS}>From</span>
        <input type="date" value={start} max={end || undefined}
          onChange={(e) => updateParam('start', e.target.value)} className={FIELD_CLS} />
        <span className={LABEL_CLS}>To</span>
        <input type="date" value={end} min={start || undefined}
          onChange={(e) => updateParam('end', e.target.value)} className={FIELD_CLS} />
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
    </div>
  );
}
