'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import type { EmployeeMonthlyStats, EmployeeLateRecord } from '@/lib/queries/attendance';
import { NteForm } from './NteForm';
import { LateAdjustForm } from './LateAdjustForm';
import { formatDate } from '@/lib/utils/date';

interface EmployeeDrawerProps {
  employee: EmployeeMonthlyStats | null;
  year: number;
  month: number;
  isAdmin?: boolean;
  onClose: () => void;
  onNteAction: () => void;
}

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function getDay(dateStr: string) {
  return DAY_NAMES[new Date(dateStr + 'T00:00:00').getDay()];
}

export function EmployeeDrawer({ employee, year, month, isAdmin = false, onClose, onNteAction }: EmployeeDrawerProps) {
  const router = useRouter();
  const [lateRecords, setLateRecords] = useState<EmployeeLateRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;

  function handleAdjusted() {
    setEditingDate(null);
    setReloadKey((k) => k + 1);
    router.refresh();
  }

  useEffect(() => {
    setEditingDate(null);
    if (!employee) { setLateRecords([]); setFetchError(false); return; }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setFetchError(false);
    fetch(`/api/employee/${employee.employeeId}/lates?year=${year}&month=${month}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: EmployeeLateRecord[]) => setLateRecords(data))
      .catch((err) => { if (err.name !== 'AbortError') setFetchError(true); })
      .finally(() => setLoading(false));
    return () => controller.abort();
    // Keyed on employeeId (not the whole employee object) intentionally.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employee?.employeeId, year, month, reloadKey]);

  if (!employee) return null;

  const fullName = `${employee.lastName}, ${employee.firstName}${employee.middleName ? ` ${employee.middleName}` : ''}`;

  return (
    <Sheet open={!!employee} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:w-[400px] p-0 flex flex-col overflow-hidden bg-white">
        <SheetTitle className="sr-only">{fullName} — tardiness detail</SheetTitle>
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
                    {isAdmin && <th className="pb-2 w-12"><span className="sr-only">Adjust</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {lateRecords.map((r) => {
                    const waived = r.adjusted && r.lateMinutes === 0;
                    const editing = editingDate === r.date;
                    return (
                      <Fragment key={r.date}>
                        <tr className={r.adjusted || editing ? '' : 'border-b border-row-border'}>
                          <td className="font-mono text-[12px] py-2 whitespace-nowrap">{formatDate(r.date)}</td>
                          <td className="text-[12px] text-muted py-2">{getDay(r.date)}</td>
                          <td className="font-mono text-[13px] font-semibold text-right py-2 whitespace-nowrap">
                            {r.adjusted && (
                              <span className="text-[11px] text-muted font-normal line-through mr-1.5">{r.originalMinutes}</span>
                            )}
                            {waived ? (
                              <span className="inline-block text-[10.5px] font-medium font-sans px-1.5 py-0.5 rounded-[3px] bg-amber/10 text-amber-dark">Waived</span>
                            ) : (
                              <span className="text-nte-red">
                                {r.lateMinutes} <span className="text-[10px] text-muted font-normal">min</span>
                              </span>
                            )}
                          </td>
                          {isAdmin && (
                            <td className="py-2 text-right">
                              <button
                                type="button"
                                onClick={() => setEditingDate(editing ? null : r.date)}
                                className="text-[11px] text-app-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-blue/40 rounded-[3px] px-1"
                              >
                                {editing ? 'Close' : r.adjusted ? 'Edit' : 'Adjust'}
                              </button>
                            </td>
                          )}
                        </tr>
                        {r.adjusted && !editing && (
                          <tr className="border-b border-row-border">
                            <td colSpan={isAdmin ? 4 : 3} className="pb-2 text-[11px] text-muted">
                              {r.reason}{r.adjustedBy && <span className="text-muted/70"> · {r.adjustedBy}</span>}
                            </td>
                          </tr>
                        )}
                        {editing && employee && (
                          <tr className="border-b border-row-border">
                            <td colSpan={4} className="pb-3">
                              <LateAdjustForm
                                employeeId={employee.employeeId}
                                date={r.date}
                                originalMinutes={r.originalMinutes}
                                adjusted={r.adjusted}
                                currentMinutes={r.lateMinutes}
                                currentReason={r.reason}
                                onDone={handleAdjusted}
                                onCancel={() => setEditingDate(null)}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
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
