'use client';

import { useState, useRef } from 'react';
import { Users, Clock, CalendarDays, CheckCircle2, AlertCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface UploadResult {
  success: boolean;
  attendanceSummary?: { period: string; employees: number; records: number; skipped?: number };
  rosterSummary?: { employees: number; removed: number };
  leaveSummary?: { period: string; records: number };
  error?: string;
}

function UploadField({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3.5">
      <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-[6px] bg-ground border border-border flex items-center justify-center">
        <Icon className="w-4 h-4 text-navy" aria-hidden="true" />
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <label htmlFor={id} className="block text-[13px] font-semibold text-app-text">
          {title}
        </label>
        {children}
      </div>
    </div>
  );
}

const FILE_INPUT =
  'block w-full text-[13px] text-app-text file:mr-3 file:py-1.5 file:px-3.5 file:rounded-[5px] file:border-0 file:text-[12px] file:font-semibold file:bg-navy file:text-white hover:file:bg-navy/90 file:cursor-pointer cursor-pointer';

export function UploadForm() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const attendance = formData.get('attendance') as File | null;
    const roster = formData.get('roster') as File | null;
    const leave = formData.get('leave') as File | null;

    if (
      (!attendance || attendance.size === 0) &&
      (!roster || roster.size === 0) &&
      (!leave || leave.size === 0)
    ) {
      setResult({ success: false, error: 'Please select at least one file before uploading.' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data: UploadResult = await res.json();
      setResult(data);
    } catch {
      setResult({ success: false, error: 'Network error — please try again.' });
    } finally {
      setLoading(false);
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Roster */}
      <UploadField id="roster" icon={Users} title="Employee Roster">
        <input id="roster" name="roster" type="file" accept=".xls,.xlsx" className={FILE_INPUT} />
        <p className="text-[11.5px] text-muted leading-relaxed">
          Replaces the employee list. Agents not in the file will be removed along with their
          records. File from Sprout: <span className="font-medium text-app-text">Employee List Report</span>.
          Employees missing from this file will have their schedule skipped when a new attendance
          report is uploaded — keep the roster up to date before uploading a new attendance report.
        </p>
        <div>
          <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em] mb-1.5">
            Required columns
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'Employee ID', note: 'e.g. ID Number' },
              { label: 'Last Name' },
              { label: 'First Name' },
              { label: 'Middle Name' },
              { label: 'Department' },
              { label: 'Immediate Supervisor' },
              { label: 'Approver 2', note: 'or Manager' },
              { label: 'Hire Date', note: 'optional' },
            ].map(({ label, note }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 bg-ground border border-border rounded-[4px] px-2 py-0.5 text-[11px] text-app-text font-mono"
              >
                {label}
                {note && <span className="text-muted font-sans">· {note}</span>}
              </span>
            ))}
          </div>
        </div>
      </UploadField>

      <div className="border-t border-border" />

      {/* Attendance */}
      <UploadField id="attendance" icon={Clock} title="Attendance Report">
        <input id="attendance" name="attendance" type="file" accept=".xls,.xlsx" className={FILE_INPUT} />
        <p className="text-[11.5px] text-muted leading-relaxed">
          Upload to replace attendance records for the detected period. File from Sprout: Attendance
          Report (Detailed sheet).
        </p>
      </UploadField>

      <div className="border-t border-border" />

      {/* Leave */}
      <UploadField id="leave" icon={CalendarDays} title="Leave Report">
        <input id="leave" name="leave" type="file" accept=".xls,.xlsx" className={FILE_INPUT} />
        <p className="text-[11.5px] text-muted leading-relaxed">
          Feeds the Attendance Score (approved sick leave) and the Leave Report view. File from
          Sprout: <span className="font-medium text-app-text">Leave Report</span> (LEAVE
          TRANSACTIONS REPORT sheet). Re-uploading overlapping weeks is safe — duplicates are
          merged. Please include the previous cutoff as well even if it already has a record, to
          catch leave that was filed late.
        </p>
      </UploadField>

      <div className="border-t border-border" />

      <Button type="submit" disabled={loading} className="bg-navy hover:bg-navy/90 text-white px-6">
        {loading ? 'Uploading…' : 'Upload Files'}
      </Button>

      {result && (
        <div
          ref={resultRef}
          className={`flex gap-2.5 rounded-[6px] border p-4 text-[13px] ${
            result.success
              ? 'border-safe-green/40 bg-safe-green/5 text-app-text'
              : 'border-nte-red/40 bg-nte-red/5 text-app-text'
          }`}
        >
          {result.success ? (
            <CheckCircle2 className="w-[18px] h-[18px] text-safe-green flex-shrink-0 mt-px" aria-hidden="true" />
          ) : (
            <AlertCircle className="w-[18px] h-[18px] text-nte-red flex-shrink-0 mt-px" aria-hidden="true" />
          )}
          {result.success ? (
            <div className="space-y-1">
              <p className="font-semibold">Upload complete</p>
              {result.rosterSummary && (
                <p className="text-muted">
                  Roster: {result.rosterSummary.employees} employees updated
                  {result.rosterSummary.removed > 0 && `, ${result.rosterSummary.removed} removed`}
                </p>
              )}
              {result.attendanceSummary && (
                <p className="text-muted">
                  Attendance: {result.attendanceSummary.records} records imported for{' '}
                  {result.attendanceSummary.employees} employees ({result.attendanceSummary.period})
                  {result.attendanceSummary.skipped != null &&
                    result.attendanceSummary.skipped > 0 &&
                    ` — ${result.attendanceSummary.skipped} records skipped (not in roster)`}
                </p>
              )}
              {result.leaveSummary && (
                <p className="text-muted">
                  Leave: {result.leaveSummary.records} transactions imported ({result.leaveSummary.period})
                </p>
              )}
            </div>
          ) : (
            <p>
              <span className="font-semibold">Error:</span> {result.error}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
