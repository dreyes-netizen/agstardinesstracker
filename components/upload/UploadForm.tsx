'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface UploadResult {
  success: boolean;
  attendanceSummary?: { period: string; employees: number; records: number };
  rosterSummary?: { employees: number; removed: number };
  error?: string;
}

export function UploadForm() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);
    const attendance = formData.get('attendance') as File | null;
    const roster = formData.get('roster') as File | null;

    if ((!attendance || attendance.size === 0) && (!roster || roster.size === 0)) {
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
      <div className="space-y-2">
        <Label htmlFor="roster" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
          Employee Roster (.xls)
        </Label>
        <input
          id="roster"
          name="roster"
          type="file"
          accept=".xls,.xlsx"
          className="block w-full text-[13px] text-app-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-navy file:text-white hover:file:bg-navy/90 cursor-pointer"
        />
        <p className="text-[11.5px] text-muted">
          Replaces the employee list. Agents not in the file will be removed along with their records. File from Sprout: <span className="font-medium text-app-text">Employee List Report</span>.
        </p>
        <div className="mt-2">
          <p className="text-[11px] font-semibold text-muted uppercase tracking-[0.06em] mb-1.5">Required columns</p>
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
              <span key={label} className="inline-flex items-center gap-1 bg-ground border border-border rounded-[4px] px-2 py-0.5 text-[11px] text-app-text font-mono">
                {label}
                {note && <span className="text-muted font-sans">· {note}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="attendance" className="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted">
          Attendance Report (.xlsx)
        </Label>
        <input
          id="attendance"
          name="attendance"
          type="file"
          accept=".xls,.xlsx"
          className="block w-full text-[13px] text-app-text file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-[12px] file:font-semibold file:bg-navy file:text-white hover:file:bg-navy/90 cursor-pointer"
        />
        <p className="text-[11.5px] text-muted">
          Upload to replace attendance records for the detected period. File from Sprout: Attendance Report (Detailed sheet).
        </p>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="bg-navy hover:bg-navy/90 text-white px-6"
      >
        {loading ? 'Uploading…' : 'Upload Files'}
      </Button>

      {result && (
        <div
          ref={resultRef}
          className={`rounded-[6px] border-2 p-4 text-[13px] ${
            result.success
              ? 'border-safe-green bg-safe-green text-white'
              : 'border-nte-red bg-nte-red text-white'
          }`}
        >
          {result.success ? (
            <div className="space-y-1">
              <p className="font-bold text-[14px]">Upload complete</p>
              {result.rosterSummary && (
                <p>
                  Roster: {result.rosterSummary.employees} employees updated
                  {result.rosterSummary.removed > 0 && `, ${result.rosterSummary.removed} removed`}
                </p>
              )}
              {result.attendanceSummary && (
                <p>
                  Attendance: {result.attendanceSummary.records} records imported for{' '}
                  {result.attendanceSummary.employees} employees ({result.attendanceSummary.period})
                </p>
              )}
            </div>
          ) : (
            <p><span className="font-bold">Error:</span> {result.error}</p>
          )}
        </div>
      )}
    </form>
  );
}
