'use client';

import type { MonthOption } from '@/lib/utils/week';

interface Range {
  start: string;
  end: string;
}

interface DateRangeControlsProps extends Range {
  lastWeek: Range;
  monthOptions: MonthOption[];
  onChange: (range: Range) => void;
}

const INPUT_CLS =
  'bg-ground border border-border rounded-[5px] px-2.5 py-1.5 text-[12.5px] text-app-text focus:outline-none focus-visible:ring-2 focus-visible:ring-app-blue/40 min-w-0';
const LABEL_CLS = 'text-[12.5px] text-muted';
const PRESET_CLS =
  'px-2.5 py-1.5 rounded-[5px] border text-[11.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-app-blue/40';

// From/To date range with a "Last week" shortcut and a month picker. Shared by the
// Dashboard and NTE Management filter bars.
export function DateRangeControls({ start, end, lastWeek, monthOptions, onChange }: DateRangeControlsProps) {
  const isRange = (r: Range) => r.start === start && r.end === end;
  // Shows the month only when the range is exactly that month; otherwise the placeholder.
  const selectedMonth = monthOptions.findIndex(isRange);

  return (
    <>
      <div className="col-span-2 flex items-center gap-2 flex-wrap">
        <span className={LABEL_CLS}>From</span>
        <input type="date" value={start} max={end} aria-label="From date"
          onChange={(e) => e.target.value && onChange({ start: e.target.value, end })} className={INPUT_CLS} />
        <span className={LABEL_CLS}>To</span>
        <input type="date" value={end} min={start} aria-label="To date"
          onChange={(e) => e.target.value && onChange({ start, end: e.target.value })} className={INPUT_CLS} />
        <button
          type="button"
          onClick={() => onChange(lastWeek)}
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
              if (r) onChange(r);
            }}
            className={INPUT_CLS}
          >
            <option value={-1} disabled>Select month</option>
            {monthOptions.map((m, i) => (
              <option key={m.label} value={i}>{m.label}</option>
            ))}
          </select>
        </div>
      )}
    </>
  );
}
