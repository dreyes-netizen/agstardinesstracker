'use client';

import { useState, useRef } from 'react';
import { uploadFiles, UploadResult } from '@/app/upload/actions';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function UploadForm() {
  const [result, setResult] = useState<UploadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    const res = await uploadFiles(formData);
    setResult(res);
    setLoading(false);
    if (res.success) formRef.current?.reset();
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
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
          Replaces the employee list. Agents not in the file will be removed along with their records. File from Sprout: Employee List Report.
        </p>
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
        <div className={`rounded-[5px] border p-4 text-[13px] ${result.success ? 'border-safe-green/30 bg-safe-green/[0.06] text-safe-green' : 'border-nte-red/30 bg-nte-red/[0.06] text-nte-red'}`}>
          {result.success ? (
            <div className="space-y-1">
              <p className="font-semibold">Upload complete</p>
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
            <p><span className="font-semibold">Error:</span> {result.error}</p>
          )}
        </div>
      )}
    </form>
  );
}
