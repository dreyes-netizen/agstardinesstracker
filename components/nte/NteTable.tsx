'use client';

import { useState } from 'react';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { issueNteAction, acknowledgeNteAction } from '@/app/nte/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface NteRow {
  id: number;
  employee_id: string;
  first_name: string;
  last_name: string;
  department: string | null;
  immediate_supervisor: string | null;
  month: string;
  status: string;
  issued_date: string | null;
  issued_by: string | null;
  late_count: number;
  accumulated_minutes: number;
}

export function NteTable({ rows }: { rows: NteRow[] }) {
  const [issueForm, setIssueForm] = useState<{ employeeId: string; month: string } | null>(null);
  const [issuedBy, setIssuedBy] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleIssue(e: React.FormEvent) {
    e.preventDefault();
    if (!issueForm) return;
    setLoading(true);
    await issueNteAction(issueForm.employeeId, issueForm.month, issuedBy, '');
    setIssueForm(null);
    setIssuedBy('');
    setLoading(false);
  }

  async function handleAcknowledge(employeeId: string, month: string) {
    setLoading(true);
    await acknowledgeNteAction(employeeId, month);
    setLoading(false);
  }

  return (
    <div className="bg-white border border-border rounded-[7px] overflow-hidden">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-ground border-b border-border">
            {['Employee', 'Month', 'Department', 'Supervisor', 'Late Count', 'Accum. Min', 'Status', 'Action'].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] tracking-[0.09em] uppercase text-muted first:pl-5">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <>
              <tr key={`${row.employee_id}-${row.month}`} className="border-b border-[#EEF1F4] hover:bg-[#F6F8FA]">
                <td className="px-4 py-3 first:pl-5">
                  <div className="font-medium text-[13px]">{row.last_name}, {row.first_name}</div>
                  <div className="font-mono text-[11px] text-muted">{row.employee_id}</div>
                </td>
                <td className="px-4 py-3 font-mono text-[12px]">{row.month}</td>
                <td className="px-4 py-3 text-[12px] text-muted">{row.department ?? '—'}</td>
                <td className="px-4 py-3 text-[12px] text-muted">{row.immediate_supervisor ?? '—'}</td>
                <td className="px-4 py-3 font-mono text-[13px] text-right">{row.late_count} <span className="text-[10px] text-muted">×</span></td>
                <td className="px-4 py-3 font-mono text-[13px] text-right">{row.accumulated_minutes} <span className="text-[10px] text-muted">min</span></td>
                <td className="px-4 py-3"><StatusBadge status={row.status as 'required' | 'issued'} /></td>
                <td className="px-4 py-3 pr-5">
                  {row.status === 'required' && (
                    <Button size="sm" variant="outline" className="text-[11px] border-nte-red/30 text-nte-red hover:bg-nte-red/5 h-7 px-3" onClick={() => setIssueForm({ employeeId: row.employee_id, month: row.month })}>
                      Issue NTE
                    </Button>
                  )}
                  {row.status === 'issued' && (
                    <Button size="sm" variant="outline" disabled={loading} className="text-[11px] border-safe-green/30 text-safe-green hover:bg-safe-green/5 h-7 px-3" onClick={() => handleAcknowledge(row.employee_id, row.month)}>
                      Mark Acknowledged
                    </Button>
                  )}
                </td>
              </tr>
              {issueForm?.employeeId === row.employee_id && issueForm?.month === row.month && (
                <tr key={`${row.employee_id}-${row.month}-form`} className="bg-[#FFF8F5] border-b border-nte-red/10">
                  <td colSpan={8} className="px-5 py-3">
                    <form onSubmit={handleIssue} className="flex items-center gap-3">
                      <span className="text-[12px] text-muted">Issued by:</span>
                      <Input value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="Your name" required className="h-7 text-[12.5px] bg-white w-52" />
                      <Button type="submit" disabled={loading} size="sm" className="bg-nte-red hover:bg-nte-red/90 text-white h-7 text-[11px] px-3">
                        {loading ? 'Saving…' : 'Confirm'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setIssueForm(null)}>Cancel</Button>
                    </form>
                  </td>
                </tr>
              )}
            </>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={8} className="text-center py-12 text-muted text-[13px]">No pending NTEs. All employees are within threshold.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
