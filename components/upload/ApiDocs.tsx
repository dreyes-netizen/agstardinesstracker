'use client';

import { useState } from 'react';

function Code({ children }: { children: string }) {
  return (
    <code className="bg-ground border border-border rounded-[4px] px-1.5 py-0.5 font-mono text-[11.5px] text-app-text">
      {children}
    </code>
  );
}

function FieldRow({ name, type, required, children }: { name: string; type: string; required?: boolean; children: React.ReactNode }) {
  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2.5 pr-4 align-top">
        <span className="font-mono text-[11.5px] text-app-text">{name}</span>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <span className="font-mono text-[11px] text-muted">{type}</span>
      </td>
      <td className="py-2.5 pr-4 align-top">
        <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] ${required ? 'bg-nte-red/10 text-nte-red' : 'bg-ground text-muted border border-border'}`}>
          {required ? 'required*' : 'optional'}
        </span>
      </td>
      <td className="py-2.5 align-top text-[12px] text-muted leading-relaxed">{children}</td>
    </tr>
  );
}

const successExample = `{
  "success": true,
  "attendanceSummary": {
    "period": "2026-04-01 to 2026-04-15",
    "employees": 120,
    "records": 540
  },
  "rosterSummary": {
    "employees": 130,
    "removed": 5
  }
}`;

const errorExample = `{
  "success": false,
  "error": "Failed to parse attendance sheet"
}`;

const curlExample = `curl -X POST https://your-domain.com/api/upload \\
  -F "roster=@EmployeeListReport.xlsx" \\
  -F "attendance=@AttendanceReport.xlsx"`;

export function ApiDocs() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'curl'>('overview');

  return (
    <div className="border border-border rounded-[7px] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-ground hover:bg-border/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted flex-shrink-0">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          <span className="text-[12.5px] font-semibold text-app-text">API Reference</span>
          <span className="text-[11px] text-muted font-mono">POST /api/upload</span>
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          className={`text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div className="border-t border-border bg-white">
          {/* Endpoint header */}
          <div className="px-5 py-4 border-b border-border flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center px-2 py-0.5 rounded-[4px] bg-app-blue/10 text-app-blue text-[11px] font-bold font-mono tracking-wide">
              POST
            </span>
            <Code>/api/upload</Code>
            <span className="text-[11.5px] text-muted">Accepts one or both files per request. At least one file must be provided.</span>
          </div>

          {/* Tabs */}
          <div className="px-5 pt-4 flex gap-1 border-b border-border">
            {(['overview', 'curl'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-[11.5px] font-medium rounded-t-[4px] -mb-px border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-app-blue text-app-blue'
                    : 'border-transparent text-muted hover:text-app-text'
                }`}
              >
                {tab === 'overview' ? 'Overview' : 'cURL Example'}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="px-5 py-4 space-y-5">
              {/* Request */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted mb-3">Request</p>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[12px] text-muted">Content-Type:</span>
                  <Code>multipart/form-data</Code>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-t border-border">
                    <thead>
                      <tr className="border-b border-border">
                        {['Field', 'Type', '', 'Description'].map((h) => (
                          <th key={h} className="py-2 pr-4 text-[10px] font-mono uppercase tracking-[0.08em] text-muted">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <FieldRow name="roster" type="File">Sprout Employee List Report (.xls / .xlsx). Replaces the full roster — employees not present in the file are removed along with their attendance and NTE records.</FieldRow>
                      <FieldRow name="attendance" type="File">Sprout Attendance Report, Detailed sheet (.xlsx). Replaces all records for the detected pay period and triggers NTE status sync for affected months.</FieldRow>
                    </tbody>
                  </table>
                </div>
                <p className="text-[11px] text-muted mt-2">* At least one field must be a non-empty file.</p>
              </section>

              {/* Responses */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted mb-3">Responses</p>
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-safe-green/10 text-safe-green text-[10.5px] font-bold font-mono">200</span>
                      <span className="text-[12px] text-muted">Success — fields present only when the corresponding file was uploaded</span>
                    </div>
                    <pre className="bg-ground border border-border rounded-[5px] p-3 text-[11.5px] font-mono text-app-text overflow-x-auto leading-relaxed">{successExample}</pre>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-[3px] bg-nte-red/10 text-nte-red text-[10.5px] font-bold font-mono">500</span>
                      <span className="text-[12px] text-muted">Parse or database error</span>
                    </div>
                    <pre className="bg-ground border border-border rounded-[5px] p-3 text-[11.5px] font-mono text-app-text overflow-x-auto leading-relaxed">{errorExample}</pre>
                  </div>
                </div>
              </section>

              {/* Behavior notes */}
              <section>
                <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted mb-2">Behavior notes</p>
                <ul className="space-y-1.5">
                  {[
                    'Roster and attendance can be sent together or independently in a single request.',
                    'Roster upload removes any employee not in the uploaded file, including their attendance and NTE records.',
                    'Attendance upload auto-detects the pay period from the file and replaces only that period\'s records.',
                    'After attendance import, NTE status is automatically synced for all months that fall within the detected period.',
                    'New employee IDs found in the attendance file but absent from the roster are added as stub records.',
                  ].map((note, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-muted">
                      <span className="mt-[3px] flex-shrink-0 w-1 h-1 rounded-full bg-border inline-block" />
                      {note}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          )}

          {activeTab === 'curl' && (
            <div className="px-5 py-4">
              <p className="text-[12px] text-muted mb-3">Replace the filename and domain with your actual values.</p>
              <pre className="bg-ground border border-border rounded-[5px] p-4 text-[11.5px] font-mono text-app-text overflow-x-auto leading-relaxed whitespace-pre">{curlExample}</pre>
              <p className="text-[11.5px] text-muted mt-3">Both <Code>-F</Code> flags are optional — omit either to skip that upload type.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
