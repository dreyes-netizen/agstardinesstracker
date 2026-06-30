'use client';

import { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { EmployeeMonthlyStats } from '@/lib/queries/attendance';
import { NteForm } from './NteForm';

interface LateRecord {
  date: string;
  lateMinutes: number;
  shiftSchedule: string | null;
  actualLogs: string | null;
}

interface EmployeeDrawerProps {
  employee: EmployeeMonthlyStats | null;
  year: number;
  month: number;
  onClose: () => void;
  onNteAction: () => void;
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function getDay(dateStr: string) {
  return DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()];
}

export function EmployeeDrawer({ employee, year, month, onClose, onNteAction }: EmployeeDrawerProps) {
  const [lateRecords, setLateRecords] = useState<LateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  useEffect(() => {
    if (!employee) { setLateRecords([]); setFetchError(false); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setFetchError(false);
    fetch(`/api/employee/${employee.employeeId}/lates?year=${year}&month=${month}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: LateRecord[]) => setLateRecords(data))
      .catch((err) => { if (err.name !== 'AbortError') setFetchError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // Keyed on employeeId (not the whole employee object) intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.employeeId, year, month]);

  if (!employee) return null;

  const fullName = `${employee.lastName}, ${employee.firstName}${employee.middleName ? ` ${employee.middleName}` : ''}`;

  return (
    <Sheet open={!!employee} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[400px] p-0 flex flex-col overflow-hidden bg-white">
        <div className="bg-navy px-[22px] py-5 flex-shrink-0">
          <p className="font-mono text-[11px] tracking-[0.12em] text-white/70 mb-1">
            ID #{employee.employeeId} · {employee.department ?? 'No dept'}
          </p>
          <p className="text-[17px] font-semibold text-white tracking-tight">{fullName}</p>
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            {employee.immediateSupervisor && (
              <span className="bg-white/10 text-white/70 text-[11px] px-2 py-0.5 rounded-[3px]">{employee.immediateSupervisor}</span>
            )}
            {employee.approver2 && (
              <span className="bg-white/10 text-white/70 text-[11px] px-2 py-0.5 rounded-[3px]">Mgr: {employee.approver2}</span>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="px-[22px] py-4 border-b border-border">
            <p className="text-[11px] font-semibold text-muted mb-3">
              {new Date(`${monthStr}-01`).toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })} — Totals
            </p>
            <div className="flex gap-4">
              <div className="flex-1 bg-ground rounded-[5px] px-3.5 py-3">
                <p className="font-mono text-[24px] font-bold text-nte-red leading-none tracking-tight">{employee.lateCount}</p>
                <p className="text-[11px] text-muted mt-1">Late instances</p>
              </div>
              <div className="flex-1 bg-ground rounded-[5px] px-3.5 py-3">
                <p className="font-mono text-[24px] font-bold text-nte-red leading-none tracking-tight">{employee.accumulatedMinutes}</p>
                <p className="text-[11px] text-muted mt-1">Minutes accumulated</p>
              </div>
            </div>
          </div>

          <div className="px-[22px] py-4 border-b border-border">
            <p className="text-[11px] font-semibold text-muted mb-3">Late Dates</p>
            {loading ? (
              <div className="animate-pulse space-y-2">
                {[72, 56, 64, 48].map((w) => (
                  <div key={w} className="flex items-center gap-3 py-1.5">
                    <div className="h-3 bg-ground rounded" style={{ width: `${w}px` }} />
                    <div className="h-3 bg-ground rounded w-8" />
                    <div className="h-3 bg-ground rounded w-10 ml-auto" />
                  </div>
                ))}
              </div>
            ) : fetchError ? (
              <p className="text-[12.5px] text-nte-red">Failed to load records. Please close and reopen.</p>
            ) : lateRecords.length === 0 ? (
              <p className="text-[12.5px] text-muted">No late records for this month.</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="font-mono text-[9.5px] tracking-[0.09em] uppercase text-muted text-left pb-2">Date</th>
                    <th className="font-mono text-[9.5px] tracking-[0.09em] uppercase text-muted text-left pb-2">Day</th>
                    <th className="font-mono text-[9.5px] tracking-[0.09em] uppercase text-muted text-right pb-2">Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {lateRecords.map((r) => (
                    <tr key={r.date} className="border-b border-[#F0F2F5]">
                      <td className="font-mono text-[12px] py-2">{r.date}</td>
                      <td className="text-[12px] text-muted py-2">{getDay(r.date)}</td>
                      <td className="font-mono text-[13px] font-semibold text-nte-red text-right py-2">
                        {r.lateMinutes} <span className="text-[10px] text-muted font-normal">min</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {['required', 'issued', 'acknowledged'].includes(employee.nteStatus) && (
            <div className="px-[22px] py-4">
              <p className="text-[11px] font-semibold text-muted mb-3">NTE Action</p>
              <NteForm
                employeeId={employee.employeeId}
                month={monthStr}
                nteStatus={employee.nteStatus}
                issuedDate={employee.issuedDate}
                issuedBy={employee.issuedBy}
                acknowledgedDate={employee.acknowledgedDate}
                notes={null}
                onSuccess={onNteAction}
              />
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
