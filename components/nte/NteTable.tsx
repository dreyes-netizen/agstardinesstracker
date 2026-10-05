'use client';

import { useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { EmployeeDrawer } from '@/components/dashboard/EmployeeDrawer';
import { issueNteAction, acknowledgeNteAction } from '@/app/nte/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmployeeStats } from '@/lib/queries/attendance';
import { NteStatus } from '@/lib/utils/nte-status';
import { formatDate } from '@/lib/utils/date';
import { formatPeriod } from '@/lib/utils/week';

interface NteRow {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  middle_name: string | null;
  department: string | null;
  immediate_supervisor: string | null;
  approver2: string | null;
  period_start: string;
  period_end: string;
  status: string;
  issued_date: string | null;
  issued_by: string | null;
  notes: string | null;
  acknowledged_date: string | null;
  late_count: number;
  accumulated_minutes: number;
  mtd_lates: number;
  mtd_minutes: number;
}

const fmtDate = formatDate;

function rowToStats(row: NteRow): EmployeeStats {
  return {
    employeeId: row.employee_id,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    department: row.department,
    immediateSupervisor: row.immediate_supervisor,
    approver2: row.approver2,
    lateCount: row.late_count,
    accumulatedMinutes: row.accumulated_minutes,
    mtdLates: row.mtd_lates,
    mtdMinutes: row.mtd_minutes,
    nteStatus: row.status as NteStatus,
    ntes: [{
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status as 'required' | 'issued' | 'acknowledged',
      issuedDate: row.issued_date,
      issuedBy: row.issued_by,
      notes: row.notes,
      acknowledgedDate: row.acknowledged_date,
    }],
  };
}

export function NteTable({ rows, isAdmin }: { rows: NteRow[]; isAdmin: boolean }) {
  const router = useRouter();
  const [issueFormId, setIssueFormId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [issueLoading, setIssueLoading] = useState(false);
  const [ackLoadingId, setAckLoadingId] = useState<number | null>(null);
  const [selected, setSelected] = useState<NteRow | null>(null);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const fullName = `${r.last_name} ${r.first_name} ${r.middle_name ?? ''}`.toLowerCase();
      const altName = `${r.first_name} ${r.last_name}`.toLowerCase();
      return fullName.includes(q) || altName.includes(q) || r.employee_id.toLowerCase().includes(q);
    });
  }, [rows, search]);

  async function handleIssue(e: React.FormEvent, row: NteRow) {
    e.preventDefault();
    setIssueLoading(true);
    await issueNteAction(row.employee_id, row.period_start, row.period_end, notes);
    setIssueFormId(null);
    setNotes('');
    setIssueLoading(false);
    router.refresh();
  }

  async function handleAcknowledge(row: NteRow) {
    setAckLoadingId(row.id);
    await acknowledgeNteAction(row.employee_id, row.period_start, row.period_end);
    setAckLoadingId(null);
    router.refresh();
  }

  return (
    <>
      <div className="bg-white border border-border rounded-[7px] overflow-clip flex flex-col flex-1 min-h-0">
        <div className="px-5 py-3 border-b border-border flex items-center gap-3 flex-shrink-0">
          <span className="text-[13.5px] font-semibold text-app-text flex-shrink-0">NTE Records</span>
          <div className="flex-1 relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              type="search"
              aria-label="Search NTE records by name or ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or ID…"
              className="w-full pl-8 pr-3 py-1.5 text-[12.5px] bg-ground border border-border rounded-[5px] focus:outline-none focus:ring-2 focus:ring-app-blue/40 placeholder:text-muted"
            />
          </div>
          <span className="text-[11.5px] text-muted flex-shrink-0">
            {filtered.length}{search ? ` of ${rows.length}` : ''} records
          </span>
        </div>
        <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-ground">
            <tr className="border-b border-border">
              {[
                { h: 'Employee', extra: '' },
                { h: 'Period', extra: '' },
                { h: 'Department', extra: ' hidden md:table-cell' },
                { h: 'Supervisor', extra: ' hidden md:table-cell' },
                { h: 'Lates', extra: ' hidden md:table-cell' },
                { h: 'Late Min', extra: ' hidden md:table-cell' },
                { h: 'Month to Date', extra: ' hidden lg:table-cell' },
                { h: 'Status', extra: '' },
                { h: 'Issued By / Action', extra: '' },
              ].map(({ h, extra }) => (
                <th key={h} className={`px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted first:pl-5${extra}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row) => (
              <Fragment key={row.id}>
                <tr className={`border-b border-row-border hover:bg-row-alt ${row.status === 'acknowledged' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3 first:pl-5">
                    <button
                      onClick={() => setSelected(row)}
                      className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-blue rounded-[2px]"
                    >
                      <div className="font-medium text-[13px] text-app-text">{row.last_name}, {row.first_name}</div>
                      <div className="font-mono text-[11px] text-muted">{row.employee_id}</div>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-app-text whitespace-nowrap">
                  {formatPeriod(row.period_start, row.period_end)}
                </td>
                  <td className="px-4 py-3 text-[12px] text-muted hidden md:table-cell">{row.department ?? '—'}</td>
                  <td className="px-4 py-3 text-[12px] text-muted hidden md:table-cell">{row.immediate_supervisor ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-[13px] text-right whitespace-nowrap hidden md:table-cell">{row.late_count} <span className="text-[10px] text-muted">×</span></td>
                  <td className="px-4 py-3 font-mono text-[13px] text-right whitespace-nowrap hidden md:table-cell">{row.accumulated_minutes} <span className="text-[10px] text-muted">min</span></td>
                  <td className="px-4 py-3 font-mono text-[12px] text-muted text-right whitespace-nowrap hidden lg:table-cell">{row.mtd_lates}<span className="text-[10px]">×</span> · {row.mtd_minutes}<span className="text-[10px]"> min</span></td>
                  <td className="px-4 py-3"><StatusBadge status={row.status as 'required' | 'issued' | 'acknowledged'} /></td>
                  <td className="px-4 py-3 pr-5">
                    {row.status === 'required' && !isAdmin && (
                      <span className="text-[11px] text-muted">Awaiting admin</span>
                    )}
                    {row.status === 'required' && isAdmin && (
                      <Button size="sm" variant="outline" className="text-[11px] border-nte-red/30 text-nte-red hover:bg-nte-red/5 h-7 px-3" onClick={() => setIssueFormId(row.id)}>
                        Issue NTE
                      </Button>
                    )}
                    {row.status === 'issued' && (
                      <div className="space-y-1.5">
                        <div className="text-[11px] text-muted leading-snug">
                          Issued <span className="font-medium text-app-text">{fmtDate(row.issued_date)}</span>
                          {row.issued_by && <> by <span className="font-medium text-app-text">{row.issued_by}</span></>}
                        </div>
                        {row.notes && <div className="text-[11px] text-muted italic">&ldquo;{row.notes}&rdquo;</div>}
                        {isAdmin && <Button size="sm" variant="outline" disabled={ackLoadingId === row.id} className="text-[11px] border-safe-green/30 text-safe-green hover:bg-safe-green/5 h-7 px-3" onClick={() => handleAcknowledge(row)}>
                          {ackLoadingId === row.id ? 'Saving…' : 'Mark Acknowledged'}
                        </Button>}
                      </div>
                    )}
                    {row.status === 'acknowledged' && (
                      <div className="space-y-0.5">
                        <div className="text-[11px] text-muted leading-snug">
                          Issued <span className="font-medium text-app-text">{fmtDate(row.issued_date)}</span>
                          {row.issued_by && <> by <span className="font-medium text-app-text">{row.issued_by}</span></>}
                        </div>
                        <div className="text-[11px] text-safe-green font-medium">
                          Acknowledged {fmtDate(row.acknowledged_date)}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
                {issueFormId === row.id && (
                  <tr className="bg-nte-red/5 border-b border-nte-red/10">
                    <td colSpan={9} className="px-5 py-3">
                      <form onSubmit={(e) => handleIssue(e, row)} className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] text-muted">Notes:</span>
                          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="h-7 text-[12.5px] bg-white w-52" />
                        </div>
                        <Button type="submit" disabled={issueLoading} size="sm" className="bg-nte-red hover:bg-nte-red/90 text-white h-7 text-[11px] px-3">
                          {issueLoading ? 'Saving…' : 'Confirm'}
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setIssueFormId(null)}>Cancel</Button>
                      </form>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-muted text-[13px]">
                {rows.length === 0 ? 'No NTE records for this period.' : 'No records match your search.'}
              </td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>

      <EmployeeDrawer
        employee={selected ? rowToStats(selected) : null}
        periodStart={selected?.period_start ?? ''}
        periodEnd={selected?.period_end ?? ''}
        isAdmin={isAdmin}
        onClose={() => setSelected(null)}
        onNteAction={() => setSelected(null)}
      />
    </>
  );
}
