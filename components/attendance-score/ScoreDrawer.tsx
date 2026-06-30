'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { AttendanceScore, ScoreDetail, ScoreDetailDay } from '@/lib/queries/attendance-score';
import { formatDate } from '@/lib/utils/date';
import { h2, pct2, fmtDuration, pctClass, gradeClass } from '@/lib/utils/score-format';

interface ScoreDrawerProps {
  score: AttendanceScore | null;
  start: string;
  end: string;
  onClose: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const getDay = (d: string) => DAY_NAMES[new Date(d + 'T00:00:00').getDay()];

export function ScoreDrawer({ score, start, end, onClose }: ScoreDrawerProps) {
  const [detail, setDetail] = useState<ScoreDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!score) { setDetail(null); setFetchError(false); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setFetchError(false);
    fetch(`/api/employee/${score.employeeId}/score?start=${start}&end=${end}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: ScoreDetail) => setDetail(data))
      .catch((err) => { if (err.name !== 'AbortError') setFetchError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [score?.employeeId, start, end]);

  if (!score) return null;

  const stat = (label: string, value: string, cls = 'text-app-text') => (
    <div className="flex-1 bg-ground rounded-[5px] px-3 py-2.5 min-w-0">
      <p className={`font-mono text-[15px] font-bold leading-none tracking-tight ${cls}`}>{value}</p>
      <p className="text-[10.5px] text-muted mt-1">{label}</p>
    </div>
  );

  // A day inside an approved Sick leave reads as "Sick Leave" even though
  // attendance credits it as worked hours (ISO dates compare lexicographically).
  const statusMeta = {
    sick: { label: 'Sick Leave', cls: 'bg-amber/10 text-amber' },
    present: { label: 'Present', cls: 'bg-safe-green/10 text-safe-green' },
    absent: { label: 'Absent', cls: 'bg-nte-red/10 text-nte-red' },
  } as const;
  function statusOf(d: ScoreDetailDay): keyof typeof statusMeta {
    if (detail?.sick.some((lv) => d.date >= lv.dateFrom && d.date <= lv.dateTo)) return 'sick';
    return d.present ? 'present' : 'absent';
  }

  return (
    <Sheet open={!!score} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[440px] p-0 flex flex-col overflow-hidden bg-white">
        <div className="bg-navy px-[22px] py-5 flex-shrink-0">
          <p className="font-mono text-[11px] tracking-[0.12em] text-white/70 mb-1">
            ID #{score.employeeId} · {score.account ?? 'No account'}
          </p>
          <p className="text-[17px] font-semibold text-white tracking-tight">{score.fullName}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {score.teamLeader && <span className="bg-white/10 text-white/70 text-[11px] px-2 py-0.5 rounded-[3px]">TL: {score.teamLeader}</span>}
            {score.accountManager && <span className="bg-white/10 text-white/70 text-[11px] px-2 py-0.5 rounded-[3px]">Mgr: {score.accountManager}</span>}
          </div>
          <p className="text-[11px] text-white/60 mt-2.5">{formatDate(start)} → {formatDate(end)}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Score summary */}
          <div className="px-[22px] py-4 border-b border-border space-y-3">
            <div className="flex items-center gap-3">
              <span className={`inline-block font-mono text-[20px] font-bold px-2.5 py-1 rounded-[5px] ${pctClass(score.attendancePct)}`}>
                {pct2(score.attendancePct)}
              </span>
              <span className="text-[12px] text-muted">Score</span>
              <span className={`inline-block w-8 text-center font-mono text-[16px] font-bold py-0.5 rounded-[4px] ${gradeClass(score.attendanceGrade)}`}>
                {score.attendanceGrade}
              </span>
            </div>
            <div className="flex gap-2">
              {stat('Present', h2(score.totalHoursPresent), 'text-safe-green')}
              {stat('Absent', h2(score.totalHoursAbsent), score.totalHoursAbsent > 0 ? 'text-nte-red' : 'text-app-text')}
              {stat('Required', h2(score.requiredHours))}
            </div>
            <div className="flex gap-2">
              {stat('Sick hrs', h2(score.totalSickLeaveHours), score.totalSickLeaveHours > 0 ? 'text-amber' : 'text-app-text')}
              {stat('Undertime', fmtDuration(score.undertime))}
            </div>
            <p className="text-[11px] text-muted leading-snug">
              Present = (present days × 8h) − undertime − sick · Score % = present ÷ required
            </p>
          </div>

          {/* Daily breakdown */}
          <div className="px-[22px] py-4 border-b border-border">
            <p className="text-[11px] font-semibold text-muted mb-3">Daily breakdown</p>
            {loading ? (
              <div className="animate-pulse space-y-2">
                {[64, 56, 60, 48].map((w) => (
                  <div key={w} className="flex items-center gap-3 py-1.5">
                    <div className="h-3 bg-ground rounded" style={{ width: `${w}px` }} />
                    <div className="h-3 bg-ground rounded w-10 ml-auto" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <p className="text-[12.5px] text-nte-red">Failed to load. Please close and reopen.</p>
            ) : !detail || detail.daily.length === 0 ? (
              <p className="text-[12.5px] text-muted">No scheduled days in this range.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    {['Date', 'Day', 'Status', 'Hrs', 'Undertime'].map((h, i) => (
                      <th key={h} className={`font-mono text-[9.5px] tracking-[0.09em] uppercase text-muted pb-2 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detail.daily.map((d) => {
                    const undertimeMin = d.lateMinutes + d.undertimeMinutes;
                    const s = statusMeta[statusOf(d)];
                    return (
                      <tr key={d.date} className="border-b border-[#F0F2F5]">
                        <td className="font-mono text-[11.5px] py-1.5">{formatDate(d.date)}</td>
                        <td className="text-[11.5px] text-muted py-1.5">{getDay(d.date)}</td>
                        <td className="py-1.5">
                          <span className={`text-[10.5px] px-1.5 py-0.5 rounded-[3px] whitespace-nowrap ${s.cls}`}>
                            {s.label}
                          </span>
                        </td>
                        <td className="font-mono text-[11.5px] text-right py-1.5">{h2(d.hoursWorked)}</td>
                        <td className="font-mono text-[11.5px] text-right py-1.5 text-muted">{undertimeMin ? `${undertimeMin}m` : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Sick leaves counted */}
          {detail && detail.sick.length > 0 && (
            <div className="px-[22px] py-4">
              <p className="text-[11px] font-semibold text-muted mb-3">Approved sick leave counted</p>
              <ul className="space-y-2">
                {detail.sick.map((s, i) => (
                  <li key={i} className="text-[12px] text-app-text flex items-center justify-between gap-3">
                    <span>{formatDate(s.dateFrom)} → {formatDate(s.dateTo)}</span>
                    <span className="text-muted">
                      {s.countedDays} of {s.withPayDays} paid ·{' '}
                      <span className="text-amber font-medium">{h2(s.countedDays * 8)} hrs</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
