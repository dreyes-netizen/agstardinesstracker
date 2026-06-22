import { DayOfWeekStat } from '@/lib/queries/attendance';

// Display order: Mon→Sun. PostgreSQL DOW: 0=Sun, 1=Mon … 6=Sat.
const DAYS = [
  { dow: 1, label: 'Mon' },
  { dow: 2, label: 'Tue' },
  { dow: 3, label: 'Wed' },
  { dow: 4, label: 'Thu' },
  { dow: 5, label: 'Fri' },
  { dow: 6, label: 'Sat' },
  { dow: 0, label: 'Sun' },
];

export function DayOfWeekCards({ stats, totalEmployees }: { stats: DayOfWeekStat[]; totalEmployees: number }) {
  const byDow = Object.fromEntries(stats.map((s) => [s.dow, s.lateEmployees]));
  const max = Math.max(1, ...stats.map((s) => s.lateEmployees));
  const busiest = stats.reduce((a, b) => (a.lateEmployees >= b.lateEmployees ? a : b), stats[0]);

  return (
    <div className="bg-white border border-border rounded-[7px] px-5 py-4">
      <p className="text-[11.5px] font-medium text-muted mb-3">Late Arrivals by Day of Week</p>
      <div className="grid grid-cols-7 gap-2">
        {DAYS.map(({ dow, label }) => {
          const count = byDow[dow] ?? 0;
          const fill = Math.round((count / max) * 100);
          const pct = totalEmployees > 0 ? Math.round((count / totalEmployees) * 100) : 0;
          const isBusiest = count > 0 && busiest && dow === busiest.dow;

          return (
            <div key={dow} className="flex flex-col items-center gap-1.5">
              <span className={`text-[10px] font-mono uppercase tracking-[0.08em] ${isBusiest ? 'text-nte-red font-semibold' : 'text-muted'}`}>
                {label}
              </span>
              <div className="w-full bg-ground rounded-[4px] h-14 flex items-end overflow-hidden">
                <div
                  className={`w-full rounded-[3px] flex items-center justify-center transition-all ${isBusiest ? 'bg-nte-red/70' : 'bg-app-blue/30'}`}
                  style={{ height: `${Math.max(fill, count > 0 ? 14 : 0)}%` }}
                >
                  {count > 0 && (
                    <span className={`text-[11px] font-semibold leading-none ${isBusiest ? 'text-white' : 'text-app-blue'}`}>
                      {count}
                    </span>
                  )}
                </div>
              </div>
              <span className={`text-[10px] leading-none ${count === 0 ? 'text-muted/50' : 'text-muted'}`}>
                {count === 0 ? '—' : `${pct}%`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
