import type { Employee } from '@/lib/db/schema';
import type { TardinessIncident } from '@/lib/queries/attendance';
import { formatDate } from '@/lib/utils/date';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function getDay(dateStr: string) {
  return DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()];
}

// NTE threshold (mirrors the rule in lib/queries/nte.ts): a month with ≥6 lates
// or ≥60 accumulated late-minutes warrants a Notice To Explain.
const NTE_LATE_COUNT = 6;
const NTE_LATE_MINUTES = 60;
// "Approaching" band: not yet over the line, but close (within 2 lates / 20 min).
const NEAR_LATE_COUNT = 4;
const NEAR_LATE_MINUTES = 40;

type MonthStatus = 'required' | 'approaching' | 'safe';

function monthStatus(count: number, minutes: number): MonthStatus {
  if (count >= NTE_LATE_COUNT || minutes >= NTE_LATE_MINUTES) return 'required';
  if (count >= NEAR_LATE_COUNT || minutes >= NEAR_LATE_MINUTES) return 'approaching';
  return 'safe';
}

const STATUS_META: Record<MonthStatus, { label: string; badge: string; num: string }> = {
  required: { label: 'Required', badge: 'bg-nte-red/10 text-nte-red border-nte-red/30', num: 'text-nte-red' },
  approaching: { label: 'Approaching', badge: 'bg-amber/10 text-amber-dark border-amber/40', num: 'text-amber-dark' },
  safe: { label: 'Safe', badge: 'bg-safe-green/10 text-safe-green border-safe-green/30', num: 'text-app-text' },
};

function Stat({ value, label, danger }: { value: string; label: string; danger?: boolean }) {
  return (
    <div className="flex-1 bg-ground rounded-[6px] px-4 py-3 break-inside-avoid">
      <p className={`font-mono text-[26px] font-bold leading-none tracking-tight ${danger ? 'text-nte-red' : 'text-app-text'}`}>
        {value}
      </p>
      <p className="text-[11px] text-muted mt-1.5">{label}</p>
    </div>
  );
}

export function TardinessReport({
  employee,
  incidents,
  start,
  end,
}: {
  employee: Employee;
  incidents: TardinessIncident[];
  start: string;
  end: string;
}) {
  const fullName = `${employee.lastName}, ${employee.firstName}${employee.middleName ? ` ${employee.middleName}` : ''}`;
  const count = incidents.length;
  const totalMinutes = incidents.reduce((sum, r) => sum + r.lateMinutes, 0);
  const avgMinutes = count > 0 ? Math.round(totalMinutes / count) : 0;

  // Late instances grouped by calendar month (YYYY-MM), for the monthly scorecards.
  const monthMap = new Map<string, { count: number; minutes: number }>();
  for (const r of incidents) {
    const key = r.date.slice(0, 7);
    const cur = monthMap.get(key) ?? { count: 0, minutes: 0 };
    cur.count += 1;
    cur.minutes += r.lateMinutes;
    monthMap.set(key, cur);
  }
  const monthly = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key,
      label: new Date(`${key}-01T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
      count: v.count,
      minutes: v.minutes,
      status: monthStatus(v.count, v.minutes),
    }));
  const meetsNte = count >= NTE_LATE_COUNT || totalMinutes >= NTE_LATE_MINUTES;
  const generatedOn = new Date().toLocaleDateString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });

  return (
    <div className="bg-white border border-border rounded-[7px] overflow-hidden print:border-0">
      {/* Header */}
      <div className="bg-navy px-6 py-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[11px] tracking-[0.12em] text-white/70 mb-1">
            ID #{employee.employeeId} · {employee.department ?? 'No dept'}
          </p>
          <p className="text-[19px] font-semibold text-white tracking-tight">{fullName}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {employee.immediateSupervisor && (
              <span className="bg-white/10 text-white/75 text-[11px] px-2 py-0.5 rounded-[3px]">
                {employee.immediateSupervisor}
              </span>
            )}
            {employee.approver2 && (
              <span className="bg-white/10 text-white/75 text-[11px] px-2 py-0.5 rounded-[3px]">
                Mgr: {employee.approver2}
              </span>
            )}
            {employee.hireDate && (
              <span className="bg-white/10 text-white/75 text-[11px] px-2 py-0.5 rounded-[3px]">
                Hired {formatDate(employee.hireDate)}
              </span>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-white/50 mb-1">
            Tardiness Report
          </p>
          <p className="text-[12.5px] text-white/90">
            {formatDate(start)} — {formatDate(end)}
          </p>
          <p className="text-[10.5px] text-white/50 mt-1">Generated {generatedOn}</p>
        </div>
      </div>

      {/* Summary */}
      <div className="px-6 py-4 border-b border-border">
        <div className="flex flex-wrap items-stretch gap-3">
          <Stat value={String(count)} label="Late instances" danger={count > 0} />
          <Stat value={String(totalMinutes)} label="Minutes accumulated" danger={totalMinutes > 0} />
          <Stat value={`${avgMinutes} min`} label="Avg per instance" />
        </div>
        {meetsNte && count > 0 && (
          <p className="mt-3 inline-flex items-center gap-2 text-[12px] text-nte-red bg-nte-red/5 border border-nte-red/30 rounded-[5px] px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-nte-red" aria-hidden="true" />
            Meets NTE threshold ({NTE_LATE_COUNT}+ lates or {NTE_LATE_MINUTES}+ minutes in period)
          </p>
        )}
      </div>

      {/* Monthly breakdown */}
      {monthly.length > 0 && (
        <div className="px-6 py-4 border-b border-border">
          <div className="flex items-baseline justify-between gap-3 mb-3">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em]">
              Late instances per month
            </p>
            <p className="text-[10.5px] text-muted">
              NTE at {NTE_LATE_COUNT}+ lates or {NTE_LATE_MINUTES}+ min
            </p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 print:grid-cols-8">
            {monthly.map((m) => {
              const meta = STATUS_META[m.status];
              return (
                <div key={m.key} className="bg-ground rounded-[6px] px-3 py-2.5 break-inside-avoid">
                  <p className="text-[10.5px] font-medium text-muted whitespace-nowrap">{m.label}</p>
                  <p className={`font-mono text-[22px] font-bold leading-none tracking-tight mt-1.5 ${meta.num}`}>
                    {m.count}
                  </p>
                  <p className="text-[10px] text-muted mt-1">
                    {m.count === 1 ? 'late' : 'lates'} · {m.minutes}m
                  </p>
                  <span className={`inline-flex items-center mt-2 rounded-[4px] border px-1.5 py-0.5 text-[9.5px] font-semibold ${meta.badge}`}>
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Incidents */}
      <div className="px-6 py-4">
        <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em] mb-3">
          Late incidents
        </p>
        {count === 0 ? (
          <p className="text-[12.5px] text-muted py-6 text-center">
            No late records in this period.
          </p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted first:pl-0">Date</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted">Day</th>
                  <th className="px-3 py-2 text-right font-mono text-[10px] tracking-[0.09em] uppercase text-muted">Minutes</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted">Scheduled shift</th>
                  <th className="px-3 py-2 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted last:pr-0">Actual clock-in</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((r, i) => (
                  <tr
                    key={r.date}
                    className={`border-b border-row-border break-inside-avoid ${i % 2 === 1 ? 'bg-row-alt' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-[12px] whitespace-nowrap first:pl-0">{formatDate(r.date)}</td>
                    <td className="px-3 py-2 text-[12px] text-muted">{getDay(r.date)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12.5px] font-semibold text-nte-red whitespace-nowrap">
                      {r.lateMinutes} <span className="text-[10px] text-muted font-normal">min</span>
                    </td>
                    <td className="px-3 py-2 text-[12px] text-muted">{r.shiftSchedule ?? '—'}</td>
                    <td className="px-3 py-2 text-[12px] text-muted last:pr-0">{r.actualLogs ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
